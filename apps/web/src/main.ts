import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';
import App from './App.vue';
import { sfx } from './lib/audio';
import { nhac } from './lib/nhac';
import { laApp } from './lib/native';
import { ganNutBackAndroid, ganVuotLuiIos } from './lib/nut-back';
import { ganLinkMoi } from './lib/link-moi';
import './styles/fonts';   // font đóng gói sẵn — xem styles/fonts.ts
import './styles/global.css';
import './styles/card-backs.css';
import './styles/theme-grid.css';
import './styles/ketcuc-fx.css';
import './styles/skins/keo.css';
import './styles/skins/keo-thach.css';
import './styles/skins/keo-canh.css';
import './styles/skins/keo-lung.css';
import './styles/skins/keo-la.css';
import { ganSkin } from './lib/skin';
import { ganCanh } from './lib/canh';
import { ganLung } from './lib/lung-la';
import { napTuDien, ngonNgu } from './lib/i18n';
import { ganBatLoi, guiLoi, suKien } from './lib/phan-tich';
import { ketQuaVeTrang } from './lib/appUrl';
import { ganNhatKyMay } from './lib/nhat-ky-may';
import { xoaKyLucCu } from './lib/tim-the';

// Lỗi JS → GA (lib/phan-tich.ts `guiLoi`) — gắn SỚM NHẤT để bắt cả lỗi lúc nạp
ganBatLoi();
// Mốc nền / treo / mất mạng cho nhật ký sự cố online (lib/nhat-ky-may.ts) — gắn sớm để có cả mốc trước khi vào phòng
ganNhatKyMay();
// Kỷ lục Tìm Thẻ theo giờ xem cũ (trước 28.11.2026) — chủ dự án: "Xoá đi"
xoaKyLucCu();
// Vừa áp gói OTA: có về đúng trang đang đứng không (lib/appUrl `khoiPhucTrang`)
if (ketQuaVeTrang) {
  suKien('ota_ve_trang', ketQuaVeTrang);
  // Chẩn đoán đọc được ngay trên GA thời gian thực (tham số chưa đăng ký custom dimension thì không đọc được): ota_ve_<kết quả>_<trang>_<lần>
  suKien(`ota_ve_${ketQuaVeTrang.ket_qua}_${ketQuaVeTrang.trang.split(/[,+]/)[0] || 'trong'}_${ketQuaVeTrang.lan}`.slice(0, 40));
}

// iOS Safari bỏ qua user-scalable=no — chặn pinch-zoom bằng gesture event
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

// Cache app shell để rời app rồi quay lại là hiện ngay (mobile hay giải phóng
// tab); bản mới tự thay khi có deploy. Thiếu SW cũng không sao — app vẫn chạy.
// Trong app iOS gói bằng Capacitor web nằm sẵn trong máy, SW chỉ thêm một lớp cache lệch bản.
if (!laApp) void registerSW({ immediate: true });

// Mở sẵn cho console: `sfx.volume = 2.5` để thử âm lượng (giá trị được nhớ lại).
// Không có dòng này thì `sfx` chỉ là biến trong module, console không thấy.
(window as unknown as { sfx: typeof sfx }).sfx = sfx;
// Tương tự cho nhạc nền: `nhac.dung()` / `nhac.chay('van')` để nghe thử hai tâm trạng
(window as unknown as { nhac: typeof nhac }).nhac = nhac;

// Skin gắn TRƯỚC khi mount: không loé giao diện mặc định một khung hình
ganSkin();
ganCanh();
ganLung();   // mặt lưng lá theo hình nền — trước khi mount để lá đầu tiên đã đúng hình
// Chờ từ điển của ngôn ngữ đầu (chunk riêng, lib/i18n.ts) — mount trước là loé tiếng Việt một nhịp
void napTuDien(ngonNgu.value).finally(() => {
  const app = createApp(App);
  // Lỗi trong component Vue không tới window.onerror — báo riêng, vẫn in ra console như mặc định
  app.config.errorHandler = (err, _vm, info) => { guiLoi('vue', err, info); console.error(err); };
  app.mount('#app');
});

// MÀN CHỜ (app): giữ tới khi game vẽ xong khung đầu rồi mờ dần — cả iOS lẫn Android.
// Không có bước này thì iOS bỏ màn chờ ngay lúc WebView mở, trước khi game kịp vẽ,
// nên người chơi gần như không thấy nó (Android thì thấy) — chủ dự án báo 14.10.2026.
// Hai rAF = sau khi trình duyệt THẬT SỰ vẽ. capacitor.config có chốt 3 giây phòng JS lỗi.
ganNutBackAndroid();
ganVuotLuiIos();
// Link mời https://…/?room=CODE mở thẳng app → vào phòng (lib/link-moi.ts)
ganLinkMoi();
// Chuông "báo tôi khi có phòng mới" (lib/thong-bao.ts) — chỉ app có plugin + server bật
if (laApp) void import('./lib/thong-bao').then((m) => m.khoiDongThongBao());
// Cập nhật nóng: báo gói chạy được NGAY (không thì plugin quay về gói trước), rồi kiểm bản mới
void import('./lib/ota').then((m) => m.kiemOta());
// Gói cài bằng zip OTA thiếu ảnh emoji 512 (zip phải < 25MiB) → dùng 256 (lib/emoji.ts)
if (laApp) void import('./lib/emoji').then((m) => m.kiemCo512());

if (laApp) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 300 }))
      .catch(() => { /* không có plugin (web) — bỏ qua */ });
  }));
}
