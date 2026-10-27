<script setup lang="ts">
/**
 * TRANG DEBUG RIÊNG (chủ dự án 16.10.2026: khối debug nằm thẳng trong menu Cài đặt thì
 * "nhiều settings quá"). Menu chỉ còn nút "🐞 Debug" cạnh chữ "Cài đặt" (khi debug bật);
 * bấm vào mở trang này — cùng khung hộp thoại với Luật chơi (lớp phủ + panel, chỉ phần
 * thân cuộn) nên không đụng bố cục chung. Nội dung là `DebugMenu.vue`.
 */
import { X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';
import DebugMenu, { type XemFx } from './DebugMenu.vue';

defineProps<{ doNhip: boolean }>();
const emit = defineEmits<{ close: []; 'update:doNhip': [boolean]; 'xem-fx': [XemFx]; tat: []; 'mua-the': [] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => nutDong.value?.focus());
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="dbgTitle" @keydown.esc="emit('close')">
    <div class="panel dbg-trang">
      <header class="dbg-head">
        <h2 id="dbgTitle">🐞 {{ t('tb.debug') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <div class="dbg-body">
        <DebugMenu
          :do-nhip="doNhip"
          @update:do-nhip="emit('update:doNhip', $event)" @xem-fx="emit('xem-fx', $event)" @tat="emit('tat')" @mua-the="emit('mua-the')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Cùng số đo với RulesDialog (.overlay / .rules): z 20 trên mọi thứ, tự cộng vùng an toàn */
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.dbg-trang { width: 100%; max-width: min(var(--col-w), 460px); max-height: 100%; display: flex; flex-direction: column; min-height: 0; }
.dbg-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.dbg-head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.dbg-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
</style>
