<script setup lang="ts">
/**
 * BỊ MỜI RA / PHÒNG BỊ HUỶ (20.11.2026, mockup A duyệt https://claude.ai/artifact/VviMC13FwDybkzYwXAH5CH):
 * hộp thoại có một nút "Đã hiểu" thay cho ô đỏ `.warn` — ô đỏ đọc như máy hỏng và trôi mất giữa
 * danh sách phòng. Người chơi đã ở màn Online sẵn, đóng hộp là chọn phòng khác ngay.
 */
import { t } from '@/lib/i18n';
import { onMounted, ref } from 'vue';

const props = defineProps<{ code: 'kicked' | 'cancelled'; ma?: string }>();
const emit = defineEmits<{ dong: [] }>();
const btn = ref<HTMLButtonElement | null>(null);
onMounted(() => btn.value?.focus());
const tieuDe = (): string => (props.code === 'kicked'
  ? (props.ma ? t('pd.kicked.tieuDe', { ma: props.ma }) : t('pd.kicked.tieuDeKhongMa'))
  : (props.ma ? t('pd.cancelled.tieuDe', { ma: props.ma }) : t('pd.cancelled.tieuDeKhongMa')));
</script>

<template>
  <div class="overlay" role="alertdialog" aria-modal="true" :aria-label="tieuDe()" @keydown.esc="emit('dong')">
    <div class="panel hop">
      <div class="ic" aria-hidden="true">{{ code === 'kicked' ? '👋' : '🚪' }}</div>
      <h2>{{ tieuDe() }}</h2>
      <p>{{ code === 'kicked' ? t('pd.kicked.than') : t('pd.cancelled.than') }}</p>
      <button ref="btn" class="btn-primary" type="button" @click="emit('dong')">{{ t('pd.daHieu') }}</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .62);
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.hop { width: 100%; max-width: 340px; text-align: center; }
.ic { font-size: 46px; line-height: 1; }
h2 { margin: 10px 0 6px; font-size: var(--text-xl); text-wrap: balance; }
p { margin: 0 0 18px; color: var(--muted); font-size: var(--text-md); }
.btn-primary { width: 100%; min-height: 48px; }
</style>
