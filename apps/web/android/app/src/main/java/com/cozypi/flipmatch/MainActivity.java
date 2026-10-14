package com.cozypi.flipmatch;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * TẮT "TỰ LÀM TỐI" CỦA WEBVIEW. Máy để giao diện tối thì WebView Android tự
     * đảo màu cả trang: emoji gấu trúc, đám mây, mặt bài trắng hoá đen sì
     * (người chơi báo 14.10.2026). Game có chế độ tối RIÊNG (nút Nền tối), nên
     * không để hệ thống can thiệp vào màu — ở đây và ở theme (forceDarkAllowed).
     * Test `android-khong-tu-lam-toi` canh cả hai lớp.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin tự viết phải đăng ký TRƯỚC super.onCreate (lúc đó bridge mới dựng)
        registerPlugin(NgonNguAppPlugin.class);
        super.onCreate(savedInstanceState);
        WebSettings s = getBridge().getWebView().getSettings();
        // Cỡ chữ WebView CỐ ĐỊNH 100%: Android áp "Cỡ chữ" của hệ thống vào trang
        // (iOS thì không), chữ phình ra là vỡ bố cục KHÔNG SCROLL và mất tên game
        // trên thanh trên. Game tự lo cỡ chữ theo màn hình.
        s.setTextZoom(100);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            // Android 13+ (targetSdk ≥ 33)
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, false);
        } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            // Android 10–12
            WebSettingsCompat.setForceDark(s, WebSettingsCompat.FORCE_DARK_OFF);
        }
    }
}
