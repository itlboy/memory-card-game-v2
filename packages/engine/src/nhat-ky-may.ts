/**
 * NHẬT KÝ MÁY (28.11.2026) — app gửi kèm khi có sự cố online (vào lại sau khi rớt / bỏ lượt Tìm Thẻ) để log server
 * biết VÌ SAO: app xuống nền, JS treo, mất mạng, bấm mà không ăn. Server KHÔNG tin client: `dongNhatKy` chỉ nhận số
 * trong khoảng và chuỗi lỗi đã lọc ký tự — client sửa tay cũng không chèn được gì vào log.
 */
export interface NhatKyMay {
  /** Bao nhiêu giây trước app bị ẩn / hiện lại / mất mạng / có mạng lại (−1 = không xảy ra từ lúc sự cố). */
  an: number;
  hien: number;
  /** 1 = lúc gửi app vẫn đang ẩn. */
  nen: number;
  matMang: number;
  coMang: number;
  /** Số lần luồng JS treo > 1,5 giây (khi trang hiện) và lần dài nhất (ms). */
  treo: number;
  treoMs: number;
  /** Số lần chạm màn trong pha chọn (chỉ với `tim_bo_luot`). */
  cham?: number;
  /** Lỗi JS gần nhất, đã rút gọn (`guiLoi`). */
  loi?: string;
}

export type LoaiSuCo = 'noi_lai' | 'tim_bo_luot';
export const LOAI_SU_CO: readonly LoaiSuCo[] = ['noi_lai', 'tim_bo_luot'];

const so = (x: unknown, min: number, max: number): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(min, Math.min(max, Math.round(x))) : null;

/**
 * Một dòng log gọn từ tin `suCo` của client, hoặc `null` nếu tin không hợp lệ. Mốc thời gian dạng `ẩn 12s` —
 * bỏ những gì không xảy ra (−1) cho dòng ngắn.
 */
export function dongNhatKy(loai: unknown, ma: unknown, giay: unknown, may: unknown): string | null {
  if (typeof loai !== 'string' || !(LOAI_SU_CO as readonly string[]).includes(loai)) return null;
  if (!may || typeof may !== 'object') return null;
  const m = may as Record<string, unknown>;
  const phan: string[] = [loai];
  const maDong = so(ma, 0, 4999);
  if (maDong !== null && maDong > 0) phan.push(`mã ${maDong}`);
  const g = so(giay, 0, 86_400);
  if (g !== null) phan.push(`${g}s`);
  const moc = (k: string, chu: string): void => { const v = so(m[k], -1, 86_400); if (v !== null && v >= 0) phan.push(`${chu} ${v}s trước`); };
  moc('an', 'ẩn'); moc('hien', 'hiện');
  if (so(m.nen, 0, 1) === 1) phan.push('đang ở nền');
  moc('matMang', 'mất mạng'); moc('coMang', 'có mạng');
  const treo = so(m.treo, 0, 99) ?? 0;
  if (treo > 0) phan.push(`treo ${treo} lần, dài nhất ${so(m.treoMs, 0, 600_000)}ms`);
  const cham = so(m.cham, 0, 9999);
  if (cham !== null) phan.push(`chạm ${cham}`);
  if (typeof m.loi === 'string' && m.loi) phan.push(`lỗi "${m.loi.replace(/[^\p{L}\p{N} .,:;_<>#()'/-]/gu, '').slice(0, 100)}"`);
  return phan.join(' · ');
}
