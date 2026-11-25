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
import { suKien } from './phan-tich';

export interface DongXepHang { hang: number; ten: string; diem: string; nhat?: boolean }
/** Một cột bảng tỷ số. `mat`: mặt từng người (đội thì nhiều mặt) — emoji / khoá mặt vẽ, `anh` = ảnh Google. */
export interface CotTySo { ten: string; n: number; diem?: string; mat?: { mat?: string; anh?: string | null; mau?: string }[] }
export interface NoiDungAnh {
  tieuDe: string;
  phu: string;
  /** Ván nhiều người: bảng xếp hạng. Ván một mình: các ô số liệu. */
  hang?: DongXepHang[];
  /** TỶ SỐ CẢ LOẠT — có thì ảnh vẽ BẢNG TỶ SỐ như màn cuối ván (mỗi người một cột: mặt, tên, số ván thắng
   *  thật to, điểm ván này) và bỏ danh sách `hang`. Xem `veBangTySo`. */
  tySo?: { nhan: string; ds: CotTySo[] };
  so?: { nhan: string; gt: string }[];
  cau: string;
  choiNgay: string;
  site: string;
  tenApp: string;
}

const W = 1080, H = 1350;
/*
 * SÁNG / TỐI THEO APP (19.11.2026, chủ dự án: "bảng chia sẻ có giao diện sáng tối như app đc ko?"): đọc
 * `data-theme` của <html> lúc vẽ. Tối = trời đêm (trăng khuyết + sao thay mặt trời + mây), thẻ xanh đậm chữ sáng.
 * `VIEN` = nét viền + đế khối nổi; `CHU` = chữ chính; `NHAT` = chữ phụ.
 */
const SANG = {
  troi: '#5cc2f2', doi: '#4fb0ea', the: '#fffbea', o: '#fff', vien: '#1d2a5a', chu: '#1d2a5a',
  nhat: 'rgba(29,42,90,.62)', mo: 'rgba(29,42,90,.3)', danNen: '255,243,196', danSo: '#e08a00', danBong: '#ffd86b',
  nhat1: ['#ffe066', '#ffc21a'] as [string, string], vienAnh: '#fff',
};
const TOI: typeof SANG = {
  troi: '#141b44', doi: '#1d2660', the: '#232c5e', o: '#2d3872', vien: '#0a0f2c', chu: '#eef1ff',
  nhat: 'rgba(238,241,255,.66)', mo: 'rgba(238,241,255,.32)', danNen: '255,200,60', danSo: '#ffc21a', danBong: '#7a5200',
  nhat1: ['#ffd84d', '#e0a200'], vienAnh: '#2d3872',
};
let P = SANG;
let MUC = SANG.vien;
const laToi = (): boolean => { try { return document.documentElement.dataset.theme === 'dark'; } catch { return false; } };

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

  P = laToi() ? TOI : SANG; MUC = P.vien;
  // Nền trời + đồi; sáng: mặt trời + mây (cùng bộ với og.jpg) — tối: trăng khuyết + sao
  c.fillStyle = P.troi; c.fillRect(0, 0, W, H);
  c.fillStyle = P.doi;
  c.beginPath(); c.ellipse(260, H + 40, 620, 120, 0, 0, Math.PI * 2); c.fill();
  if (P === TOI) {
    c.fillStyle = '#f4e6a6'; c.beginPath(); c.arc(975, 120, 54, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.troi; c.beginPath(); c.arc(995, 104, 46, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)';
    for (const [x, y, r] of [[90, 90, 4], [210, 150, 3], [330, 70, 2.5], [760, 60, 3], [860, 170, 2.5], [60, 1230, 3], [990, 1260, 4], [930, 1190, 2.5]] as const) {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  } else {
    c.fillStyle = '#ffd84d'; c.beginPath(); c.arc(975, 120, 58, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    for (const [x, y, rx, ry] of [[110, 108, 90, 34], [185, 82, 60, 26], [950, 1260, 80, 30]] as const) {
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    }
  }

  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `900 66px ${fD}`;
  chuVien(c, n.tenApp, W / 2, 128, 5);

  if (n.tySo?.ds.length) {
    await veBangTySo(c, n, fD, fB);
  } else {
  // Thẻ trắng giữa ảnh — cao theo nội dung, đặt giữa khoảng trống
  const soDong = n.hang?.length ?? Math.ceil((n.so?.length ?? 0) / 2);
  const caoNoiDung = n.hang ? soDong * 128 : soDong * 160;
  const cao = 150 + 96 + 52 + 40 + caoNoiDung + 110;
  const y0 = Math.max(200, Math.round(200 + (920 - cao) / 2));
  khoiNoi(c, 80, y0, W - 160, cao, 48, P.the, 14, 8);

  let y = y0 + 150;
  c.font = `120px ${fB}`; c.fillText('🏆', W / 2, y);
  y += 96;
  c.fillStyle = P.chu; c.font = `800 64px ${fD}`;
  c.fillText(vua(c, n.tieuDe, W - 260), W / 2, y);
  y += 52;
  c.fillStyle = P.nhat; c.font = `700 30px ${fB}`;
  c.fillText(vua(c, n.phu, W - 260), W / 2, y);
  y += 40;

  if (n.hang) {
    for (const d of n.hang) {
      const x = 140, w = W - 280, h = 104;
      let mat: string | CanvasGradient = P.o;
      if (d.nhat) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, P.nhat1[0]); g.addColorStop(1, P.nhat1[1]); mat = g; }
      khoiNoi(c, x, y, w, h, 30, mat, d.nhat ? 7 : 0, 5);
      // Dòng nhất nền vàng: chữ mực tối ở cả hai theme (chữ sáng của theme tối không đọc được trên vàng)
      c.fillStyle = d.nhat ? '#1d2a5a' : P.chu; c.textAlign = 'left'; c.font = `800 40px ${fB}`;
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
      khoiNoi(c, x, yy, w, h, 28, P.o, 0, 5);
      c.textAlign = 'center'; c.fillStyle = P.nhat; c.font = `700 28px ${fB}`;
      c.fillText(vua(c, o.nhan, w - 30), x + w / 2, yy + 50);
      c.fillStyle = P.chu; c.font = `800 52px ${fB}`;
      c.fillText(o.gt, x + w / 2, yy + 108);
    });
    y += caoNoiDung;
  }
  c.textAlign = 'center'; c.fillStyle = P.chu; c.font = `800 36px ${fB}`;
  c.fillText(vua(c, n.cau, W - 260), W / 2, y + 44);
  }

  // Chân ảnh: lời mời + địa chỉ trong viên trắng nổi khối
  c.font = `800 34px ${fB}`; c.fillStyle = P.chu;
  c.fillText(n.choiNgay, W / 2, H - 175);
  c.font = `800 38px ${fB}`;
  const rong = c.measureText(n.site).width + 80;
  khoiNoi(c, (W - rong) / 2, H - 150, rong, 76, 38, P.o, 6, 5);
  c.fillStyle = P.chu; c.fillText(n.site, W / 2, H - 98);

  return new Promise((ok, loi) => cv.toBlob((b) => (b ? ok(b) : loi(new Error('toBlob'))), 'image/png'));
}

/** Mặt vẽ tay (SVG trong MatBot) không vẽ được bằng chữ lên canvas → emoji gần nhất. */
const MAT_THAY: Record<string, string> = { ':bao-den:': '🐈‍⬛', ':rong-vang:': '🐉' };

/** Ảnh Google: tải kiểu CORS — máy chủ không cho thì `onerror` (KHÔNG làm bẩn canvas, toBlob vẫn chạy) → mặt thú. */
function taiAnh(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const im = new Image();
    im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
    const het = setTimeout(() => ok(null), 2500);
    im.onload = () => { clearTimeout(het); ok(im); };
    im.onerror = () => { clearTimeout(het); ok(null); };
    im.src = src;
  });
}

/**
 * BẢNG TỶ SỐ NHƯ MÀN CUỐI VÁN (19.11.2026, mockup duyệt https://claude.ai/artifact/11swqn2QDAce9P5GTBxAbz,
 * chủ dự án: "hiển thị rõ kết quả tổng tỷ số hơn như chính giao diện cuối ván"). Trước đó tỷ số chỉ là một
 * dòng chữ "Linh 3 · Minh 1", phần lớn ảnh là danh sách điểm ván cuối.
 * Mỗi người một cột: mặt · tên · SỐ VÁN THẮNG thật to · "220 điểm". Người dẫn DUY NHẤT: nền vàng nhạt, số
 * vàng cam, vương miện. 2 người đặt đối đầu "3 – 2"; ≤3 người một hàng; từ 4 người lưới 3 cột (≤4 hàng).
 */
async function veBangTySo(c: CanvasRenderingContext2D, n: NoiDungAnh, fD: string, fB: string): Promise<void> {
  const ds = n.tySo!.ds;
  const max = Math.max(...ds.map((d) => d.n));
  const dan = max > 0 && ds.filter((d) => d.n === max).length === 1;
  const hai = ds.length === 2;
  const soCot = ds.length <= 3 ? ds.length : 3;
  const soHang = Math.ceil(ds.length / soCot);
  const rowH = hai ? 440 : ds.length === 3 ? 410 : Math.min(290, Math.floor(560 / soHang));   // thẻ phải dừng trước chân ảnh (~1150px)
  const anh = await Promise.all(ds.map((d) => Promise.all((d.mat ?? []).map((m) => (m.anh ? taiAnh(m.anh) : Promise.resolve(null))))));

  const caoBang = soHang * rowH + 40;
  const cao = 236 + caoBang + 100;
  const y0 = Math.max(190, Math.round(190 + (990 - cao) / 2));
  khoiNoi(c, 80, y0, W - 160, cao, 48, P.the, 14, 8);

  c.textAlign = 'center';
  c.fillStyle = P.nhat; c.font = `800 30px ${fB}`;
  c.fillText(vua(c, n.tySo!.nhan.toUpperCase(), W - 260), W / 2, y0 + 72);
  c.fillStyle = P.chu; c.font = `900 68px ${fD}`;
  c.fillText(vua(c, n.tieuDe, W - 240), W / 2, y0 + 150);
  c.fillStyle = P.nhat; c.font = `700 28px ${fB}`;
  c.fillText(vua(c, n.phu, W - 260), W / 2, y0 + 196);

  const bx = 130, bw = W - 260, by = y0 + 226;
  khoiNoi(c, bx, by, bw, caoBang, 34, P.o, 0, 6);
  const giua = hai ? 70 : 0;                         // chỗ cho dấu "–" giữa hai người
  const colW = (bw - 20 - giua) / soCot;
  ds.forEach((d, i) => {
    const r = Math.floor(i / soCot), k = i % soCot;
    const conHang = Math.min(soCot, ds.length - r * soCot);     // hàng cuối thiếu người → căn giữa
    const lech = (soCot - conHang) * colW / 2;
    const cx = bx + 10 + lech + k * colW + colW / 2 + (hai && k === 1 ? giua : 0);
    const top = by + 20 + r * rowH;
    const laDan = dan && d.n === max;
    if (laDan) {
      const g = c.createLinearGradient(0, top, 0, top + rowH);
      g.addColorStop(0, `rgba(${P.danNen},${P === TOI ? .2 : 1})`); g.addColorStop(1, `rgba(${P.danNen},0)`);
      khoiTron(c, cx - colW / 2 + 6, top, colW - 12, rowH - 6, 26); c.fillStyle = g; c.fill();
    }
    // Mặt (đội: nhiều mặt nhỏ cạnh nhau)
    const mats = d.mat?.length ? d.mat : [{}];
    const f = Math.round(rowH * (mats.length > 1 ? .2 : .27) / Math.max(1, Math.min(mats.length, 3) * .62));
    const yMat = top + rowH * .06 + f;
    mats.forEach((m, j) => {
      const mx = cx + (j - (mats.length - 1) / 2) * f * 1.05;
      const im = anh[i]?.[j];
      if (im) {
        c.save(); c.beginPath(); c.arc(mx, yMat - f * .42, f * .5, 0, Math.PI * 2); c.closePath(); c.clip();
        c.drawImage(im, mx - f * .5, yMat - f * .92, f, f); c.restore();
        c.beginPath(); c.arc(mx, yMat - f * .42, f * .5, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = P.vienAnh; c.stroke();
      } else {
        // Ô màu hồ sơ sau mặt (một người một cột; đội thì các mặt đứng sát nhau, không tô) — khớp bảng kết quả trong app
        if (m.mau && mats.length === 1) { const o = f * 1.3; khoiTron(c, mx - o / 2, yMat - f * .4 - o / 2, o, o, o * .28); c.fillStyle = m.mau; c.fill(); }
        c.font = `${f}px ${fB}`; c.fillStyle = P.chu;
        c.fillText(MAT_THAY[m.mat ?? ''] ?? m.mat ?? '🙂', mx, yMat);
      }
    });
    if (laDan) { c.font = `${Math.round(f * .5)}px ${fB}`; c.fillText('👑', cx + f * .48, yMat - f * .9); }
    // Tên
    const coTen = Math.round(rowH * .085);
    c.fillStyle = P.chu; c.font = `800 ${coTen}px ${fD}`;
    const yTen = yMat + rowH * .05 + coTen;
    c.fillText(vua(c, d.ten, colW - 24), cx, yTen);
    // Số ván thắng — to nhất
    const coSo = Math.round(rowH * .36);
    c.font = `900 ${coSo}px ${fD}`;
    const ySo = yTen + coSo * .95;
    if (laDan) { c.fillStyle = P.danBong; c.fillText(String(d.n), cx, ySo + 6); }
    c.fillStyle = laDan ? P.danSo : P.chu;
    c.fillText(String(d.n), cx, ySo);
    if (d.diem) {
      c.fillStyle = P.nhat; c.font = `700 ${Math.round(rowH * .065)}px ${fB}`;
      c.fillText(vua(c, d.diem, colW - 20), cx, ySo + rowH * .1);
    }
  });
  if (hai) {
    c.fillStyle = P.mo; c.font = `900 90px ${fD}`;
    c.fillText('–', bx + bw / 2, by + 20 + rowH * .62);
  }
  c.fillStyle = P.chu; c.font = `800 36px ${fB}`;
  c.fillText(vua(c, n.cau, W - 260), W / 2, by + caoBang + 62);
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
  const kq = await luuAnhTho(blob);
  suKien('chia_se', { kenh: 'luu_anh', ket_qua: kq });   // PHÂN TÍCH 17.11.2026: mở hộp ≠ lưu thật
  return kq;
}
async function luuAnhTho(blob: Blob): Promise<'xong' | 'huy'> {
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
  const kq = await chiaSeAnhTho(blob, chu, url);
  // `kenh` = đường chia sẻ máy này đi được; `copy` = không có bảng chia sẻ, đã chép chữ + link
  suKien('chia_se', { kenh: kq === 'copy' ? 'copy' : coChiaSeFile() ? 'anh' : 'chu', ket_qua: kq });
  return kq;
}
async function chiaSeAnhTho(blob: Blob, chu: string, url: string): Promise<'xong' | 'huy' | 'copy'> {
  const file = new File([blob], tenFile(), { type: 'image/png' });
  try {
    if (coChiaSeFile()) { await navigator.share({ files: [file], text: `${chu}\n${url}` }); return 'xong'; }
    if (typeof navigator.share === 'function') { await navigator.share({ text: chu, url }); return 'xong'; }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'huy';
  }
  try { await navigator.clipboard.writeText(`${chu}\n${url}`); return 'copy'; } catch { return 'huy'; }
}
