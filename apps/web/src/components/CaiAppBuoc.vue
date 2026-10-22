<script setup lang="ts">
/**
 * CÁC BƯỚC CÀI LÊN MÀN HÌNH CHÍNH — dùng chung cho hộp `CaiAppDialog` và mục trong
 * Luật chơi (`RulesDialog`). Luật ở `lib/cai-app.ts`. Mở sẵn tab theo máy, đổi được.
 *
 * Chữ các bước là HTML có sẵn trong từ điển (`<span class="nut" data-ic="…">`): hình
 * nút Safari/Chrome gắn ở đây theo nhãn `data-ic`, để 15 bản dịch khỏi chép SVG.
 *
 * LẬT TỪNG BƯỚC (1 · 2 · 3) với hình minh hoạ to (`MinhHoaCai`) thay vì danh sách dài: hộp
 * không phải cuộn, và mắt chỉ nhìn một việc mỗi lúc.
 */
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { td, t } from '@/lib/i18n';
import MinhHoaCai from './MinhHoaCai.vue';
import { caiNgay, coCaiNgay, tabCai } from '@/lib/cai-app';

const IC: Record<string, string> = {
  share: '<path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/>',
  them: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  tai: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v7M9 12l3 3 3-3"/>'
};
/** Chữ bước (HTML của CHÍNH từ điển ta) + hình nút theo nhãn data-ic. */
const buoc = (k: string): string => td(k).replace(/data-ic="(\w+)">/g, (_m, ic: string) =>
  `>${IC[ic] ? `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[ic]}</svg>` : ''}`);

const chon = (h: 'ios' | 'android'): void => { tabCai.value = h; };
const BUOC = { ios: ['i2', 'i3', 'i4'], android: ['a2', 'a3', 'a4'] } as const;
const so = ref(0);
watch(tabCai, () => { so.value = 0; });
/** Bước đang xem (khoá i2…a4). */
const hien = computed(() => BUOC[tabCai.value][so.value] ?? BUOC[tabCai.value][0]);
</script>

<template>
  <div class="cai-buoc">
    <div class="tabs" role="tablist">
      <button class="thach th-nho" :class="{ 'th-chon': tabCai === 'ios' }" role="tab" type="button" :aria-selected="tabCai === 'ios'" @click="chon('ios')">{{ t('cai.tabIos') }}</button>
      <button class="thach th-nho" :class="{ 'th-chon': tabCai === 'android' }" role="tab" type="button" :aria-selected="tabCai === 'android'" @click="chon('android')">{{ t('cai.tabAndroid') }}</button>
    </div>

    <button v-if="tabCai === 'android' && coCaiNgay" class="thach th-xanh cai-ngay" type="button" @click="caiNgay">{{ t('cai.caiNgay') }}</button>

    <div class="buoc khay-nho" role="tabpanel">
      <div class="chu">
        <span class="so">{{ so + 1 }}</span>
        <div>
          <!-- HTML lấy từ từ điển của ta, không từ người dùng -->
          <b v-html="buoc(`cai.${hien}`)" />
          <p>{{ td(`cai.${hien}p`) }}</p>
        </div>
      </div>
      <MinhHoaCai :key="hien" :buoc="hien" />
      <div class="dieu-huong">
        <button class="thach th-nho lat" type="button" :disabled="so === 0" :aria-label="t('menu.quayLai')" @click="so--"><ChevronLeft :size="20" /></button>
        <span class="cham">
          <button
            v-for="(k, i) in BUOC[tabCai]" :key="k" data-phang type="button" :class="{ dang: i === so }"
            :aria-label="String(i + 1)" :aria-current="i === so ? 'step' : undefined" @click="so = i"
          />
        </span>
        <button class="thach th-nho lat" :class="{ 'th-xanh': so < 2 }" type="button" :disabled="so === 2" :aria-label="t('menu.tiep')" @click="so++"><ChevronRight :size="20" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cai-buoc { display: flex; flex-direction: column; gap: 10px; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tabs .thach { min-height: 44px; border-radius: 14px; font-weight: 800; }
.cai-ngay { border-radius: 16px; min-height: 50px; font-family: var(--font-display); font-size: 19px; }
.buoc { display: flex; flex-direction: column; gap: 10px; padding: 10px; border-radius: 18px; }
.chu { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; min-height: 74px; }
.so { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #3aa52a; color: #fff;
  font-family: var(--font-display); font-weight: 900; font-size: 16px; }
.buoc b { display: block; font-size: 15.5px; line-height: 1.55; }
.buoc p { margin: 2px 0 0; font-size: 13px; line-height: 1.4; color: var(--muted); }
.dieu-huong { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lat { width: 48px; height: 40px; min-width: 0; min-height: 0; padding: 0; border-radius: 14px; display: grid; place-items: center; }
.lat:disabled { opacity: .35; }
.cham { display: flex; gap: 6px; }
/* chấm 10px, vùng chạm nới bằng ::after */
.cham button { position: relative; width: 10px; height: 10px; min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 5px; background: var(--line); transition: width .2s; }
.cham button::after { content: ''; position: absolute; inset: -12px -4px; }
.cham button.dang { width: 26px; background: #3aa52a; }
/* Nút trông như nút thật của Safari/Chrome — nằm trong v-html nên phải :deep */
.buoc :deep(.nut) {
  display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; margin: 0 1px; padding: 0 7px;
  border: 1.5px solid var(--line); border-radius: 9px; background: var(--panel-soft); color: var(--fg);
  font: 600 13.5px/1.7 -apple-system, system-ui, sans-serif; white-space: nowrap;
}
.buoc :deep(.nut.xanh svg) { color: #0a84ff; }
.buoc :deep(.xanh-chu) { color: var(--accent); }
</style>
