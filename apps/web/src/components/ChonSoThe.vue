<script setup lang="ts">
/**
 * POPUP CHỌN SỐ THẺ trước mỗi ván online (mockup chạy thử duyệt 24.11.2026 https://claude.ai/artifact/BxHdozRXetLMa9Wz27c7g7, v10).
 *   1. CẢ PHÒNG CHỌN trong `CHON_THE_MS`: tiêu đề "Chọn số thẻ" CANH GIỮA, ngay dưới là VẠCH XANH thời gian co đều hai đầu về
 *      giữa (đỏ 3 giây cuối); ô CHỈ CÓ CON SỐ, đúng giữa; ô mình chọn thạch vàng + tick; mặt người chọn DƯỚI ô; "Đã chọn 2/3".
 *   2. Server chốt (`chon.ket`): ô ít phiếu hơn (kể cả ô không ai chọn) MỜ TẠI CHỖ.
 *   3. Còn nhiều ô bằng phiếu: nháy luân phiên chậm dần, dừng ở số server đã bốc, ô kia mờ tại chỗ. Cuối cùng ô thắng TRƯỢT
 *      ÊM NGANG về giữa + pháo giấy. Nhịp lấy từ engine `lichChot` — server chờ đúng `tong` ms rồi mới đếm ngược.
 * KHÔNG NHẢY CHỖ (chủ dự án: "lúc chọn xong nó bị nhảy vị trí, rất xấu"): ô bị loại vẫn giữ khoảng của nó, tiêu đề + vạch +
 * dòng cuối luôn giữ chỗ (ẩn bằng visibility) → hộp không đổi cỡ giữa các bước.
 * Máy vào giữa lúc đang diễn thì nhảy tới đúng bước (theo `ket.con`). Người xem THẤY nhưng ô bị khoá. MOUNT MỘT CHỖ
 * (OnlineScreen) — teleport ra body. Vạch giờ: bề rộng do JS đặt theo ms còn lại (đừng đổi sang @keyframes — server gửi số ms
 * còn lại, máy vào sau phải khớp đúng chỗ).
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

// Lượt chọn của Tìm Thẻ (có `kho`) là việc của ChonTimTheOnline.vue — popup này chỉ cho ghép cặp
const chon = computed(() => (props.o.room.value?.chon?.kho ? undefined : props.o.room.value?.chon));
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

/**
 * Ô MÌNH CHỌN — sáng vàng NGAY lúc bấm và GIỮ vàng qua bước loại ô (25.11.2026, chủ dự án: "bấm vào không có hiệu ứng gì
 * ngoài avatar bên dưới"). Hai lý do trước đây không thấy vàng: (1) phải chờ server báo lại phiếu (~0,3 giây qua Dallas);
 * (2) phiếu của mình là phiếu CUỐI (chơi với máy: máy bỏ phiếu tức thì) thì server chốt luôn, màn sang bước `loai` — mà
 * ô vàng chỉ vẽ ở bước `chon`. `toiBam` = lựa chọn tại chỗ, bỏ khi sang lượt chọn mới.
 */
const toiBam = ref<number | null>(null);
watch(() => chon.value?.id, () => { toiBam.value = null; });
const cuaToi = computed(() => chon.value?.phieu[props.o.myId.value] ?? toiBam.value ?? undefined);
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
  toiBam.value = the;
  props.o.chonThe(the);
}

/* ---------- BƯỚC 2 + 3: diễn kết quả theo `lichChot` ---------- */
type Pha = 'chon' | 'loai' | 'quay' | 'chot';
const pha = ref<Pha>('chon');
const conO = ref<number[]>([]);       // ba ô — LUÔN đủ ba, ô bị loại chỉ ẩn (giữ chỗ)
const rut = ref<number[]>([]);        // các ô đang mờ dần
const an = ref<number[]>([]);         // các ô đã ẩn (vẫn giữ khoảng)
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
  if (id === undefined || !chon.value || !ket.value) { pha.value = 'chon'; conO.value = chon.value?.ds.slice() ?? []; rut.value = []; an.value = []; return; }
  const ds = chon.value.ds, k = ket.value;
  const lich = lichChot(ds, k);
  const daQua = Math.max(0, lich.tong - k.con);   // máy vào giữa chừng: nhảy tới đúng chỗ
  const viec: { ms: number; lam: () => void; am?: () => void }[] = [
    { ms: 0, lam: () => { pha.value = 'loai'; conO.value = ds.slice(); an.value = []; rut.value = lich.rut; }, am: () => { if (lich.rut.length) sfx.vut(); } },
    { ms: lich.nhay[0]?.ms ?? lich.chotMs, lam: () => { an.value = lich.rut; rut.value = []; } },
    ...lich.nhay.map((b, i) => ({ ms: b.ms, lam: () => { pha.value = 'quay'; sang.value = b.so; }, am: () => sfx.nhayBoc(i) })),
    ...(k.dan.length > 1 ? [{ ms: lich.xoaMs, lam: () => { rut.value = k.dan.filter((x) => x !== k.the); }, am: () => sfx.vut() }] : []),
    { ms: lich.chotMs, lam: () => { pha.value = 'chot'; an.value = ds.filter((x) => x !== k.the); rut.value = []; sang.value = null; }, am: () => { sfx.chotThe(); banPhao(); } }
  ];
  // Các bước đã qua: áp ngay, không tiếng. Bước sau: hẹn giờ.
  for (const v of viec) {
    if (v.ms <= daQua) v.lam();
    else hen.push(setTimeout(() => { v.lam(); v.am?.(); }, v.ms - daQua));
  }
}, { immediate: true });
watch(() => chon.value?.id, () => { if (!ket.value) { pha.value = 'chon'; conO.value = chon.value?.ds.slice() ?? []; rut.value = []; an.value = []; } }, { immediate: true });
/** Ô thắng trượt NGANG về giữa: lệch (giữa − vị trí) × (bề rộng ô + khoảng cách 10px). */
const veGiua = (the: number): Record<string, string> | undefined => {
  if (pha.value !== 'chot' || ket.value?.the !== the) return undefined;
  return { transform: `translateX(calc(${1 - conO.value.indexOf(the)} * (100% + 10px)))` };
};
onBeforeUnmount(() => { dungNhip(); huyHen(); clearTimeout(henRung); });

</script>

<template>
  <Teleport to="body">
    <Transition name="ct">
      <div v-if="chon" class="ct-phu" role="dialog" aria-modal="true" :aria-label="t('on.chonSoThe')">
        <div class="panel ct-hop">
          <h2 class="ct-tieu">{{ t('on.chonSoThe') }}</h2>
          <div class="ct-vach" :class="{ thap: giay <= 3, 'giu-cho': pha !== 'chon' }" role="timer" :aria-label="t('ct.conGiay', { n: giay })">
            <i :style="{ width: `${(100 * Math.min(conMs, CHON_THE_MS)) / CHON_THE_MS}%` }" />
          </div>

          <div class="ct-luoi">
            <div v-for="the in conO" :key="the" class="ct-cot" :class="{ rut: rut.includes(the), an: an.includes(the) }" :style="veGiua(the)">
              <button
                class="ct-o thach"
                :class="{
                  chon: (pha === 'chon' || pha === 'loai') && !chiXem && cuaToi === the, quay: pha === 'quay' && sang === the,
                  thang: pha === 'chot', rung: rung === the, khoa: chiXem,
                  'th-vang': ((pha === 'chon' || pha === 'loai') && !chiXem && cuaToi === the) || (pha === 'quay' && sang === the) || pha === 'chot'
                }"
                type="button" :aria-pressed="!chiXem && cuaToi === the" :disabled="chiXem || pha !== 'chon'" @click="bam(the)"
              >
                <span v-if="(pha === 'chon' || pha === 'loai') && !chiXem && cuaToi === the" class="ct-tick" aria-hidden="true"><Check :size="14" :stroke-width="4" /></span>
                <b>{{ the }}</b>
              </button>
              <span class="ct-ai">
                <span
                  v-for="p in aiChon(the)" :key="p.id" class="ct-nguoi"
                  :class="{ minh: !chiXem && p.id === o.myId.value, 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"
                ><MatNguoi :mat="p.avatar" :anh="p.anh" /></span>
              </span>
            </div>
            <span v-if="phao.length" class="ct-phao" aria-hidden="true"><i v-for="p in phao" :key="p.id" :style="p.s" /></span>
          </div>

          <p class="ct-chan" :class="{ xong: !chiXem && cuaToi, 'giu-cho': pha !== 'chon' }">
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
/* Tiêu đề CANH GIỮA; thời gian là MỘT VẠCH XANH co đều hai đầu về giữa (chủ dự án: "chọn số thẻ ở giữa, thời gian làm một
   vạch xanh bên dưới… ngắn dần và hết ở giữa, cho nó cân đối đối xứng") */
.ct-tieu { margin: 0; text-align: center; font-size: 22px; line-height: 1.15; }
.ct-vach { height: 8px; border-radius: 999px; overflow: hidden; display: flex; justify-content: center;
  background: color-mix(in srgb, var(--fg) 12%, transparent); }
.ct-vach i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(#a3ec72, #46ad22); transition: width .1s linear; }
.ct-vach.thap i { background: linear-gradient(#ff9a8a, #e0442f); }
/* Giữ chỗ để hộp không đổi cỡ giữa các bước (ẩn, không bỏ) */
.giu-cho { visibility: hidden; }

/* Ba ô LUÔN giữ chỗ: ô bị loại mờ tại chỗ rồi ẩn; ô thắng trượt ngang về giữa (`veGiua`) */
.ct-luoi { position: relative; display: flex; justify-content: center; align-items: flex-start; gap: 10px; }
.ct-cot { flex: 0 0 calc((100% - 20px) / 3); min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 7px;
  transition: transform .5s cubic-bezier(.3, 1.25, .5, 1); }
.ct-cot.rut { animation: ct-rut .48s ease forwards; }
.ct-cot.an { visibility: hidden; }
.ct-o {
  position: relative; width: 100%; min-height: 88px; padding: 8px 4px; border-radius: 18px;
  display: grid; place-items: center;
  transition: transform .15s;
}
.ct-o b { font: 800 44px/1 var(--font-display); font-variant-numeric: tabular-nums; }
/* SỐ ĐÚNG GIỮA Ô (chủ dự án 24.11.2026: "sao số vẫn không ở chính giữa?"): font của skin (Grandstander ở Kẹo) để khoảng trống
   TRÊN chữ số ít hơn DƯỚI — đo ảnh thật ô 88px: nét cách mép trên 24,5px, mép dưới 34px. Cắt hộp chữ đúng từ đỉnh chữ hoa tới
   đường chân (`text-box`) thì lưới canh giữa chính nét chữ; máy chưa hỗ trợ thì dời xuống ~0,1em (số đo ở Kẹo). */
.ct-o b { text-box: trim-both cap alphabetic; }
@supports not (text-box: trim-both cap alphabetic) { .ct-o b { transform: translateY(.1em); } }
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
.ct-ai { display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; min-height: 27px; font-size: 18px; line-height: 1; }
.ct-ai :deep(img) { width: 22px; height: 22px; border-radius: 50%; }
.ct-ai .minh:not(.vong-mau) { border-radius: 50%; box-shadow: 0 0 0 2px #f5b324; }
/* Ô MÀU hồ sơ như mọi chỗ khác (chủ dự án gửi ảnh 25.11.2026: "avatar dưới số thẻ chọn chưa theo phong cách mới"). Ô = 1,7em
   thò ra ngoài mặt → thu chữ và chừa lề để các ô không chồng nhau, không chạm ô số phía trên. */
.ct-ai .vong-mau { font-size: 15px; margin: 6px 6px 5px; }
.ct-ai .vong-mau.minh::before { box-shadow: 0 0 0 2px #f5b324; }
.ct-ai > * { animation: ct-vao .3s cubic-bezier(.3, 1.6, .5, 1); }
.ct-chan { margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 10px; min-height: 22px;
  border-top: 1px solid var(--line); font-size: 13px; font-weight: 800; color: var(--muted); text-align: center; }
.ct-chan.xong { color: #2f8a14; }
:global([data-theme='dark'] .ct-chan.xong) { color: #8fdc6a; }
/* Pháo giấy: bắn từ tâm ô thắng (ô thắng luôn ở giữa lưới) */
.ct-phao { position: absolute; left: 50%; top: 48px; width: 0; height: 0; pointer-events: none; }
.ct-phao i { position: absolute; left: 0; top: 0; width: var(--w); height: var(--h); border-radius: 2px; background: var(--c);
  animation: ct-bay 1.1s cubic-bezier(.15, .7, .4, 1) forwards; }

@keyframes ct-rut { to { opacity: 0; transform: scale(.85); } }
@keyframes ct-nay { from { transform: translateY(-3px) scale(.94); } }
@keyframes ct-no { 0% { transform: translateY(-3px) scale(.9); } 100% { transform: translateY(-3px) scale(1.12); } }
@keyframes ct-lac { 25% { transform: rotate(-4deg); } 50% { transform: rotate(3deg); } 75% { transform: rotate(-2deg); } }
@keyframes ct-vao { from { transform: scale(.3); opacity: 0; } }
@keyframes ct-bay { 0% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ct-cot.rut, .ct-o.quay, .ct-o.thang, .ct-o.rung, .ct-ai > *, .ct-phao i { animation: none; }
  .ct-cot.rut { visibility: hidden; }
  .ct-cot, .ct-vach i { transition: none; }
}
.ct-enter-active, .ct-leave-active { transition: opacity .16s ease; }
.ct-enter-from, .ct-leave-to { opacity: 0; }
</style>
