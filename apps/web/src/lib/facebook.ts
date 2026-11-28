import { laFacebook } from './nen-fb';

/**
 * FACEBOOK INSTANT GAMES — lớp mỏng quanh SDK `FBInstant` (bản 8.0, thẻ <script> do vite.config.ts
 * chèn vào index.html CHỈ ở `pnpm build:fb`).
 *
 * Trình tự Meta bắt buộc (tài liệu quick-start):
 *   1. `FBInstant.initializeAsync()` — xong mới được gọi hàm khác của SDK;
 *   2. `FBInstant.setLoadingProgress(0..100)` — thanh tiến độ trên màn chờ của Meta;
 *   3. `FBInstant.startGameAsync()` — màn chờ KHÔNG tắt cho tới khi gọi hàm này.
 *
 * Mọi hàm ở đây KHÔNG BAO GIỜ ném lỗi và là no-op ngoài bản Facebook — web/app gọi cũng không sao.
 * Thiếu SDK (mở thử `dist-fb` ngoài Facebook, mạng chặn connect.facebook.net) thì game vẫn chạy
 * như bản web: `coSdk()` là false, các hàm trả về ngay.
 *
 * CHƯA LÀM (đợt sau, cần đọc tài liệu SDK 8.0 chế độ Zero Permissions + sửa server):
 *  · đăng nhập bằng danh tính Facebook (`player.getSignedPlayerInfoAsync` → server xác minh chữ ký);
 *  · mời bạn / chia sẻ qua `shareAsync`, `context.chooseAsync` (thay copy link `?room=`);
 *  · lưu tiến độ qua `player.setDataAsync` (localStorage trong khung Facebook có thể bị xoá).
 */
interface FbInstant {
  initializeAsync(): Promise<void>;
  setLoadingProgress(phanTram: number): void;
  startGameAsync(): Promise<void>;
  getLocale?(): string | null;
}

const sdk = (): FbInstant | null =>
  (laFacebook && (globalThis as { FBInstant?: FbInstant }).FBInstant) || null;

let daKhoiDong = false;

/** SDK có mặt VÀ đã `initializeAsync` xong. */
export const coSdk = (): boolean => daKhoiDong;

/** Hạn chờ cho từng lời gọi SDK: treo ở đây là người chơi kẹt màn chờ mãi. */
const HAN_MS = 8000;
function coHan<T>(p: Promise<T>): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((xong) => setTimeout(() => xong(undefined), HAN_MS))]);
}

/** Bước 1. Gọi SỚM NHẤT, trước khi mount. Không có SDK / lỗi / quá hạn: bỏ qua, game vẫn lên. */
export async function fbKhoiDong(): Promise<void> {
  const fb = sdk();
  if (!fb) return;
  try {
    let xong = false;
    await coHan(fb.initializeAsync().then(() => { xong = true; }));
    daKhoiDong = xong;
    if (xong) fb.setLoadingProgress(30);
  } catch { daKhoiDong = false; }
}

/** Bước 2. Tiến độ tải 0..100 trên màn chờ của Meta. */
export function fbTienDo(phanTram: number): void {
  if (!daKhoiDong) return;
  try { sdk()?.setLoadingProgress(Math.max(0, Math.min(100, Math.round(phanTram)))); } catch { /* bỏ qua */ }
}

/** Bước 3. Game đã vẽ khung đầu → bỏ màn chờ của Meta. */
export async function fbBatDau(): Promise<void> {
  if (!daKhoiDong) return;
  try {
    fbTienDo(100);
    await coHan(sdk()!.startGameAsync());
  } catch { /* bỏ qua — không bao giờ làm hỏng game */ }
}

/** Ngôn ngữ Facebook báo (vd 'vi_VN'), hoặc null. Chưa nối vào lib/i18n.ts. */
export function fbNgonNgu(): string | null {
  if (!daKhoiDong) return null;
  try { return sdk()?.getLocale?.() ?? null; } catch { return null; }
}
