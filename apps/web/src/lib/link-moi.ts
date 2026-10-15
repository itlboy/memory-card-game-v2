import { laApp } from './native';

/**
 * LINK MỜI MỞ THẲNG APP (Universal Links iOS + App Links Android, 15.10.2026).
 *
 * Bấm `https://flipmatch.cozypi.com/?room=123456` trên máy đã cài app thì hệ điều
 * hành mở app thay vì trình duyệt (xác minh qua `public/.well-known/`). Nhưng URL
 * đó KHÔNG tới tay trang web trong app — WebView vẫn mở `capacitor://localhost/`
 * — nó chỉ đến qua plugin `@capacitor/app`: `getLaunchUrl()` khi app mở nguội,
 * sự kiện `appUrlOpen` khi app đang chạy.
 *
 * Cả hai đường đều NẠP LẠI trang ở `?room=CODE`, để App.vue đi đúng lối vào phòng
 * như trên web (một lối duy nhất, khỏi dựng nhánh thứ hai giữa ván dở).
 * `getLaunchUrl()` trả lại link cũ suốt đời tiến trình, nên phải nhớ đã xử lý
 * link nào (sessionStorage sống qua lần nạp lại) — không thì rời phòng rồi app
 * nạp lại (cập nhật nóng) là bị kéo vào phòng cũ.
 */
const KHOA = 'mm.linkMoi';

export function maPhongTuLink(url: string): string | null {
  try {
    const code = new URL(url).searchParams.get('room');
    return code && /^\d{6}$/.test(code) ? code : null;
  } catch { return null; }
}

/** Link đã xử lý trong phiên này. */
function daXuLy(): string[] {
  try { return JSON.parse(sessionStorage.getItem(KHOA) ?? '[]') as string[]; } catch { return []; }
}

function moPhong(url: string, luonMo: boolean): void {
  const code = maPhongTuLink(url);
  if (!code) return;
  const ds = daXuLy();
  if (!luonMo && ds.includes(url)) return;
  try { sessionStorage.setItem(KHOA, JSON.stringify([...ds.filter((u) => u !== url), url].slice(-20))); } catch { /* vẫn mở */ }
  if (new URLSearchParams(location.search).get('room') === code) return;
  location.replace(`${location.pathname}?room=${code}`);
}

export function ganLinkMoi(): void {
  if (!laApp) return;
  void import('@capacitor/app').then(({ App }) => {
    // Link bấm lúc app đang chạy: luôn mở, kể cả trùng link lần trước
    void App.addListener('appUrlOpen', ({ url }) => moPhong(url, true));
    // Link mở app nguội: chỉ một lần (sau đó getLaunchUrl vẫn trả nó mãi)
    void App.getLaunchUrl().then((r) => { if (r?.url) moPhong(r.url, false); });
  }).catch(() => { /* không có plugin */ });
}
