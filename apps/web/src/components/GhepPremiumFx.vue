<script setup lang="ts">
/**
 * LỚP VẼ HIỆU ỨNG GHÉP CẶP PREMIUM (lib/hieu-ung-premium.ts). Đặt MỘT lần ở App.vue; teleport ra <body>, `position: fixed`,
 * không chặn chạm. Tìm hai lá theo `[data-index]` trong lưới bàn (`[role=grid]`), gắn lớp `.ghep-pm` cho chúng ~0,9 giây
 * (phồng + quầng sáng, CSS toàn cục bên dưới), và bung 12 tia từ tâm mỗi lá. Hạt theo CHỦ ĐỀ đang dùng (lib/canh.ts).
 * Máy bật giảm chuyển động: chỉ còn quầng sáng tĩnh + nhãn chuỗi, không bung tia.
 */
import { Crown } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { canh } from '@/lib/canh';
import { t } from '@/lib/i18n';
import { suKienGhep } from '@/lib/hieu-ung-premium';

interface Bung { key: string; x: number; y: number }
const bung = ref<Bung[]>([]);
const chuoi = ref<{ key: number; n: number } | null>(null);
const bao = ref(0);
const giam = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const GOC = Array.from({ length: 12 }, (_, i) => i * 30);
let henChuoi: ReturnType<typeof setTimeout> | undefined;
let henBao: ReturnType<typeof setTimeout> | undefined;

watch(suKienGhep, (e) => {
  if (!e || typeof document === 'undefined') return;
  const luoi = document.querySelector<HTMLElement>('[role="grid"]');
  const moi: Bung[] = [];
  for (const i of e.indices) {
    const la = luoi?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (!la) continue;
    la.classList.remove('ghep-pm'); void la.offsetWidth; la.classList.add('ghep-pm');   // chạy lại khi ghép liền
    setTimeout(() => la.classList.remove('ghep-pm'), 950);
    const r = la.getBoundingClientRect();
    moi.push({ key: `${e.key}-${i}`, x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }
  if (!giam && moi.length) {
    bung.value = [...bung.value, ...moi];
    setTimeout(() => { bung.value = bung.value.filter((b) => !moi.includes(b)); }, 1000);
  }
  if (e.chuoi >= 2) {
    chuoi.value = { key: e.key, n: e.chuoi };
    clearTimeout(henChuoi); henChuoi = setTimeout(() => { chuoi.value = null; }, 1600);
  }
  if (e.baoHomNay) {
    bao.value = e.key;
    clearTimeout(henBao); henBao = setTimeout(() => { bao.value = 0; }, 2200);
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="gpf" aria-hidden="true">
      <div v-for="b in bung" :key="b.key" class="bung" :class="`c-${canh}`" :style="{ left: `${b.x}px`, top: `${b.y}px` }">
        <i v-for="g in GOC" :key="g" :style="{ '--g': `${g}deg` }" />
      </div>
      <Transition name="cx">
        <div v-if="chuoi" :key="chuoi.key" class="chuoi" :class="{ to: chuoi.n >= 4 }">
          <span class="vm"><Crown :size="11" :stroke-width="3" /></span>🔥 {{ t('fx.chuoi', { n: chuoi.n }) }}
        </div>
      </Transition>
      <Transition name="cx">
        <div v-if="bao" class="bao"><span class="vm"><Crown :size="11" :stroke-width="3" /></span>{{ t('fx.premium') }}</div>
      </Transition>
    </div>
  </Teleport>
</template>

<style>
/* Hai lá vừa ghép: phồng + quầng vàng (toàn cục vì gắn lên lá của BoardGrid) */
.ghep-pm { animation: ghep-pm .9s ease-out; z-index: 2; }
@keyframes ghep-pm {
  0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 214, 90, 0)); }
  30% { transform: scale(1.08); filter: drop-shadow(0 0 14px rgba(255, 214, 90, .95)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 214, 90, 0)); }
}
@media (prefers-reduced-motion: reduce) {
  .ghep-pm { animation: none; filter: drop-shadow(0 0 10px rgba(255, 214, 90, .9)); }
}
</style>

<style scoped>
.gpf { position: fixed; inset: 0; z-index: 58; pointer-events: none; }
.bung { position: fixed; width: 0; height: 0; }
.bung i {
  position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%;
  background: #ffd96a; box-shadow: 0 0 6px #ffd96a; transform: rotate(var(--g)) translateX(0); opacity: 0;
  animation: tia .9s ease-out forwards;
}
/* Thiên hà: sao bốn cánh trắng xanh · Hoa anh đào: cánh hoa hồng · gốc: kim tuyến vàng */
.bung.c-thien-ha i { background: #dff1ff; box-shadow: 0 0 8px #8fd0ff; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); width: 11px; height: 11px; left: -5.5px; top: -5.5px; }
.bung.c-anh-dao i { background: #ffc1d6; box-shadow: none; border-radius: 80% 0 80% 0; width: 9px; height: 7px; }
@keyframes tia {
  0% { opacity: 1; transform: rotate(var(--g)) translateX(0) scale(.6); }
  100% { opacity: 0; transform: rotate(var(--g)) translateX(62px) scale(1); }
}
.vm { display: grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; flex: none; }
.chuoi {
  position: fixed; top: calc(env(safe-area-inset-top, 0px) + 118px); left: 50%; translate: -50% 0;
  display: flex; align-items: center; gap: 6px; padding: 5px 13px 5px 6px; border-radius: 99px;
  background: linear-gradient(90deg, #ff7a18, #ff3d6b); color: #fff; font: 800 15px/1.2 var(--font-display);
  box-shadow: 0 3px 0 #b0213f, 0 8px 18px rgba(176, 33, 63, .35); animation: noi .5s cubic-bezier(.2, 1.5, .4, 1);
}
.chuoi.to { font-size: 18px; padding: 7px 16px 7px 8px; }
@keyframes noi { 0% { scale: .5; } 100% { scale: 1; } }
.bao {
  position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 86px); translate: -50% 0;
  display: flex; align-items: center; gap: 6px; padding: 5px 13px 5px 6px; border-radius: 99px;
  background: rgba(20, 24, 60, .84); color: #ffe6a3; font: 800 13px/1.2 var(--font-body); white-space: nowrap;
}
.cx-enter-active, .cx-leave-active { transition: opacity .25s ease; }
.cx-enter-from, .cx-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .chuoi { animation: none; } }
</style>
