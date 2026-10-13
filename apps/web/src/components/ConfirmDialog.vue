<script setup lang="ts">
import { t } from '@/lib/i18n';
import { onMounted, ref } from 'vue';

defineProps<{ title: string; body: string; confirmLabel: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const btn = ref<HTMLButtonElement | null>(null);
onMounted(() => btn.value?.focus());
</script>

<template>
  <div class="overlay" role="alertdialog" aria-modal="true" :aria-label="title" @keydown.esc="emit('cancel')">
    <div class="panel">
      <h2>{{ title }}</h2>
      <p>{{ body }}</p>
      <div class="row">
        <button ref="btn" class="btn danger" type="button" @click="emit('confirm')">{{ confirmLabel }}</button>
        <button class="btn" type="button" @click="emit('cancel')">{{ t('chung.oLai') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .62);
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.panel { width: 100%; max-width: 360px; }
h2 { margin: 0 0 6px; font-size: var(--text-xl); }
p { margin: 0; color: var(--muted); font-size: var(--text-md); }
.row { display: flex; gap: 8px; margin-top: 18px; }
.row .btn { flex: 1; min-height: 48px; }
.danger {
  /* --bad-solid: chữ trắng trên --bad chỉ 3,91:1, chưa đạt 4,5 */
  border: 0; background: var(--bad-solid); color: #fff; font-weight: 700;
}
</style>
