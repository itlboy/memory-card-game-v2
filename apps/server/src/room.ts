import { DurableObject } from 'cloudflare:workers';
import {
  DEFAULT_ROOM_CONFIG, GRIDS, MemoryGame, QUICK_EMOJIS, ROOM_LIMITS,
  presetConfig, publicEvents, publicPlayer, publicView, seedFrom
} from '@mm/engine';
import type {
  ClientMsg, GameEvent, QuickEmoji, RoomConfig, RoomInfo, ServerMsg
} from '@mm/engine';
import { THEME_SYMBOLS } from './themes.js';

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
}

interface RoomPlayer {
  id: string;
  name: string;
  avatar?: string;
  /** Bí mật để vào lại sau khi rớt mạng (ON-07). */
  token: string;
  /** Hạn chót vào lại; null = đang kết nối. */
  disconnectedAt: number | null;
}

interface RoomState {
  code: string;
  hostId: string;
  config: RoomConfig;
  players: RoomPlayer[];
  status: 'lobby' | 'playing' | 'ended';
}

/** Socket nào thuộc người chơi nào — sống sót qua hibernation nhờ attachment. */
interface Attachment { playerId: string }

const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/**
 * Một phòng chơi = một Durable Object (ON-01…ON-09).
 *
 * Server-authoritative: engine chạy TẠI ĐÂY, client chỉ gửi {t:'flip', index}.
 * WebSocket Hibernation giữ phòng rẻ khi không ai thao tác; trạng thái phòng
 * và snapshot engine nằm trong storage nên DO bị evict vẫn khôi phục được.
 */
export class RoomDO extends DurableObject<Env> {
  private room: RoomState | null = null;
  private game: MemoryGame | null = null;

  /* ---------- nạp / lưu ---------- */

  private async load(): Promise<void> {
    if (this.room) return;
    this.room = (await this.ctx.storage.get<RoomState>('room')) ?? null;
    const snap = await this.ctx.storage.get<string>('game');
    if (snap) this.game = MemoryGame.restore(snap);
  }

  private async save(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
    if (this.game) await this.ctx.storage.put('game', this.game.snapshot());
  }

  /* ---------- kết nối ---------- */

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket only', { status: 426 });
    }
    await this.load();

    const url = new URL(request.url);
    const code = url.searchParams.get('code') ?? '';
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 16);
    const token = url.searchParams.get('token') ?? '';

    this.room ??= {
      code, hostId: '', config: { ...DEFAULT_ROOM_CONFIG }, players: [], status: 'lobby'
    };

    // Vào lại bằng token (ON-07) hay người chơi mới?
    let player = token ? this.room.players.find((p) => p.token === token) : undefined;
    if (!player) {
      if (!name) return new Response('Thiếu tên', { status: 400 });
      // Ván đã bắt đầu / phòng đầy: vào làm KHÁN GIẢ — chỉ xem, không thao tác
      if (this.room.status !== 'lobby' || this.room.players.length >= ROOM_LIMITS.maxPlayers) {
        return this.acceptSpectator();
      }
      player = {
        id: crypto.randomUUID().slice(0, 8),
        name,
        avatar: AVATARS[this.room.players.length % AVATARS.length],
        token: crypto.randomUUID(),
        disconnectedAt: null
      };
      this.room.players.push(player);
      if (!this.room.hostId) this.room.hostId = player.id;
    } else {
      player.disconnectedAt = null;
      if (name) player.name = name;
    }

    // Đóng socket cũ của cùng người chơi (mở tab mới / reconnect nhanh)
    for (const ws of this.ctx.getWebSockets(player.id)) ws.close(4000, 'replaced');

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [player.id]);
    pair[1].serializeAttachment({ playerId: player.id } satisfies Attachment);

    await this.save();
    this.send(pair[1], {
      t: 'welcome', playerId: player.id, token: player.token, room: this.roomInfo()
    });
    this.broadcast({ t: 'room', room: this.roomInfo() }, player.id);
    if (this.game) this.send(pair[1], { t: 'state', view: this.view() });
    await this.scheduleNext();

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** Khán giả: nhận mọi broadcast nhưng không có mặt trong danh sách người chơi. */
  private acceptSpectator(): Response {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], ['spectator']);
    pair[1].serializeAttachment({ playerId: '' } satisfies Attachment);
    this.send(pair[1], {
      t: 'welcome', playerId: '', token: '', spectator: true, room: this.roomInfo()
    });
    if (this.game) this.send(pair[1], { t: 'state', view: this.view() });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;   // khán giả (playerId rỗng) không được gửi hành động

    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMsg;
    } catch { return; }

    switch (msg.t) {
      case 'ping':
        this.send(ws, { t: 'pong' });
        return;

      case 'config': {
        // ON-03: chỉ chủ phòng chỉnh cấu hình, và chỉ khi còn ở lobby
        if (player.id !== this.room.hostId || this.room.status !== 'lobby') return;
        const c = msg.config;
        if (c.grid && GRIDS[c.grid]) this.room.config.grid = c.grid;
        if (c.mode === 'classic' || c.mode === 'survival') this.room.config.mode = c.mode;
        if (Array.isArray(c.themeIds)) {
          const valid = [...new Set(c.themeIds)].filter((id) => THEME_SYMBOLS[id]);
          if (valid.length) this.room.config.themeIds = valid;
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        return;
      }

      case 'start':
      case 'again': {
        if (player.id !== this.room.hostId) return;
        if (msg.t === 'start' && this.room.status !== 'lobby') return;
        if (msg.t === 'again' && this.room.status !== 'ended') return;
        if (this.room.players.length < ROOM_LIMITS.minPlayers) {
          this.send(ws, { t: 'error', code: 'not-enough', message: 'Cần ít nhất 2 người chơi' });
          return;
        }
        this.startGame();
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        this.broadcast({ t: 'state', view: this.view() });
        await this.scheduleNext();
        return;
      }

      case 'flip': {
        if (!this.game || this.room.status !== 'playing') return;
        // ON-09: server phán quyết — sai lượt thì bỏ qua, không tin client
        if (this.game.current.id !== player.id) return;
        const events = this.game.flip(Number(msg.index), Date.now());
        if (!events.length) return;
        await this.afterEvents(events);
        return;
      }

      case 'leave': {
        // Đầu hàng giữa ván: xử thua ngay, không chờ hạn 30 giây
        if (this.room.status === 'playing' && this.game && !this.game.finished) {
          player.disconnectedAt = null;
          const events = this.game.forfeit(player.id, Date.now());
          await this.afterEvents(events);
        } else if (this.room.status === 'lobby') {
          this.room.players = this.room.players.filter((p) => p.id !== player.id);
          if (this.room.hostId === player.id) this.room.hostId = this.room.players[0]?.id ?? '';
        }
        for (const sock of this.ctx.getWebSockets(player.id)) sock.close(4001, 'left');
        if (!this.room.players.length) {
          await this.ctx.storage.deleteAll();
          this.room = null;
          this.game = null;
          return;
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        await this.scheduleNext();
        return;
      }

      case 'cancel': {
        // Huỷ phòng: chỉ chủ phòng; mọi người bị đưa ra ngoài
        if (player.id !== this.room.hostId) return;
        this.broadcast({ t: 'closed', message: 'Chủ phòng đã huỷ phòng.' });
        for (const sock of this.ctx.getWebSockets()) sock.close(4002, 'room-cancelled');
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.room = null;
        this.game = null;
        return;
      }

      case 'emoji': {
        if (!(QUICK_EMOJIS as readonly string[]).includes(msg.emoji)) return;   // ON-08: danh sách đóng
        this.broadcast({ t: 'emoji', from: player.id, emoji: msg.emoji as QuickEmoji });
        return;
      }
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;
    // Socket khác của cùng người còn sống thì không tính là rớt mạng
    if (this.ctx.getWebSockets(player.id).some((s) => s !== ws)) return;

    if (this.room.status === 'lobby') {
      // Ở lobby thì rời phòng luôn
      this.room.players = this.room.players.filter((p) => p.id !== player.id);
      if (this.room.hostId === player.id) this.room.hostId = this.room.players[0]?.id ?? '';
      if (!this.room.players.length) {
        await this.ctx.storage.deleteAll();
        this.room = null;
        this.game = null;
        return;
      }
    } else {
      player.disconnectedAt = Date.now();   // ON-07: 30 giây để vào lại
    }
    await this.save();
    this.broadcast({ t: 'room', room: this.roomInfo() });
    await this.scheduleNext();
  }

  /* ---------- đồng hồ của phòng ---------- */

  override async alarm(): Promise<void> {
    await this.load();
    if (!this.room) return;
    const now = Date.now();

    // Xử thua người rớt mạng quá hạn (ON-07)
    if (this.game && this.room.status === 'playing') {
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null && now - p.disconnectedAt >= ROOM_LIMITS.reconnectMs) {
          p.disconnectedAt = null;
          const events = this.game.forfeit(p.id, now);
          await this.afterEvents(events, false);
        }
      }
      // Úp lại thẻ sai / hết giờ
      const events = this.game.tick(now);
      if (events.length) await this.afterEvents(events, false);
    }

    await this.save();
    await this.scheduleNext();
  }

  /** Một alarm duy nhất = mốc gần nhất trong: úp thẻ, hạn vào lại, hết giờ. */
  private async scheduleNext(): Promise<void> {
    const marks: number[] = [];
    const now = Date.now();
    if (this.room?.status === 'playing' && this.game && !this.game.finished) {
      if (this.game.locked) marks.push(now + (this.game.config.flipBackMs ?? 1000));
      // Đồng hồ 30 giây mỗi lượt: hết hạn thì alarm đánh thức để chuyển lượt
      if (this.game.turnDeadline) marks.push(this.game.turnDeadline + 50);
      const left = this.game.timeLeft(now);
      if (left !== null) marks.push(now + left * 1000 + 50);
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null) marks.push(p.disconnectedAt + ROOM_LIMITS.reconnectMs);
      }
    }
    if (marks.length) await this.ctx.storage.setAlarm(Math.min(...marks));
    else await this.ctx.storage.deleteAlarm();
  }

  /* ---------- trợ giúp ---------- */

  private startGame(): void {
    const room = this.room!;
    // Trộn biểu tượng của mọi theme đã chọn (loại trùng)
    const symbols = [...new Set(
      room.config.themeIds.flatMap((id) => THEME_SYMBOLS[id] ?? [])
    )];
    if (!symbols.length) symbols.push(...THEME_SYMBOLS['animals']!);
    // Seed sinh tại server — client không bao giờ biết trước bàn thẻ (NF-04)
    const seed = seedFrom(crypto.getRandomValues(new Uint32Array(1))[0]!);
    this.game = new MemoryGame(presetConfig({
      mode: room.config.mode,
      grid: room.config.grid,
      symbols,
      seed,
      players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
    }));
    this.game.start(Date.now());
    room.status = 'playing';
  }

  /** Phát sự kiện + view mới cho cả phòng, cập nhật trạng thái phòng nếu ván xong. */
  private async afterEvents(events: GameEvent[], save = true): Promise<void> {
    if (!events.length || !this.game || !this.room) return;
    if (events.some((e) => e.type === 'end')) this.room.status = 'ended';
    if (save) await this.save();
    this.broadcast({ t: 'events', events: publicEvents(this.game, events), view: this.view() });
    if (this.room.status === 'ended') this.broadcast({ t: 'room', room: this.roomInfo() });
    if (save) await this.scheduleNext();
  }

  private view() {
    return publicView(this.game!, Date.now(), (id) => this.connected(id));
  }

  private connected(id: string): boolean {
    const p = this.room?.players.find((x) => x.id === id);
    return !!p && p.disconnectedAt === null && this.ctx.getWebSockets(id).length > 0;
  }

  private roomInfo(): RoomInfo {
    const room = this.room!;
    return {
      code: room.code,
      hostId: room.hostId,
      config: room.config,
      status: room.status,
      players: room.players.map((p) => {
        const gp = this.game?.players.find((x) => x.id === p.id);
        return gp
          ? publicPlayer(gp, this.connected(p.id))
          : {
              id: p.id, name: p.name, avatar: p.avatar,
              score: 0, pairs: 0, bestStreak: 0, frozenTurns: 0,
              doubleNext: false, forfeited: false, connected: this.connected(p.id)
            };
      })
    };
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket đã đóng */ }
  }

  private broadcast(msg: ServerMsg, exceptWelcomeFor?: string): void {
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(raw); } catch { /* bỏ qua socket chết */ }
    }
    void exceptWelcomeFor;
  }
}
