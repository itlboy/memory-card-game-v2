/**
 * BÁO LỖI / GÓP Ý (28.11.2026, mockup duyệt https://claude.ai/artifact/QUH5duZnNP6ZJ7kS8Q78BJ) — phần không giao diện:
 * thu thông tin máy gửi kèm + nén ảnh + gửi `POST /api/baoloi` (apps/node-server/src/baoloi.ts).
 *
 * GỬI KÈM TỰ ĐỘNG (hộp báo lỗi ghi rõ cho người chơi): máy (dòng máy, hãng, hệ điều hành), màn hình (cỡ, độ nét, tai thỏ,
 * xoay), app (bản gốc + bản cập nhật nóng, ngôn ngữ, sáng/tối, màn đang mở), chẩn đoán (lỗi JS gần đây, nhật ký máy, mạng).
 * KHÔNG gửi tên người chơi, email tài khoản hay mã thiết bị bền: `cid` là mã khách GA (ngẫu nhiên, chỉ để chống spam).
 */
import { laApp, nenApp, SERVER_URL } from './native';
import { loiGanDay } from './phan-tich';
import { chupNhatKy } from './nhat-ky-may';
import { ngonNgu } from './i18n';
import { store } from './storage';

export type LoaiBl = 'loi' | 'gopy' | 'hoi';
export type NoiBl = 'motMinh' | 'may' | 'online' | 'timThe' | 'chienDich' | 'premium' | 'khac';
export const NOI_BL: NoiBl[] = ['motMinh', 'may', 'online', 'timThe', 'chienDich', 'premium', 'khac'];
export type VanDeBl = 'dung' | 'vang' | 'matKetNoi' | 'hienThi' | 'diemSai' | 'cham' | 'amThanh' | 'khac' | 'tinhNang' | 'giaoDien' | 'doKho';
/** Chip "chuyện gì xảy ra" theo loại (khớp `VAN_DE` ở server). Câu hỏi không có chip. */
export const VAN_DE_BL: Record<LoaiBl, VanDeBl[]> = {
  loi: ['dung', 'vang', 'matKetNoi', 'hienThi', 'diemSai', 'cham', 'amThanh', 'khac'],
  gopy: ['tinhNang', 'giaoDien', 'doKho', 'khac'],
  hoi: []
};

/** Màn người chơi vừa rời — App.vue ghi lại mỗi khi đổi màn, hộp báo lỗi chọn sẵn "Ở đâu" theo nó. */
let manGanNhat: NoiBl = 'khac';
export function ghiManGanNhat(n: NoiBl): void { manGanNhat = n; }
export const manVuaRoi = (): NoiBl => manGanNhat;

/** Vùng tai thỏ / thanh điều hướng (px) — đọc env() qua một phần tử tạm. */
function vungAnToan(): string {
  try {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0)';
    document.body.appendChild(d);
    const c = getComputedStyle(d);
    const kq = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map((x) => Math.round(parseFloat(x) || 0)).join(',');
    d.remove();
    return kq;
  } catch { return ''; }
}

/** Đoán máy từ trình duyệt (web, hoặc app chưa có plugin Device). */
function doanTuUa(): Record<string, string> {
  const ua = navigator.userAgent;
  const ios = ua.match(/(iPhone|iPad|iPod).*?OS (\d+[_\d]*)/);
  if (ios) return { may: ios[1]!, heDieuHanh: 'iOS', banHdh: ios[2]!.replace(/_/g, '.') };
  const and = ua.match(/Android (\d+(?:\.\d+)*);\s*([^;)]+)/);
  if (and) return { may: and[2]!.replace(/\s*Build\/.*/, '').trim(), heDieuHanh: 'Android', banHdh: and[1]! };
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'khác';
  return { may: 'máy tính', heDieuHanh: os, banHdh: '' };
}

export async function thuThapMay(): Promise<Record<string, unknown>> {
  const ra: Record<string, unknown> = { nen: nenApp, laApp, ...doanTuUa() };
  if (laApp) {
    try {
      const { Device } = await import('@capacitor/device');
      const i = await Device.getInfo();
      Object.assign(ra, { may: i.model, hang: i.manufacturer, heDieuHanh: i.operatingSystem, banHdh: i.osVersion, webView: i.webViewVersion, laGiaLap: i.isVirtual });
    } catch { /* app cũ chưa có plugin Device → giữ phần đoán từ trình duyệt */ }
    try {
      const { App } = await import('@capacitor/app');
      const a = await App.getInfo();
      Object.assign(ra, { banApp: a.version, buildApp: a.build });
    } catch { /* bỏ */ }
  }
  const nhatKy = chupNhatKy(Date.now());
  const ketNoi = (navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number; downlink?: number } }).connection;
  Object.assign(ra, {
    manHinh: `${screen.width}x${screen.height}`, cuaSo: `${innerWidth}x${innerHeight}`, doNet: Math.round(devicePixelRatio * 100) / 100,
    vungAnToan: vungAnToan(), xoay: innerWidth > innerHeight ? 'ngang' : 'doc',
    banWeb: __APP_VERSION__, banOta: __OTA_ID__, ngonNgu: ngonNgu.value,
    nenToi: typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches,
    manDangMo: manGanNhat,
    loiJs: loiGanDay(Date.now() - 15 * 60_000) ?? '',
    nhatKy: JSON.stringify(nhatKy).slice(0, 280),
    mang: navigator.onLine ? (ketNoi?.effectiveType ?? 'co') : 'mat', rttMs: ketNoi?.rtt ?? -1,
    ua: navigator.userAgent.slice(0, 300)
  });
  return ra;
}

/** Nén ảnh chụp màn hình: cạnh dài ≤ 1280 px, JPEG — trả data URL ≤ ~750 KB, hoặc null nếu không đọc được. */
export async function nenAnh(tep: File): Promise<string | null> {
  try {
    const bm = await createImageBitmap(tep);
    let tl = Math.min(1, 1280 / Math.max(bm.width, bm.height));
    for (const cl of [0.72, 0.55, 0.4]) {
      const c = document.createElement('canvas');
      c.width = Math.round(bm.width * tl); c.height = Math.round(bm.height * tl);
      c.getContext('2d')?.drawImage(bm, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', cl);
      if (url.length * 0.75 < 750 * 1024) return url;
      tl *= 0.8;
    }
    return null;
  } catch { return null; }
}

export interface ThuBl { loai: LoaiBl; noi: NoiBl; vanDe: VanDeBl[]; noiDung: string; email: string; anh: string | null }
/** Gửi thư. 'ok' | 'nhieuQua' (quá 5 thư / giờ) | 'loi' (mạng / server). */
export async function guiBaoLoi(thu: ThuBl): Promise<'ok' | 'nhieuQua' | 'loi'> {
  try {
    const may = await thuThapMay();
    const r = await fetch(`${SERVER_URL}/api/baoloi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...thu, anh: thu.anh ?? undefined, email: thu.email.trim() || undefined, may, cid: store.clientId() })
    });
    if (r.status === 429) return 'nhieuQua';
    return r.ok ? 'ok' : 'loi';
  } catch { return 'loi'; }
}
