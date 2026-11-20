import { onScopeDispose, ref } from 'vue';
import type { PublicRoom } from '@mm/engine';
import { SERVER_URL } from './native';

/**
 * SỐ PHÒNG ĐANG CHỜ trên ô Online ở trang chủ (20.11.2026, mockup C duyệt
 * https://claude.ai/artifact/C8WqYvu9Fbkz9R16EbkpyA — chấm xanh "đang sống" + số ở góc ô).
 * Chỉ đếm phòng công khai CÒN CHỖ và CHƯA vào ván (`dangChoi` là phòng để xem, không đếm).
 * Hỏi lúc trang chủ hiện và mỗi `CHU_KY_MS` trong lúc ở đó; app nằm nền thì thôi hỏi. Lỗi mạng: giữ số cũ.
 */
export const CHU_KY_MS = 20_000;

export const demPhongCho = (rooms: PublicRoom[]): number => rooms.filter((r) => !r.dangChoi && r.nguoi < r.toiDa).length;
/** Hiện trên chấm: 0 = ẩn, 10 trở lên = "9+". */
export const nhanSoPhong = (n: number): string => (n <= 0 ? '' : n > 9 ? '9+' : String(n));

export function useSoPhongCho() {
  const so = ref(0);
  let hen: ReturnType<typeof setTimeout> | undefined;
  let tat = false;
  async function hoi(): Promise<void> {
    clearTimeout(hen);
    if (tat) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      try {
        const r = await fetch(`${SERVER_URL}/api/rooms/public?v=2`);
        if (r.ok) so.value = demPhongCho(((await r.json()) as { rooms?: PublicRoom[] }).rooms ?? []);
      } catch { /* mất mạng: giữ số cũ */ }
    }
    if (!tat) hen = setTimeout(() => { void hoi(); }, CHU_KY_MS);
  }
  const khiHien = (): void => { if (document.visibilityState === 'visible') void hoi(); };
  if (import.meta.env.MODE !== 'test' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', khiHien);
    void hoi();
  }
  onScopeDispose(() => {
    tat = true;
    clearTimeout(hen);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', khiHien);
  });
  return so;
}
