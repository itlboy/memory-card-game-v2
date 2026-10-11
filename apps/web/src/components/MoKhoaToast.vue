<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { byId, vuaMo } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { rung } from '@/lib/rung';

/**
 * KHOE DANH HIỆU VỪA MỞ — dải huy hiệu trượt xuống dưới thanh trên, từng cái
 * một, 2,4 giây mỗi cái. Không chặn chạm (`pointer-events: none`) và nằm dưới
 * hộp thoại (z 19 < 20), nên không bao giờ che nút của bảng kết quả.
 */
const dang = ref<{ id: string; key: number } | null>(null);
let hen: ReturnType<typeof setTimeout> | undefined;

function tiep(): void {
  if (dang.value || !vuaMo.value.length) return;
  const [dau, ...con] = vuaMo.value;
  vuaMo.value = con;
  dang.value = dau!;
  sfx.unlockTheme();
  rung.ghep(4);
  hen = setTimeout(() => { dang.value = null; setTimeout(tiep, 250); }, 2400);
}
watch(vuaMo, tiep, { immediate: true });
onUnmounted(() => clearTimeout(hen));
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="dang" :key="dang.key" class="toast" role="status" aria-live="polite">
        <span class="huy" aria-hidden="true">🏅</span>
        <span><small>Mở khoá danh hiệu</small><b>{{ byId(dang.id)?.name }}</b></span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 68px); z-index: 19;
  transform: translateX(-50%); pointer-events: none;
  display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 32px);
  padding: 10px 18px 10px 12px; border-radius: 999px;
  background: linear-gradient(135deg, #ffd76a, #f0a500); color: #4a2f00;
  box-shadow: 0 10px 30px rgba(240, 165, 0, .45);
}
.huy { font-size: 28px; }
.toast small { display: block; font-size: 11px; font-weight: 700; opacity: .8; }
.toast b { display: block; font-family: var(--font-display); font-size: var(--text-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toast-enter-active { transition: transform .35s cubic-bezier(.3, 1.5, .5, 1), opacity .25s; }
.toast-leave-active { transition: transform .25s, opacity .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -24px); }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: opacity .2s; } }
</style>
