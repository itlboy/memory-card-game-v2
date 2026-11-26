<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * CHỌN HUY HIỆU PREMIUM (26.11.2026, mockup duyệt https://claude.ai/artifact/UTdgp7a6ngSsiWyv3ZXz7U, phần "Bảng chọn").
 * Mở từ dòng "Huy hiệu" ở mục Cài đặt Premium của bảng Premium. Ba ô xem trước avatar của chính mình đeo từng kiểu; bấm là đổi
 * ngay (lần nối phòng online kế tiếp mang kiểu mới lên server). Dòng dưới cùng: không hiện huy hiệu.
 */
import { Check, X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { HUY_HIEU, type HuyHieu } from '@mm/engine';
import { moChucNang } from '@/lib/phan-tich';
import { t } from '@/lib/i18n';
import { hoSo } from '@/lib/ho-so';
import { datHuyHieu, huyHieu } from '@/lib/premium';
import DauPremium from './DauPremium.vue';

const emit = defineEmits<{ close: [] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('huy_hieu_mo'); });
function chon(v: HuyHieu | ''): void {
  if (huyHieu.value === v) return;
  datHuyHieu(v);
  moChucNang('huy_hieu', { loai: v || 'khong' });
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="hhTitle" @keydown.esc="emit('close')" @click.self="emit('close')" v-cham-ngoai="() => emit('close')">
    <div class="panel hhb">
      <header>
        <h2 id="hhTitle">{{ t('pm.cd.huyHieu') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>
      <p class="mo-ta">{{ t('hhb.moTa') }}</p>
      <div class="luoi" role="radiogroup" aria-labelledby="hhTitle">
        <button
          v-for="k in HUY_HIEU" :key="k" class="o thach" :class="{ chon: huyHieu === k }" type="button" role="radio"
          :aria-checked="huyHieu === k" @click="chon(k)"
        >
          <span class="av" :style="{ '--m': hoSo.mau }" aria-hidden="true">{{ hoSo.mat || '🙂' }}<DauPremium :loai="k" /></span>
          <b>{{ t(`hhb.${k}`) }}</b>
          <span v-if="huyHieu === k" class="dang" aria-hidden="true"><Check :size="13" :stroke-width="3.4" /></span>
        </button>
      </div>
      <button class="khong thach" :class="{ chon: huyHieu === '' }" type="button" role="radio" :aria-checked="huyHieu === ''" @click="chon('')">{{ t('hhb.khong') }}</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.hhb {
  --vang: #f0b429;
  width: min(380px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 16px; background: var(--panel-solid, #fff); border-radius: 28px;
}
.hhb > * { flex-shrink: 0; }
.hhb header { display: flex; align-items: center; justify-content: space-between; }
.hhb h2 { margin: 0; font-size: var(--text-xl); }
.mo-ta { margin: 0; color: var(--muted); font: 600 13px/1.4 var(--font-body); }
.luoi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.o { position: relative; display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 16px 4px 10px; border-radius: 16px; color: inherit; cursor: pointer; }
.o.chon, .khong.chon { outline: 2.5px solid var(--vang); outline-offset: 1px; }
.o b { font: 800 13.5px/1.2 var(--font-body); }
/* avatar xem trước: ô vuông tô đặc màu hồ sơ, PHẲNG — đúng luật hồ sơ người chơi */
.av { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--m, #3fb950); font-size: 32px; line-height: 1; }
.dang { position: absolute; top: 5px; left: 5px; display: grid; place-items: center; width: 21px; height: 21px; border-radius: 50%; background: #1f9d6b; color: #fff; }
.khong { min-height: 44px; border-radius: 14px; color: var(--muted); font: 800 14px/1.2 var(--font-body); cursor: pointer; }
</style>
