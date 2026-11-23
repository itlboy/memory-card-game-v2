<script setup lang="ts">
/**
 * POPUP CHỌN SỐ THẺ (23.11.2026, mockup duyệt https://claude.ai/artifact/1ZLCzgAHHk6gZYm5eFggFr; chủ dự án: "giao diện
 * hiện tại không phải update gì, chỉ thêm thôi… đừng giải thích nhiều, chỉ cần hiện ra ô chọn số thẻ… bỏ chữ thẻ"; thời gian 10 giây").
 * Hiện khi server mở lượt chọn (`RoomInfo.chon`: chủ phòng bấm Bắt đầu, hoặc cả phòng bấm Chơi lại) và tự biến mất khi
 * server chốt. Ba ô CHỈ CÓ CON SỐ; dưới ô là mặt những người đã chọn. Ô mình chọn màu vàng, bấm ô khác là đổi ý.
 * Luật chốt (số đông, hoà thì bốc trong các số dẫn đầu, không chọn thì bỏ qua) nằm ở server — popup không giải thích.
 * Người xem CŨNG THẤY popup nhưng các ô bị khoá (không bỏ phiếu). MOUNT MỘT CHỖ (OnlineScreen) — teleport ra body, nổi trên cả bảng kết quả.
 */
import { CHON_THE_MS } from '@mm/engine';
import type { RoomInfo } from '@mm/engine';
import { Timer } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { sfx } from '@/lib/audio';
import { t } from '@/lib/i18n';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{
  o: { room: { value: RoomInfo | null }; myId: { value: string }; spectator: { value: boolean }; chonThe: (the: number) => void };
}>();

// NGƯỜI XEM CŨNG THẤY bảng này (chủ dự án 23.11.2026: "người xem cũng thấy hiện lên bảng chọn số thẻ nhưng họ không chọn được")
// — các ô bị khoá, chỉ để theo dõi mọi người chọn gì.
const chon = computed(() => props.o.room.value?.chon);
const chiXem = computed(() => props.o.spectator.value);
/** Mốc hết giờ theo đồng hồ MÁY NÀY (server gửi số ms còn lại, không gửi mốc tuyệt đối). */
const het = ref(0);
const conMs = ref(0);
let nhip: ReturnType<typeof setInterval> | undefined;
const dung = (): void => { clearInterval(nhip); nhip = undefined; };
watch(() => chon.value?.id, (id) => {
  dung();
  if (id === undefined || !chon.value) return;
  het.value = Date.now() + chon.value.con;
  conMs.value = chon.value.con;
  nhip = setInterval(() => { conMs.value = Math.max(0, het.value - Date.now()); if (!conMs.value) dung(); }, 100);
}, { immediate: true });
onBeforeUnmount(dung);

const cuaToi = computed(() => chon.value?.phieu[props.o.myId.value]);
const aiChon = (the: number) => (props.o.room.value?.players ?? []).filter((p) => chon.value?.phieu[p.id] === the);
function bam(the: number): void {
  if (chiXem.value || cuaToi.value === the) return;
  sfx.select();
  props.o.chonThe(the);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ct">
      <div v-if="chon" class="ct-phu" role="dialog" aria-modal="true" :aria-label="t('on.chonSoThe')">
        <div class="panel ct-hop">
          <div class="ct-dau">
            <h2>{{ t('on.chonSoThe') }}</h2>
            <span class="ct-giay" aria-hidden="true"><Timer :size="19" :stroke-width="2.8" />{{ Math.ceil(conMs / 1000) }}</span>
          </div>
          <div class="ct-vach" aria-hidden="true"><i :style="{ width: `${Math.min(100, (conMs / CHON_THE_MS) * 100)}%` }" /></div>
          <div class="ct-luoi">
            <button
              v-for="the in chon.ds" :key="the" class="ct-o thach" :class="{ 'th-vang': cuaToi === the, khoa: chiXem }" type="button"
              :aria-pressed="cuaToi === the" :disabled="chiXem" @click="bam(the)"
            >
              <b>{{ the }}</b>
              <span class="ct-ai"><MatNguoi v-for="p in aiChon(the)" :key="p.id" :mat="p.avatar" :anh="p.anh" /></span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ct-phu {
  /* Trên bảng kết quả (17–20) và hộp xác nhận, dưới bong bóng chat (59/60) */
  position: fixed; inset: 0; z-index: 55; display: flex; align-items: center; justify-content: center;
  padding: 20px 22px; background: rgba(6, 9, 18, .6);
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.ct-hop { width: 100%; max-width: 360px; padding: 18px 14px 16px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
.ct-dau { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ct-dau h2 { margin: 0; font-size: 22px; line-height: 1.1; }
.ct-giay { display: inline-flex; align-items: center; gap: 5px; font: 800 22px/1 var(--font-display); color: #2f8a14; font-variant-numeric: tabular-nums; }
:global([data-theme='dark'] .ct-giay) { color: #9fe07a; }
.ct-vach { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--fg) 12%, transparent); overflow: hidden; }
/* Thanh giờ: bề rộng do JS đặt mỗi 0,1 s + transition ngắn cho mượt. KHÔNG dùng @keyframes (xem chú thích ở script). */
.ct-vach i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(#a3ec72, #46ad22); transition: width .1s linear; }
.ct-luoi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ct-o {
  min-height: 108px; padding: 8px 4px 6px; border-radius: 18px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
}
/* Người xem: ô vẫn rõ để đọc, chỉ không bấm được (không làm mờ kiểu disabled .45) */
.ct-o.khoa { opacity: 1; cursor: default; pointer-events: none; }
.ct-o b { font: 800 36px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.ct-ai { display: flex; justify-content: center; gap: 2px; min-height: 22px; font-size: 18px; line-height: 1; }
.ct-ai :deep(img) { width: 20px; height: 20px; border-radius: 50%; }
.ct-enter-active, .ct-leave-active { transition: opacity .16s ease; }
.ct-enter-from, .ct-leave-to { opacity: 0; }
</style>
