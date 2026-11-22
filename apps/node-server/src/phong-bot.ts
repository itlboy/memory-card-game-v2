/**
 * PHÒNG BOT THƯỜNG TRỰC (22.11.2026, chủ dự án) — module RIÊNG, KHÔNG nằm trong tiến trình server.
 *
 * "Tạo 2 phòng chơi thường trực cho 2 bot thi đấu… giữa mỗi ván chờ ~30 giây cho người chơi tham gia, không ai
 * tham gia thì bot tự đấu và ai thích thì vào xem… độ khó ngẫu nhiên, không chênh quá 1 cấp… số thẻ ngẫu nhiên…
 * làm cơ chế riêng, hạn chế can thiệp vào server… giống script bot của chúng ta… chạy trên một container riêng
 * nhưng cùng image… bot lấy TÊN NGƯỜI CHƠI theo cơ chế gen tên của chúng ta… sau khoảng 10 ván thì đổi phòng, đổi tên."
 *
 * CÁCH LÀM: mỗi bot là một KẾT NỐI WebSocket bình thường vào server (y như tools/gia-nguoi.mjs) — server không
 * biết đó là máy, KHÔNG có dòng code nào của server dành riêng cho nó. Bot đầu lập phòng (POST /api/rooms) nên
 * làm chủ phòng: nó chỉnh số thẻ, đếm giờ chờ, bấm Bắt đầu, hết ván thì đưa phòng về phòng chờ.
 * Bộ não là AI máy sẵn có của engine (`botPick`/`observe`/`botThinkMs`) — chỉ nhìn bàn CÔNG KHAI server phát.
 *
 * HỆ QUẢ CỦA VIỆC "SERVER KHÔNG BIẾT" (đã nói với chủ dự án trước khi làm):
 *  - Thắng bot ở đây tính như thắng NGƯỜI; bot hiện trong sổ phòng như người; người chơi không biết là máy.
 *  - Phòng công khai mới vẫn đi qua luật thông báo "có phòng mới" của server (thongbao.ts) như mọi phòng.
 *
 * CHẠY: `node dist/phong-bot.mjs` trong CÙNG ảnh với server (build.mjs gói thành file thứ hai). Biến môi trường:
 *   MM_SERVER   địa chỉ server (mặc định http://127.0.0.1:8080; trong compose: http://server:8080)
 *   SO_PHONG    số phòng thường trực (mặc định 2)
 *   CHO_MS      chờ người ở phòng chờ trước mỗi ván (mặc định 30000)
 *   DOI_SAU     khoảng bao nhiêu ván thì đổi phòng + đổi tên (mặc định 10, lệch ±2)
 *   THE_MIN/THE_MAX  khoảng số thẻ (mặc định 12–59 = "12 tới 5x")
 *   MUC         các mức máy được dùng (mặc định easy,normal,hard)
 *   XEM_KQ_MS   đứng ở bảng kết quả bao lâu rồi về phòng chờ (mặc định 8000)
 * Tắt: SIGTERM/SIGINT → bot rời phòng gọn gàng.
 */
import {
  BOT_LEVELS, LEVEL_KEYS, botPick, botRng, botThinkMs, createBotMemory, observe, pairsForLevel,
  type BotLevel, type GameView, type RoomInfo
} from '@mm/engine';
import { NGON_NGU_CO_TEN, taoTen } from '../../web/src/lib/ten-goc';

const so = (ten: string, mac: number): number => { const v = Number(process.env[ten]); return Number.isFinite(v) && v > 0 ? v : mac; };
const SERVER = (process.env.MM_SERVER ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const WS = SERVER.replace(/^http/, 'ws');
const SO_PHONG = Math.min(10, Math.round(so('SO_PHONG', 2)));
const CHO_MS = so('CHO_MS', 30_000);
const DOI_SAU = Math.round(so('DOI_SAU', 10));
const THE_MIN = Math.round(so('THE_MIN', 12));
const THE_MAX = Math.round(so('THE_MAX', 59));
const XEM_KQ_MS = so('XEM_KQ_MS', 8_000);
/** Người vào sát giờ vẫn có ngần này để bấm Sẵn sàng; hết hạn mà chưa sẵn sàng: nhắc + chờ thêm một lần rồi mời ra. */
const KIP_SAN_SANG_MS = Math.min(12_000, CHO_MS);
const CHO_THEM_MS = Math.min(15_000, CHO_MS);
/** Mọi người (thật) đã sẵn sàng thì không bắt họ ngồi nhìn đồng hồ: vào ván sau ngần này. */
const DU_NGUOI_MS = Math.min(5_000, CHO_MS);

const nghi = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rd = (n: number): number => Math.floor(Math.random() * n);
const log = (...a: unknown[]): void => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Các cấp bàn có số thẻ trong khoảng cho phép: [level, số thẻ]. */
const BAN: [number, number][] = [];
for (let l = 1; l <= LEVEL_KEYS; l++) { const the = pairsForLevel(l) * 2; if (the >= THE_MIN && the <= THE_MAX) BAN.push([l, the]); }
if (!BAN.length) { console.error(`Không có cỡ bàn nào trong khoảng ${THE_MIN}–${THE_MAX} thẻ`); process.exit(1); }

/** Bốc bàn: đông người thì bàn to hơn chút ("số thẻ cũng tăng lên chút cho phù hợp"). */
function bocBan(soNguoi: number): [number, number] {
  const toiThieu = soNguoi >= 4 ? 28 : soNguoi === 3 ? 20 : THE_MIN;
  const hop = BAN.filter(([, the]) => the >= toiThieu);
  const ds = hop.length ? hop : BAN;
  return ds[rd(ds.length)]!;
}

/**
 * MỨC MÁY ĐƯỢC DÙNG — chỉ ba mức đầu: gà mờ · gà cứng · báo đen (chủ dự án 22.11.2026: "rồng thần… khó quá" — mãnh hổ
 * và rồng thần làm người vào chơi cùng thua mãi). Đổi bằng biến `MUC` (vd `MUC=easy,normal`); tên lạ bị bỏ.
 */
const MUC: BotLevel[] = (process.env.MUC ?? 'easy,normal,hard').split(',').map((x) => x.trim())
  .filter((x): x is BotLevel => (BOT_LEVELS as readonly string[]).includes(x))
  .sort((x, y) => BOT_LEVELS.indexOf(x) - BOT_LEVELS.indexOf(y));
if (!MUC.length) MUC.push('easy', 'normal', 'hard');

/** Hai mức máy: mức đầu bốc đều, mức sau lệch tối đa MỘT cấp (có thể bằng) — trong các mức được dùng. */
function bocMuc(): [BotLevel, BotLevel] {
  const a = rd(MUC.length);
  const b = Math.min(MUC.length - 1, Math.max(0, a + rd(3) - 1));
  return [MUC[a]!, MUC[b]!];
}

/** Tên như người mới cài app: 40% tiếng Anh, 18% tiếng Việt, còn lại chia đều các tiếng có bộ tên riêng. */
function bocTen(): string {
  const x = Math.random();
  if (x < 0.4) return taoTen('en');
  if (x < 0.58) return taoTen('vi');
  const khac = NGON_NGU_CO_TEN.filter((l) => l !== 'en' && l !== 'vi');
  return taoTen(khac[rd(khac.length)]!);
}

type TinServer =
  | { t: 'welcome'; playerId: string; token: string; room: RoomInfo; spectator?: boolean }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state' | 'events'; view?: GameView }
  | { t: 'error'; code?: string; message?: string }
  | { t: string };

class Bot {
  id = '';
  token = '';
  ws: WebSocket | null = null;
  muc: BotLevel = 'normal';
  kyUc = createBotMemory();
  rng = botRng((Math.random() * 0xffffffff) >>> 0);
  /** Mốc sẽ lật (0 = chưa hẹn) và bàn lúc gửi nước gần nhất (chờ server trả bàn mới rồi mới nghĩ tiếp). */
  hen = 0;
  choBan: GameView | null = null;
  choTu = 0;
  constructor(public ten: string, private phong: Phong) {}

  gui(m: Record<string, unknown>): void { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }

  /** Mở (hoặc mở lại bằng token) kết nối. Trả false nếu không vào được làm NGƯỜI CHƠI. */
  vao(): Promise<boolean> {
    return new Promise((xong) => {
      const p = new URLSearchParams({ name: this.ten, dd: '1' });
      if (this.token) p.set('token', this.token);
      let ws: WebSocket;
      try { ws = new WebSocket(`${WS}/ws/${this.phong.code}?${p}`); } catch { xong(false); return; }
      this.ws = ws;
      let daXong = false;
      const tra = (ok: boolean): void => { if (!daXong) { daXong = true; clearTimeout(han); xong(ok); } };
      const han = setTimeout(() => { try { ws.close(); } catch { /* kệ */ } tra(false); }, 10_000);
      ws.onmessage = (e) => {
        let m: TinServer;
        try { m = JSON.parse(String(e.data)) as TinServer; } catch { return; }
        if (m.t === 'welcome') {
          const w = m as Extract<TinServer, { t: 'welcome' }>;
          if (w.spectator || !w.playerId) { tra(false); return; }
          this.id = w.playerId; this.token = w.token;
          this.phong.nhanPhong(w.room);
          tra(true);
          return;
        }
        this.phong.nhan(this, m);
      };
      ws.onerror = () => tra(false);
      ws.onclose = () => { tra(false); if (this.ws === ws) { this.ws = null; this.phong.matKetNoi(this); } };
    });
  }

  dong(): void { const w = this.ws; this.ws = null; try { w?.close(); } catch { /* kệ */ } }
}

class Phong {
  code = '';
  bot: Bot[] = [];
  room: RoomInfo | null = null;
  ban: GameView | null = null;
  banLuc = 0;
  soVan = 0;
  doiKhi = 0;
  /** Phòng chờ: hạn bắt đầu, đã nhắc chưa, ai đã được nới giờ. */
  han = 0;
  daNhac = false;
  daNoi = new Set<string>();
  /** Bảng kết quả: mốc về phòng chờ. */
  hetXem = 0;
  trangThaiCu = '';
  dangDung = false;
  /** Nối lại: không chạy hai lượt cùng lúc, và đếm số lần hỏng liên tiếp. */
  dangNoi = false;
  hong = 0;
  /** Chủ phòng là người khác (bot rớt mạng rồi quay lại): mốc bắt đầu chờ họ. */
  chuLaTu = 0;
  startGui = 0;

  constructor(public so: number) {}

  get chu(): Bot | undefined { return this.bot.find((b) => b.id && b.id === this.room?.hostId); }
  laBot(id: string): boolean { return this.bot.some((b) => b.id === id); }
  nguoi(): RoomInfo['players'] { return (this.room?.players ?? []).filter((p) => !this.laBot(p.id)); }

  /** Lập phòng mới + hai bot tên mới vào. */
  async mo(): Promise<void> {
    for (;;) {
      if (dangTat) return;
      try {
        const r = await fetch(`${SERVER}/api/rooms`, { method: 'POST' });
        const code = ((await r.json()) as { code?: string }).code;
        if (!code) throw new Error('server không trả mã phòng');
        this.code = code; this.room = null; this.ban = null; this.soVan = 0; this.han = 0; this.hetXem = 0; this.trangThaiCu = '';
        this.doiKhi = Math.max(2, DOI_SAU + rd(5) - 2);
        let a = bocTen(), b = bocTen();
        while (b === a) b = bocTen();
        this.bot = [new Bot(a, this), new Bot(b, this)];
        if (!(await this.bot[0]!.vao())) throw new Error('bot đầu không vào được');
        await nghi(600 + rd(900));   // người thứ hai vào sau một nhịp, như người thật
        if (!(await this.bot[1]!.vao())) throw new Error('bot thứ hai không vào được');
        this.hong = 0;
        log(`[phòng ${this.so}] mở ${code}: ${a} + ${b}, đổi sau ${this.doiKhi} ván`);
        return;
      } catch (e) {
        for (const b of this.bot) b.dong();
        this.bot = [];
        this.hong++;
        log(`[phòng ${this.so}] chưa mở được phòng (${(e as Error).message}) — thử lại`);
        await nghi(Math.min(60_000, 3000 * this.hong));
      }
    }
  }

  /** Rời phòng hiện tại (đổi phòng / tắt module). */
  async roi(): Promise<void> {
    const cu = this.bot; this.bot = []; this.room = null; this.ban = null;
    for (const b of cu) b.gui({ t: 'leave' });
    await nghi(400);
    for (const b of cu) b.dong();
  }

  async doiPhong(lyDo: string): Promise<void> {
    if (this.dangDung) return;
    this.dangDung = true;
    log(`[phòng ${this.so}] rời ${this.code} (${lyDo})`);
    try { await this.roi(); await nghi(2000 + rd(4000)); await this.mo(); } finally { this.dangDung = false; }
  }

  matKetNoi(b: Bot): void {
    if (dangTat || this.dangDung || !this.bot.includes(b) || this.dangNoi) return;
    this.dangNoi = true;
    void (async () => {
      try {
        for (let lan = 1; lan <= 6; lan++) {
          await nghi(Math.min(15_000, 1500 * lan));
          if (dangTat || this.dangDung) return;
          let ok = true;
          for (const x of this.bot) if (!x.ws && !(await x.vao())) ok = false;
          if (ok) return;
        }
      } finally { this.dangNoi = false; }
      // Mất chỗ hẳn (server khởi động lại không giữ phòng, hoặc ván chạy tiếp mà mình thành khán giả) → phòng mới
      await this.doiPhong('không nối lại được');
    })();
  }

  nhanPhong(room: RoomInfo): void {
    const cu = this.trangThaiCu;
    this.room = room;
    this.trangThaiCu = room.status;
    if (room.status === cu) return;
    if (room.status === 'lobby') { this.han = Date.now() + CHO_MS; this.daNhac = false; this.daNoi.clear(); this.hetXem = 0; this.chuLaTu = 0; this.vanMoi(); }
    if (room.status === 'countdown' || (room.status === 'playing' && cu !== 'countdown')) {
      for (const b of this.bot) { b.kyUc = createBotMemory(); b.hen = 0; b.choBan = null; }
      this.ban = null;
    }
    if (room.status === 'ended') { this.soVan++; this.hetXem = Date.now() + XEM_KQ_MS + rd(3000); log(`[phòng ${this.so}] ${this.code} xong ván ${this.soVan}/${this.doiKhi}`); }
  }

  /** Vào phòng chờ: bốc mức máy + bàn cho ván sắp tới (chủ phòng gửi cấu hình). */
  vanMoi(): void {
    const [a, b] = bocMuc();
    if (this.bot[0]) this.bot[0].muc = a;
    if (this.bot[1]) this.bot[1].muc = b;
    const [level, the] = bocBan(2);
    this.chu?.gui({ t: 'config', config: { level } });
    log(`[phòng ${this.so}] ${this.code} phòng chờ: ${a} ↔ ${b}, ${the} thẻ`);
  }

  nhan(b: Bot, m: TinServer): void {
    if (m.t === 'room') { this.nhanPhong((m as Extract<TinServer, { t: 'room' }>).room); return; }
    if ((m.t === 'state' || m.t === 'events') && (m as { view?: GameView }).view) {
      const v = (m as { view: GameView }).view;
      if (!Array.isArray(v.cards)) return;   // chỉ đọc dạng đầy đủ (không khai ?pv=1 nên server gửi đủ)
      this.ban = v; this.banLuc = Date.now();
      // Mỗi bot tự ghi nhớ bàn theo mức của nó — đúng như máy trong phòng (room.ts `quanSatMay`)
      for (const x of this.bot) observe(x.kyUc, v, x.muc);
      return;
    }
    if (m.t === 'error') {
      const e = m as { code?: string; message?: string };
      if (e.code !== 'not-ready') log(`[phòng ${this.so}] ${this.code} ${b.ten}: ${e.code ?? ''} ${e.message ?? ''}`);
    }
  }

  /** Nhịp 300 ms: việc của chủ phòng ở phòng chờ / bảng kết quả, và nước đi của bot tới lượt. */
  nhip(): void {
    const r = this.room;
    if (!r || this.dangDung || !this.bot.length) return;
    const now = Date.now();
    if (r.status === 'lobby') this.nhipPhongCho(r, now);
    else if (r.status === 'playing') this.nhipVan(now);
    else if (r.status === 'ended' && this.hetXem && now >= this.hetXem) {
      this.hetXem = now + 5000;   // gửi rồi mà chưa đổi trạng thái thì 5 giây sau gửi lại
      if (this.soVan >= this.doiKhi && !this.nguoi().some((p) => p.connected)) { void this.doiPhong(`đủ ${this.soVan} ván`); return; }
      (this.chu ?? this.bot[0])?.gui({ t: 'tolobby' });
    }
  }

  nhipPhongCho(r: RoomInfo, now: number): void {
    // Bot không phải chủ phòng thì bấm Sẵn sàng như người
    for (const b of this.bot) {
      const toi = r.players.find((p) => p.id === b.id);
      if (toi && !toi.ready && b.id !== r.hostId) b.gui({ t: 'ready', ready: true });
    }
    const chu = this.chu;
    if (!chu) {
      // Chủ phòng là NGƯỜI (bot chủ rớt mạng lúc có người trong phòng): để họ bấm Bắt đầu; lâu quá thì sang phòng khác
      if (!this.chuLaTu) this.chuLaTu = now;
      else if (now - this.chuLaTu > 120_000 && !this.dangNoi) void this.doiPhong('chủ phòng là người khác');
      return;
    }
    this.chuLaTu = 0;
    if (!r.congKhai) chu.gui({ t: 'public', on: true });
    const nguoi = this.nguoi().filter((p) => p.connected);
    // Người vừa vào sát giờ: nới cho kịp bấm Sẵn sàng (mỗi người một lần)
    for (const p of nguoi) if (!this.daNoi.has(p.id)) { this.daNoi.add(p.id); this.han = Math.max(this.han, now + KIP_SAN_SANG_MS); }
    const chuaSan = nguoi.filter((p) => !p.ready);
    // Có người và ai cũng sẵn sàng: không bắt họ ngồi nhìn đồng hồ
    if (nguoi.length && !chuaSan.length) this.han = Math.min(this.han, now + DU_NGUOI_MS);
    if (now < this.han || now - this.startGui < 2500) return;
    if (chuaSan.length) {
      if (!this.daNhac) { this.daNhac = true; this.han = now + CHO_THEM_MS; chu.gui({ t: 'nhac' }); return; }
      for (const p of chuaSan) chu.gui({ t: 'kick', playerId: p.id });   // đứng im quá lâu: mời ra, vào lại lúc nào cũng được
      this.han = now + 1500;
      return;
    }
    // Mỗi người một đội (ván thường): ai đó tự xếp chung đội thì chủ phòng tách ra
    const dung = new Set<number>();
    for (const p of r.players) {
      const d = (p as { doiSo?: number }).doiSo;
      if (d && !dung.has(d)) { dung.add(d); continue; }
      const trong = [1, 2, 3, 4].find((x) => !dung.has(x) && !r.players.some((q) => (q as { doiSo?: number }).doiSo === x));
      if (trong) { dung.add(trong); chu.gui({ t: 'doi', playerId: p.id, doi: trong }); }
    }
    // Có người chơi cùng: bàn to hơn chút
    const tong = r.players.length;
    const theHienTai = pairsForLevel(r.config.level) * 2;
    const toiThieu = tong >= 4 ? 28 : tong === 3 ? 20 : THE_MIN;
    if (theHienTai < toiThieu || theHienTai > THE_MAX) chu.gui({ t: 'config', config: { level: bocBan(tong)[0] } });
    this.startGui = now;
    chu.gui({ t: 'start' });
  }

  nhipVan(now: number): void {
    const v = this.ban;
    if (!v || v.status !== 'playing') return;
    const b = this.bot.find((x) => x.id === v.currentId);
    for (const x of this.bot) if (x !== b) { x.hen = 0; x.choBan = null; }
    if (!b) return;
    // Vừa gửi nước: chờ server phát bàn mới; im quá 4 giây thì xin lại trạng thái
    if (b.choBan === v) { if (now - b.choTu > 4000) { b.choTu = now; b.gui({ t: 'resync' }); b.choBan = null; } return; }
    b.choBan = null;
    // Đang hé mở cả bàn / đang chờ úp hai lá sai → chưa tới lúc lật
    if (v.peekLeft != null && this.banLuc + v.peekLeft * 1000 > now) { b.hen = 0; return; }
    const dangMo = v.cards.filter((c) => c.state === 'up').length;
    if (dangMo >= 2) { b.hen = 0; return; }
    if (!b.hen) {
      const conLai = v.cards.filter((c) => !c.blank && c.state !== 'matched').length;
      b.hen = now + botThinkMs(b.muc, b.rng, { cardsLeft: conLai, closing: dangMo === 1 });
      return;
    }
    if (now < b.hen) return;
    b.hen = 0;
    const chon = botPick(v, b.kyUc, b.rng, b.muc);
    if (chon === null) return;
    b.choBan = v; b.choTu = now;
    b.gui({ t: 'flip', index: chon });
  }
}

let dangTat = false;
const phongs = Array.from({ length: SO_PHONG }, (_, i) => new Phong(i + 1));

async function tat(): Promise<void> {
  if (dangTat) return;
  dangTat = true;
  log('tắt: cho bot rời phòng…');
  await Promise.all(phongs.map((p) => p.roi().catch(() => { /* kệ */ })));
  process.exit(0);
}
process.on('SIGTERM', () => void tat());
process.on('SIGINT', () => void tat());

log(`phòng bot: ${SO_PHONG} phòng tại ${SERVER} · chờ ${CHO_MS / 1000}s · ${THE_MIN}–${THE_MAX} thẻ (${BAN.length} cỡ bàn) · mức ${MUC.join('/')} · đổi sau ~${DOI_SAU} ván`);
// Chờ server lên (container bot có thể khởi động trước server)
for (;;) {
  try { if ((await fetch(`${SERVER}/health`)).ok) break; } catch { /* chưa lên */ }
  await nghi(2000);
}
for (const p of phongs) { await p.mo(); await nghi(1500 + rd(3000)); }
setInterval(() => { for (const p of phongs) { try { p.nhip(); } catch (e) { console.error('[nhịp] lỗi:', e); } } }, 300);
// Báo còn sống (server có mốc im lặng)
setInterval(() => { for (const p of phongs) for (const b of p.bot) b.gui({ t: 'alive' }); }, 20_000);
