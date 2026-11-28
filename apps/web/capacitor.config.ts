import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Đóng gói web thành ứng dụng iOS + Android (Capacitor). Web ở `dist` được nhúng thẳng
 * vào app, còn phòng online đi tới server công khai qua `VITE_SERVER_URL`
 * (xem script `build:app`; CI ở `.github/workflows/mobile.yml`). Trong app, origin là `capacitor://localhost` nên
 * mọi chỗ dựa vào `location.origin` phải đi qua `lib/native.ts`.
 */
const config: CapacitorConfig = {
  // Mã iOS (đã đăng ký với Apple). Android KHÔNG lấy từ đây mà từ
  // android/app/build.gradle — `com.cozypi.flipmatch` (xem CLAUDE.md).
  appId: 'com.hello314.flipmatch',
  appName: 'Lật Thẻ',
  webDir: 'dist',
  ios: {
    // Không đệm theo thanh trạng thái: web đã tự xử lý bằng env(safe-area-inset-*)
    contentInset: 'never',
    // Màu WebView vẽ TRƯỚC khi trang được đọc (mở app, tự khởi động lại để áp OTA). Trước là #edeffa gần trắng → loé
    // chói ở nền tối (chủ dự án 25.11.2026). Nay = màu trời của màn chờ (SplashScreen bên dưới); trang tự tô tiếp đúng
    // sáng/tối ngay khung hình đầu (index.html). Android dùng cùng màu.
    backgroundColor: '#5bc0f0',
    // Không cho kéo giật trang — màn chơi vốn KHÔNG SCROLL
    scrollEnabled: false
  },
  android: {
    backgroundColor: '#5bc0f0'
  },
  plugins: {
    /*
     * Apple + GOOGLE NATIVE (từ bản app 1.5.0, 09.11.2026). Google trong WebView bị Google
     * chặn, nên app dùng hộp thoại native: iOS = client OAuth iOS (URL scheme đảo ngược ở
     * Info.plist), Android = client web + client Android (khoá ký Play) đã khai ở Google Cloud
     * dự án `lat-the-nkien`. Facebook/Twitter tắt — khỏi gói SDK thừa. Xem lib/taikhoan.ts.
     */
    SocialLogin: {
      providers: { apple: true, google: true, facebook: false, twitter: false }
    },
    // Màn chờ giữ tới khi main.ts gọi SplashScreen.hide() (game đã vẽ khung đầu).
    // Tự tắt sau 3 giây là CHỐT AN TOÀN: JS lỗi thì không kẹt mãi ở màn chờ.
    /*
     * CẬP NHẬT NÓNG (lib/ota.ts): chế độ THỦ CÔNG (autoUpdate tắt — tự đọc
     * /ota/manifest.json của server mình), KHÔNG gửi thống kê về Capgo (mặc định nó
     * gửi crash + lỗi JS + tín hiệu WebView — phải khai App Privacy nếu bật).
     * resetWhenUpdate: cài bản store mới hơn thì bỏ gói OTA cũ, chạy gói đi kèm app.
     */
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      resetWhenUpdate: true,
      appReadyTimeout: 10000,
      /*
       * GIỮ NGUYÊN URL (cả `?room=` / `?playing=1` …) khi áp gói OTA (28.11.2026, chủ dự án: "đang ở phòng chờ bấm cập nhật
       * thì bị thoát ra trang chủ… cập nhật ở đâu thì reload và ở lại ngay trang đấy"). Mặc định plugin nạp gói mới ở URL
       * TRẦN; lib/appUrl `nhoTrang`/`khoiPhucTrang` (26.11) bù bằng localStorage nhưng trên máy thật vẫn về trang chủ.
       * Bật cái này thì URL đi thẳng qua lần nạp lại; cách localStorage vẫn giữ làm dự phòng.
       */
      keepUrlPathAfterReload: true
    },
    /*
     * THÔNG BÁO PHÒNG MỚI (lib/thong-bao.ts, từ 1.8.17). Đang mở app thì KHÔNG hiện banner —
     * người đang ở trong game tự thấy danh sách phòng, banner chỉ che màn chơi.
     */
    PushNotifications: {
      presentationOptions: []
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 300,
      backgroundColor: '#5bc0f0',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
