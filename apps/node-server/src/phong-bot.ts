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
 *   TEP_TRANG_THAI  file nhớ phòng + vé vào lại (mặc định /data/phong-bot.json — gắn volume vào /data)
 *   ROI_KHI_TAT=1   tắt module thì bot RỜI phòng hẳn (mặc định: chỉ đóng kết nối, giữ chỗ để lần chạy sau vào lại)
 *
 * DEPLOY LẠI KHÔNG ĐƯỢC ĐỂ LẠI PHÒNG MA (22.11.2026, chủ dự án: "khi deploy lại bot thì các ván đấu cũ sẽ bị treo"). Server
 * giữ phòng qua MySQL khi thay ảnh, còn bot bản đầu quên sạch và mở phòng mới → sổ phòng còn lại phòng chờ 1 bot chết và
 * ván "đang chơi" đứng đồng hồ (đo trên Dallas: 3 phòng ma sau một lần deploy). Nay bot GHI mã phòng + token + số ván ra
 * `TEP_TRANG_THAI` mỗi khi đổi, khởi động thì VÀO LẠI ĐÚNG PHÒNG CŨ bằng token (ván dở chơi tiếp, chỉ mất ký ức thẻ) —
 * không vào lại được (phòng đã bị dọn, mất chỗ) mới mở phòng mới. Tắt module KHÔNG gửi `leave` nữa (gửi là xử thua ván dở
 * và nhả chỗ, lần sau không vào lại được). Server khởi động lại MỘT MÌNH: bot kiên trì nối lại ~2 phút rồi mới bỏ phòng.
 */
import {
  BOT_LEVELS, LEVEL_KEYS, botPick, botRng, botThinkMs, createBotMemory, observe, pairsForLevel,
  type BotLevel, type GameView, type RoomInfo
} from '@mm/engine';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { taoTenBotPhong } from '../../web/src/lib/ten-bot-phong';

const so = (ten: string, mac: number): number => { const v = Number(process.env[ten]); return Number.isFinite(v) && v > 0 ? v : mac; };
const SERVER = (process.env.MM_SERVER ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const WS = SERVER.replace(/^http/, 'ws');
const SO_PHONG = Math.min(10, Math.round(so('SO_PHONG', 2)));
const CHO_MS = so('CHO_MS', 30_000);
const DOI_SAU = Math.round(so('DOI_SAU', 10));
const THE_MIN = Math.round(so('THE_MIN', 12));
const THE_MAX = Math.round(so('THE_MAX', 59));
const XEM_KQ_MS = so('XEM_KQ_MS', 8_000);
/** Người vào sát giờ vẫn có ngần này để bấm Sẵn sàng; hết hạn mà chưa sẵn sàng: nhắc + chờ thêm một lần rồi chuyển sang người xem. */
const KIP_SAN_SANG_MS = Math.min(12_000, CHO_MS);
const CHO_THEM_MS = Math.min(15_000, CHO_MS);
/** Mọi người (thật) đã sẵn sàng thì không bắt họ ngồi nhìn đồng hồ: vào ván sau ngần này. */
const DU_NGUOI_MS = Math.min(5_000, CHO_MS);

const nghi = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rd = (n: number): number => Math.floor(Math.random() * n);
const log = (...a: unknown[]): void => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Các cấp bàn có số thẻ trong khoảng cho phép: [level, số thẻ]. */
const BAN: [number, number][] = [];
// MỖI SỐ THẺ MỘT MỤC: nhiều cấp chung một cỡ bàn (36 và 42 thẻ mỗi cỡ 9 cấp) — bốc theo cấp là lệch hẳn về bàn to
for (let l = 1; l <= LEVEL_KEYS; l++) { const the = pairsForLevel(l) * 2; if (the >= THE_MIN && the <= THE_MAX && !BAN.some(([, t]) => t === the)) BAN.push([l, the]); }
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

/** TÊN NGƯỜI theo nước (25.11.2026, thay bộ tên con vật): 1 từ 60%, 2 từ 30%, 3 từ 10% + dấu ẩn để app bật debug nhận ra
 *  bot — xem apps/web/src/lib/ten-bot-phong.ts. */
function bocTen(): string { return taoTenBotPhong(); }

const TEP = process.env.TEP_TRANG_THAI ?? '/data/phong-bot.json';
const ROI_KHI_TAT = process.env.ROI_KHI_TAT === '1';
interface PhongNho { code: string; soVan: number; doiKhi: number; bot: { ten: string; token: string }[] }
let daBaoLoiTep = false;

/** Ghi trạng thái mọi phòng (ghi file tạm rồi đổi tên — tắt ngang giữa chừng không để lại file hỏng). */
function luu(): void {
  try {
    const ds: PhongNho[] = phongs.filter((p) => p.code && p.bot.length === 2 && p.bot.every((b) => b.token))
      .map((p) => ({ code: p.code, soVan: p.soVan, doiKhi: p.doiKhi, bot: p.bot.map((b) => ({ ten: b.ten, token: b.token })) }));
    mkdirSync(dirname(TEP), { recursive: true });
    writeFileSync(TEP + '.tam', JSON.stringify({ luc: Date.now(), server: SERVER, phong: ds }));
    renameSync(TEP + '.tam', TEP);
  } catch (e) {
    if (!daBaoLoiTep) { daBaoLoiTep = true; log(`không ghi được ${TEP} (${(e as Error).message}) — deploy lại sẽ mở phòng mới thay vì vào lại phòng cũ`); }
  }
}

function docNho(): PhongNho[] {
  try {
    const d = JSON.parse(readFileSync(TEP, 'utf8')) as { server?: string; phong?: PhongNho[] };
    if (d.server !== SERVER || !Array.isArray(d.phong)) return [];
    return d.phong.filter((p) => /^\d{6}$/.test(p?.code ?? '') && Array.isArray(p.bot) && p.bot.length === 2 && p.bot.every((b) => b?.ten && b?.token));
  } catch { return []; }
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
  /** Tự chữa khi bot mất ghế ở phòng chờ: mốc bắt đầu thiếu, mốc thử vào lại gần nhất. */
  thieuTu = 0;
  chuaLuc = 0;
  daThuRoi = false;
  /** Lượt chọn số thẻ đã bỏ phiếu (id của `room.chon`). */
  chonId = 0;

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
        luu();
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

  /** Vào lại phòng của lần chạy trước bằng token. false = phòng không còn / mất chỗ → người gọi mở phòng mới. */
  async khoiPhuc(n: PhongNho): Promise<boolean> {
    this.code = n.code; this.room = null; this.ban = null; this.han = 0; this.hetXem = 0; this.trangThaiCu = '';
    this.soVan = n.soVan || 0; this.doiKhi = n.doiKhi || DOI_SAU;
    this.bot = n.bot.map((x) => { const b = new Bot(x.ten, this); b.token = x.token; return b; });
    const cu = this.bot.map((b) => b.token);
    let ok = true;
    for (const b of this.bot) if (!(await b.vao())) { ok = false; break; }
    // Server cấp token MỚI = không nhận ra mình (chỗ cũ đã bị gỡ) → mình vừa vào như người lạ; coi như hỏng
    if (ok && this.bot.some((b, i) => b.token !== cu[i])) ok = false;
    if (!ok) {
      const ds = this.bot; this.bot = []; this.room = null; this.code = '';
      for (const b of ds) { b.gui({ t: 'leave' }); }
      await nghi(300);
      for (const b of ds) b.dong();
      return false;
    }
    log(`[phòng ${this.so}] vào lại ${n.code}: ${this.bot.map((b) => b.ten).join(' + ')} (${(this.room as RoomInfo | null)?.status}, ván ${this.soVan}/${this.doiKhi})`);
    return true;
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
        for (let lan = 1; lan <= 12; lan++) {   // ~2 phút: đủ cho server thay ảnh (chờ DB + dựng lại phòng)
          await nghi(Math.min(15_000, 1500 * lan));
          if (dangTat || this.dangDung) return;
          // Server đã lên lại mà phòng KHÔNG còn (server không giữ phòng qua lần khởi động) → khỏi cố, mở phòng mới ngay
          try {
            const r = await fetch(`${SERVER}/api/rooms/${this.code}`);
            if (r.ok && ((await r.json()) as { exists?: boolean }).exists === false) break;
          } catch { /* server chưa lên — thử tiếp */ }
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
    // TÌM THẺ (27.11.2026): máy trực phòng chưa biết chơi Tìm Thẻ — chủ phòng chuyển sang thì RỜI GHẾ, không đứng chặn
    // nút Bắt đầu (server đòi `?tim=1` ở mọi người thật mà máy ngoài là người thật với server).
    if (room.config.kieu === 'tim') { for (const b of this.bot) b.gui({ t: 'leave' }); return; }
    /*
     * BỎ PHIẾU SỐ THẺ như người chơi (23.11.2026, chủ dự án: "update bot để bot cũng chọn"): server mở lượt chọn 10 giây khi
     * bấm Bắt đầu / Chơi lại. Mỗi bot chọn sau 0,3–1,7 s, ngẫu nhiên trong các ô hợp lệ: trong khoảng THE_MIN–THE_MAX và
     * không nhỏ hơn mức tối thiểu theo số người (bàn 3–4 người không tụt về 12 thẻ). Không ô nào hợp lệ thì không chọn.
     */
    if (room.chon && !room.chon.ket && room.chon.id !== this.chonId) {
      this.chonId = room.chon.id;
      const tong = room.players.length;
      const toiThieu = Math.max(THE_MIN, tong >= 4 ? 28 : tong === 3 ? 20 : THE_MIN);
      const hop = room.chon.ds.filter((the) => the >= toiThieu && the <= THE_MAX);
      const ma = this.code;
      if (hop.length) for (const b of this.bot) setTimeout(() => { if (this.code === ma) b.gui({ t: 'chon', the: hop[rd(hop.length)] }); }, 300 + rd(1400));
    }
    this.trangThaiCu = room.status;
    if (room.status === cu) return;
    if (room.status === 'lobby') { this.han = Date.now() + CHO_MS; this.daNhac = false; this.daNoi.clear(); this.hetXem = 0; this.chuLaTu = 0; this.vanMoi(); }
    if (room.status === 'countdown' || (room.status === 'playing' && cu !== 'countdown')) {
      for (const b of this.bot) { b.kyUc = createBotMemory(); b.hen = 0; b.choBan = null; }
      this.ban = null;
    }
    if (room.status === 'ended') { this.soVan++; queueMicrotask(luu); this.hetXem = Date.now() + XEM_KQ_MS + rd(3000); log(`[phòng ${this.so}] ${this.code} xong ván ${this.soVan}/${this.doiKhi}`); }
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
      // Còn người thật NGỒI CHƠI hoặc đang XEM thì chưa đổi phòng (đổi là đóng phòng trước mặt họ)
      if (this.soVan >= this.doiKhi && !this.nguoi().some((p) => p.connected) && !(this.room as { xem?: unknown[] } | null)?.xem?.length) { void this.doiPhong(`đủ ${this.soVan} ván`); return; }
      (this.chu ?? this.bot[0])?.gui({ t: 'tolobby' });
    }
  }

  nhipPhongCho(r: RoomInfo, now: number): void {
    /*
     * TỰ CHỮA: bot của mình KHÔNG còn trong danh sách người chơi (bị gỡ vì server tưởng rớt mạng, bị chủ phòng người thật
     * mời ra…) → vào lại như người mới. Chưa đủ hai bot thì KHÔNG bấm Bắt đầu. Quá 90 giây vẫn thiếu thì bỏ phòng.
     */
    const thieu = this.bot.filter((b) => !r.players.some((p) => p.id === b.id));
    if (thieu.length) {
      if (!this.thieuTu) this.thieuTu = now;
      if (now - this.thieuTu > 90_000 && !this.dangNoi) { this.thieuTu = 0; void this.doiPhong('không vào lại được ghế'); return; }
      if (!this.dangNoi && now - this.chuaLuc > 4000) {
        this.chuaLuc = now;
        this.dangNoi = true;
        void (async () => {
          try {
            for (const b of thieu) { b.token = ''; b.dong(); await nghi(300); if (await b.vao()) log(`[phòng ${this.so}] ${this.code} ${b.ten} mất ghế — đã vào lại`); }
            luu();
          } finally { this.dangNoi = false; }
        })();
      }
      return;
    }
    this.thieuTu = 0;
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
    if (process.env.BOT_DEBUG_ROI && !this.daThuRoi && this.bot[1]) { this.daThuRoi = true; log('[gỡ lỗi] cho bot thứ hai rời ghế để thử tự chữa'); this.bot[1].gui({ t: 'leave' }); return; }
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
      // Đứng im quá lâu: KHÔNG mời ra sảnh nữa (25.11.2026) — trả ghế, app tự chuyển họ sang NGƯỜI XEM, muốn chơi thì bấm "Vào chơi"
      for (const p of chuaSan) chu.gui({ t: 'kick', playerId: p.id, xem: true });
      this.han = now + 1500;
      return;
    }
    /*
     * ĐỔI GÌ THÌ CHỜ SERVER XÁC NHẬN RỒI MỚI BẤM BẮT ĐẦU. Gửi `config` rồi `start` liền nhau thì trên server thật (có
     * MySQL) lệnh Bắt đầu có thể được xử lý TRƯỚC khi cấu hình mới áp — đo 22.11.2026 trên Dallas: có người vào mà bàn
     * vẫn 12 thẻ. Nên: gửi thay đổi → về; nhịp sau thấy `room` đã đúng thì mới đi tiếp.
     */
    // Mỗi người một đội (ván thường): ai đó tự xếp chung đội thì chủ phòng tách ra
    const dung = new Set<number>();
    let doiDoi = false;
    for (const p of r.players) {
      const d = (p as { doiSo?: number }).doiSo;
      if (d && !dung.has(d)) { dung.add(d); continue; }
      const trong = [1, 2, 3, 4].find((x) => !dung.has(x) && !r.players.some((q) => (q as { doiSo?: number }).doiSo === x));
      if (trong) { dung.add(trong); chu.gui({ t: 'doi', playerId: p.id, doi: trong }); doiDoi = true; }
    }
    // Có người chơi cùng: bàn to hơn chút
    const tong = r.players.length;
    const theHienTai = pairsForLevel(r.config.level) * 2;
    const toiThieu = tong >= 4 ? 28 : tong === 3 ? 20 : THE_MIN;
    const doiBan = theHienTai < toiThieu || theHienTai > THE_MAX;
    if (doiBan) chu.gui({ t: 'config', config: { level: bocBan(tong)[0] } });
    if (doiDoi || doiBan) { this.startGui = now - 1500; return; }   // ~1 giây sau xét lại với `room` mới
    if (process.env.BOT_DEBUG) log(`[gỡ lỗi] start: tong=${tong} the=${theHienTai} toiThieu=${toiThieu} nguoi=${nguoi.length} players=${r.players.map((p) => p.name + (p.ready ? '✓' : '·')).join(',')}`);
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
  if (ROI_KHI_TAT) {
    log('tắt: cho bot rời phòng…');
    await Promise.all(phongs.map((p) => p.roi().catch(() => { /* kệ */ })));
  } else {
    // GIỮ CHỖ: chỉ đóng kết nối — lần chạy sau vào lại bằng token và chơi tiếp (server giữ chỗ 5 phút trong ván)
    luu();
    log('tắt: đóng kết nối, giữ chỗ để lần chạy sau vào lại');
    for (const p of phongs) for (const b of p.bot) b.dong();
    await nghi(200);
  }
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
const nho = docNho();
for (const [i, p] of phongs.entries()) {
  const n = nho[i];
  if (n && (await p.khoiPhuc(n))) continue;
  if (n) log(`[phòng ${p.so}] không vào lại được ${n.code} — mở phòng mới`);
  await p.mo();
  await nghi(1500 + rd(3000));
}
luu();
setInterval(() => { for (const p of phongs) { try { p.nhip(); } catch (e) { console.error('[nhịp] lỗi:', e); } } }, 300);
// Báo còn sống (server có mốc im lặng)
// 8 GIÂY, không phải 20: server coi im quá SILENT_MS = 20 s là MẤT KẾT NỐI. Bot không tới lượt chỉ gửi mỗi tin này, nên nhịp
// 20 s là chạm ngưỡng — bot bị đánh dấu rớt mạng, và nếu đúng lúc đó phòng về phòng chờ thì nó bị GỠ khỏi phòng (gặp thật trên
// Dallas 23.11.2026: phòng còn một bot, bấm Bắt đầu mãi "cần ít nhất 2 người").
setInterval(() => { for (const p of phongs) for (const b of p.bot) b.gui({ t: 'alive' }); }, 8_000);
