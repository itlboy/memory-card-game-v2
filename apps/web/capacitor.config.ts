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
    backgroundColor: '#edeffa',
    // Không cho kéo giật trang — màn chơi vốn KHÔNG SCROLL
    scrollEnabled: false
  },
  android: {
    backgroundColor: '#edeffa'
  },
  plugins: {
    /*
     * Chỉ Apple (Sign in with Apple, App Store luật 4.8). Google trong app phải
     * đi đường native (cần OAuth client iOS/Android riêng ở Google Cloud) — chưa
     * làm, nên tắt cho khỏi gói SDK Google/Facebook vào app. Xem lib/taikhoan.ts.
     */
    SocialLogin: {
      providers: { apple: true, google: false, facebook: false, twitter: false }
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
      appReadyTimeout: 10000
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
