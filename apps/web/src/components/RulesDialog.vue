<script setup lang="ts">
// Số giây trong luật đọc thẳng từ engine — viết tay là lệch (đã lệch: 15 trong khi luật là 25)
import CaiAppBuoc from './CaiAppBuoc.vue';
import { coHuongDanCai } from '@/lib/cai-app';
import { CAMPAIGN_LEVELS, TURN_BONUS_MS, TURN_LIMIT_SEC } from '@mm/engine';
import { X } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { buildAgeText } from '@/lib/format';
import { t } from '@/lib/i18n';
import { banNative } from '@/lib/ota';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';

const props = defineProps<{ debug: boolean }>();
const emit = defineEmits<{ close: []; 'update:debug': [boolean] }>();

/* ---------- phiên bản & tuổi bản build ---------- */

const version = __APP_VERSION__;
/** Ngày giờ build, ĐÃ định dạng theo giờ Việt Nam lúc build (xem vite.config). */
const builtAt = __BUILD_AT__;

const ago = ref(buildAgeText(Date.now() - Date.parse(__BUILD_ISO__)));
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  // Đếm từng giây: người chơi mở bảng này ra đúng lúc vừa deploy thì thấy con số
  // chạy, biết ngay là bản mới.
  tick = setInterval(() => {
    ago.value = buildAgeText(Date.now() - Date.parse(__BUILD_ISO__));
  }, 1000);
});
onUnmounted(() => clearInterval(tick));
const native = ref<string | null>(null);
void banNative().then((v) => { native.value = v; });

/*
 * CỬA BÍ MẬT VÀO CHẾ ĐỘ DEBUG (chủ dự án 14.10.2026: nút bật nằm sẵn trên màn là
 * "lộ quá"). Chạm 7 LẦN LIÊN TIẾP vào dòng phiên bản — kiểu "Tuỳ chọn nhà phát
 * triển" của Android; ngắt quá 1,5 giây giữa hai chạm là đếm lại. Đang bật thì nút
 * hiện ra để TẮT. `?debug=1` vẫn mở được như cũ.
 *
 * Đếm bằng `pointerup`, KHÔNG `click`: Safari/WebView iOS không phát `click` trên
 * phần tử không bấm được (<p> không cursor:pointer) — trên iPhone 7 chạm không
 * đếm được lần nào (chủ dự án báo). `touch-action: manipulation` để chạm nhanh
 * không bị hiểu thành chạm-đúp phóng to.
 */
const SO_CHAM_MO = 7;
let soCham = 0;
let hetCham: ReturnType<typeof setTimeout> | undefined;
function chamPhienBan(): void {
  clearTimeout(hetCham);
  soCham += 1;
  if (soCham >= SO_CHAM_MO) { soCham = 0; if (!props.debug) emit('update:debug', true); return; }
  hetCham = setTimeout(() => { soCham = 0; }, 1500);
}
onUnmounted(() => clearTimeout(hetCham));
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

/*
 * Luật viết theo giọng của game: nói với "bạn", mỗi dòng một điều, không sáo.
 *
 * KHÔNG CÒN MỤC "CÁC CHẾ ĐỘ". Bốn chế độ cũ đã tan thành năm tuỳ chọn bàn chơi,
 * nên mục này phải kể đúng thứ người chơi thấy trong màn cài đặt — icon dùng
 * CHUNG một bộ với màn đó, để đọc luật xong nhận ra ngay hàng nào là hàng nào
 * (quy tắc ở CLAUDE.md: đổi thể thức chơi thì phải cập nhật hướng dẫn).
 */
const OPTIONS = computed((): readonly { icon: IconName; name: string; text: string }[] => [
  { icon: 'time', name: t('opt.time'), text: t('lc.opt.time') },
  { icon: 'lives', name: t('opt.lives'), text: t('lc.opt.lives') },
  { icon: 'peek', name: t('opt.peek'), text: t('lc.opt.peek') },
  { icon: 'shuffle', name: t('opt.shuffle'), text: t('lc.opt.shuffle') },
  { icon: 'special', name: t('opt.special'), text: t('lc.opt.special') }
]);

const POWERS = computed((): readonly { icon: IconName; name: string; text: string }[] => [
  { icon: 'swap', name: t('lc.phep.swap'), text: t('lc.phep.swapMo') },
  { icon: 'bomb', name: t('lc.phep.bomb'), text: t('lc.phep.bombMo') },
  { icon: 'x2', name: t('lc.phep.x2'), text: t('lc.phep.x2Mo') },
  { icon: 'freeze', name: t('lc.phep.freeze'), text: t('lc.phep.freezeMo') }
]);
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" @keydown.esc="emit('close')">
    <div class="panel rules">
      <header class="rules-head">
        <h2 id="rulesTitle">{{ t('lc.tieuDe') }}</h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <!-- Chỉ khối này cuộn, để tiêu đề và nút đóng luôn nhìn thấy -->
      <div class="rules-body">
        <h3>{{ t('lc.h.cachChoi') }}</h3>
        <p class="lead">{{ t('lc.cachChoi') }}</p>

        <h3>{{ t('lc.h.diem') }}</h3>
        <ul class="plain">
          <li><b>{{ t('lc.diem1b') }}</b>{{ t('lc.diem1c') }}</li>
          <li>{{ t('lc.diem2') }}<b>{{ t('lc.diem2b') }}</b>{{ t('lc.diem2c') }}</li>
          <li>{{ t('lc.diem3') }}<b>{{ t('lc.diem3b') }}</b>{{ t('lc.diem3c') }}</li>
          <li>{{ t('lc.diem4') }}<b>{{ t('lc.diem4b') }}</b>{{ t('lc.diem4c') }}</li>
        </ul>

        <h3>{{ t('lc.h.tuyChon') }}</h3>
        <ul class="items">
          <li v-for="o in OPTIONS" :key="o.name">
            <OptionIcon :name="o.icon" :size="22" />
            <span><b>{{ o.name }}</b> — {{ o.text }}</span>
          </li>
        </ul>

        <h3>{{ t('lc.h.theDacBiet') }}</h3>
        <ul class="items">
          <li v-for="p in POWERS" :key="p.name">
            <OptionIcon :name="p.icon" :size="22" />
            <span><b>{{ p.name }}</b> — {{ p.text }}</span>
          </li>
        </ul>

        <h3>{{ t('lc.h.chienDich') }}</h3>
        <ul class="items">
          <li>
            <OptionIcon name="campaign" :size="22" />
            <span><b>{{ t('lc.chienDichB', { n: CAMPAIGN_LEVELS }) }}</b>{{ t('lc.chienDich') }}</span>
          </li>
        </ul>

        <h3>{{ t('lc.h.nhieuNguoi') }}</h3>
        <ul class="plain">
          <li>{{ t('lc.nn1') }}<b>{{ t('lc.nn1b') }}</b>{{ t('lc.nn1c') }}<b>{{ t('lc.nn1d') }}</b>{{ t('lc.nn1e') }}</li>
          <li>
            {{ t('lc.nn2') }}<b>{{ t('lc.nn2b') }}</b>{{ t('lc.nn2c') }}<b>{{ t('lc.nn2d') }}</b>{{
              t('lc.nn2e') }}<b>{{ t('lc.nn2f') }}</b>{{ t('lc.nn2g') }}
          </li>
          <li>{{ t('lc.nn3') }}</li>
          <li>{{ t('lc.nn4') }}<b>{{ t('lc.nn4b', { s: TURN_LIMIT_SEC }) }}</b>{{ t('lc.nn4c', { s: TURN_LIMIT_SEC, b: TURN_BONUS_MS / 1000 }) }}</li>
          <li>{{ t('lc.nn5') }}<b>{{ t('lc.nn5b') }}</b>{{ t('lc.nn5c') }}</li>
          <li>{{ t('lc.nn6') }}<b>{{ t('lc.nn6b') }}</b>{{ t('lc.nn6c') }}</li>
        </ul>

        <!-- Cài lên màn hình chính (lib/cai-app.ts) — ẩn khi đang là app (store hoặc đã cài) -->
        <template v-if="coHuongDanCai">
          <h3 id="cai">{{ t('cai.tieuDe') }}</h3>
          <p class="lead">{{ t('cai.lead') }}</p>
          <CaiAppBuoc />
        </template>
      </div>

      <button class="btn btn-primary" type="button" @click="emit('close')">{{ t('lc.daHieu') }}</button>

      <!-- Phiên bản + ngày build. Để ở đây vì đây là chỗ người chơi tìm khi cần
           trả lời "máy tôi đang chạy bản nào" — không cần một màn hình riêng. -->
      <p class="build" @pointerup="chamPhienBan">
        <b>v{{ version }}</b> · build {{ builtAt }}
        <span class="ago">({{ ago }})</span>
        <!-- Trong app: bản NATIVE cài từ store. Gói web phía trên có thể mới hơn nhờ cập
             nhật nóng (lib/ota.ts) — hai dòng khác nhau là bình thường. -->
        <template v-if="native"><br>{{ t('lc.banApp', { ban: native }) }}</template>
      </p>

      <!-- DƯỚI CÙNG, sau cả số bản dựng: đây là công cụ soi lỗi, không phải một
           tính năng chơi. CHỈ HIỆN khi debug đang bật (để tắt) — bật thì chạm 7 lần
           vào dòng phiên bản phía trên (`chamPhienBan`). -->
      <button
        v-if="props.debug" class="nut-do" type="button"
        :aria-pressed="props.debug ? 'true' : 'false'"
        @click="emit('update:debug', !props.debug)"
      >{{ props.debug ? t('lc.debugBat') : t('lc.debugTat') }}</button>
      <!--
        GHI CÔNG CC-BY 4.0 — giấy phép BẮT BUỘC ghi công nên không xoá hẳn được.
        Chủ dự án yêu cầu bỏ khỏi màn thường (11.10.2026: "đừng hiển thị nhiều
        gây rối"), nên chỉ hiện trong chế độ debug, và có thêm `/credits.txt`.
      -->
      <!-- Công cụ debug (Premium thử, đo khung hình, ping, bộ emoji, xem thử hiệu ứng) đã
           chuyển vào MENU CÀI ĐẶT (DebugMenu.vue, 16.10.2026) — ở đây chỉ còn cửa bật/tắt
           và ghi công bắt buộc. -->
      <p v-if="props.debug" class="build">{{ t('lc.ghiCong') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Nút soi lỗi: cố tình NHẠT và nhỏ hơn mọi nút khác trong bảng — nó không phải
   thứ người chơi cần bấm, chỉ là chỗ để bật khi được nhờ đọc số đo. */
.nut-do {
  display: block; width: 100%; margin-top: 6px;
  min-height: 34px; padding: 6px 10px; border-radius: 9px;
  border: 1px dashed var(--line-strong); background: transparent;
  color: var(--muted); font: inherit; font-size: var(--text-xs); font-weight: 700;
}
.nut-do[aria-pressed='true'] { border-style: solid; border-color: var(--bad); color: var(--bad); }
/* Chân trang phiên bản: mờ, nhỏ, không giành sự chú ý với nội dung luật chơi */
.build {
  margin: 12px 0 0; text-align: center; touch-action: manipulation; -webkit-user-select: none; user-select: none;
  font-size: 12px; color: var(--muted); line-height: 1.5;
}
.build b { color: var(--fg); font-variant-numeric: tabular-nums; }
.build .ago { opacity: .85; font-variant-numeric: tabular-nums; }

.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
/* Panel cao tối đa theo viewport; RIÊNG phần nội dung được cuộn — luật dài hơn
   một màn hình là chuyện bình thường, còn tiêu đề và nút đóng phải luôn thấy. */
.rules {
  /* Rộng ĐÚNG BẰNG cột nội dung của game (--col-w ở global.css), không phải một
     con số riêng: 460px cố định nằm trong cột 600px trên máy tính đọc ra thành
     một cột chữ hẹp lọt giữa màn hình, mà luật chơi là trang chữ dài — nó cần
     mọi pixel bề rộng đang có. */
  width: 100%; max-width: var(--col-w); max-height: 100%;   /* = cao lớp phủ trừ đệm (đã gồm vùng an toàn) */
  display: flex; flex-direction: column; min-height: 0;
}
.rules-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.rules-head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.rules-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
/* Tiêu đề mục: chữ display cỡ lớn (chủ dự án 22.10.2026: bản chữ hoa nhỏ màu nhạt khó thấy) */
.rules-body h3 {
  margin: 18px 0 6px; font-family: var(--font-display); font-size: 19px; line-height: 1.2; color: var(--fg);
}
.rules-body h3:first-child { margin-top: 0; }
.lead { margin: 0; font-size: var(--text-md); line-height: 1.5; }
.plain, .items { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.plain li { font-size: var(--text-md); line-height: 1.45; padding-left: 14px; position: relative; }
.plain li::before { content: '·'; position: absolute; left: 3px; color: var(--accent); font-weight: 800; }
/* align-items: flex-start + nhích 2px: icon là ô vuông 22px, canh giữa theo
   dòng đầu thì nó trôi xuống giữa đoạn khi chữ dài hai ba dòng. */
.items li { display: flex; gap: 9px; align-items: flex-start; font-size: var(--text-md); line-height: 1.45; }
.items :deep(.opt-ico) { margin-top: 2px; }
</style>
