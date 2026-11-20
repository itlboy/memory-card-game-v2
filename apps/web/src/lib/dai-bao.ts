import { ref } from 'vue';

/**
 * DẢI BÁO CHUNG (19.11.2026, mockup duyệt https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH — chủ dự án:
 * "nên có thông báo cùng một chỗ và đồng nhất với nhau"). MỌI thông báo về NGƯỜI trong chơi online (vào,
 * sẵn sàng, rời, nhắc, muốn chơi lại, mất kết nối, đang xem) đi qua đây và hiện ở MỘT chỗ: dải nổi trên
 * cùng (DaiBao.vue), đè lên hàng trên cùng chứ không đẩy bàn thẻ. Màu theo LOẠI, không theo màn:
 *   tot  — tin vui (xanh lá)      can — cần bạn làm (vàng)     roi — có người đi (xám)
 *   mang — mạng (cam, đứng yên tới khi hết sự cố)              xem — người xem (xanh dương)
 * Tự tắt sau 3 giây; tin mới thay tin cũ, dồn nhiều thì xếp hàng (tối đa CHO_TOI_DA, bỏ tin cũ nhất).
 * Tin `giu` (mạng) đứng yên tới khi `boBao(khoa)`.
 */
export type LoaiBao = 'tot' | 'can' | 'roi' | 'mang' | 'xem';
export interface Bao {
  loai: LoaiBao;
  /** Biểu tượng đầu dải: emoji, hoặc tên vòng xanh dùng chung `'choiLai'` (↻) / `'sanSang'` (✋). */
  ic?: string;
  /** Mặt thú / ảnh của người được nói tới — vẽ thay `ic` (xem). */
  mat?: string;
  anh?: string;
  chu: string;
  /** Khoá để thay/gỡ đúng tin này (vd. `mang:<id>`). Tin trùng khoá thay chỗ nhau. */
  khoa?: string;
  /** Đứng yên tới khi `boBao(khoa)` — chỉ dùng cho tin mạng. */
  giu?: boolean;
  /** Số thứ tự để vẽ lại hiệu ứng vào. */
  so?: number;
}

const HIEN_MS = 3000;
const CHO_TOI_DA = 4;

export const baoHien = ref<Bao | null>(null);
const hang: Bao[] = [];
let hen: ReturnType<typeof setTimeout> | undefined;
let dem = 0;

function chay(): void {
  clearTimeout(hen);
  const ke = hang.shift() ?? null;
  baoHien.value = ke;
  if (ke && !ke.giu) hen = setTimeout(chay, HIEN_MS);
}

/** Đưa một tin lên dải. Tin đang hiện là tin `giu` mà tin mới không phải mạng thì vẫn chen lên trước. */
export function baoNoi(b: Bao): void {
  const moi = { ...b, so: ++dem };
  if (b.khoa) {
    const i = hang.findIndex((x) => x.khoa === b.khoa);
    if (i >= 0) hang.splice(i, 1);
    if (baoHien.value?.khoa === b.khoa) { baoHien.value = moi; clearTimeout(hen); if (!b.giu) hen = setTimeout(chay, HIEN_MS); return; }
  }
  // Tin CẦN BẠN LÀM (nhắc) và tin MẠNG chen lên NGAY — xếp hàng sau "X vừa vào…" là tới lúc hiện thì đã
  // lỡ việc (đo thật 19.11.2026: lời nhắc hiện ra khi người kia đã bấm Sẵn sàng rồi). Tin đang hiện bị thay.
  const gap = b.loai === 'can' || b.loai === 'mang';
  if (!baoHien.value || baoHien.value.giu || gap) {
    // Tin mạng đang đứng: tin mới hiện đè, xong 3 giây thì tin mạng quay lại (nếu còn)
    if (baoHien.value?.giu) hang.unshift(baoHien.value);
    baoHien.value = moi; clearTimeout(hen);
    if (!moi.giu) hen = setTimeout(chay, HIEN_MS);
    return;
  }
  hang.push(moi);
  while (hang.length > CHO_TOI_DA) hang.shift();
}

/** Gỡ tin theo khoá (vd. hết mất kết nối). */
export function boBao(khoa: string): void {
  const i = hang.findIndex((x) => x.khoa === khoa);
  if (i >= 0) hang.splice(i, 1);
  if (baoHien.value?.khoa === khoa) chay();
}

/** Rời chơi online: dọn sạch. */
export function donBao(): void {
  hang.length = 0;
  clearTimeout(hen);
  baoHien.value = null;
}
