<script setup lang="ts">
/**
 * MẬT KHẨU CHẾ ĐỘ DEBUG (25.11.2026, chủ dự án: "chế độ debug có thêm mật khẩu") — hỏi khi BẬT debug (7 chạm hoặc
 * `?debug=1`); máy đã bật từ trước thì giữ nguyên. Đây là CỬA MỀM: mã nằm trong gói web nên người soi mã vẫn thấy —
 * mục đích là người chơi chạm nhầm 7 lần không vào được khu thử nghiệm (Premium, hình nền…), không phải bảo mật.
 * Sai thì lắc ô và xoá, không báo chữ.
 */
import { Bug, X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';

const MA = '1412';
const emit = defineEmits<{ dung: []; dong: [] }>();
const nhap = ref('');
const sai = ref(false);
const o = ref<HTMLInputElement | null>(null);
onMounted(() => o.value?.focus());

function thu(): void {
  if (nhap.value === MA) { emit('dung'); return; }
  nhap.value = ''; sai.value = true;
  setTimeout(() => { sai.value = false; }, 450);
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('tb.debug')" @keydown.esc="emit('dong')" @click.self="emit('dong')">
    <form class="panel mk" :class="{ sai }" @submit.prevent="thu">
      <header>
        <h2><Bug :size="20" :stroke-width="2.4" aria-hidden="true" /> {{ t('tb.debug') }}</h2>
        <button class="btn" type="button" :aria-label="t('dhd.dong')" @click="emit('dong')"><X :size="20" /></button>
      </header>
      <input ref="o" v-model="nhap" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="••••" :aria-label="t('tb.debug')" @input="nhap.length === MA.length && thu()">
    </form>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  padding: calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px));
  background: rgba(6, 9, 18, .62);
}
.mk { width: 100%; max-width: 300px; display: grid; gap: 14px; }
.mk header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mk h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: var(--text-lg); }
.mk input {
  min-height: 52px; box-sizing: border-box; width: 100%; padding: 0 14px; border-radius: 14px; border: 2px solid var(--line);
  background: var(--panel-solid); color: var(--fg); font: 800 24px/1 var(--font-body); letter-spacing: .3em; text-align: center;
}
.mk.sai { animation: lac .4s; }
@keyframes lac { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
</style>
