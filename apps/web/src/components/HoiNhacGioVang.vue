<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BellRing } from 'lucide-vue-next';
import { t } from '@/lib/i18n';
import { ghiDaHoi } from '@/lib/gio-vang';
import { batGioVang } from '@/lib/thong-bao';
import { sfx } from '@/lib/audio';

/**
 * TẤM "HẸN BẠN 20:00 MỖI TỐI?" (giờ vàng, 28.11.2026 — mockup duyệt https://claude.ai/artifact/TdLTzxW8Hc61MU3F23cvkk mục 3).
 * Hiện khi về trang chủ sau một ván THẮNG, chỉ trong app (App.vue + lib/gio-vang.ts `nenHoiNhac`). "Nhắc tôi" mới bật hộp
 * xin quyền của hệ điều hành — người đã đồng ý ở bước này thường bấm Cho phép. "Để sau" → hỏi lại sau ≥ 7 ngày, tối đa 2 lần.
 */
const emit = defineEmits<{ close: [] }>();
const dangLam = ref(false);
const bao = ref<'' | 'bat' | 'chan' | 'loi'>('');

onMounted(() => { ghiDaHoi(); });

async function nhac(): Promise<void> {
  if (dangLam.value) return;
  dangLam.value = true;
  sfx.select();
  const kq = await batGioVang();
  dangLam.value = false;
  bao.value = kq;
  if (kq === 'bat') setTimeout(() => emit('close'), 1600);
}
</script>

<template>
  <Teleport to="body">
    <div class="nen" role="dialog" aria-modal="true" :aria-label="t('gv.hoiTieuDe')" @click.self="emit('close')">
      <div class="tam thach">
        <span class="ic" aria-hidden="true"><BellRing :size="26" :stroke-width="2.5" /></span>
        <h2>{{ t('gv.hoiTieuDe') }}</h2>
        <p v-if="!bao">{{ t('gv.hoiThan') }}</p>
        <p v-else-if="bao === 'bat'" class="ok">{{ t('gv.daBat') }}</p>
        <p v-else class="loi">{{ t('gv.biChan') }}</p>
        <button v-if="bao !== 'bat'" class="btn-primary nut" type="button" :disabled="dangLam" @click="nhac">{{ t('gv.nhacToi') }}</button>
        <button data-phang class="phu" type="button" @click="emit('close')">{{ bao ? t('cs.dong') : t('gv.deSau') }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.nen {
  position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; justify-content: center;
  padding: calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px)); background: rgba(10, 12, 30, .45);
}
.tam {
  width: min(420px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
  padding: 18px 16px 14px; border-radius: 22px; background: var(--panel-solid); color: var(--fg);
  animation: len .28s cubic-bezier(.2, .9, .3, 1.2);
}
.ic { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: #7a3a00;
  background: linear-gradient(#ffe27a, #ffbf2e); box-shadow: 0 4px 0 #c98400; }
h2 { margin: 0; font: 800 20px/1.15 var(--font-display, inherit); }
p { margin: 0; font: 700 14px/1.4 var(--font-body, inherit); opacity: .85; max-width: 34ch; }
p.ok { color: #1f8a3a; opacity: 1; }
p.loi { color: #b3261e; opacity: 1; }
.nut { width: 100%; }
.phu { appearance: none; background: none; border: 0; padding: 8px 12px; font: 800 14px var(--font-body, inherit); color: inherit; opacity: .7; cursor: pointer; }
@keyframes len { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .tam { animation: none; } }
</style>
