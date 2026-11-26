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
import { THE, W, moBut, raBlob, tron, veAvatar, veChan, veLogo, veNen, veO, veThe, veVien, vua, type But } from './anh-chia-se';

/* BẢN MỚI 26.11.2026 (mockup https://claude.ai/artifact/WLMtGi289WrYicB9N3wYb3): phần VẼ ở lib/anh-chia-se.ts — mỗi ảnh là
   "tấm thẻ khoe" có avatar + tên, một con số thật to, và chân ảnh là vé mời (icon app · link `/tai` · mã QR thật). */
export interface DongXepHang { hang: number; ten: string; diem: string; nhat?: boolean; mat?: string; mau?: string }
/** Một cột bảng tỷ số. `mat`: mặt từng người (đội thì nhiều mặt). */
export interface CotTySo { ten: string; n: number; diem?: string; mat?: { mat?: string; anh?: string | null; mau?: string }[] }
export interface NoiDungAnh {
  tieuDe: string;
  phu: string;
  /** Người chơi trên máy (ván một mình): avatar + tên ở đầu thẻ. */
  nguoi?: { ten: string; mat?: string; mau?: string };
  /** Ván nhiều người: bục 1–2–3 (+ dòng nhỏ cho người thứ 4 trở đi). Ván một mình: các ô số liệu (ô đầu là con số to). */
  hang?: DongXepHang[];
  /** TỶ SỐ CẢ LOẠT — có thì ảnh vẽ các avatar đối mặt và tỷ số to, bỏ `hang`. */
  tySo?: { nhan: string; ds: CotTySo[] };
  so?: { nhan: string; gt: string }[];
  cau: string;
  choiNgay: string;
  /** Link in ở chân ảnh + mã QR (nên là `/tai`). */
  site: string;
  tenApp: string;
}

export async function veAnhKetQua(n: NoiDungAnh): Promise<Blob> {
  const { cv, b } = await moBut();
  veNen(b); veLogo(b, n.tenApp); veThe(b);
  if (n.tySo?.ds.length) veTySo(b, n);
  else if (n.hang?.length) veBuc(b, n);
  else veMotMinh(b, n);
  veChan(b, n.tenApp, n.site.startsWith('http') ? n.site : `https://${n.site}`);
  return raBlob(cv);
}

/** Ván một mình: avatar + tên · viên "Thắng rồi!" · ĐIỂM thật to · ba ô số liệu. */
function veMotMinh(b: But, n: NoiDungAnh): void {
  const { c, p, fD, fB } = b;
  const cx = W / 2;
  let y = THE.y + 60;
  if (n.nguoi) {
    c.font = `800 46px ${fB}`;
    const ten = vua(c, n.nguoi.ten, 600), w = 104 + 22 + c.measureText(ten).width, x0 = cx - w / 2;
    veAvatar(b, x0, y, 104, n.nguoi.mat, n.nguoi.mau);
    c.textAlign = 'left'; c.fillStyle = p.chu; c.fillText(ten, x0 + 126, y + 68);
    y += 130;
  }
  y = veVien(b, `🏆 ${n.tieuDe}`, cx, y) + 24;
  const [dau, ...con] = n.so ?? [];
  if (dau) {
    c.textAlign = 'center'; c.fillStyle = p.chu; c.font = `900 200px ${fD}`;
    c.fillText(vua(c, dau.gt, 860), cx, y + 180);
    c.fillStyle = p.chu2; c.font = `800 38px ${fB}`;
    c.fillText(vua(c, `${dau.nhan.toLowerCase()} · ${n.phu}`, 860), cx, y + 240);
  }
  const o = con.slice(0, 3), gap = 22, w = (THE.w - 120 - gap * (o.length - 1)) / Math.max(1, o.length), h = 150;
  o.forEach((x, i) => veO(b, THE.x + 60 + i * (w + gap), THE.y + THE.h - 60 - h, w, h, x.gt, x.nhan));
}

/** Nhiều người: viên "X thắng!" · dòng phụ · bục 1–2–3 có avatar · người thứ 4 trở đi một dòng nhỏ. */
function veBuc(b: But, n: NoiDungAnh): void {
  const { c, p, fD, fB } = b;
  const cx = W / 2;
  let y = veVien(b, `🏆 ${n.tieuDe}`, cx, THE.y + 56) + 20;
  c.textAlign = 'center'; c.fillStyle = p.chu2; c.font = `800 32px ${fB}`; c.fillText(vua(c, n.phu, 860), cx, y + 24);
  const ds = n.hang!;
  const top = ds.slice(0, 3);
  // thứ tự bày: 2 · 1 · 3 (bục giữa cao nhất); hai người thì 2 · 1
  const bay = top.length >= 3 ? [top[1]!, top[0]!, top[2]!] : top.length === 2 ? [top[1]!, top[0]!] : [top[0]!];
  const cao = (d: DongXepHang): number => (d.hang === 1 ? 240 : d.hang === 2 ? 170 : 120);
  const mauBuc = (d: DongXepHang): [string, string] => (d.hang === 1 ? ['#ffe17a', '#f5b324'] : d.hang === 2 ? ['#dfe4f0', '#9aa6c2'] : ['#f3bd88', '#c97a3d']);
  const cw = 250, gap = 26, tong = bay.length * cw + (bay.length - 1) * gap, x0 = cx - tong / 2;
  const dayBuc = THE.y + THE.h - (ds.length > 3 ? 120 : 60);
  bay.forEach((d, i) => {
    const x = x0 + i * (cw + gap), hb = cao(d), yb = dayBuc - hb;
    // bục
    tron(b.c, x, yb, cw, hb, 26); c.fillStyle = (() => { const g = c.createLinearGradient(0, yb, 0, yb + hb); g.addColorStop(0, mauBuc(d)[0]); g.addColorStop(1, mauBuc(d)[1]); return g; })(); c.fill();
    c.textAlign = 'center'; c.font = `900 96px ${fD}`; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.22)';
    c.strokeText(String(d.hang), x + cw / 2, yb + hb / 2 + 34); c.fillStyle = '#fff'; c.fillText(String(d.hang), x + cw / 2, yb + hb / 2 + 34);
    // điểm · tên · avatar phía trên bục
    c.fillStyle = p.chu2; c.font = `800 32px ${fB}`; c.fillText(vua(c, d.diem, cw), x + cw / 2, yb - 18);
    c.fillStyle = p.chu; c.font = `800 38px ${fB}`; c.fillText(vua(c, d.ten, cw), x + cw / 2, yb - 62);
    const co = d.hang === 1 ? 120 : 100;
    veAvatar(b, x + cw / 2 - co / 2, yb - 104 - co, co, d.mat, d.mau, d.hang === 1 && !!d.nhat);
  });
  if (ds.length > 3) {
    c.textAlign = 'center'; c.fillStyle = p.chu2; c.font = `800 30px ${fB}`;
    c.fillText(vua(c, ds.slice(3).map((d) => `${d.hang}. ${d.ten} ${d.diem}`).join('   ·   '), 860), cx, THE.y + THE.h - 56);
  }
}

/** Tỷ số cả loạt: viên kết quả · nhãn tỷ số · các avatar đối mặt, số ván thắng thật to (hai người thì "2 – 1" ở giữa). */
function veTySo(b: But, n: NoiDungAnh): void {
  const { c, p, fD, fB } = b;
  const cx = W / 2;
  let y = veVien(b, `🏆 ${n.tieuDe}`, cx, THE.y + 56) + 20;
  c.textAlign = 'center'; c.fillStyle = p.chu2; c.font = `800 32px ${fB}`; c.fillText(vua(c, n.tySo!.nhan, 860), cx, y + 24);
  const ds = n.tySo!.ds.slice(0, 4);
  const maxN = Math.max(...ds.map((d) => d.n));
  const vaMat = (d: CotTySo) => d.mat?.[0];
  if (ds.length === 2) {
    const [a, bb] = ds as [CotTySo, CotTySo];
    const co = 170, yA = THE.y + 300;
    for (const [d, xc] of [[a, cx - 300], [bb, cx + 300]] as const) {
      veAvatar(b, xc - co / 2, yA, co, vaMat(d)?.mat, vaMat(d)?.mau, d.n === maxN && maxN > 0);
      c.textAlign = 'center'; c.fillStyle = p.chu; c.font = `800 44px ${fB}`; c.fillText(vua(c, d.ten, 260), xc, yA + co + 64);
      if (d.diem) { c.fillStyle = p.chu2; c.font = `800 30px ${fB}`; c.fillText(vua(c, d.diem, 260), xc, yA + co + 108); }
    }
    c.fillStyle = p.chu; c.font = `900 170px ${fD}`; c.textAlign = 'center';
    c.fillText(`${a.n}–${bb.n}`, cx, yA + co / 2 + 60);
  } else {
    const cw = (THE.w - 120) / ds.length, co = 130, yA = THE.y + 290;
    ds.forEach((d, i) => {
      const xc = THE.x + 60 + cw * i + cw / 2;
      veAvatar(b, xc - co / 2, yA, co, vaMat(d)?.mat, vaMat(d)?.mau, d.n === maxN && maxN > 0);
      c.textAlign = 'center'; c.fillStyle = p.chu; c.font = `800 38px ${fB}`; c.fillText(vua(c, d.ten, cw - 16), xc, yA + co + 56);
      c.font = `900 120px ${fD}`; c.fillText(String(d.n), xc, yA + co + 190);
    });
  }
  c.fillStyle = p.chu; c.font = `800 42px ${fB}`; c.textAlign = 'center';
  c.fillText(vua(c, n.cau, 860), cx, THE.y + THE.h - 70);
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

/*
 * ẢNH CHIA SẺ CHỈ SỐ TRÍ NHỚ (26.11.2026, chủ dự án: "làm tính năng chia sẻ chỉ số trí nhớ… kèm link để người dùng cài app"; bản
 * mới cùng ngày thêm cả biểu đồ 14 ngày). Avatar + tên · huy chương điểm + bậc + thay đổi so với tuần trước · thanh 5 bậc ·
 * "Theo số lượt" (5 chặng) · "14 ngày qua" (cột hôm nay sáng nhất, ngày chưa có điểm là vạch mờ) · vé mời ở chân.
 */
export interface NoiDungTriNho {
  tenApp: string; tieuDe: string; diem: number; bac: number; tenBac: string; cacBac: string[];
  chang: { nhan: string; tiLe: number | null }[]; cau: string; taiApp: string; link: string;
  nguoi?: { ten: string; mat?: string; mau?: string };
  /** 14 ngày, cũ → mới; null = ngày chưa đủ số liệu. */
  ngay14?: (number | null)[]; nhan14?: [string, string];
  muc5?: string; muc14?: string;
  /** Dòng nhỏ cạnh huy chương, vd "▲ 32 điểm so với tuần trước". */
  lech?: string;
}
const MAU_BAC = ['#c98a4b', '#b6bfd3', '#f0b400', '#8fd3f4', '#8ee0ff'];
export async function veAnhTriNho(n: NoiDungTriNho): Promise<Blob> {
  const { cv, b } = await moBut();
  const { c, p, fD, fB } = b;
  veNen(b); veLogo(b, n.tenApp); veThe(b);
  const x0 = THE.x + 56, wT = THE.w - 112, cx = W / 2;
  let y = THE.y + 40;
  // tiêu đề: avatar + "Chỉ số trí nhớ của …"
  c.font = `800 42px ${fB}`;
  const tieu = vua(c, n.tieuDe, 700), coAv = 84, wTieu = (n.nguoi ? coAv + 20 : 0) + c.measureText(tieu).width;
  let xt = cx - wTieu / 2;
  if (n.nguoi) { veAvatar(b, xt, y, coAv, n.nguoi.mat, n.nguoi.mau); xt += coAv + 20; }
  c.textAlign = 'left'; c.fillStyle = p.chu; c.font = `800 42px ${fB}`; c.fillText(tieu, xt, y + 56);
  y += 110;
  // huy chương + bậc
  const mau = MAU_BAC[n.bac] ?? MAU_BAC[0]!, r = 88, hx = x0 + 110, hy = y + r;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(hx, hy + 9, r, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(hx - 30, hy - 32, 8, hx, hy, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, mau);
  c.fillStyle = g; c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fill();
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(hx, hy, r - 7, 0, Math.PI * 2); c.stroke();
  c.textAlign = 'center'; c.fillStyle = '#1d2a5a'; c.font = `900 ${n.diem >= 1000 ? 66 : 78}px ${fD}`; c.fillText(String(n.diem), hx, hy + 28);
  const bx = hx + r + 40;
  c.font = `900 46px ${fD}`;
  const wb = Math.min(440, c.measureText(n.tenBac).width + 80);
  tron(c, bx, hy - 62 + 7, wb, 72, 36); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  tron(c, bx, hy - 62, wb, 72, 36); c.fillStyle = mau; c.fill();
  c.textAlign = 'center'; c.fillStyle = '#1d2a5a'; c.fillText(vua(c, n.tenBac, wb - 30), bx + wb / 2, hy - 10);
  if (n.lech) { c.textAlign = 'left'; c.fillStyle = p.chu2; c.font = `800 30px ${fB}`; c.fillText(vua(c, n.lech, THE.x + THE.w - 56 - bx), bx, hy + 52); }
  y = hy + r + 26;
  // thanh 5 bậc
  const ob = (wT - 4 * 12) / 5;
  n.cacBac.slice(0, 5).forEach((_, i) => { tron(c, x0 + i * (ob + 12), y, ob, 22, 11); c.fillStyle = i <= n.bac ? (MAU_BAC[i] ?? p.o) : p.oVien; c.fill(); });
  y += 70;
  const muc = (chu: string, yy: number): void => { c.textAlign = 'left'; c.fillStyle = p.chu2; c.font = `800 27px ${fB}`; c.fillText(chu.toLocaleUpperCase(), x0, yy); };
  // 5 chặng
  muc(n.muc5 ?? '', y);
  const hc = 110, cw = (wT - 4 * 22) / 5, day5 = y + 40 + hc;
  n.chang.slice(0, 5).forEach((ch, i) => {
    const x = x0 + i * (cw + 22);
    const h = ch.tiLe === null ? 8 : Math.max(10, Math.round(hc * Math.min(1, ch.tiLe)));
    tron(c, x, day5 - h, cw, h, 14);
    c.fillStyle = ch.tiLe === null ? p.oVien : (() => { const gg = c.createLinearGradient(0, day5 - h, 0, day5); gg.addColorStop(0, '#2ed3b7'); gg.addColorStop(1, '#0f8a7a'); return gg; })(); c.fill();
    c.textAlign = 'center'; c.fillStyle = p.chu; c.font = `900 30px ${fD}`; c.fillText(ch.tiLe === null ? '–' : `${Math.round(ch.tiLe * 100)}%`, x + cw / 2, day5 - h - 10);
    c.fillStyle = p.chu2; c.font = `800 22px ${fB}`; c.fillText(vua(c, ch.nhan, cw + 14), x + cw / 2, day5 + 30);
  });
  y = day5 + 92;
  // 14 ngày
  if (n.ngay14?.length) {
    muc(n.muc14 ?? '', y);
    const d14 = n.ngay14, h14 = 96, gap = 8, w14 = (wT - gap * (d14.length - 1)) / d14.length, day = y + 22 + h14;
    const dinh = Math.max(200, ...d14.map((v) => v ?? 0));
    d14.forEach((v, i) => {
      const x = x0 + i * (w14 + gap);
      const h = v === null ? 10 : Math.max(14, Math.round(h14 * (v / dinh)));
      tron(c, x, day - h, w14, h, 8);
      c.fillStyle = v === null ? p.oVien : i === d14.length - 1 ? '#14b8a0' : 'rgba(20,184,160,.5)'; c.fill();
    });
    if (n.nhan14) {
      c.fillStyle = p.chu2; c.font = `800 22px ${fB}`;
      c.textAlign = 'left'; c.fillText(n.nhan14[0], x0, day + 30);
      c.textAlign = 'right'; c.fillText(n.nhan14[1], x0 + wT, day + 30);
    }
  }
  veChan(b, n.tenApp, n.link.startsWith('http') ? n.link : `https://${n.link}`);
  return raBlob(cv);
}
