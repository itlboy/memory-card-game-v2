<script setup lang="ts">
/**
 * POPUP CHỌN SỐ THẺ trước mỗi ván online. Bản 24.11.2026 (mockup duyệt https://claude.ai/artifact/BxHdozRXetLMa9Wz27c7g7;
 * chủ dự án: bản trước "chưa trực quan, số chưa ở giữa, chưa có active khi chọn"). Ba bước:
 *   1. CẢ PHÒNG CHỌN trong `CHON_THE_MS`: tiêu đề là câu hỏi, mỗi ô có nhãn "Ít hơn · Giữ nguyên · Nhiều hơn" + con số
 *      ĐÚNG GIỮA; ô mình chọn vàng, nhô lên, có dấu tick; mặt người đã chọn nằm DƯỚI ô; đồng hồ vòng tròn.
 *   2. Server chốt (`chon.ket`): bỏ mọi ô ÍT phiếu hơn (kể cả ô không ai chọn) — ô co lại, ô còn lại trượt vào giữa.
 *   3. Còn nhiều ô BẰNG phiếu: nháy luân phiên chậm dần, dừng ở số server đã bốc, xoá ô kia. Cuối cùng MỘT ô ở giữa +
 *      "Chơi N thẻ" + pháo giấy. Nhịp lấy từ engine `lichChot` — server chờ đúng `tong` ms rồi mới đếm ngược.
 * Máy vào giữa lúc đang diễn thì nhảy tới đúng bước (theo `ket.con`), không diễn lại từ đầu.
 * Người xem THẤY nhưng ô bị khoá. MOUNT MỘT CHỖ (OnlineScreen) — teleport ra body, nổi trên cả bảng kết quả.
 * Đồng hồ vòng: độ dài nét do JS đặt theo ms còn lại mỗi 0,1 s (đừng đổi sang @keyframes — server gửi số ms còn lại,
 * máy vào sau phải khớp đúng chỗ).
 */
import { CHON_THE_MS, lichChot } from '@mm/engine';
import type { RoomInfo } from '@mm/engine';
import { Check, Eye } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { sfx } from '@/lib/audio';
import { t } from '@/lib/i18n';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{
  o: { room: { value: RoomInfo | null }; myId: { value: string }; spectator: { value: boolean }; chonThe: (the: number) => void };
}>();

const chon = computed(() => props.o.room.value?.chon);
const chiXem = computed(() => props.o.spectator.value);
const ket = computed(() => chon.value?.ket);

/* ---------- BƯỚC 1: đồng hồ ---------- */
const het = ref(0);
const conMs = ref(0);
let nhip: ReturnType<typeof setInterval> | undefined;
const dungNhip = (): void => { clearInterval(nhip); nhip = undefined; };
watch(() => (chon.value && !ket.value ? chon.value.id : undefined), (id) => {
  dungNhip();
  if (id === undefined || !chon.value) return;
  het.value = Date.now() + chon.value.con;
  conMs.value = chon.value.con;
  nhip = setInterval(() => {
    const truoc = Math.ceil(conMs.value / 1000);
    conMs.value = Math.max(0, het.value - Date.now());
    const giay = Math.ceil(conMs.value / 1000);
    if (giay !== truoc && giay > 0 && giay <= 3) sfx.tick();
    if (!conMs.value) dungNhip();
  }, 100);
}, { immediate: true });
const giay = computed(() => Math.ceil(conMs.value / 1000));
const R = 20;
const CV = 2 * Math.PI * R;

const cuaToi = computed(() => chon.value?.phieu[props.o.myId.value]);
const aiChon = (the: number) => (props.o.room.value?.players ?? []).filter((p) => chon.value?.phieu[p.id] === the);
const daChon = computed(() => Object.keys(chon.value?.phieu ?? {}).length);
/** Mọi người chơi trong phòng đều bỏ phiếu được (kể cả máy) — người xem không nằm trong `players`. */
const tongNguoi = computed(() => props.o.room.value?.players.length ?? 0);

/** Ô vừa có người bỏ phiếu vào → lắc nhẹ 0,4 s (kèm tiếng nếu là người khác). */
const rung = ref<number | null>(null);
let henRung: ReturnType<typeof setTimeout> | undefined;
function lac(n: number): void { rung.value = n; clearTimeout(henRung); henRung = setTimeout(() => { rung.value = null; }, 400); }
watch(() => ({ ...(chon.value?.phieu ?? {}) }), (moi, cu) => {
  if (!chon.value || ket.value || !cu) return;
  for (const [id, so] of Object.entries(moi)) {
    if (cu[id] === so || id === props.o.myId.value) continue;
    sfx.phieuKhac();
    lac(so);
  }
});

function bam(the: number): void {
  if (chiXem.value || ket.value || cuaToi.value === the) return;
  sfx.select();
  lac(the);
  props.o.chonThe(the);
}

/* ---------- BƯỚC 2 + 3: diễn kết quả theo `lichChot` ---------- */
type Pha = 'chon' | 'loai' | 'quay' | 'chot';
const pha = ref<Pha>('chon');
const conO = ref<number[]>([]);       // các ô còn trên bàn
const rut = ref<number[]>([]);        // các ô đang co lại
const sang = ref<number | null>(null);
const phao = ref<{ id: number; s: Record<string, string> }[]>([]);
let hen: ReturnType<typeof setTimeout>[] = [];
const huyHen = (): void => { hen.forEach(clearTimeout); hen = []; };
const MAU_PHAO = ['#ffc21a', '#ff4d8d', '#4cc9f0', '#6be08a', '#b388ff', '#ff8a3d'];
function banPhao(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  phao.value = Array.from({ length: 26 }, (_, i) => {
    const goc = Math.random() * Math.PI * 2, xa = 70 + Math.random() * 90;
    return { id: i, s: {
      '--w': `${5 + Math.random() * 5}px`, '--h': `${8 + Math.random() * 8}px`, '--c': MAU_PHAO[i % MAU_PHAO.length]!,
      '--dx': `${Math.cos(goc) * xa}px`, '--dy': `${Math.sin(goc) * xa - 30}px`, '--r': `${Math.random() * 720 - 360}deg`
    } };
  });
}

watch(() => (ket.value ? chon.value!.id : undefined), (id) => {
  huyHen();
  phao.value = [];
  sang.value = null;
  if (id === undefined || !chon.value || !ket.value) { pha.value = 'chon'; conO.value = chon.value?.ds.slice() ?? []; rut.value = []; return; }
  const ds = chon.value.ds, k = ket.value;
  const lich = lichChot(ds, k);
  const daQua = Math.max(0, lich.tong - k.con);   // máy vào giữa chừng: nhảy tới đúng chỗ
  const viec: { ms: number; lam: () => void; am?: () => void }[] = [
    { ms: 0, lam: () => { pha.value = 'loai'; conO.value = ds.slice(); rut.value = lich.rut; }, am: () => { if (lich.rut.length) sfx.vut(); } },
    { ms: lich.nhay[0]?.ms ?? lich.chotMs, lam: () => { conO.value = k.dan.slice(); rut.value = []; } },
    ...lich.nhay.map((b, i) => ({ ms: b.ms, lam: () => { pha.value = 'quay'; sang.value = b.so; }, am: () => sfx.nhayBoc(i) })),
    ...(k.dan.length > 1 ? [{ ms: lich.xoaMs, lam: () => { rut.value = k.dan.filter((x) => x !== k.the); }, am: () => sfx.vut() }] : []),
    { ms: lich.chotMs, lam: () => { pha.value = 'chot'; conO.value = [k.the]; rut.value = []; sang.value = null; }, am: () => { sfx.chotThe(); banPhao(); } }
  ];
  // Các bước đã qua: áp ngay, không tiếng. Bước sau: hẹn giờ.
  for (const v of viec) {
    if (v.ms <= daQua) v.lam();
    else hen.push(setTimeout(() => { v.lam(); v.am?.(); }, v.ms - daQua));
  }
}, { immediate: true });
watch(() => chon.value?.id, () => { if (!ket.value) { pha.value = 'chon'; conO.value = chon.value?.ds.slice() ?? []; rut.value = []; } }, { immediate: true });
onBeforeUnmount(() => { dungNhip(); huyHen(); clearTimeout(henRung); });

/* ÍT CHỮ (chủ dự án 24.11.2026: "bỏ bớt text đi… người dùng hiểu mà"): chỉ một tiêu đề câu hỏi suốt lúc chọn/rút/bốc,
   ô chỉ có con số (bỏ nhãn Ít hơn/Nhiều hơn), dòng cuối "Đã chọn 2/3"; lúc chốt không tiêu đề — ô thắng + "Chơi N thẻ". */
</script>

<template>
  <Teleport to="body">
    <Transition name="ct">
      <div v-if="chon" class="ct-phu" role="dialog" aria-modal="true" :aria-label="t('on.chonSoThe')">
        <div class="panel ct-hop">
          <div v-if="pha !== 'chot'" class="ct-dau">
            <div class="ct-chu">
              <h2>{{ t('ct.hoi') }}</h2>
            </div>
            <span v-if="pha === 'chon'" class="ct-gio" :class="{ thap: giay <= 3 }" role="timer" :aria-label="t('ct.conGiay', { n: giay })">
              <svg viewBox="0 0 46 46" aria-hidden="true">
                <circle class="ve" cx="23" cy="23" :r="R" />
                <circle class="con" cx="23" cy="23" :r="R" :stroke-dasharray="CV" :stroke-dashoffset="CV - (CV * Math.min(conMs, CHON_THE_MS)) / CHON_THE_MS" />
              </svg>
              <span>{{ giay }}</span>
            </span>
          </div>

          <div class="ct-luoi">
            <div v-for="the in conO" :key="the" class="ct-cot" :class="{ rut: rut.includes(the) }">
              <button
                class="ct-o thach"
                :class="{
                  chon: pha === 'chon' && !chiXem && cuaToi === the, quay: pha === 'quay' && sang === the,
                  thang: pha === 'chot', rung: rung === the, khoa: chiXem,
                  'th-vang': (pha === 'chon' && !chiXem && cuaToi === the) || (pha === 'quay' && sang === the) || pha === 'chot'
                }"
                type="button" :aria-pressed="!chiXem && cuaToi === the" :disabled="chiXem || pha !== 'chon'" @click="bam(the)"
              >
                <span v-if="pha === 'chon' && !chiXem && cuaToi === the" class="ct-tick" aria-hidden="true"><Check :size="14" :stroke-width="4" /></span>
                <b>{{ the }}</b>
              </button>
              <span class="ct-ai">
                <MatNguoi
                  v-for="p in aiChon(the)" :key="p.id" :mat="p.avatar" :anh="p.anh"
                  :class="{ minh: !chiXem && p.id === o.myId.value }"
                />
                <i v-if="!aiChon(the).length && pha !== 'chot'" class="ct-chua" aria-hidden="true">–</i>
              </span>
            </div>
            <span v-if="phao.length" class="ct-phao" aria-hidden="true"><i v-for="p in phao" :key="p.id" :style="p.s" /></span>
          </div>

          <p v-if="pha === 'chot' && ket" class="ct-ket">{{ t('ct.choi', { n: ket.the }) }}</p>
          <template v-else-if="pha !== 'chon'" />
          <p v-else class="ct-chan" :class="{ xong: !chiXem && cuaToi }">
            <Eye v-if="chiXem" :size="15" :stroke-width="2.6" aria-hidden="true" /><Check v-else-if="cuaToi" :size="15" :stroke-width="3" aria-hidden="true" />{{ t('ct.daChon', { da: daChon, tong: tongNguoi }) }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ct-phu {
  /* Trên bảng kết quả (17–20) và hộp xác nhận, dưới bong bóng chat (59/60) */
  position: fixed; inset: 0; z-index: 55; display: flex; align-items: center; justify-content: center;
  padding: 20px 18px; background: rgba(6, 9, 18, .6);
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.ct-hop { position: relative; width: 100%; max-width: 380px; padding: 16px 14px 14px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; }
.ct-dau { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-height: 46px; }
.ct-chu { min-width: 0; }
.ct-dau h2 { margin: 0; font-size: 22px; line-height: 1.15; text-wrap: balance; }
.ct-dau p { margin: 2px 0 0; font-size: 13px; font-weight: 700; line-height: 1.35; color: var(--muted); }

/* Đồng hồ vòng: nét co theo ms còn lại (JS), đỏ + đập nhịp ở 3 giây cuối */
.ct-gio { position: relative; flex: none; width: 46px; height: 46px; display: grid; place-items: center;
  font: 800 19px/1 var(--font-display); font-variant-numeric: tabular-nums; color: #2f8a14; }
.ct-gio svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ct-gio .ve { fill: none; stroke: color-mix(in srgb, var(--fg) 14%, transparent); stroke-width: 5; }
.ct-gio .con { fill: none; stroke: currentColor; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset .1s linear; }
.ct-gio.thap { color: #e0442f; animation: ct-dap .5s ease-in-out infinite alternate; }
:global([data-theme='dark'] .ct-gio) { color: #8fdc6a; }
:global([data-theme='dark'] .ct-gio.thap) { color: #ff7a66; }

/* Ô xếp flex: ô bị bỏ CO BỀ NGANG về 0 (nuốt cả khoảng gap) nên các ô còn lại trượt vào giữa */
.ct-luoi { position: relative; display: flex; justify-content: center; align-items: flex-start; gap: 10px; min-height: 136px; }
.ct-cot { flex: 0 0 calc((100% - 20px) / 3); min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 7px; }
.ct-cot.rut { animation: ct-rut .48s ease forwards; overflow: hidden; }
.ct-o {
  position: relative; width: 100%; min-height: 88px; padding: 8px 4px; border-radius: 18px;
  display: grid; place-items: center;
  transition: transform .15s;
}
.ct-o b { font: 800 44px/1 var(--font-display); font-variant-numeric: tabular-nums; }
/* Người xem / đang chốt: ô vẫn rõ để đọc, chỉ không bấm được (không làm mờ kiểu disabled .45) */
.ct-o:disabled { opacity: 1; cursor: default; }
.ct-o.khoa { pointer-events: none; }
/* MÌNH ĐANG CHỌN · ô đang sáng khi bốc · ô thắng: thạch VÀNG của skin (lớp `th-vang` — đặt màu nền tay thì skin Kẹo đè
   mất, đã gặp ở ảnh thật 24.11.2026) + nhô lên; ô đang nháy và ô thắng thêm quầng sáng bằng drop-shadow (skin giữ box-shadow) */
.ct-o.chon, .ct-o.quay, .ct-o.thang { transform: translateY(-3px); }
.ct-o.quay { filter: drop-shadow(0 0 12px rgba(255, 200, 40, .85)); animation: ct-nay .12s ease-out; }
.ct-o.thang { filter: drop-shadow(0 0 16px rgba(255, 200, 40, .8)); transform: translateY(-3px) scale(1.12); animation: ct-no .5s cubic-bezier(.3, 1.6, .5, 1); }
.ct-o.rung { animation: ct-lac .4s ease; }
.ct-tick { position: absolute; bottom: -9px; right: -7px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  background: #2f9a18; color: #fff; border: 3px solid var(--panel-solid); box-shadow: 0 2px 4px rgba(0, 0, 0, .25); }
.ct-ai { display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; min-height: 24px; font-size: 18px; line-height: 1; }
.ct-ai :deep(img) { width: 22px; height: 22px; border-radius: 50%; }
.ct-ai .minh { border-radius: 50%; box-shadow: 0 0 0 2px #f5b324; }
.ct-ai > * { animation: ct-vao .3s cubic-bezier(.3, 1.6, .5, 1); }
.ct-chua { font-style: normal; font-size: 12px; font-weight: 700; color: var(--muted); animation: none !important; }
.ct-chan { margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 10px; min-height: 22px;
  border-top: 1px solid var(--line); font-size: 13px; font-weight: 800; color: var(--muted); text-align: center; }
.ct-chan.xong { color: #2f8a14; }
:global([data-theme='dark'] .ct-chan.xong) { color: #8fdc6a; }
.ct-ket { margin: 0; padding-top: 4px; text-align: center; font: 800 21px/1.2 var(--font-display); animation: ct-no2 .5s cubic-bezier(.3, 1.6, .5, 1) .1s backwards; }
.ct-ket small { display: block; font: 700 13px var(--font-body, inherit); color: var(--muted); }
/* Pháo giấy: bắn từ tâm ô thắng (ô thắng luôn ở giữa lưới) */
.ct-phao { position: absolute; left: 50%; top: 48px; width: 0; height: 0; pointer-events: none; }
.ct-phao i { position: absolute; left: 0; top: 0; width: var(--w); height: var(--h); border-radius: 2px; background: var(--c);
  animation: ct-bay 1.1s cubic-bezier(.15, .7, .4, 1) forwards; }

@keyframes ct-rut { to { opacity: 0; transform: scale(.5); flex-basis: 0; margin-inline: -5px; } }
@keyframes ct-nay { from { transform: translateY(-3px) scale(.94); } }
@keyframes ct-no { 0% { transform: translateY(-3px) scale(.9); } 100% { transform: translateY(-3px) scale(1.12); } }
@keyframes ct-no2 { from { transform: scale(.6); opacity: 0; } }
@keyframes ct-lac { 25% { transform: rotate(-4deg); } 50% { transform: rotate(3deg); } 75% { transform: rotate(-2deg); } }
@keyframes ct-vao { from { transform: scale(.3); opacity: 0; } }
@keyframes ct-dap { to { transform: scale(1.12); } }
@keyframes ct-bay { 0% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ct-cot.rut, .ct-o.quay, .ct-o.thang, .ct-o.rung, .ct-ai > *, .ct-gio.thap, .ct-ket, .ct-phao i { animation: none; }
  .ct-cot.rut { display: none; }
}
.ct-enter-active, .ct-leave-active { transition: opacity .16s ease; }
.ct-enter-from, .ct-leave-to { opacity: 0; }
</style>
