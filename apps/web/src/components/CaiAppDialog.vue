<script setup lang="ts">
/**
 * Hộp HƯỚNG DẪN CÀI LÊN MÀN HÌNH CHÍNH — luật ở `lib/cai-app.ts`.
 *
 * Mở sẵn đúng tab theo máy (iPhone/iPad hay Android), đổi được. Bàn tay 3D nhún chỉ
 * vào nút của trình duyệt NẰM NGOÀI trang: Safari ⋯ ở góc DƯỚI phải, Chrome ⋮ ở góc
 * TRÊN phải — vì thế lớp phủ là `fixed` theo cửa sổ, không theo cột #app. Không chỉ tay
 * khi đang trong trình duyệt nhúng (Zalo…): ở đó nút ấy không có lối cài.
 * Các bước nằm ở `CaiAppBuoc` (dùng chung với mục trong Luật chơi).
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { t } from '@/lib/i18n';
import { heMay, tabCai, trongAppKhac } from '@/lib/cai-app';
import CaiAppBuoc from './CaiAppBuoc.vue';

const emit = defineEmits<{ close: [] }>();

const chiTay = !trongAppKhac && heMay !== 'khac';
/** Có bàn tay chỉ nút trình duyệt → hộp dạt xuống (Safari) / lên (Chrome) chừa chỗ; không thì ở GIỮA (máy tính). */
const coTay = computed(() => chiTay && tabCai.value === heMay);
const daChep = ref(false);
const nutDong = ref<HTMLButtonElement | null>(null);

async function chep(): Promise<void> {
  try {
    await navigator.clipboard.writeText(`${location.origin}/?cai=1`);
    daChep.value = true;
    setTimeout(() => { daChep.value = false; }, 1600);
  } catch { /* trình duyệt chặn clipboard */ }
}

function phim(e: KeyboardEvent): void { if (e.key === 'Escape') emit('close'); }
onMounted(() => { nutDong.value?.focus(); document.addEventListener('keydown', phim); });
onUnmounted(() => document.removeEventListener('keydown', phim));
</script>

<template>
  <div class="cai-phu" :class="{ [tabCai]: coTay }" role="dialog" aria-modal="true" :aria-label="t('cai.tieuDe')" @click.self="emit('close')">
    <div class="cai-hop khay">
      <header>
        <img class="ico" src="/emoji/3d/128/1f4f1.webp" alt="" aria-hidden="true" />
        <h2>{{ t('cai.tieuDe') }}</h2>
        <button ref="nutDong" class="dong thach th-nho" type="button" :aria-label="t('cs.dong')" @click="emit('close')"><X :size="18" /></button>
      </header>
      <!-- Chỉ thân cuộn (máy thấp, hoặc thêm khối Zalo): tiêu đề và nút Đã hiểu luôn thấy -->
      <div class="than">
        <p class="loi">{{ t('cai.lead') }}</p>

        <div v-if="trongAppKhac" class="bao khay-nho">
          <b>{{ t('cai.trongAppH') }}</b>
          <p>{{ t('cai.trongAppP') }}</p>
          <button class="thach th-vang th-nho" type="button" @click="chep">{{ daChep ? t('cai.daChep') : t('cai.chep') }}</button>
        </div>

        <CaiAppBuoc />
      </div>

      <button class="thach th-xanh xong" type="button" @click="emit('close')">{{ t('cai.daHieu') }}</button>
    </div>
    <img v-if="coTay" class="tay" :src="heMay === 'ios' ? '/emoji/3d/128/1f447.webp' : '/emoji/3d/128/1f446.webp'" alt="" aria-hidden="true" />
  </div>
</template>

<style scoped>
.cai-phu {
  position: fixed; inset: 0; z-index: 20;
  display: flex; justify-content: center; align-items: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(6, 9, 18, .55);
}
/* Chừa chỗ cho bàn tay: Safari chỉ xuống góc dưới, Chrome chỉ lên góc trên */
.cai-phu.ios { align-items: flex-end; padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
.cai-phu.android { align-items: flex-start; padding-top: calc(62px + env(safe-area-inset-top, 0px)); }
.cai-hop {
  width: 100%; max-width: 420px; max-height: 100%;
  padding: 14px 14px 12px; border-radius: 24px; background: var(--panel-solid); color: var(--fg);
  display: flex; flex-direction: column; gap: 10px;
}
.than { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 10px; }
header { display: flex; align-items: center; gap: 8px; }
.ico { width: 38px; height: 38px; flex: none; }
h2 { flex: 1; margin: 0; font-family: var(--font-display); font-size: 21px; line-height: 1.15; }
.dong { flex: none; position: relative; width: 36px; height: 36px; min-width: 0; min-height: 0; padding: 0; border-radius: 50%; }
.dong::after { content: ''; position: absolute; inset: -5px; }
.loi { margin: 0; font-size: 14px; color: var(--muted); }
.bao { display: grid; gap: 6px; padding: 10px 12px; border-radius: 16px; font-size: 13.5px; }
.bao b { font-size: 14.5px; }
.bao p { margin: 0; color: var(--muted); }
.bao .thach { justify-self: start; min-height: 40px; padding: 4px 14px; border-radius: 12px; }
.xong { flex: none; border-radius: 16px; min-height: 50px; font-family: var(--font-display); font-size: 19px; }
.tay { position: fixed; z-index: 21; width: 52px; height: 52px; pointer-events: none; animation: nhun 1s ease-in-out infinite; }
.ios .tay { right: 6px; bottom: calc(4px + env(safe-area-inset-bottom, 0px)); }
.android .tay { right: 4px; top: calc(4px + env(safe-area-inset-top, 0px)); --huong: -1; }
@keyframes nhun { 50% { transform: translateY(calc(8px * var(--huong, 1))); } }
@media (prefers-reduced-motion: reduce) { .tay { animation: none; } }
</style>
