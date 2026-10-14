package com.cozypi.flipmatch;

import android.app.LocaleManager;
import android.os.Build;
import android.os.LocaleList;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * GHI NGÔN NGỮ GAME XUỐNG CÀI ĐẶT MÁY (Android 13+): chọn ngôn ngữ trong game thì
 * mục Cài đặt → Ứng dụng → Flip Match → Ngôn ngữ đổi theo — xem web lib/ngon-ngu-app.ts.
 * Activity khai configChanges "locale|layoutDirection" nên đổi ngôn ngữ KHÔNG dựng lại
 * activity (không tải lại game). Android 12 trở xuống không có ngôn ngữ riêng → bỏ qua.
 */
@CapacitorPlugin(name = "NgonNguApp")
public class NgonNguAppPlugin extends Plugin {
    @PluginMethod
    public void dat(PluginCall call) {
        String ma = call.getString("ma");
        if (ma == null || ma.isEmpty()) { call.reject("thiếu mã ngôn ngữ"); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            LocaleManager lm = getContext().getSystemService(LocaleManager.class);
            if (lm != null) lm.setApplicationLocales(LocaleList.forLanguageTags(ma));
        }
        call.resolve();
    }
}
