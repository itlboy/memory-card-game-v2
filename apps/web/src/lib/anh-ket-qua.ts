/**
 * ẢNH KẾT QUẢ ĐỂ LƯU / CHIA SẺ (11.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/MkD66nuGdEmYrYf9wmniWy: "lưu ảnh để khoe hoặc trêu nhau sau này").
 *
 * Vẽ NGAY TRÊN MÁY bằng canvas 1080×1350 (khổ 4:5 — vừa bài đăng lẫn story), không gửi gì
 * lên server. Cuối ảnh có địa chỉ chơi ngay: mỗi ảnh khoe là một lời mời.
 *
 * Chia sẻ dùng Web Share (có FILE) — trên iPhone bảng chia sẻ có sẵn "Lưu hình ảnh".
 * Máy nào không chia sẻ được file (WebView Android trong app cũ) thì `coChiaSeAnh` = false
 * và nút ẩn đi; bản app có plugin chia sẻ sẽ bật lại (bản 1.6).
 */
import { laApp, nenApp } from './native';

export interface DongXepHang { hang: number; ten: string; diem: string; nhat?: boolean }
export interface NoiDungAnh {
  tieuDe: string;
  phu: string;
  /** Ván nhiều người: bảng xếp hạng. Ván một mình: các ô số liệu. */
  hang?: DongXepHang[];
  so?: { nhan: string; gt: string }[];
  cau: string;
  choiNgay: string;
  site: string;
  tenApp: string;
}

const W = 1080, H = 1350;
const MUC = '#1d2a5a';

function font(bien: string, duPhong: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(bien).trim();
    return v || duPhong;
  } catch { return duPhong; }
}

function khoiTron(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Khối nổi: đế mực lệch xuống `de` px rồi mặt khối, viền mực. */
function khoiNoi(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, mat: string | CanvasGradient, de: number, vien: number): void {
  khoiTron(c, x, y + de, w, h, r); c.fillStyle = MUC; c.fill();
  khoiTron(c, x, y, w, h, r); c.fillStyle = mat; c.fill();
  c.lineWidth = vien; c.strokeStyle = MUC; c.stroke();
}

/** Cắt chữ cho vừa `max` px, thêm "…". */
function vua(c: CanvasRenderingContext2D, s: string, max: number): string {
  if (c.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function chuVien(c: CanvasRenderingContext2D, s: string, x: number, y: number, day: number): void {
  c.lineJoin = 'round'; c.lineWidth = day * 2; c.strokeStyle = MUC;
  c.strokeText(s, x, y + day * .9); c.strokeText(s, x, y);
  c.fillStyle = '#fff'; c.fillText(s, x, y);
}

export async function veAnhKetQua(n: NoiDungAnh): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* vẽ bằng font dự phòng */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const fD = font('--font-display', "'Grandstander', system-ui, sans-serif");
  const fB = font('--font-body', "'Be Vietnam Pro', system-ui, sans-serif");

  // Nền trời + mây + mặt trời (cùng bộ với ảnh thẻ chia sẻ og.jpg)
  c.fillStyle = '#5cc2f2'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#4fb0ea';
  c.beginPath(); c.ellipse(260, H + 40, 620, 120, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd84d'; c.beginPath(); c.arc(975, 120, 58, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  for (const [x, y, rx, ry] of [[110, 108, 90, 34], [185, 82, 60, 26], [950, 1260, 80, 30]] as const) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }

  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `900 66px ${fD}`;
  chuVien(c, n.tenApp, W / 2, 128, 5);

  // Thẻ trắng giữa ảnh — cao theo nội dung, đặt giữa khoảng trống
  const soDong = n.hang?.length ?? Math.ceil((n.so?.length ?? 0) / 2);
  const caoNoiDung = n.hang ? soDong * 128 : soDong * 160;
  const cao = 150 + 96 + 52 + 40 + caoNoiDung + 110;
  const y0 = Math.max(200, Math.round(200 + (920 - cao) / 2));
  khoiNoi(c, 80, y0, W - 160, cao, 48, '#fffbea', 14, 8);

  let y = y0 + 150;
  c.font = `120px ${fB}`; c.fillText('🏆', W / 2, y);
  y += 96;
  c.fillStyle = MUC; c.font = `800 64px ${fD}`;
  c.fillText(vua(c, n.tieuDe, W - 260), W / 2, y);
  y += 52;
  c.fillStyle = 'rgba(29,42,90,.65)'; c.font = `700 30px ${fB}`;
  c.fillText(vua(c, n.phu, W - 260), W / 2, y);
  y += 40;

  if (n.hang) {
    for (const d of n.hang) {
      const x = 140, w = W - 280, h = 104;
      let mat: string | CanvasGradient = '#fff';
      if (d.nhat) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#ffc21a'); mat = g; }
      khoiNoi(c, x, y, w, h, 30, mat, d.nhat ? 7 : 0, 5);
      c.fillStyle = MUC; c.textAlign = 'left'; c.font = `800 40px ${fB}`;
      c.fillText(String(d.hang), x + 34, y + 66);
      c.textAlign = 'right'; c.font = `800 46px ${fB}`;
      c.fillText(d.diem, x + w - 34, y + 68);
      const rongDiem = c.measureText(d.diem).width;
      c.textAlign = 'left'; c.font = `800 40px ${fB}`;
      c.fillText(vua(c, d.ten, w - 34 - 70 - rongDiem - 40), x + 92, y + 66);
      y += 128;
    }
  } else if (n.so) {
    const cot = 2, w = (W - 280 - 24) / cot, h = 136;
    n.so.forEach((o, i) => {
      const x = 140 + (i % cot) * (w + 24), yy = y + Math.floor(i / cot) * 160;
      khoiNoi(c, x, yy, w, h, 28, '#fff', 0, 5);
      c.textAlign = 'center'; c.fillStyle = 'rgba(29,42,90,.65)'; c.font = `700 28px ${fB}`;
      c.fillText(vua(c, o.nhan, w - 30), x + w / 2, yy + 50);
      c.fillStyle = MUC; c.font = `800 52px ${fB}`;
      c.fillText(o.gt, x + w / 2, yy + 108);
    });
    y += caoNoiDung;
  }
  c.textAlign = 'center'; c.fillStyle = MUC; c.font = `800 36px ${fB}`;
  c.fillText(vua(c, n.cau, W - 260), W / 2, y + 44);

  // Chân ảnh: lời mời + địa chỉ trong viên trắng nổi khối
  c.font = `800 34px ${fB}`; c.fillStyle = MUC;
  c.fillText(n.choiNgay, W / 2, H - 175);
  c.font = `800 38px ${fB}`;
  const rong = c.measureText(n.site).width + 80;
  khoiNoi(c, (W - rong) / 2, H - 150, rong, 76, 38, '#fff', 6, 5);
  c.fillStyle = MUC; c.fillText(n.site, W / 2, H - 98);

  return new Promise((ok, loi) => cv.toBlob((b) => (b ? ok(b) : loi(new Error('toBlob'))), 'image/png'));
}

/** Máy này chia sẻ được FILE ảnh không (Web Share Level 2). */
export function coChiaSeFile(): boolean {
  try {
    const f = new File([new Uint8Array(1)], 'a.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [f] });
  } catch { return false; }
}

/** Hiện nút Lưu / Chia sẻ: web luôn có (tải file hoặc bảng chia sẻ), app chỉ khi chia sẻ được file. */
export const coChiaSeAnh = (): boolean => !laApp || coChiaSeFile();

const laIOS = (): boolean => nenApp === 'ios'
  || /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function tenFile(): string {
  const d = new Date();
  const p = (x: number): string => String(x).padStart(2, '0');
  return `flipmatch-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}

/**
 * LƯU ẢNH. iPhone: tải file chỉ vào app Tệp, không vào Ảnh → mở bảng chia sẻ (có "Lưu hình ảnh").
 * Android/máy tính: tải file thẳng (Android hiện trong Thư viện ảnh).
 */
export async function luuAnh(blob: Blob): Promise<'xong' | 'huy'> {
  const ten = tenFile();
  if (laIOS() && coChiaSeFile()) {
    try { await navigator.share({ files: [new File([blob], ten, { type: 'image/png' })] }); return 'xong'; }
    catch { return 'huy'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = ten;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'xong';
}

/** CHIA SẺ: ảnh + câu mời + link. Không chia sẻ được file thì chia sẻ chữ, không nữa thì copy. */
export async function chiaSeAnh(blob: Blob, chu: string, url: string): Promise<'xong' | 'huy' | 'copy'> {
  const file = new File([blob], tenFile(), { type: 'image/png' });
  try {
    if (coChiaSeFile()) { await navigator.share({ files: [file], text: `${chu}\n${url}` }); return 'xong'; }
    if (typeof navigator.share === 'function') { await navigator.share({ text: chu, url }); return 'xong'; }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'huy';
  }
  try { await navigator.clipboard.writeText(`${chu}\n${url}`); return 'copy'; } catch { return 'huy'; }
}
