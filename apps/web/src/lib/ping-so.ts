import { ref } from 'vue';

/**
 * HIỆN PING BẰNG SỐ (ms) — công tắc CHỈ trong chế độ debug (Luật chơi).
 * Chủ dự án 16.10.2026: chip người chơi online chỉ cần CHẤM MÀU mạng (xanh · vàng · đỏ),
 * con số làm rối; ai cần soi mạng thì bật lại ở đây. Nhớ ở máy này (`mm.pingSo`) và
 * tự về mặc định khi TẮT debug (App.vue), giống bộ emoji thử.
 */
const KHOA = 'mm.pingSo';
const doc = (): boolean => { try { return localStorage.getItem(KHOA) === '1'; } catch { return false; } };

export const pingSo = ref(doc());

export function datPingSo(bat: boolean): void {
  pingSo.value = bat;
  try { if (bat) localStorage.setItem(KHOA, '1'); else localStorage.removeItem(KHOA); } catch { /* chế độ riêng tư */ }
}
