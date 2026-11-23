<script setup lang="ts">
/**
 * SỔ TRÍ NHỚ (23.11.2026, THỬ NGHIỆM — mở từ trang Debug). Điểm trí nhớ = tỉ lệ nhớ (có tính độ
 * lâu) × trần của bàn, lưu số đếm thô theo ngày (`storage.ghiTriNho`), gộp ở `lib/tri-nho.ts`.
 * Con số chính là 7 NGÀY QUA chứ không phải hôm nay: một ngày hiếm khi đủ số liệu để tin, nên
 * mọi con số đều đi kèm mức tin cậy (ba chấm) và ngày ít số liệu vẽ cột nhạt.
 * KHÔNG SCROLL: mọi khối co theo chỗ còn lại, biểu đồ là khối duy nhất giãn.
 */
import { Brain, TrendingDown, TrendingUp, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { NHOM_BAN, dayNgay, theoNhomBan, tomTat, vanConThieu } from '@/lib/tri-nho';

const emit = defineEmits<{ close: [] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => nutDong.value?.focus());

const nhatKy = store.nhatKyTriNho();
const SO_COT = 14;
const ngay = dayNgay(SO_COT * 2);
const cuaNgay = (ds: string[]) => ds.map((k) => nhatKy[k]);

const tuan = computed(() => tomTat(cuaNgay(ngay.slice(-7))));
const tuanTruoc = computed(() => tomTat(cuaNgay(ngay.slice(-14, -7))));
const homNay = computed(() => tomTat(cuaNgay(ngay.slice(-1))));
/** Chỉ so hai tuần khi CẢ HAI đều từ mức "tạm tham khảo" trở lên — so hai con số ít dữ liệu là so nhiễu. */
const lech = computed(() => (tuan.value.diem !== null && tuanTruoc.value.diem !== null
  && tuan.value.tinCay >= 2 && tuanTruoc.value.tinCay >= 2 ? tuan.value.diem - tuanTruoc.value.diem : null));

const cot = computed(() => ngay.slice(-SO_COT).map((k) => ({ k, so: Number(k.slice(8)), ...tomTat([nhatKy[k]]) })));
const dinh = computed(() => Math.max(200, ...cot.value.map((c) => c.diem ?? 0)));
const nhom = computed(() => theoNhomBan(cuaNgay(ngay.slice(-SO_COT))));
const tenNhom = (i: number): string => (i === 0 ? t('tn.banDen', { n: NHOM_BAN[0]! })
  : NHOM_BAN[i] === Infinity ? t('tn.banTren', { n: NHOM_BAN[i - 1]! + 1 })
  : t('tn.banTu', { a: NHOM_BAN[i - 1]! + 1, b: NHOM_BAN[i]! }));
/** Còn khoảng mấy ván nữa thì số 7 ngày lên mức tin cậy kế tiếp (0 = đã đáng tin). */
const conThieu = computed(() => vanConThieu(tuan.value, tomTat(cuaNgay(ngay.slice(-SO_COT)))));
const coGi = computed(() => cot.value.some((c) => c.van > 0));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tnTitle" @keydown.esc="emit('close')">
    <div class="panel tn">
      <header class="tn-head">
        <h2 id="tnTitle"><Brain :size="22" :stroke-width="2.4" aria-hidden="true" /> {{ t('tn.ten') }}</h2>
        <span class="tn-thu">{{ t('mt.thuNghiem') }}</span>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>

      <p v-if="!coGi" class="tn-trong">{{ t('tn.trong') }}<br>{{ t('tn.choiThem', { n: conThieu }) }}</p>
      <template v-else>
        <section class="tn-chinh">
          <p class="tn-nhan">{{ t('tn.bayNgay') }}</p>
          <p class="tn-so">
            <b>{{ tuan.diem === null ? '–' : num(tuan.diem) }}</b>
            <span v-if="lech !== null" class="tn-lech" :class="{ xuong: lech < 0 }">
              <component :is="lech < 0 ? TrendingDown : TrendingUp" :size="16" :stroke-width="2.6" aria-hidden="true" />
              {{ t('tn.soVoi', { n: (lech > 0 ? '+' : '') + num(lech) }) }}
            </span>
          </p>
          <p class="tn-tc" :class="`m${tuan.tinCay}`">
            <span class="cham" aria-hidden="true"><i v-for="i in 3" :key="i" :class="{ bat: i <= tuan.tinCay }" /></span>
            {{ td(`tn.tc${Math.max(1, tuan.tinCay)}`) }}
          </p>
          <p v-if="conThieu" class="tn-them">{{ t('tn.choiThem', { n: conThieu }) }}</p>
        </section>

        <dl class="tn-o">
          <div><dt>{{ t('tn.homNay') }}</dt><dd>{{ homNay.diem === null ? '–' : num(homNay.diem) }}</dd></div>
          <div><dt>{{ t('tn.tiLe') }}</dt><dd>{{ tuan.tiLe === null ? '–' : `${tuan.tiLe}%` }}</dd></div>
          <div><dt>{{ t('tn.cao') }}</dt><dd>{{ tuan.cao ? num(tuan.cao) : '–' }}</dd></div>
          <div><dt>{{ t('tn.tam') }}</dt><dd>{{ tuan.tam ? t('tn.nuoc', { n: tuan.tam }) : '–' }}</dd></div>
        </dl>

        <section class="tn-bd">
          <h3>{{ t('tn.muoiBon') }}</h3>
          <ol class="tn-cot">
            <li v-for="(c, i) in cot" :key="c.k" :class="{ nay: i === cot.length - 1, it: c.tinCay === 1, rong: c.diem === null }">
              <span class="so-cot">{{ c.diem === null ? '' : c.diem }}</span>
              <i :style="{ height: `${c.diem === null ? 0 : Math.max(6, (c.diem / dinh) * 100)}%` }" />
              <small>{{ c.so }}</small>
            </li>
          </ol>
          <p class="tn-chu"><i class="mau" />{{ t('tn.chuDu') }}<i class="mau it" />{{ t('tn.chuIt') }}</p>
        </section>

        <section class="tn-ban">
          <h3>{{ t('tn.theoBan') }}</h3>
          <ul>
            <li v-for="(n, i) in nhom" :key="i" :class="{ rong: n.tiLe === null }">
              <span>{{ tenNhom(i) }}</span>
              <span class="vach"><i :style="{ width: `${n.tiLe ?? 0}%` }" /></span>
              <b>{{ n.tiLe === null ? '–' : `${n.tiLe}%` }}</b>
            </li>
          </ul>
        </section>
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
  display: flex; flex-direction: column; gap: 10px;
}
.tn-head { display: flex; align-items: center; gap: 8px; }
.tn-head h2 { flex: 1; min-width: 0; margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl); }
.tn-thu {
  padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase;
  background: color-mix(in srgb, #1aa697 18%, transparent); color: #0b6b60;
}
:global([data-theme='dark'] .tn-thu) { color: #7fe6d7; }
.tn-trong { margin: 28px 8px; text-align: center; color: var(--muted); font-weight: 700; }

/* Khối chính: thạch XANH NGỌC (chủ dự án chọn 23.11.2026 thay tím — màu chưa ô nào ở trang chủ dùng);
   màu kẹo giữ nguyên ở nền tối, chữ trắng đi cặp */
.tn-chinh {
  flex: none; padding: 12px 16px; border-radius: 20px; color: #fff;
  background: linear-gradient(135deg, #149384, #075a50);
  box-shadow: 0 4px 0 #04433b, 0 10px 18px rgba(8, 90, 80, .28);
}
.tn-chinh p { margin: 0; }
.tn-nhan { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
.tn-so { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.tn-so b { font: 900 46px/1.05 var(--font-display); font-variant-numeric: tabular-nums; }
.tn-lech {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px;
  font-size: 13px; font-weight: 800; background: rgba(255, 255, 255, .92); color: #14734f;
}
.tn-lech.xuong { color: #b3261e; }
.tn-tc { display: flex; align-items: center; gap: 8px; margin-top: 4px !important; font-size: 13px; font-weight: 700; }
.tn-them { margin-top: 2px !important; font-size: 12.5px; font-weight: 700; opacity: .9; }
.cham { display: inline-flex; gap: 4px; }
.cham i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255, 255, 255, .3); }
.cham i.bat { background: #fff; }
.tn-tc.m1 .cham i.bat { background: #ffd36b; }

.tn-o { flex: none; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.tn-o div {
  display: flex; align-items: baseline; justify-content: space-between; gap: 6px; padding: 8px 9px; border-radius: 14px;
  background: var(--panel-soft); border: 1px solid var(--line);
}
.tn-o dt { min-width: 0; font-size: 12.5px; font-weight: 700; color: var(--muted); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tn-o dd { margin: 0; flex: none; font: 800 14px/1.1 var(--font-display); font-variant-numeric: tabular-nums; white-space: nowrap; }

h3 { margin: 0 0 4px; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.tn-bd { flex: 1 1 150px; min-height: 96px; display: flex; flex-direction: column; }
.tn-cot { flex: 1; min-height: 0; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; }
.tn-cot li { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-height: 0; }
.tn-cot i { width: 100%; border-radius: 6px 6px 3px 3px; background: linear-gradient(#3fd0bd, #108073); }
/* Ngày ÍT SỐ LIỆU: cột sọc nhạt — có số nhưng đừng tin */
.tn-cot li.it i, .tn-chu .mau.it {
  background: repeating-linear-gradient(135deg, color-mix(in srgb, #1aa697 60%, transparent) 0 4px, color-mix(in srgb, #1aa697 22%, transparent) 4px 8px);
}
.tn-cot li.rong i { height: 3px !important; background: var(--line); border-radius: 3px; }
.so-cot { font-size: 9px; font-weight: 800; line-height: 1.3; color: var(--muted); font-variant-numeric: tabular-nums; }
.tn-cot small { margin-top: 2px; font-size: 10px; font-weight: 700; color: var(--muted); line-height: 1.2; }
.tn-cot li.nay small { color: var(--fg); font-weight: 900; }
.tn-chu { margin: 4px 0 0; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--muted); }
.tn-chu .mau { width: 12px; height: 12px; border-radius: 3px; background: linear-gradient(#3fd0bd, #108073); }
.tn-chu .mau.it { margin-left: 10px; }

.tn-ban { flex: none; }
.tn-ban ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
.tn-ban li { display: grid; grid-template-columns: 82px 1fr 44px; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.tn-ban li.rong { color: var(--muted); }
.tn-ban b { text-align: right; font-variant-numeric: tabular-nums; }
.vach { display: block; height: 8px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--fg) 10%, transparent); }
.vach i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #3fd0bd, #108073); }
:global([data-theme='dark'] .tn-lech) { background: rgba(255, 255, 255, .95); }
@media (max-height: 620px) {
  .tn-so b { font-size: 36px; }
  .so-cot { display: none; }
}
</style>
