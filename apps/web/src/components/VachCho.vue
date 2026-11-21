<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { t } from '@/lib/i18n';

/**
 * NÚT ĐANG CHỜ MỜI LẠI (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 3 — chủ dự án:
 * "mời rồi mà vẫn hiện chữ mời"). Đứng ĐÚNG CHỖ nút Mời / Thách: ô xám, vạch xanh lấp dần tới lúc mời lại được.
 * Lời mời còn treo (20 giây đầu) ghi "Đã mời · 14s", sau đó "Mời lại 1:32". Hết giờ → `xong`, cha vẽ lại nút.
 * Mốc là thời điểm TUYỆT ĐỐI (ms) — đổi ra từ số "còn bao lâu" của server NGAY lúc nhận, đừng cộng lại mỗi nhịp.
 */
const p = defineProps<{ het: number; tong: number; moiDen?: number; nho?: boolean }>();
const emit = defineEmits<{ xong: [] }>();

const bayGio = ref(Date.now());
let nhip: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  nhip = setInterval(() => {
    bayGio.value = Date.now();
    if (bayGio.value >= p.het) { clearInterval(nhip); emit('xong'); }
  }, 1000);
});
onUnmounted(() => clearInterval(nhip));

const con = computed(() => Math.max(0, p.het - bayGio.value));
const phanTram = computed(() => `${Math.min(100, Math.max(0, (1 - con.value / Math.max(1, p.tong)) * 100)).toFixed(1)}%`);
const chu = computed(() => {
  if (p.moiDen && p.moiDen > bayGio.value) return t('moi.daMoi', { n: Math.ceil((p.moiDen - bayGio.value) / 1000) });
  const s = Math.ceil(con.value / 1000);
  return t('moi.moiLai', { t: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` });
});
</script>

<template>
  <span class="vach-cho" :class="{ nho: p.nho }" role="status"><i :style="{ width: phanTram }" aria-hidden="true" /><em>{{ chu }}</em></span>
</template>

<style scoped>
.vach-cho {
  position: relative; overflow: hidden; flex: none; box-sizing: border-box;
  min-width: 104px; height: 34px; padding: 0 8px; border-radius: 12px;
  display: inline-grid; place-items: center;
  background: var(--panel-solid); color: var(--muted); box-shadow: inset 0 0 0 1.5px var(--line);
  font: 800 12px var(--font-body); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.vach-cho i { position: absolute; left: 0; top: 0; bottom: 0; background: color-mix(in srgb, #2fb36a 22%, transparent); transition: width 1s linear; }
.vach-cho em { position: relative; font-style: normal; }
.vach-cho.nho { min-width: 0; height: 26px; padding: 0 9px; border-radius: 999px; font-size: 11px; }
@media (prefers-reduced-motion: reduce) { .vach-cho i { transition: none; } }
</style>
