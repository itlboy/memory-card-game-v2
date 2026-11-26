<script setup lang="ts">
/**
 * BIỂU QUYẾT BÀN TÌM THẺ ONLINE (27.11.2026, mockup duyệt https://claude.ai/artifact/5rwkt1SVgamVqoED4nEWz6 màn ②): server mở
 * lượt chọn `room.chon` có `kho` → cả phòng chọn SỐ THẺ (đủ sáu cỡ) + ĐỘ KHÓ trong `CHON_THE_MS`, mặt người chọn dưới ô.
 * Đủ phiếu cả hai của mọi người thật thì server chốt sớm. Chốt xong (`ket`) ô thắng sáng vàng tới lúc vào đếm ngược.
 * ÍT CHỮ (chủ dự án 27.11.2026: "Ko cần hiện các thông số kỹ thuật nhiều làm ng chơi đau đầu"): không giải thích luật bốc.
 * Popup ghép cặp (ChonSoThe.vue — ba ô, ô thắng trượt về giữa) KHÔNG hiện khi có `kho`.
 */
import { TIM_THE_DO_KHO, TIM_THE_SO_THE, type RoomInfo, type TimTheDoKho } from '@mm/engine';
import { Check } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { sfx } from '@/lib/audio';
import { t, td } from '@/lib/i18n';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{
  o: {
    room: { value: RoomInfo | null }; myId: { value: string }; spectator: { value: boolean };
    chonThe: (the: number) => void; chonKho: (kho: TimTheDoKho) => void;
  };
}>();

const chon = computed(() => (props.o.room.value?.chon?.kho ? props.o.room.value.chon : undefined));
const ket = computed(() => chon.value?.ket);
const ketKho = computed(() => chon.value?.kho?.ket);
const chiXem = computed(() => props.o.spectator.value);
const nguoi = computed(() => props.o.room.value?.players ?? []);

/* Đồng hồ: vạch co về giữa, đỏ 3 giây cuối (cùng chất popup ghép cặp) */
const het = ref(0);
const conMs = ref(0);
let nhip: ReturnType<typeof setInterval> | undefined;
watch(() => (chon.value && !ket.value ? chon.value.id : undefined), (id) => {
  clearInterval(nhip);
  if (id === undefined || !chon.value) return;
  het.value = Date.now() + chon.value.con;
  conMs.value = chon.value.con;
  nhip = setInterval(() => {
    const truoc = Math.ceil(conMs.value / 1000);
    conMs.value = Math.max(0, het.value - Date.now());
    const g = Math.ceil(conMs.value / 1000);
    if (g !== truoc && g > 0 && g <= 3) sfx.tick();
    if (!conMs.value) clearInterval(nhip);
  }, 100);
}, { immediate: true });
watch(ket, (k) => { if (k) sfx.chotThe(); });

/* Lựa chọn tại chỗ — sáng ngay lúc bấm, không chờ server báo lại */
const toiThe = ref<number | null>(null);
const toiKho = ref<TimTheDoKho | null>(null);
watch(() => chon.value?.id, () => { toiThe.value = null; toiKho.value = null; });
const cuaToiThe = computed(() => chon.value?.phieu[props.o.myId.value] ?? toiThe.value);
const cuaToiKho = computed(() => chon.value?.kho?.phieu[props.o.myId.value] ?? toiKho.value);
const aiThe = (n: number) => nguoi.value.filter((p) => chon.value?.phieu[p.id] === n);
const aiKho = (k: TimTheDoKho) => nguoi.value.filter((p) => chon.value?.kho?.phieu[p.id] === k);
const daXong = computed(() => nguoi.value.filter((p) => chon.value?.phieu[p.id] !== undefined && chon.value?.kho?.phieu[p.id] !== undefined).length);

function bamThe(n: number): void {
  if (chiXem.value || ket.value) return;
  sfx.select(); toiThe.value = n; props.o.chonThe(n);
}
function bamKho(k: TimTheDoKho): void {
  if (chiXem.value || ket.value) return;
  sfx.select(); toiKho.value = k; props.o.chonKho(k);
}
onBeforeUnmount(() => clearInterval(nhip));
</script>

<template>
  <Teleport to="body">
    <Transition name="ctt">
      <div v-if="chon" class="ctt-phu" role="dialog" aria-modal="true" :aria-label="t('tt.chonBan')">
        <div class="panel ctt-hop">
          <h2 class="ctt-tieu">{{ t('tt.chonBan') }}</h2>
          <div class="ctt-vach" :class="{ thap: conMs <= 3000, 'giu-cho': !!ket }" aria-hidden="true">
            <i :style="{ width: `${Math.min(100, conMs / 100)}%` }" />
          </div>

          <p class="ctt-nhan">{{ t('tt.soThe') }}</p>
          <div class="ctt-hang c6">
            <div v-for="n in TIM_THE_SO_THE" :key="n" class="ctt-cot" :class="{ mo: ket && ket.the !== n }">
              <button
                class="ctt-o thach th-nho" type="button"
                :class="{ 'th-vang': ket ? ket.the === n : cuaToiThe === n, thang: ket?.the === n }"
                :aria-pressed="cuaToiThe === n" :disabled="chiXem || !!ket" @click="bamThe(n)"
              ><b>{{ n }}</b></button>
              <span class="ctt-ai"><span v-for="p in aiThe(n)" :key="p.id" class="ctt-mat vong-mau" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /></span></span>
            </div>
          </div>

          <p class="ctt-nhan">{{ t('tt.doKho') }}</p>
          <div class="ctt-hang c3">
            <div v-for="k in TIM_THE_DO_KHO" :key="k" class="ctt-cot" :class="{ mo: ketKho && ketKho !== k }">
              <button
                class="ctt-o chu thach th-nho" type="button"
                :class="{ 'th-vang': ketKho ? ketKho === k : cuaToiKho === k, thang: ketKho === k }"
                :aria-pressed="cuaToiKho === k" :disabled="chiXem || !!ket" @click="bamKho(k)"
              ><b>{{ td(`tt.${k}`) }}</b></button>
              <span class="ctt-ai"><span v-for="p in aiKho(k)" :key="p.id" class="ctt-mat vong-mau" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /></span></span>
            </div>
          </div>

          <p class="ctt-chan" :class="{ 'giu-cho': !!ket }"><Check :size="15" :stroke-width="3" aria-hidden="true" />{{ t('ct.daChon', { da: daXong, tong: nguoi.length }) }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctt-phu {
  position: fixed; inset: 0; z-index: 55; display: flex; align-items: center; justify-content: center;
  padding: 20px 14px; background: rgba(6, 9, 18, .6);
  padding-top: calc(20px + env(safe-area-inset-top, 0px)); padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.ctt-hop { width: 100%; max-width: 390px; padding: 16px 12px 12px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; }
.ctt-tieu { margin: 0; text-align: center; font-size: 22px; line-height: 1.15; }
.ctt-vach { height: 8px; border-radius: 999px; overflow: hidden; display: flex; justify-content: center; background: color-mix(in srgb, var(--fg) 12%, transparent); }
.ctt-vach i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(#a3ec72, #46ad22); transition: width .1s linear; }
.ctt-vach.thap i { background: linear-gradient(#ff9a8a, #e0442f); }
.giu-cho { visibility: hidden; }
.ctt-nhan { margin: 4px 0 0; font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); text-align: center; }
.ctt-hang { display: grid; gap: 6px; }
.ctt-hang.c6 { grid-template-columns: repeat(6, 1fr); }
.ctt-hang.c3 { grid-template-columns: repeat(3, 1fr); }
.ctt-cot { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: opacity .3s; }
.ctt-cot.mo { opacity: .35; }
.ctt-o { width: 100%; min-height: 50px; padding: 0 2px; border-radius: 14px; display: grid; place-items: center; transition: transform .15s; }
.ctt-o b { font: 800 22px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.ctt-o.chu b { font-size: 17px; }
.ctt-o:disabled { opacity: 1; cursor: default; }
.ctt-o.thang { transform: translateY(-2px) scale(1.08); filter: drop-shadow(0 0 12px rgba(255, 200, 40, .8)); }
.ctt-ai { display: flex; justify-content: center; flex-wrap: wrap; gap: 1px; min-height: 26px; font-size: 13px; line-height: 1; }
.ctt-mat { margin: 5px 4px 4px; }
.ctt-ai > * { animation: ctt-vao .3s cubic-bezier(.3, 1.6, .5, 1); }
.ctt-chan { margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 13px; font-weight: 800; color: var(--muted); }
@keyframes ctt-vao { from { transform: scale(.3); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ctt-ai > * { animation: none; } .ctt-vach i { transition: none; } }
.ctt-enter-active, .ctt-leave-active { transition: opacity .16s ease; }
.ctt-enter-from, .ctt-leave-to { opacity: 0; }
</style>
