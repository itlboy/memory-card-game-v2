<script setup lang="ts">
/**
 * CHỈ SỐ TRÍ NHỚ (bản 2, 24.11.2026 — mockup duyệt https://claude.ai/artifact/C4U5gqmAvLeRgv42TkJxZ9). VẪN CHỈ HIỆN
 * KHI DEBUG BẬT (cổng `hienTriNho` ở App.vue). Điểm = tỉ lệ nhớ (có tính độ lâu) × trần của bàn, số đếm thô theo ngày
 * (`storage.ghiTriNho`), gộp ở `lib/tri-nho.ts`.
 * Chủ dự án chốt: tên "Chỉ số trí nhớ"; biểu tượng BIỂU ĐỒ (không bao giờ cái não); màu xanh ngọc; người chơi KHÔNG có
 * khái niệm "cặp" — cỡ bàn ghi bằng SỐ THẺ (code vẫn đếm cặp, nhân đôi lúc hiện).
 *  · Điểm có THANG: "445 / 1000" + thước. 1000 = trần bàn 88 thẻ — dòng cuối nói rõ để bàn nhỏ không thấy oan.
 *  · CHƯA ĐỦ SỐ LIỆU (dưới mốc 1) thì KHÔNG bày con số: "Chơi thêm N ván để có điểm" + thanh tiến trình. Mức giữa ghi
 *    "Tạm tính". Bỏ ba chấm tin cậy và chú thích cột sọc — ngày ít số liệu chỉ là cột nhạt.
 *  · Biểu đồ chỉ ghi số ở HÔM NAY và NGÀY CAO NHẤT. Cỡ bàn chỉ hiện nhóm đã chơi.
 * KHÔNG SCROLL: mọi khối co theo chỗ còn lại, biểu đồ là khối duy nhất giãn.
 */
import { ChartColumn, TrendingDown, TrendingUp, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { MOC_TIN_CAY, NHOM_BAN, dayNgay, theoNhomBan, tomTat, vanConThieu } from '@/lib/tri-nho';

const emit = defineEmits<{ close: [] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => nutDong.value?.focus());

const nhatKy = store.nhatKyTriNho();
const SO_COT = 14;
const ngay = dayNgay(SO_COT * 2);
const cuaNgay = (ds: string[]) => ds.map((k) => nhatKy[k]);

const tuan = computed(() => tomTat(cuaNgay(ngay.slice(-7))));
const tuanTruoc = computed(() => tomTat(cuaNgay(ngay.slice(-14, -7))));
/** Có điểm để bày: từ mức "tạm tính" trở lên. Dưới đó là màn "chơi thêm N ván". */
const coDiem = computed(() => tuan.value.diem !== null && tuan.value.tinCay >= 2);
/** Chỉ so hai tuần khi CẢ HAI đều từ mức "tạm tính" trở lên — so hai con số ít dữ liệu là so nhiễu. */
const lech = computed(() => (coDiem.value && tuanTruoc.value.diem !== null && tuanTruoc.value.tinCay >= 2
  ? tuan.value.diem! - tuanTruoc.value.diem : null));

const cot = computed(() => ngay.slice(-SO_COT).map((k) => ({ k, so: Number(k.slice(8)), ...tomTat([nhatKy[k]]) })));
const dinh = computed(() => Math.max(600, ...cot.value.map((c) => c.diem ?? 0)));
/** Chỉ cột ĐỦ SỐ LIỆU mới ghi số (cột nhạt mà ghi số là mâu thuẫn với "chơi thêm N ván để có điểm"). */
const ghiSo = (c: { diem: number | null; tinCay: number }): boolean => c.diem !== null && c.tinCay >= 2;
const caoNhat = computed(() => Math.max(0, ...cot.value.filter(ghiSo).map((c) => c.diem ?? 0)));
const nhom = computed(() => theoNhomBan(cuaNgay(ngay.slice(-SO_COT))).map((n, i) => ({ ...n, i })).filter((n) => n.van > 0 && n.tiLe !== null));
/** Tên nhóm theo SỐ THẺ (= cặp × 2): ≤16 · 18–36 · 38–60 · 62+. */
const tenNhom = (i: number): string => (i === 0 ? t('tn.banDen', { n: NHOM_BAN[0]! * 2 })
  : NHOM_BAN[i] === Infinity ? t('tn.banTren', { n: (NHOM_BAN[i - 1]! + 1) * 2 })
  : t('tn.banTu', { a: (NHOM_BAN[i - 1]! + 1) * 2, b: NHOM_BAN[i]! * 2 }));
/** Còn khoảng mấy ván nữa thì số 7 ngày lên mức tin cậy kế tiếp (0 = đã đáng tin). */
const conThieu = computed(() => vanConThieu(tuan.value, tomTat(cuaNgay(ngay.slice(-SO_COT)))));
/** Tiến trình tới mốc có điểm (mốc 1). */
const tienTrinh = computed(() => Math.min(100, Math.round((100 * tuan.value.coHoi) / MOC_TIN_CAY[0])));
const coGi = computed(() => cot.value.some((c) => c.van > 0));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tnTitle" @keydown.esc="emit('close')">
    <div class="panel tn">
      <header class="tn-head">
        <h2 id="tnTitle"><ChartColumn :size="22" :stroke-width="2.4" aria-hidden="true" /> {{ t('tn.ten') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>

      <section class="tn-chinh">
        <template v-if="coDiem">
          <p class="tn-nhan">{{ t('tn.diem7') }}</p>
          <p class="tn-so">
            <b>{{ num(tuan.diem!) }}</b><small>/ 1000</small>
            <span v-if="lech !== null && lech !== 0" class="tn-lech" :class="{ xuong: lech < 0 }" :aria-label="t('tn.soVoi', { n: (lech > 0 ? '+' : '') + num(lech) })">
              <component :is="lech < 0 ? TrendingDown : TrendingUp" :size="14" :stroke-width="2.8" aria-hidden="true" />{{ (lech > 0 ? '+' : '') + num(lech) }}
            </span>
          </p>
          <div class="thuoc" aria-hidden="true"><i :style="{ width: `${Math.min(100, tuan.diem! / 10)}%` }" /></div>
          <p v-if="tuan.tinCay === 2" class="tn-tam"><i class="cham" aria-hidden="true" />{{ t('tn.tamTinh', { n: conThieu }) }}</p>
        </template>
        <div v-else class="tn-khoa">
          <p class="tn-nhan">{{ t('tn.diemTn') }}</p>
          <b>{{ t('tn.khoa', { n: conThieu }) }}</b>
          <div class="thuoc vang" role="progressbar" :aria-valuenow="tienTrinh" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${Math.max(4, tienTrinh)}%` }" /></div>
          <p>{{ t('tn.khoaMo') }}</p>
        </div>
      </section>

      <template v-if="coGi">
        <dl class="tn-ba">
          <div><dd>{{ tuan.tiLe === null ? '–' : `${tuan.tiLe}%` }}</dd><dt>{{ t('tn.tiLe') }}</dt></div>
          <div><dd>{{ tuan.cao ? num(tuan.cao) : '–' }}</dd><dt>{{ t('tn.vanCao') }}</dt></div>
          <div><dd>{{ tuan.tam || '–' }}</dd><dt>{{ t('tn.tam') }}</dt></div>
        </dl>

        <section class="tn-bd">
          <h3>{{ t('tn.muoiBon') }}</h3>
          <ol class="tn-cot">
            <li v-for="(c, i) in cot" :key="c.k" :class="{ nay: i === cot.length - 1, it: c.tinCay === 1, rong: c.diem === null }">
              <b v-if="ghiSo(c) && (i === cot.length - 1 || c.diem === caoNhat)" class="so-cot">{{ c.diem }}</b>
              <i :style="{ height: `${c.diem === null ? 0 : Math.max(6, (c.diem / dinh) * 100)}%` }" />
            </li>
          </ol>
          <ol class="tn-ngay" aria-hidden="true">
            <li v-for="(c, i) in cot" :key="c.k" :class="{ nay: i === cot.length - 1 }">{{ c.so }}</li>
          </ol>
        </section>

        <section v-if="nhom.length" class="tn-ban">
          <h3>{{ t('tn.theoBan') }}</h3>
          <ul>
            <li v-for="n in nhom" :key="n.i">{{ tenNhom(n.i) }}<b>{{ n.tiLe }}%</b></li>
          </ul>
        </section>
        <p class="tn-tran">{{ t('tn.tran') }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.tn {
  width: 100%; max-width: min(var(--col-w), 460px); max-height: 100%; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; gap: 12px;
}
.tn-head { display: flex; align-items: center; gap: 8px; }
.tn-head h2 { flex: 1; min-width: 0; margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl); }
.tn p { margin: 0; }

/* Khối chính: thạch XANH NGỌC (chủ dự án chọn 23.11.2026); màu giữ nguyên ở nền tối, chữ trắng đi cặp */
.tn-chinh {
  flex: none; padding: 12px 16px 14px; border-radius: 20px; color: #fff;
  background: linear-gradient(135deg, #149384, #075a50);
  box-shadow: 0 4px 0 #04433b, 0 10px 18px rgba(8, 90, 80, .28);
}
.tn-nhan { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
.tn-so { display: flex; align-items: baseline; gap: 6px; margin-top: 2px !important; }
.tn-so b { font: 900 46px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.tn-so small { font: 800 16px/1 var(--font-display); opacity: .7; }
.tn-lech {
  margin-left: auto; align-self: center; display: inline-flex; align-items: center; gap: 3px; padding: 4px 9px; border-radius: 999px;
  font-size: 13px; font-weight: 900; background: rgba(255, 255, 255, .92); color: #14734f; font-variant-numeric: tabular-nums;
}
.tn-lech.xuong { color: #b3261e; }
.thuoc { position: relative; height: 10px; margin-top: 10px; border-radius: 999px; background: rgba(255, 255, 255, .22); overflow: hidden; }
.thuoc i { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: #fff; }
.thuoc.vang i { background: #ffd36b; }
.tn-tam { display: flex; align-items: center; gap: 6px; margin-top: 8px !important; font-size: 12.5px; font-weight: 800; }
.cham { width: 8px; height: 8px; border-radius: 50%; background: #ffd36b; flex: none; }
.tn-khoa { display: flex; flex-direction: column; gap: 8px; }
.tn-khoa b { font: 800 19px/1.25 var(--font-display); }
.tn-khoa .thuoc { margin-top: 0; }
.tn-khoa p:last-child { font-size: 12.5px; font-weight: 700; opacity: .88; }

/* Ba chỉ số: MỘT khay, vạch ngăn — cùng kiểu menu */
.tn-ba { flex: none; margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: 16px; background: var(--panel-soft); border: 1px solid var(--line); }
.tn-ba div { display: flex; flex-direction: column; align-items: center; padding: 9px 4px; min-width: 0; }
.tn-ba div + div { border-left: 1px solid var(--line); }
.tn-ba dd { order: 0; margin: 0; font: 900 19px/1.1 var(--font-display); font-variant-numeric: tabular-nums; }
.tn-ba dt { order: 1; max-width: 100%; font-size: 11.5px; font-weight: 800; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

h3 { margin: 0 0 4px; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.tn-bd { flex: 1 1 130px; min-height: 90px; display: flex; flex-direction: column; }
.tn-cot, .tn-ngay { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 4px; }
.tn-cot { flex: 1; min-height: 0; padding-top: 16px; }
.tn-cot li { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-height: 0; }
.tn-cot i { width: 100%; border-radius: 6px 6px 3px 3px; background: linear-gradient(#3fd0bd, #108073); }
/* Ngày ÍT SỐ LIỆU: cột nhạt — có số nhưng đừng tin (không cần chú thích) */
.tn-cot li.it i { opacity: .4; }
.tn-cot li.rong i { height: 4px !important; background: var(--line); border-radius: 3px; }
.tn-cot li.nay i { box-shadow: 0 0 0 2px var(--panel-solid), 0 0 0 4px #1aa697; }
.so-cot { font-size: 10.5px; font-weight: 900; line-height: 1.3; color: var(--fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tn-ngay { margin-top: 4px; }
.tn-ngay li { text-align: center; font-size: 10px; font-weight: 700; color: var(--muted); line-height: 1.2; }
.tn-ngay li.nay { color: var(--fg); font-weight: 900; }

.tn-ban { flex: none; }
.tn-ban ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tn-ban li { padding: 5px 10px; border-radius: 999px; background: var(--panel-soft); border: 1px solid var(--line); font-size: 12.5px; font-weight: 800; }
.tn-ban li b { margin-left: 5px; color: #0b6b60; font-variant-numeric: tabular-nums; }
:global([data-theme='dark'] .tn-ban li b) { color: #7fe6d7; }
.tn-tran { flex: none; font-size: 11.5px; font-weight: 700; color: var(--muted); text-align: center; }
@media (max-height: 620px) {
  .tn-so b { font-size: 36px; }
  .tn-tran { display: none; }
}
</style>
