import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Đóng gói web thành ứng dụng iOS + Android (Capacitor). Web ở `dist` được nhúng thẳng
 * vào app, còn phòng online đi tới server công khai qua `VITE_SERVER_URL`
 * (xem script `build:app`; CI ở `.github/workflows/mobile.yml`). Trong app, origin là `capacitor://localhost` nên
 * mọi chỗ dựa vào `location.origin` phải đi qua `lib/native.ts`.
 */
const config: CapacitorConfig = {
  appId: 'com.hello314.thebai',
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
    }
  }
};

export default config;
