import QRCode from 'qrcode';

/*
 * ẢNH CHIA SẺ BẢN MỚI (26.11.2026, chủ dự án: "làm lại các trang chia sẻ cho thật tử tế và đẹp đẽ"; mockup
 * https://claude.ai/artifact/WLMtGi289WrYicB9N3wYb3 — chủ dự án cho tự duyệt). Mỗi ảnh là một "tấm thẻ khoe":
 *  - AVATAR + TÊN người chơi, MỘT con số thật to là thứ đáng khoe nhất;
 *  - CHÂN ẢNH như tấm vé mời: icon app, tên, link `/tai` (tự chuyển tới đúng cửa hàng) và MÃ QR THẬT — Facebook / Instagram
 *    bỏ phần chữ đi kèm ảnh, chữ + mã in trên ảnh thì không mất.
 * Khổ 1080×1350 (bài đăng + story), nền trời / đêm theo giao diện app lúc vẽ. Vẽ trên máy, không gửi gì đi.
 * File này chỉ lo phần VẼ; dữ liệu do lib/anh-ket-qua.ts (ván) và SoTriNho.vue (chỉ số trí nhớ) đưa vào.
 */
export const W = 1080, H = 1350;

export interface Bang {
  troi: [string, string, string]; doi1: string; doi2: string; the: string; vien: string; chu: string; chu2: string;
  o: string; oVien: string; chan: string; chanChu: string; link: string; toi: boolean;
}
const SANG: Bang = {
  troi: ['#3fa9ee', '#7fd3fb', '#bde9ff'], doi1: '#5cc23f', doi2: '#8fdc5f', the: '#fffdf6', vien: '#1d2a5a', chu: '#1d2348', chu2: '#4a5585',
  o: 'rgba(29,35,72,.06)', oVien: 'rgba(29,35,72,.12)', chan: '#ffffff', chanChu: '#1d2348', link: '#2563eb', toi: false,
};
const TOI: Bang = {
  troi: ['#080c26', '#111a44', '#18235a'], doi1: '#26315f', doi2: '#323e78', the: '#1f2658', vien: '#0a0f2c', chu: '#ffffff', chu2: '#c9d0f4',
  o: 'rgba(255,255,255,.07)', oVien: 'rgba(255,255,255,.14)', chan: '#262f6a', chanChu: '#ffffff', link: '#9fc0ff', toi: true,
};
export const bangMau = (): Bang => {
  try { return document.documentElement.dataset.theme === 'dark' ? TOI : SANG; } catch { return SANG; }
};

function bienFont(bien: string, duPhong: string): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue(bien).trim() || duPhong; } catch { return duPhong; }
}
export interface But { c: CanvasRenderingContext2D; p: Bang; fD: string; fB: string }

export async function moBut(): Promise<{ cv: HTMLCanvasElement; b: But }> {
  try { await document.fonts?.ready; } catch { /* vẽ bằng font dự phòng */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  return { cv, b: { c, p: bangMau(), fD: bienFont('--font-display', "'Grandstander', system-ui, sans-serif"), fB: bienFont('--font-body', "'Be Vietnam Pro', system-ui, sans-serif") } };
}
export const raBlob = (cv: HTMLCanvasElement): Promise<Blob> =>
  new Promise((ok, loi) => cv.toBlob((x) => (x ? ok(x) : loi(new Error('toBlob'))), 'image/png'));

export function tron(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}
/** Khối nổi: đế lệch xuống `de` px rồi mặt khối, viền. */
export function khoi(b: But, x: number, y: number, w: number, h: number, r: number, mat: string | CanvasGradient, de: number, vien: number, mauVien = b.p.vien): void {
  const { c } = b;
  if (de) { tron(c, x, y + de, w, h, r); c.fillStyle = mauVien; c.fill(); }
  tron(c, x, y, w, h, r); c.fillStyle = mat; c.fill();
  if (vien) { c.lineWidth = vien; c.strokeStyle = mauVien; c.stroke(); }
}
export function vua(c: CanvasRenderingContext2D, s: string, max: number): string {
  if (c.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
const doc = (c: CanvasRenderingContext2D, y0: number, y1: number, ...m: [number, string][]): CanvasGradient => {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, mau] of m) g.addColorStop(o, mau);
  return g;
};

/** Nền trời (sáng: mặt trời + mây · tối: trăng + sao) + hai ngọn đồi. */
export function veNen(b: But): void {
  const { c, p } = b;
  c.fillStyle = doc(c, 0, H, [0, p.troi[0]], [0.62, p.troi[1]], [1, p.troi[2]]); c.fillRect(0, 0, W, H);
  const quang = c.createRadialGradient(905, 150, 40, 905, 150, 170);
  quang.addColorStop(0, p.toi ? 'rgba(255,230,170,.35)' : 'rgba(255,232,130,.55)'); quang.addColorStop(1, 'rgba(255,232,130,0)');
  c.fillStyle = quang; c.fillRect(700, 0, 380, 360);
  c.fillStyle = p.toi ? '#fbe8a6' : '#ffe066';
  if (p.toi) {
    // Trăng khuyết: KHOÉT đĩa thứ hai trong vùng cắt của mặt trăng — không tô màu trời đè lên (trời là dải chuyển màu,
    // đè là ra vết tối), và vùng cắt giữ cho đĩa khoét không lòi ra ngoài thành viền
    c.save(); c.beginPath(); c.arc(905, 150, 58, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.rect(840, 85, 130, 130); c.arc(932, 128, 50, 0, Math.PI * 2, true); c.fill('evenodd');
    c.restore();
  } else { c.beginPath(); c.arc(905, 150, 70, 0, Math.PI * 2); c.fill(); }
  if (p.toi) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (const [x, y, r] of [[120, 120, 3], [300, 70, 2], [560, 150, 2.5], [720, 200, 3], [980, 520, 2], [60, 700, 2.5], [1030, 900, 2.5], [40, 1040, 2]] as const) {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  } else {
    c.fillStyle = 'rgba(255,255,255,.92)';
    for (const [x, y, rx, ry] of [[540, 120, 90, 32], [610, 98, 60, 26]] as const) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  }
  c.fillStyle = p.doi2; c.beginPath(); c.ellipse(860, H + 30, 640, 190, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.doi1; c.beginPath(); c.ellipse(220, H + 50, 620, 170, 0, 0, Math.PI * 2); c.fill();
}

/** Logo góc trên trái: một lá bài nghiêng + tên app viền đậm. */
export function veLogo(b: But, tenApp: string): void {
  const { c, fD } = b;
  c.save(); c.translate(100, 112); c.rotate(-0.17);
  tron(c, -31, -40 + 5, 62, 80, 12); c.fillStyle = '#1d2a5a'; c.fill();
  tron(c, -31, -40, 62, 80, 12); c.fillStyle = '#2b4c9b'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
  c.restore();
  c.font = `900 64px ${fD}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = '#1d2a5a';
  c.strokeText(tenApp, 150, 140); c.strokeText(tenApp, 150, 134);
  c.fillStyle = '#fff'; c.fillText(tenApp, 150, 134);
}

/** Tấm thẻ chính: (60, 200) → (1020, 1050). */
export const THE = { x: 60, y: 200, w: 960, h: 850 };
export function veThe(b: But): void { khoi(b, THE.x, THE.y, THE.w, THE.h, 64, b.p.the, 16, 9); }

/** Mặt vẽ tay (SVG trong MatBot) không vẽ được bằng chữ lên canvas → emoji gần nhất. */
const MAT_THAY: Record<string, string> = { ':bao-den:': '🐈‍⬛', ':rong-vang:': '🐉' };
/** Ô avatar: vuông bo tròn tô màu hồ sơ, emoji ở giữa; `vm` = vương miện phía trên. */
export function veAvatar(b: But, x: number, y: number, co: number, mat?: string, mau?: string, vm = false): void {
  const { c } = b;
  tron(c, x, y + co * 0.06, co, co, co * 0.29); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
  tron(c, x, y, co, co, co * 0.29); c.fillStyle = mau || '#f59e0b'; c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${Math.round(co * 0.64)}px sans-serif`;
  c.fillText(MAT_THAY[mat ?? ''] ?? mat ?? '🙂', x + co / 2, y + co / 2 + co * 0.04);
  if (vm) { c.font = `${Math.round(co * 0.48)}px sans-serif`; c.fillText('👑', x + co / 2, y - co * 0.16); }
  c.textBaseline = 'alphabetic';
}
/** Viên vàng (nhãn kết quả): căn giữa tại `cx`, mép trên `y`. Trả về đáy. */
export function veVien(b: But, chu: string, cx: number, y: number, mau: [string, string, string, string] = ['#ffe17a', '#f5b324', '#c98f12', '#4a3300']): number {
  const { c, fD } = b;
  c.font = `900 48px ${fD}`;
  const w = Math.min(860, c.measureText(chu).width + 80), h = 80;
  tron(c, cx - w / 2, y + 7, w, h, h / 2); c.fillStyle = mau[2]; c.fill();
  tron(c, cx - w / 2, y, w, h, h / 2); c.fillStyle = doc(c, y, y + h, [0, mau[0]], [1, mau[1]]); c.fill();
  c.fillStyle = mau[3]; c.textAlign = 'center'; c.fillText(vua(c, chu, w - 50), cx, y + 58);
  return y + h + 7;
}

/** Chân ảnh "vé mời": icon app · tên · link · mã QR thật của link. */
export function veChan(b: But, tenApp: string, link: string): void {
  const { c, p, fB } = b;
  const x = 60, y = 1094, w = 960, h = 150;
  khoi(b, x, y, w, h, 44, p.chan, 10, 7);
  // icon app
  const ix = x + 34, iy = y + 27;
  tron(c, ix, iy, 96, 96, 24); c.fillStyle = doc(c, iy, iy + 96, [0, '#5cc2f2'], [1, '#2b4c9b']); c.fill();
  c.save(); c.translate(ix + 48, iy + 48); c.rotate(-0.14);
  tron(c, -22 + 8, -29 + 2, 44, 58, 9); c.fillStyle = '#f5b324'; c.fill();
  tron(c, -22, -29, 44, 58, 9); c.fillStyle = '#fff'; c.fill();
  c.restore();
  // chữ
  const ten = /flip match/i.test(tenApp) ? tenApp : `${tenApp} · Flip Match`;
  c.textAlign = 'left'; c.fillStyle = p.chanChu; c.font = `800 42px ${fB}`;
  c.fillText(vua(c, ten, w - 330), ix + 126, y + 66);
  c.fillStyle = p.link; c.font = `800 32px ${fB}`;
  c.fillText(vua(c, link.replace(/^https?:\/\//, ''), w - 330), ix + 126, y + 112);
  // mã QR
  try {
    const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, co = 112, qx = x + w - co - 26, qy = y + (h - co) / 2;
    tron(c, qx - 6, qy - 6, co + 12, co + 12, 12); c.fillStyle = '#fff'; c.fill();
    const o = co / n;
    c.fillStyle = '#1d2348';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.modules.get(r, k)) c.fillRect(qx + k * o, qy + r * o, Math.ceil(o), Math.ceil(o));
  } catch { /* không có mã thì thôi — link vẫn in bằng chữ */ }
}

/** Ô số nhỏ: số to + nhãn. */
export function veO(b: But, x: number, y: number, w: number, h: number, so: string, nhan: string): void {
  const { c, p, fD, fB } = b;
  tron(c, x, y, w, h, 32); c.fillStyle = p.o; c.fill(); c.lineWidth = 4; c.strokeStyle = p.oVien; c.stroke();
  c.textAlign = 'center'; c.fillStyle = p.chu; c.font = `900 58px ${fD}`; c.fillText(vua(c, so, w - 20), x + w / 2, y + h / 2 + 10);
  c.fillStyle = p.chu2; c.font = `800 28px ${fB}`; c.fillText(vua(c, nhan, w - 20), x + w / 2, y + h / 2 + 52);
}
