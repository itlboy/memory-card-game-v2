/**
 * NHẬT KÝ MÁY CHO SỰ CỐ ONLINE (28.11.2026, chủ dự án duyệt). Log server chỉ biết socket ĐỨT (1006) hoặc người chơi
 * NGỒI YÊN không chọn — không biết VÌ SAO: app bị đưa xuống nền? JavaScript treo? mất mạng? bấm mà không ăn?
 * Module này ghi lặng lẽ vài mốc trên máy; khi có sự cố (`useOnlineRoom`: vào lại sau khi rớt, bỏ lượt Tìm Thẻ) thì
 * gói thành MỘT dòng gửi lên server (`{ t: 'suCo' }` → log `[phòng] … máy: …`), ghép với dòng `[ws]` cùng `cid`.
 *
 * KHÔNG dữ liệu cá nhân: chỉ số đếm, số mili-giây, mã đóng, và thông điệp lỗi JS ĐÃ RÚT GỌN (`guiLoi` bỏ URL / email /
 * số dài). Không giao diện, người chơi không thấy gì.
 */
import type { NhatKyMay } from '@mm/engine';
import { loiGanDay } from './phan-tich';

/** Nhịp đo treo: timer 1 giây, trễ quá `TREO_MS` (khi trang ĐANG HIỆN cả trước lẫn sau) = luồng JS bị treo. */
const NHIP_MS = 1000;
const TREO_MS = 1500;
const TRUOC_MS = 30_000;

let dau = 0;                 // đã gắn chưa
let anLuc = 0;               // lần cuối trang bị ẩn (xuống nền / khoá màn)
let hienLuc = 0;             // lần cuối trang hiện lại
let matMangLuc = 0;          // lần cuối trình duyệt báo `offline`
let coMangLuc = 0;
/** Các lần treo gần đây: [mốc kết thúc, độ dài ms]. Giữ 8 lần. */
const treo: [number, number][] = [];
let nhipTruoc = 0;
let hienTuNhipTruoc = true;
/** Số lần chạm màn (pointerdown) — đếm theo đợt do `batDauDemCham` mở. */
let cham = 0;

export function ganNhatKyMay(): void {
  if (dau || typeof window === 'undefined') return;
  dau = 1;
  const bay = Date.now();
  if (document.visibilityState === 'hidden') anLuc = bay;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') anLuc = Date.now();
    else hienLuc = Date.now();
    hienTuNhipTruoc = false;
  });
  window.addEventListener('pagehide', () => { anLuc = Date.now(); hienTuNhipTruoc = false; });
  window.addEventListener('offline', () => { matMangLuc = Date.now(); });
  window.addEventListener('online', () => { coMangLuc = Date.now(); });
  window.addEventListener('pointerdown', () => { cham++; }, { capture: true, passive: true });
  nhipTruoc = bay;
  setInterval(() => {
    const bay2 = Date.now();
    const tre = bay2 - nhipTruoc - NHIP_MS;
    // Chỉ tính treo khi trang hiện suốt khoảng đó — ở nền trình duyệt cố ý hãm timer, không phải treo
    if (tre > TREO_MS && hienTuNhipTruoc && document.visibilityState === 'visible') {
      treo.push([bay2, tre]);
      if (treo.length > 8) treo.shift();
    }
    nhipTruoc = bay2;
    hienTuNhipTruoc = document.visibilityState === 'visible';
  }, NHIP_MS);
}

/** Mở đợt đếm chạm mới (vd đầu pha chọn Tìm Thẻ); trả số chạm của đợt trước. */
export function batDauDemCham(): number { const c = cham; cham = 0; return c; }

/** Giây (làm tròn) từ mốc `luc` tới nay, hoặc -1 nếu mốc chưa có / cũ hơn `tu`. */
const giayTu = (luc: number, tu: number, bay: number): number => (luc && luc >= tu ? Math.round((bay - luc) / 1000) : -1);

/**
 * Ảnh chụp tình trạng máy từ 30 giây trước `tuSuCo` (lúc rớt / lúc bắt đầu lượt) tới bây giờ.
 * `an`/`hien`/`matMang`/`coMang`: bao nhiêu giây trước (−1 = không xảy ra trong khoảng).
 */
export function chupNhatKy(tuSuCo: number, soCham?: number): NhatKyMay {
  const bay = Date.now();
  // Nhìn lùi 30 giây trước sự cố: cái làm đứt socket (treo, mất mạng, xuống nền) xảy ra TRƯỚC lúc `onclose` chạy
  const tu = tuSuCo - TRUOC_MS;
  const treoTrong = treo.filter(([luc]) => luc >= tu);
  const loi = loiGanDay(tu);
  return {
    an: giayTu(anLuc, tu, bay),
    hien: giayTu(hienLuc, tu, bay),
    // Đang ẩn ngay lúc này (gửi từ nền — hiếm, nhưng có thì rất đáng biết)
    nen: document.visibilityState === 'hidden' ? 1 : 0,
    matMang: giayTu(matMangLuc, tu, bay),
    coMang: giayTu(coMangLuc, tu, bay),
    treo: treoTrong.length,
    treoMs: treoTrong.reduce((m, [, ms]) => Math.max(m, ms), 0),
    ...(soCham !== undefined ? { cham: soCham } : {}),
    ...(loi ? { loi } : {})
  };
}
