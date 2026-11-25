<script setup lang="ts">
/**
 * CHỈ SỐ TRÍ NHỚ — màn GỌN (bản 4, 25.11.2026: mockup B duyệt https://claude.ai/artifact/MPUFzw758MSrAqUN4osP3t,
 * chủ dự án: "giao diện hơi xấu… đừng quá nhiều thứ làm loạn"; chọn B và "điểm số cho nhỏ bớt đi, 50%").
 * VẪN CHỈ HIỆN KHI DEBUG BẬT (cổng `hienTriNho` ở App.vue). Công thức 5 chặng nhớ: engine `chiSoTriNho`.
 * Chủ dự án chốt từ trước: tên "Chỉ số trí nhớ"; biểu tượng BIỂU ĐỒ (không bao giờ cái não); không có khái niệm "cặp";
 * bậc Đồng → Kim cương mốc cố định, KHÔNG so với bot.
 *
 * CHỈ BA KHỐI: (1) huy chương mang màu bậc, điểm nằm TRONG huy chương + bậc + còn bao nhiêu tới bậc kế;
 * (2) một hình, hai tab: "5 chặng nhớ" (5 cột — nhìn ra "càng lâu càng quên") / "14 ngày" (bấm cột = xem kỳ 7 ngày
 * kết thúc ở ngày đó; nhãn tab thành "14 ngày · 20/11", bấm cột cuối là về hôm nay); (3) nút "Luyện ngay".
 * ĐÃ BỎ (bản 3 có, bị chê rối): vòng điểm + "/ 1000", điểm từng chặng "116/150", ba tiêu đề chữ hoa, 14 nhãn ngày,
 * dòng "so với tuần trước", dòng chú thích cuối, dòng "bấm cột để xem".
 * BỐ CỤC ĐỨNG YÊN: hai tab cùng chiều cao, khối huy chương cùng chiều cao dù có điểm hay chưa, nút luôn hiện — đổi
 * tab / đổi ngày CHỈ ĐỔI SỐ (chủ dự án: "bấm cột khác… giao diện thì nhảy, tại sao phải làm thế?").
 * MÀU: phần chính lấy màu của BẬC; ngọc chỉ còn ở các cột — hai tông (đậm nền sáng, sáng nền tối) vì một tông chỉ đạt 2,7–3,0.
 */
import { ChartColumn, Play, X } from 'lucide-vue-next';
import { LAN_MO_CHANG } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { MOC_CO_DIEM, chiSoTai, daXemTriNho, dayNgay, ngayTuKhoa, theNenLuyen, vanConThieu } from '@/lib/tri-nho';

const emit = defineEmits<{ close: []; luyen: [soThe: number] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); daXemTriNho(); });

const nhatKy = store.nhatKyTriNho();
const SO_COT = 14;
const ngay = dayNgay(SO_COT);
const homNay = ngay[SO_COT - 1]!;
/** Ngày đang xem (khoá `YYYY-MM-DD`) — mặc định hôm nay; bấm cột ở tab 14 ngày để đổi. */
const chon = ref(homNay);
const laHomNay = computed(() => chon.value === homNay);
const tab = ref<'chang' | 'ngay'>('chang');

const ky = computed(() => chiSoTai(nhatKy, ngayTuKhoa(chon.value)));
const conVan = computed(() => vanConThieu(ky.value));
/** Gợi ý luyện LUÔN theo số liệu HÔM NAY (luyện là luyện bây giờ) — đang xem ngày cũ nút vẫn hiện, vẫn đúng một con số. */
const theLuyen = theNenLuyen(chiSoTai(nhatKy).chang);
const tenBac = (b: number): string => td(`tn.bac.${b}`);

const cot = ngay.map((k) => {
  const van = Object.values(nhatKy[k]?.ban ?? {}).reduce((a, b) => a + b.van, 0);
  return { k, diem: chiSoTai(nhatKy, ngayTuKhoa(k)).diem, choi: van > 0 };
});
/** Đỉnh của biểu đồ = ngày cao nhất đang hiện (tối thiểu 200): chia theo 1000 thì người 300–500 điểm chỉ thấy một dải
 *  cột lùn. Mục đích của biểu đồ là XU HƯỚNG; con số tuyệt đối đã nằm trong huy chương. */
const dinh = Math.max(200, ...cot.map((c) => c.diem ?? 0));
const caoCot = (d: number | null): string => (d === null ? '4px' : `${Math.max(10, Math.round((d / dinh) * 100))}%`);
const ngayThang = (k: string): string => `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`;
/**
 * Chỉ ghi ngày ở cột ĐẦU, cột CUỐI và cột ĐANG CHỌN — 14 nhãn là 14 con số không ai đọc. Nhãn ("24/11") rộng hơn cột,
 * nên nhãn đầu/cuối NHƯỜNG khi cột đang chọn nằm sát nó (cách dưới 2 cột): chủ dự án gửi ảnh 25.11.2026 — chọn 24/11
 * thì "24/11" đè lên "25/11".
 */
const viTriChon = computed(() => ngay.indexOf(chon.value));
const coNhan = (k: string, i: number): boolean =>
  k === chon.value || ((i === 0 || i === SO_COT - 1) && Math.abs(i - viTriChon.value) >= 2);
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tnTitle" @keydown.esc="emit('close')" @click.self="emit('close')">
    <div class="panel tn">
      <header class="tn-head">
        <h2 id="tnTitle"><ChartColumn :size="22" :stroke-width="2.4" aria-hidden="true" /> {{ t('tn.ten') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>

      <!-- (1) TÔI Ở ĐÂU: điểm trong huy chương màu bậc -->
      <section v-if="ky.diem !== null" class="giua">
        <span class="huy" :class="`b${ky.bac}`" role="img" :aria-label="`${num(ky.diem)}`"><b :class="{ dai: ky.diem >= 1000 }">{{ ky.diem }}</b></span>
        <strong>{{ t('tn.bacTen', { ten: tenBac(ky.bac!) }) }}</strong>
        <p class="toi-bac">
          <template v-if="ky.conToiBac !== null">
            <span class="ray" :class="`b${ky.bac}`" aria-hidden="true"><i :style="{ width: `${Math.round(ky.tienBac * 100)}%` }" /></span>
            <span>{{ t('tn.conBac', { n: num(ky.conToiBac) }) }} {{ tenBac(ky.bac! + 1) }}</span>
          </template>
          <span v-else>{{ t('tn.bacCaoNhat') }}</span>
        </p>
      </section>
      <section v-else class="giua">
        <span class="huy khoa" aria-hidden="true"><ChartColumn :size="26" :stroke-width="2.6" /></span>
        <strong>{{ t('tn.khoa', { n: conVan }) }}</strong>
        <p class="toi-bac">
          <span class="ray khoa" role="img" :aria-label="`${ky.coHoi} / ${MOC_CO_DIEM}`"><i :style="{ width: `${Math.min(100, Math.round((ky.coHoi / MOC_CO_DIEM) * 100))}%` }" /></span>
          <span>{{ t('tn.khoaMo') }}</span>
        </p>
      </section>

      <!-- (2) MỘT HÌNH, HAI TAB -->
      <div class="doi" role="tablist">
        <button class="thach th-nho" :class="{ 'th-ngoc': tab === 'chang' }" type="button" role="tab" :aria-selected="tab === 'chang'" @click="tab = 'chang'">{{ t('tn.tab5') }}</button>
        <button class="thach th-nho" :class="{ 'th-ngoc': tab === 'ngay' }" type="button" role="tab" :aria-selected="tab === 'ngay'" @click="tab = 'ngay'">
          {{ t('tn.tab14') }}<template v-if="!laHomNay"> · {{ ngayThang(chon) }}</template>
        </button>
      </div>

      <div v-if="tab === 'chang'" class="hinh tru" role="tabpanel">
        <div v-for="(c, i) in ky.chang" :key="i" class="c" :class="{ khoa: !c.mo }">
          <b>{{ c.mo ? `${Math.round(c.tiLe! * 100)}%` : `${c.n}/${LAN_MO_CHANG}` }}</b>
          <span class="than"><i :style="c.mo ? { height: `${Math.max(5, Math.round(c.tiLe! * 100))}%` } : undefined" /></span>
          <small>{{ td(`tn.chang.${i}`) }}</small>
        </div>
      </div>
      <!-- Ngày CHƯA CÓ ĐIỂM thì không bấm được (trừ hôm nay): bấm vào quá khứ mà ra "Chơi thêm 4 ván để có điểm" là vô
           nghĩa (chủ dự án gửi ảnh 25.11.2026) — quá khứ thì không chơi thêm được. Bấm ngày cũ luôn ra một con số thật. -->
      <div v-else class="hinh ngay" role="tabpanel">
        <button
          v-for="(c, i) in cot" :key="c.k" data-phang type="button" class="c" :class="{ chon: c.k === chon, nghi: !c.choi, trong: c.diem === null }"
          :disabled="c.diem === null && c.k !== homNay"
          :aria-pressed="c.k === chon" :aria-label="`${ngayThang(c.k)}: ${c.diem === null ? t('tn.chuaDu') : num(c.diem)}`" @click="chon = c.k"
        >
          <b>{{ c.k === chon && c.diem !== null ? c.diem : '' }}</b>
          <span class="than"><i :style="{ height: caoCot(c.diem) }" /></span>
          <small>{{ coNhan(c.k, i) ? ngayThang(c.k) : '' }}</small>
        </button>
      </div>

      <!-- (3) HÀNH ĐỘNG — luôn hiện -->
      <button class="btn btn-primary luyen" type="button" @click="emit('luyen', theLuyen)">
        <Play :size="16" :stroke-width="0" fill="currentColor" aria-hidden="true" />{{ t('tn.luyen', { n: theLuyen }) }}
      </button>
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
  --tn: #0b7468; --tn-chu: #ffffff; --ray: #e3e7f5; --o: #f1f3fb;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
  padding: 16px 16px 18px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .tn) { --tn: #4fd6c4; --tn-chu: #06302b; --ray: #343c80; --o: #2a3170; }
.tn > * { flex-shrink: 0; }
.tn-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tn-head h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl, 22px); }
.tn-head h2 svg { color: var(--tn); }
.tn-head .btn { width: 38px; height: 38px; min-height: 38px; padding: 0; display: grid; place-items: center; }

/* (1) Huy chương 60px — nhỏ bằng nửa mockup (chủ dự án: "điểm số cũng cho nhỏ bớt đi, 50%") */
.giua { display: flex; flex-direction: column; align-items: center; gap: 7px; min-height: 142px; }
.huy {
  --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; --hc: #4a3600;
  flex: none; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; color: var(--hc);
  background: radial-gradient(circle at 34% 28%, var(--h1), var(--h2) 68%); border: 3px solid var(--h3);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .38), 0 3px 0 var(--h3);
}
.huy b { font: 800 21px/1 var(--font-display); font-variant-numeric: tabular-nums; text-shadow: 0 1px 0 rgba(255, 255, 255, .45); }
.huy b.dai { font-size: 17px; }
.b0 { --h1: #f6d0aa; --h2: #c98345; --h3: #8a4a18; --hc: #45220a; }
.b1 { --h1: #ffffff; --h2: #b3bccd; --h3: #6f7a90; --hc: #2b3346; }
.b2 { --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; --hc: #4a3600; }
.b3 { --h1: #f0fbff; --h2: #86c9ea; --h3: #3f84ad; --hc: #0d3b57; }
.b4 { --h1: #e9e0ff; --h2: #8a6df2; --h3: #4a34b0; --hc: #ffffff; }
.huy.b4 b { text-shadow: 0 1px 0 rgba(0, 0, 0, .35); }
.huy.khoa { --h1: var(--o); --h2: var(--ray); --h3: var(--ray); color: var(--muted); box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .25); }
.giua strong { margin-top: 3px; font: 800 19px/1.15 var(--font-display); color: var(--fg); text-align: center; }
.toi-bac { margin: 0; min-height: 34px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px;
  font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--muted); text-align: center; }
.toi-bac .ray { flex: none; width: 92px; height: 8px; border-radius: 4px; background: var(--ray); overflow: hidden; }
.toi-bac .ray i { display: block; height: 100%; border-radius: 4px; background: var(--h2); }
.toi-bac .ray.khoa i { background: var(--tn); }

/* (2) Nút chuyển hai tab */
.doi { align-self: center; display: flex; gap: 6px; }
/* Tab đang chọn = nút thạch NGỌC (`th-ngoc`): tự đặt nền bằng CSS thường thì kiểu thạch của skin đè mất, hai tab trông y nhau */
.doi button { min-height: 34px; padding: 0 14px; font: 800 13px/1 var(--font-body); }

/* Hai tab CÙNG chiều cao: [số 16] [thân cột co giãn] [nhãn 26] */
.hinh { height: 158px; display: grid; align-items: stretch; }
.hinh.tru { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.hinh.ngay { grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; }
.hinh .c { min-width: 0; min-height: 0; height: 100%; padding: 0; border: 0; background: none; color: var(--fg);
  display: flex; flex-direction: column; align-items: stretch; gap: 5px; }
.hinh button.c { cursor: pointer; }
.hinh button.c:disabled { cursor: default; }
.hinh .c b { height: 16px; font: 800 13px/16px var(--font-display); font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
.hinh .than { flex: 1; min-height: 0; display: flex; align-items: flex-end; }
.hinh .than i { display: block; width: 100%; background: var(--tn); }
.hinh .c small { height: 24px; font-size: 11px; font-weight: 800; line-height: 1.15; text-align: center; color: var(--muted); overflow: hidden; }
.tru .than i { border-radius: 10px 10px 6px 6px; }
.tru .khoa .than i { height: 22px; background: repeating-linear-gradient(135deg, var(--ray) 0 5px, transparent 5px 10px); box-shadow: inset 0 0 0 1.5px var(--ray); }
.tru .khoa b { color: var(--muted); font-size: 11.5px; }
.ngay .than i { border-radius: 4px 4px 2px 2px; opacity: .5; }
.ngay .nghi .than i { opacity: .26; }
.ngay .trong .than i { background: var(--ray); opacity: 1; border-radius: 2px; }
.ngay .chon .than i { opacity: 1; }
/* Con số + ngày của cột đang chọn rộng hơn cột (cột chỉ ~22px): cho tràn hai bên, không xuống dòng */
.ngay .c b, .ngay .c small { overflow: visible; display: flex; justify-content: center; white-space: nowrap; }
.ngay .c small { height: 24px; align-items: flex-start; font-variant-numeric: tabular-nums; }
.ngay .chon small { color: var(--tn); }

.luyen { min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; }
</style>
