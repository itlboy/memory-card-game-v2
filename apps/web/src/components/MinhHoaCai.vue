<script setup lang="ts">
/**
 * HÌNH MINH HOẠ từng bước cài lên màn hình chính (chủ dự án 22.10.2026: chỉ chữ thì "hơi
 * khó"; chọn VẼ LẠI giao diện thay cho ảnh chụp — chữ theo 15 ngôn ngữ, nhẹ, nét).
 *
 * Mỗi cảnh là một mẩu màn hình Safari (iOS 26) / Chrome (Android) vẽ bằng HTML: chỗ cần
 * bấm khoanh sáng + ngón tay chạm. Các dòng KHÁC trong menu vẽ thành vạch xám — nhờ vậy
 * chỉ dòng cần bấm mang chữ, và chữ đó lấy NGAY từ bản dịch của bước (`<span data-ic>`,
 * `.xanh-chu`), không thêm khoá mới. Màu trong hình là màu CỦA SAFARI/CHROME (cứng, cố ý):
 * hình mô tả giao diện khác, không đổi theo skin của game.
 */
import { computed } from 'vue';
import { t, td } from '@/lib/i18n';

const props = defineProps<{ buoc: 'i2' | 'i3' | 'i4' | 'a2' | 'a3' | 'a4' }>();

/** Chữ trong thẻ `<span …chon…>` của bản dịch bước — bỏ thẻ, giữ chữ. */
const nhan = (k: string, chon: RegExp): string =>
  (td(k).match(chon)?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
const chiaSe = computed(() => nhan('cai.i2', /data-ic="share">([^<]*)</));
const themMH = computed(() => nhan('cai.i3', /data-ic="them">([^<]*)</));
const themAD = computed(() => nhan('cai.a3', /data-ic="tai">([^<]*)</));
const nutThem = computed(() => nhan('cai.i4', /class="xanh-chu">([^<]*)</));
const nutCai = computed(() => nhan('cai.a4', /class="xanh-chu">([^<]*)</));
</script>

<template>
  <div class="mh" :class="props.buoc" aria-hidden="true">
    <!-- iOS 1: ⋯ ở thanh dưới → menu bật lên → Chia sẻ -->
    <template v-if="buoc === 'i2'">
      <div class="trang" />
      <div class="ios-menu hien-sau">
        <i class="vach" /><span class="dong chon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0a84ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" /></svg>{{ chiaSe }}</span><i class="vach" />
      </div>
      <div class="ios-thanh">
        <span class="lui">‹</span><span class="dc">flipmatch.cozypi.com</span><span class="ba-cham dich-1">•••</span>
      </div>
      <img class="tay tay-i2" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>

    <!-- iOS 2: bảng Chia sẻ → Thêm vào MH chính -->
    <template v-else-if="buoc === 'i3'">
      <div class="ios-bang">
        <div class="hang-app"><i /><i /><i /><i /><i /></div>
        <div class="the-ds">
          <i class="vach" /><i class="vach" />
          <span class="dong chon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1c1c1e" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></svg>{{ themMH }}</span>
          <i class="vach" />
        </div>
      </div>
      <img class="tay tay-giua" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>

    <!-- iOS 3: màn xác nhận → Thêm -->
    <template v-else-if="buoc === 'i4'">
      <div class="ios-them">
        <div class="dau"><i class="vach ngan" /><i class="vach ngan" /><b class="chon">{{ nutThem }}</b></div>
        <div class="the-app"><img src="/icon-192.png" alt="" /><span>{{ t('tb.thuongHieu') }}</span></div>
      </div>
      <img class="tay tay-phai-tren" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>

    <!-- Android 1: ⋮ góc trên phải -->
    <template v-else-if="buoc === 'a2'">
      <div class="ad-thanh"><span class="dc">flipmatch.cozypi.com</span><span class="ba-cham-doc chon">⋮</span></div>
      <div class="trang duoi" />
      <img class="tay tay-a2" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>

    <!-- Android 2: menu thả xuống → Thêm vào màn hình chính -->
    <template v-else-if="buoc === 'a3'">
      <div class="ad-thanh"><span class="dc">flipmatch.cozypi.com</span><span class="ba-cham-doc">⋮</span></div>
      <div class="ad-menu">
        <i class="vach" /><i class="vach" />
        <span class="dong chon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 8v7M9 12l3 3 3-3" /></svg>{{ themAD }}</span>
        <i class="vach" />
      </div>
      <img class="tay tay-giua" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>

    <!-- Android 3: hộp xác nhận → Cài đặt -->
    <template v-else>
      <div class="ad-hop">
        <i class="vach ngan" />
        <div class="the-app"><img src="/icon-192.png" alt="" /><span>{{ t('tb.thuongHieu') }}</span></div>
        <div class="nut-hop"><i class="vach ngan" /><b class="chon">{{ nutCai }}</b></div>
      </div>
      <img class="tay tay-phai-duoi" src="/emoji/3d/128/1f446.webp" alt="" />
    </template>
  </div>
</template>

<style scoped>
/* Khung: một MẨU màn hình điện thoại, bo góc như máy, nền là trang game mờ */
.mh {
  position: relative; overflow: hidden; width: 100%; max-width: 340px; margin: 0 auto; aspect-ratio: 2 / 1;
  border-radius: 22px; border: 4px solid #1c1f2e; background: linear-gradient(#7fd0f6, #c9ecfb);
  font: 600 13px/1.25 -apple-system, system-ui, sans-serif; color: #1c1c1e;
}
.trang { position: absolute; inset: 14px 18px 60px; border-radius: 14px; background: rgba(255, 255, 255, .45); }
.trang.duoi { inset: 56px 18px 14px; }
.vach { display: block; height: 10px; border-radius: 5px; background: #d9dbe2; margin: 9px 12px; }
.vach.ngan { width: 46px; margin: 0; }
.dong { display: flex; align-items: center; gap: 7px; padding: 6px 10px; margin: 0 4px; border-radius: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
  font-weight: 500; font-size: 12px; color: #3c3c43; background: rgba(118, 118, 128, .14); border-radius: 12px; padding: 6px 8px; }

/* Chỗ cần bấm: viền xanh sáng nhịp đập */
.chon { position: relative; background: #e7f1ff; box-shadow: 0 0 0 2.5px #0a84ff; animation: dap 1.4s ease-in-out infinite; }
@keyframes dap { 50% { box-shadow: 0 0 0 5px rgba(10, 132, 255, .35); } }

/* Ngón tay 👆: đầu ngón ở GIỮA mép trên ảnh → đặt `top` = điểm chạm */
.tay { position: absolute; width: 40px; height: 40px; margin-left: -20px; pointer-events: none; animation: cham 1.4s ease-in-out infinite; }
@keyframes cham { 0%, 100% { transform: translateY(6px); } 45% { transform: translateY(0) scale(.92); } }

/* —— iOS —— */
.ios-thanh { position: absolute; left: 0; right: 0; bottom: 0; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 12px;
  background: rgba(249, 249, 251, .96); border-top: 1px solid #d1d1d6; }
.lui { font-size: 26px; line-height: 1; color: #0a84ff; }
.ba-cham { width: 34px; height: 30px; display: grid; place-items: center; border-radius: 15px; font-size: 11px; letter-spacing: 1px; }
.dich-1 { box-shadow: 0 0 0 2.5px #0a84ff; animation: dap 1.4s ease-in-out infinite; }
.ios-menu { position: absolute; right: 10px; bottom: 58px; width: 64%; padding: 2px 0; border-radius: 14px; background: #fff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .18); }
.ios-menu .vach { margin: 8px 12px; }
/* ⋯ trước, menu hiện sau rồi tay dời lên Chia sẻ — cùng một vòng 3 giây */
.i2 .hien-sau { animation: hienMenu 3s ease-in-out infinite; }
@keyframes hienMenu { 0%, 35% { opacity: 0; transform: translateY(8px) scale(.96); } 45%, 100% { opacity: 1; transform: none; } }
.tay-i2 { animation: tayI2 3s ease-in-out infinite; }
@keyframes tayI2 {
  0%, 30% { left: calc(100% - 29px); top: calc(100% - 26px); }
  45%, 100% { left: 52%; top: calc(100% - 82px); }
}
.ios-bang { position: absolute; left: 0; right: 0; bottom: 0; top: 8px; border-radius: 16px 16px 0 0; background: #f2f2f7; padding: 10px 10px 0; }
.hang-app { display: flex; justify-content: space-between; padding: 0 6px 8px; }
.hang-app i { width: 26px; height: 26px; border-radius: 9px; background: #d9dbe2; }
.the-ds { border-radius: 12px; background: #fff; padding: 2px 0; }
.the-ds .vach { margin: 8px 12px; }
.tay-giua { left: 80%; top: calc(100% - 40px); }
.ios-them { position: absolute; inset: 10px 0 0; border-radius: 16px 16px 0 0; background: #f2f2f7; }
.ios-them .dau { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; }
.ios-them .dau b { padding: 3px 8px; border-radius: 8px; color: #0a84ff; font-weight: 700; }
.the-app { display: flex; align-items: center; gap: 10px; margin: 6px 12px; padding: 10px; border-radius: 12px; background: #fff; }
.the-app img { width: 40px; height: 40px; border-radius: 10px; }
.the-app span { font-weight: 600; font-size: 14px; }
.tay-phai-tren { left: calc(100% - 34px); top: 40px; }

/* —— Android (Chrome) —— */
.ad-thanh { position: absolute; left: 0; right: 0; top: 0; height: 50px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: #fff; }
.ad-thanh .dc { text-align: left; background: #eef0f4; border-radius: 20px; color: #444; }
.ba-cham-doc { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; font-size: 20px; font-weight: 700; color: #444; }
.tay-a2 { left: calc(100% - 23px); top: 42px; }
.ad-menu { position: absolute; right: 6px; top: 8px; width: 72%; padding: 4px 0; border-radius: 10px; background: #fff; box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
.ad-menu .vach { margin: 8px 12px; }
.ad-menu .dong { color: #1f1f1f; }
.a3 .tay-giua { left: 62%; top: 86px; }
.ad-hop { position: absolute; left: 12%; right: 12%; top: 50%; transform: translateY(-50%); padding: 12px; border-radius: 22px; background: #f3f0f7;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .25); display: grid; gap: 8px; }
.ad-hop .the-app { margin: 0; padding: 6px; background: transparent; }
.nut-hop { display: flex; justify-content: flex-end; align-items: center; gap: 14px; }
.nut-hop b { padding: 3px 10px; border-radius: 14px; color: #3d5afe; font-weight: 700; }
.tay-phai-duoi { left: calc(88% - 34px); top: calc(50% + 44px); }

@media (prefers-reduced-motion: reduce) {
  .mh *, .tay { animation: none !important; }
  .i2 .hien-sau { opacity: 1; }
  .tay-i2 { left: 52%; top: calc(100% - 82px); }
}
</style>
