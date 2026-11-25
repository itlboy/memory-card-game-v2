<script setup lang="ts">
/**
 * CHỈ SỐ TRÍ NHỚ (bản 3, 25.11.2026 — trang nghiên cứu duyệt https://claude.ai/artifact/D1HPHCCMsVXdgzoFwRjjsu).
 * VẪN CHỈ HIỆN KHI DEBUG BẬT (cổng `hienTriNho` ở App.vue). Công thức: cộng 5 chặng nhớ, đã trừ ăn may (engine
 * `chiSoTriNho`), gộp theo kỳ 7 ngày (`lib/tri-nho.ts`).
 * Chủ dự án chốt: tên "Chỉ số trí nhớ"; biểu tượng BIỂU ĐỒ (không bao giờ cái não); màu xanh ngọc; người chơi KHÔNG có
 * khái niệm "cặp"; bậc Đồng → Kim cương mốc cố định, KHÔNG so với bot (bot có thể đổi độ khó).
 *  · TRÊN trả lời "tôi ở đâu": điểm, bậc, còn bao nhiêu tới bậc kế, hơn/kém 7 ngày trước.
 *  · GIỮA là chính công thức: 5 chặng với tỉ lệ nhớ — nhìn là biết điểm từ đâu ra và yếu chặng nào. Thay khối
 *    "Theo cỡ bàn" cũ (chủ dự án: dòng lẻ một viên "hơi khó chịu").
 *  · BẤM MỘT CỘT của 14 ngày = xem chỉ số của kỳ 7 ngày kết thúc ở ngày đó — đổi cột CHỈ ĐỔI SỐ, bố cục đứng yên (chủ dự án: "muốn bấm lại để xem chỉ số
 *    của ngày trước"). Cột cao theo đúng con số sẽ hiện khi bấm.
 *  · DƯỚI là hành động: "Luyện ngay" mở ván một mình đúng cỡ bàn nên luyện (`theNenLuyen`).
 * MÀU HAI TÔNG (đo tương phản 25.11.2026): ngọc ĐẬM trên nền sáng, ngọc SÁNG trên nền tối — một tông ngọc #149384
 * cho cả hai thì thanh trên rãnh chỉ đạt 2,7–3,0.
 */
import { ChartColumn, Play, TrendingDown, TrendingUp, Undo2, X } from 'lucide-vue-next';
import { LAN_MO_CHANG } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { MOC_CO_DIEM, chiSoTai, daXemTriNho, dayNgay, ngayTuKhoa, theNenLuyen, vanConThieu } from '@/lib/tri-nho';
import HuyChuongBac from './HuyChuongBac.vue';

const emit = defineEmits<{ close: []; luyen: [soThe: number] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); daXemTriNho(); });

const nhatKy = store.nhatKyTriNho();
const SO_COT = 14;
const ngay = dayNgay(SO_COT);
const homNay = ngay[SO_COT - 1]!;
/** Ngày đang xem (khoá `YYYY-MM-DD`) — mặc định hôm nay; bấm cột để đổi. */
const chon = ref(homNay);
const laHomNay = computed(() => chon.value === homNay);

const ky = computed(() => chiSoTai(nhatKy, ngayTuKhoa(chon.value)));
/** Kỳ 7 ngày liền TRƯỚC kỳ đang xem — để nói hơn/kém. */
const kyTruoc = computed(() => { const d = ngayTuKhoa(chon.value); d.setDate(d.getDate() - 7); return chiSoTai(nhatKy, d); });
const lech = computed(() => (ky.value.diem !== null && kyTruoc.value.diem !== null ? ky.value.diem - kyTruoc.value.diem : null));
const conVan = computed(() => vanConThieu(ky.value));
/** Gợi ý luyện LUÔN theo số liệu HÔM NAY (luyện là luyện bây giờ) — đang xem ngày cũ nút vẫn hiện, vẫn đúng một con số. */
const theLuyen = theNenLuyen(chiSoTai(nhatKy).chang);
const tenBac = (b: number): string => td(`tn.bac.${b}`);

const cot = ngay.map((k) => {
  const van = Object.values(nhatKy[k]?.ban ?? {}).reduce((a, b) => a + b.van, 0);
  return { k, so: Number(k.slice(8)), diem: chiSoTai(nhatKy, ngayTuKhoa(k)).diem, choi: van > 0 };
});
/** Đỉnh của biểu đồ = ngày cao nhất đang hiện (tối thiểu 200): chia theo 1000 thì người 300–500 điểm chỉ thấy một dải
 *  cột lùn, nửa trên trống. Mục đích của biểu đồ là XU HƯỚNG; con số tuyệt đối đã có ở đồng hồ phía trên. */
const dinh = Math.max(200, ...cot.map((c) => c.diem ?? 0));
const caoCot = (d: number | null): string => (d === null ? '4px' : `${Math.max(10, Math.round((d / dinh) * 100))}%`);
const coCot = cot.some((c) => c.diem !== null);
const ngayThang = (k: string): string => `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`;
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tnTitle" @keydown.esc="emit('close')" @click.self="emit('close')">
    <div class="panel tn">
      <header class="tn-head">
        <h2 id="tnTitle"><ChartColumn :size="22" :stroke-width="2.4" aria-hidden="true" /> {{ t('tn.ten') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>

      <!-- Đang xem kỳ nào: hôm nay thì "7 ngày qua"; ngày cũ thì ghi rõ + nút về hôm nay -->
      <p class="tn-ky" :class="{ cu: !laHomNay }">
        <span>{{ laHomNay ? t('tn.bayNgay') : t('tn.tinhDen', { ngay: ngayThang(chon) }) }}</span>
        <button v-if="!laHomNay" class="thach th-nho ve" type="button" @click="chon = homNay"><Undo2 :size="13" :stroke-width="2.8" aria-hidden="true" />{{ t('tn.homNay') }}</button>
      </p>

      <!-- TÔI Ở ĐÂU -->
      <section v-if="ky.diem !== null" class="tn-chinh">
        <div class="dong-ho" :style="{ '--pt': Math.round(ky.diem / 10) }" role="img" :aria-label="`${num(ky.diem)} / 1000`">
          <div><b>{{ num(ky.diem) }}</b><small>/ 1000</small></div>
        </div>
        <div class="phai">
          <span class="bac-chip"><HuyChuongBac :bac="ky.bac!" />{{ t('tn.bacTen', { ten: tenBac(ky.bac!) }) }}</span>
          <p v-if="ky.conToiBac !== null" class="con">{{ t('tn.conBac', { n: num(ky.conToiBac) }) }} <b><HuyChuongBac :bac="ky.bac! + 1" /> {{ tenBac(ky.bac! + 1) }}</b></p>
          <p v-else class="con">{{ t('tn.bacCaoNhat') }}</p>
          <span v-if="lech !== null && lech !== 0" class="xu" :class="{ giam: lech < 0 }">
            <component :is="lech > 0 ? TrendingUp : TrendingDown" :size="14" :stroke-width="2.8" aria-hidden="true" />
            {{ t('tn.soVoi', { n: `${lech > 0 ? '+' : '−'}${num(Math.abs(lech))}` }) }}
          </span>
        </div>
      </section>
      <section v-else class="tn-khoa">
        <b>{{ t('tn.khoa', { n: conVan }) }}</b>
        <span class="thanh" role="img" :aria-label="`${ky.coHoi} / ${MOC_CO_DIEM}`"><i :style="{ width: `${Math.min(100, Math.round((ky.coHoi / MOC_CO_DIEM) * 100))}%` }" /></span>
        <small>{{ t('tn.khoaMo') }}</small>
      </section>

      <!-- ĐIỂM TỪ ĐÂU RA: 5 chặng nhớ -->
      <p class="tn-nhom">{{ t('tn.nhoBaoLau') }}</p>
      <ul class="chang">
        <li v-for="(c, i) in ky.chang" :key="i" :class="{ khoa: !c.mo }">
          <span class="ten">{{ td(`tn.chang.${i}`) }}</span>
          <span v-if="c.mo" class="ray"><i :style="{ width: `${Math.round(c.tiLe! * 100)}%` }" /><em>{{ Math.round(c.tiLe! * 100) }}%</em></span>
          <span v-else class="ray"><em>{{ t('tn.chuaMo', { n: c.n, can: LAN_MO_CHANG }) }}</em></span>
          <b>{{ c.diem }}<small>/{{ c.toiDa }}</small></b>
        </li>
      </ul>

      <!-- 14 NGÀY: bấm một cột để xem chỉ số của ngày đó -->
      <!-- Chưa ngày nào có điểm thì ẩn hẳn: 14 vạch trống chỉ là một khoảng hở (soát ảnh 25.11.2026) -->
      <p v-if="coCot" class="tn-nhom">{{ t('tn.muoiBon') }}</p>
      <div v-if="coCot" class="cot" role="group" :aria-label="t('tn.muoiBon')">
        <button
          v-for="c in cot" :key="c.k" data-phang type="button" class="c" :class="{ chon: c.k === chon, nghi: !c.choi, trong: c.diem === null }"
          :aria-pressed="c.k === chon" :aria-label="`${ngayThang(c.k)}: ${c.diem === null ? t('tn.chuaDu') : num(c.diem)}`" @click="chon = c.k"
        >
          <span class="than"><i :style="{ height: caoCot(c.diem) }" /></span>
          <small>{{ c.so }}</small>
        </button>
      </div>

      <!-- LUÔN hiện, kể cả khi đang xem ngày cũ (25.11.2026, chủ dự án: "bấm cột khác lại không có nút luyện ngay, giao
           diện thì nhảy, tại sao phải làm thế?") — đổi cột chỉ đổi SỐ, không thêm bớt khối nào -->
      <button class="btn btn-primary luyen" type="button" @click="emit('luyen', theLuyen)">
        <Play :size="16" :stroke-width="0" fill="currentColor" aria-hidden="true" />{{ t('tn.luyen', { n: theLuyen }) }}
      </button>
      <p class="chu-thich">{{ t('tn.khongMay') }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Ngọc ĐẬM trên nền sáng · ngọc SÁNG trên nền tối (xem đầu file) */
.tn {
  --tn: #0b7468; --tn-nhat: #dff5f1; --tn-chu: #ffffff; --ray: #dfe4f4; --len: #157a2c; --xuong: var(--muted);
  width: min(430px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 16px 14px 14px; background: var(--panel-solid, #fff); border-radius: 26px;
}
:global([data-theme='dark'] .tn) { --tn: #4fd6c4; --tn-nhat: #123f3c; --tn-chu: #06302b; --ray: #343c80; --len: #74e28d; }
.tn > * { flex-shrink: 0; }
.tn-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tn-head h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl, 22px); }
.tn-head h2 svg { color: var(--tn); }
.tn-head .btn { width: 38px; height: 38px; min-height: 38px; padding: 0; display: grid; place-items: center; }

.tn-ky { margin: -4px 0 0; min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font: 800 12px/1.2 var(--font-display); letter-spacing: .03em; text-transform: uppercase; color: var(--muted); }
.tn-ky.cu span { color: var(--tn); }
.tn-ky .ve { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 10px; font: 800 12px/1 var(--font-display); text-transform: none; letter-spacing: 0; }

.tn-chinh { display: flex; align-items: center; gap: 14px; min-height: 112px; }
.dong-ho { flex: none; position: relative; width: 112px; height: 112px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--tn) calc(var(--pt) * 1%), var(--ray) 0); }
.dong-ho::before { content: ""; position: absolute; inset: 10px; border-radius: 50%; background: var(--panel-solid, #fff); }
.dong-ho div { position: relative; text-align: center; }
.dong-ho b { display: block; font: 800 34px/1 var(--font-display); font-variant-numeric: tabular-nums; color: var(--fg); }
.dong-ho small { font-size: 11px; font-weight: 800; color: var(--muted); }
.phai { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.bac-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; font: 800 14px/1 var(--font-display); color: var(--tn); background: var(--tn-nhat); }
.con { margin: 0; font-size: 12.5px; font-weight: 700; line-height: 1.35; color: var(--muted); }
.con b { color: var(--fg); white-space: nowrap; }
.xu { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; color: var(--len); }
.xu.giam { color: var(--xuong); }

.tn-khoa { box-sizing: border-box; min-height: 112px; justify-content: center; display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 16px; background: var(--tn-nhat); }
.tn-khoa b { font: 800 16px/1.25 var(--font-display); color: var(--fg); }
.tn-khoa .thanh { height: 12px; border-radius: 6px; background: var(--ray); overflow: hidden; }
.tn-khoa .thanh i { display: block; height: 100%; border-radius: 6px; background: var(--tn); }
.tn-khoa small { font-size: 12.5px; font-weight: 700; color: var(--muted); }

.tn-nhom { margin: 4px 0 -4px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  font: 800 12px/1.2 var(--font-display); letter-spacing: .03em; text-transform: uppercase; color: var(--muted); }

.chang { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.chang li { display: grid; grid-template-columns: 76px minmax(0, 1fr) 58px; align-items: center; gap: 8px; }
.chang .ten { font-size: 12.5px; font-weight: 800; color: var(--muted); white-space: nowrap; }
.ray { position: relative; height: 18px; border-radius: 9px; background: var(--ray); overflow: hidden; }
.ray i { position: absolute; inset: 0 auto 0 0; border-radius: 9px; background: var(--tn); }
/* Con số nằm trên cả phần tô lẫn phần rãnh → chữ màu nền chính + viền sáng/tối theo nền để đọc được ở mọi tỉ lệ */
.ray em { position: absolute; inset: 0; display: grid; place-items: center; font: 800 11px/1 var(--font-body); font-style: normal; color: var(--fg);
  text-shadow: 0 0 3px var(--panel-solid, #fff), 0 0 3px var(--panel-solid, #fff), 0 0 2px var(--panel-solid, #fff); }
.chang b { text-align: right; font: 800 14px/1 var(--font-display); font-variant-numeric: tabular-nums; color: var(--fg); }
.chang b small { font: 700 10.5px/1 var(--font-body); color: var(--muted); }
.chang li.khoa .ray { background: repeating-linear-gradient(135deg, var(--ray) 0 6px, transparent 6px 12px); box-shadow: inset 0 0 0 1.5px var(--ray); }
.chang li.khoa .ray em { color: var(--muted); font-weight: 700; }
.chang li.khoa b { color: var(--muted); }

.cot { display: flex; align-items: flex-end; gap: 3px; height: 104px; }
.cot .c { flex: 1; min-width: 0; min-height: 0; height: 100%; padding: 0; border: 0; background: none; cursor: pointer;
  display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; gap: 3px; color: var(--muted); }
.cot .c .than { flex: 1; min-height: 0; display: flex; align-items: flex-end; }
.cot .c i { display: block; width: 100%; border-radius: 4px 4px 2px 2px; background: var(--tn); opacity: .55; }
.cot .c.nghi i { opacity: .28; }
.cot .c.trong i { background: var(--ray); opacity: 1; border-radius: 2px; }
.cot .c small { font-size: 10.5px; font-weight: 800; line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
.cot .c.chon i { opacity: 1; }
.cot .c.chon small { color: var(--tn-chu); background: var(--tn); border-radius: 6px; padding: 2px 0; margin: 0 -1px; }

.luyen { margin-top: 2px; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 16px; }
.chu-thich { margin: 0; text-align: center; font-size: 11.5px; font-weight: 700; line-height: 1.35; color: var(--muted); }
</style>
