<script setup lang="ts">
import { t, td } from '@/lib/i18n';
import { MAU_BAC, type BacDanhHieu } from '@/lib/ketcuc-fx';
import { X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { dsHien, NHOM, type Achievement, type ThongKe } from '@/lib/achievements';
import { num } from '@/lib/format';
import { useBackCloser } from '@/composables/useBackGuard';
import HuyChuong from './HuyChuong.vue';

/**
 * MÀN DANH HIỆU — LÀM LẠI 09.11.2026 (chủ dự án duyệt mockup
 * https://claude.ai/artifact/S6iPWAV8MkwtHe22t58qPf; "làm lại trang danh hiệu cho đẹp và tử tế hơn").
 * Bản cũ: 93 lá bài úp giống hệt nhau + 93 nút "Chinh phục" xanh, mỗi màn thấy 6 ô, tab đỏ
 * "Chưa có (93)" trông như báo lỗi. Bản mới:
 *  · khối tổng thạch vàng (giữ nguyên), "SẮP ĐẠT" = 3 danh hiệu gần xong nhất kèm tiến độ;
 *  · bộ lọc nhỏ Tất cả · Đã có · Chưa có (mặc định Tất cả);
 *  · mỗi nhóm: tiêu đề + số đạt + thanh mảnh, lưới 4 cột HUY CHƯƠNG (HuyChuong.vue);
 *  · KHÔNG nút trong lưới — chạm huy chương mở TỜ CHI TIẾT: huy chương lớn, mô tả, bậc, tiến độ,
 *    MỘT nút "Chinh phục" (theme Premium còn khoá thì báo thay vì nút).
 * Khung giống RulesDialog: tiêu đề + nút đóng đứng yên, ruột cuộn — không phá luật KHÔNG SCROLL.
 */
const props = defineProps<{ daCo: ReadonlySet<string>; tk: ThongKe; themeKhoa: ReadonlySet<string> }>();
const emit = defineEmits<{ close: []; 'chinh-phuc': [Achievement] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

const so = computed(() => dsHien.value.filter((a) => props.daCo.has(a.id)).length);
const BAC_HIEN: BacDanhHieu[] = ['vang', 'bac', 'dong', 'bi-mat'];
const demBac = computed(() => {
  const d: Record<BacDanhHieu, number> = { vang: 0, bac: 0, dong: 0, 'bi-mat': 0 };
  for (const a of dsHien.value) if (props.daCo.has(a.id)) d[a.bac ?? 'dong']++;
  return d;
});
const chipBac = computed(() => BAC_HIEN.filter((b) => b !== 'bi-mat' || demBac.value[b] > 0));

/** [đã, cần] của danh hiệu đếm được; null nếu không đếm. */
function tienDo(a: Achievement): [number, number] | null {
  if (!a.tienDo) return null;
  const [x, y] = a.tienDo(props.tk);
  return [Math.min(x, y), y];
}
const tiLe = (a: Achievement): number | null => {
  const p = tienDo(a);
  return p && p[1] > 0 ? p[0] / p[1] : null;
};

/** 3 danh hiệu CHƯA CÓ gần xong nhất (bỏ bí mật) — biết nên chơi gì tiếp. */
const sapDat = computed(() => dsHien.value
  .filter((a) => !props.daCo.has(a.id) && !a.biMat)
  .map((a) => ({ a, r: tiLe(a) }))
  .filter((x): x is { a: Achievement; r: number } => x.r != null && x.r > 0 && x.r < 1)
  .sort((x, y) => y.r - x.r)
  .slice(0, 3));

const loc = ref<'tat' | 'co' | 'chua'>('tat');
const nhom = computed(() => NHOM.map((n) => {
  const tatCa = dsHien.value.filter((a) => a.nhom === n.id);
  const ds = tatCa.filter((a) => loc.value === 'tat' || props.daCo.has(a.id) === (loc.value === 'co'));
  return { ...n, ds, co: tatCa.filter((a) => props.daCo.has(a.id)).length, tong: tatCa.length };
}).filter((n) => n.ds.length));

const tenCua = (a: Achievement): string => (a.biMat && !props.daCo.has(a.id) ? t('dh.biMat') : a.name);

/* TỜ CHI TIẾT — Back / Esc / chạm nền đóng tờ trước, chưa đóng cả màn */
const chon = ref<Achievement | null>(null);
useBackCloser(30, () => chon.value !== null, () => { chon.value = null; });
const khoaTheme = (a: Achievement): boolean => !!a.chinhPhuc?.theme && props.themeKhoa.has(a.chinhPhuc.theme);
function dongHoac(): void { if (chon.value) chon.value = null; else emit('close'); }
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('dhd.danhHieu')" @keydown.esc="dongHoac">
    <div class="panel">
      <header class="head">
        <h2>{{ t('dhd.danhHieu') }}</h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <div class="body">
        <div class="tong">
          <p class="so"><b>{{ so }}</b><span>/{{ dsHien.length }}</span></p>
          <p class="bac">
            <span v-for="b in chipBac" :key="b" class="o-bac" :title="td(`fx.bac.${b}`)">
              <i :style="{ '--a': MAU_BAC[b].a, '--b': MAU_BAC[b].b }" /><span class="sr-only">{{ td(`fx.bac.${b}`) }}</span>{{ demBac[b] }}
            </span>
          </p>
          <div class="thanh"><i :style="{ width: `${Math.max(2, (so / dsHien.length) * 100)}%` }" /></div>
        </div>

        <template v-if="sapDat.length">
          <h3 class="muc">{{ t('dhd.sapDat') }}</h3>
          <ul class="gan">
            <li v-for="{ a, r } in sapDat" :key="a.id">
              <button class="dong-gan" type="button" data-phang @click="chon = a">
                <HuyChuong :a="a" :co="false" :tien="r" />
                <span class="gan-chu">
                  <b>{{ a.name }}</b>
                  <small>{{ a.hint }}</small>
                  <span class="vach"><i :style="{ width: `${r * 100}%` }" /></span>
                </span>
              </button>
            </li>
          </ul>
        </template>

        <div class="loc" role="tablist">
          <button class="tab" role="tab" type="button" data-phang :aria-selected="loc === 'tat'" @click="loc = 'tat'">{{ t('dhd.tatCa') }}</button>
          <button class="tab" role="tab" type="button" data-phang :aria-selected="loc === 'co'" @click="loc = 'co'">{{ t('dhd.daCo', { n: so }) }}</button>
          <button class="tab" role="tab" type="button" data-phang :aria-selected="loc === 'chua'" @click="loc = 'chua'">{{ t('dhd.chuaCo', { n: dsHien.length - so }) }}</button>
        </div>

        <section v-for="n in nhom" :key="n.id">
          <h3>{{ n.ten }} <small>{{ n.co }}/{{ n.tong }}</small></h3>
          <span class="vach"><i :style="{ width: `${(n.co / n.tong) * 100}%` }" /></span>
          <ul class="luoi">
            <li v-for="a in n.ds" :key="a.id" :class="{ khoa: !daCo.has(a.id) }">
              <button class="o" type="button" data-phang :aria-label="tenCua(a)" @click="chon = a">
                <HuyChuong :a="a" :co="daCo.has(a.id)" :tien="daCo.has(a.id) ? null : tiLe(a)" />
                <b>{{ tenCua(a) }}</b>
              </button>
            </li>
          </ul>
        </section>
        <p v-if="!nhom.length" class="xong">{{ loc === 'co' ? t('dhd.chuaCoGi') : t('dhd.coHet') }}</p>
      </div>

      <!-- TỜ CHI TIẾT -->
      <Transition name="to">
        <div v-if="chon" class="nen-to" @click.self="chon = null">
          <div class="to" role="dialog" :aria-label="tenCua(chon)">
            <span class="keo" aria-hidden="true" />
            <HuyChuong :a="chon" :co="daCo.has(chon.id)" :tien="daCo.has(chon.id) ? null : tiLe(chon)" lon />
            <h4>{{ tenCua(chon) }}</h4>
            <p>{{ chon.biMat && !daCo.has(chon.id) ? t('dh.biMatGoiY') : chon.hint }}</p>
            <span class="nhan">{{ td(`fx.bac.${chon.bac ?? 'dong'}`) }}</span>
            <div v-if="!daCo.has(chon.id) && tienDo(chon)" class="tien">
              {{ num(tienDo(chon)![0]) }}/{{ num(tienDo(chon)![1]) }}
              <span class="vach day"><i :style="{ width: `${(tiLe(chon) ?? 0) * 100}%` }" /></span>
            </div>
            <template v-if="!daCo.has(chon.id) && chon.chinhPhuc">
              <p v-if="khoaTheme(chon)" class="khoa-theme">{{ t('dhd.premium') }}</p>
              <button
                v-else class="nut-di thach th-xanh" type="button"
                :aria-label="t('kq.chinhPhucAria', { ten: chon.name })" @click="emit('chinh-phuc', chon)"
              >{{ t('kq.chinhPhuc') }}</button>
            </template>
            <p v-else-if="daCo.has(chon.id)" class="da-co">✓ {{ t('dhd.daDat') }}</p>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45); backdrop-filter: blur(4px);
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.panel {
  position: relative; overflow: hidden;
  width: 100%; max-width: var(--col-w); max-height: 100%;   /* = cao lớp phủ trừ đệm (đã gồm vùng an toàn) */
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px 14px 0; border-radius: 20px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; padding: 0 2px 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 2px 2px 18px; }
/* Khối tổng: thạch VÀNG (màu kẹo giữ nguyên ở nền tối, chữ nâu đậm đi cặp) */
.tong {
  display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 12px;
  margin: 2px 0 4px; padding: 12px 14px; border-radius: 18px;
  background: linear-gradient(135deg, #ffe680, #ffb12b); color: #4a2c00;
  box-shadow: 0 4px 0 #d98a00, 0 10px 18px rgba(200, 120, 0, .25);
}
.tong p { margin: 0; }
.so { font: 900 34px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.so span { font-size: 18px; opacity: .7; }
.bac { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.o-bac {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px 5px 6px; border-radius: 999px;
  background: rgba(255, 255, 255, .75); font-weight: 800; font-size: 13px; line-height: 1; font-variant-numeric: tabular-nums;
}
.o-bac i {
  width: 14px; height: 14px; border-radius: 50%; flex: none;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .85), transparent 45%), linear-gradient(var(--a), var(--b));
  box-shadow: 0 1.5px 0 rgba(0, 0, 0, .25);
}
.tong .thanh { grid-column: 1 / -1; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, .55); }
.tong .thanh i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(#fff6c8, #ff8a00); }
/* Thanh mảnh dùng chung (nhóm, sắp đạt, tờ chi tiết) */
.vach { display: block; height: 6px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--fg) 10%, transparent); }
.vach i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7ad04a, #3fa320); }
.vach.day { height: 12px; margin-top: 6px; }
h3 {
  display: flex; justify-content: space-between; align-items: baseline; margin: 18px 2px 4px;
  font: 800 16px/1.2 var(--font-display); color: var(--fg);
}
h3 small { font: 700 13px var(--font-body, inherit); color: var(--muted); }
section h3 + .vach { margin: 0 2px 12px; }
.muc { margin-top: 16px; }
.gan { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 8px; }
.dong-gan {
  width: 100%; display: flex; gap: 12px; align-items: center; padding: 9px 12px; border-radius: 16px; text-align: left;
  background: color-mix(in srgb, var(--fg) 5%, transparent); border: 2px solid color-mix(in srgb, var(--fg) 9%, transparent);
  color: var(--fg); font: inherit; cursor: pointer;
}
.gan-chu { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gan-chu b { font-size: 14.5px; line-height: 1.2; }
.gan-chu small { color: var(--muted); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gan-chu .vach { margin-top: 4px; }
.loc { display: flex; gap: 6px; margin: 16px 0 0; flex-wrap: wrap; }
.tab {
  padding: 6px 14px; min-height: 34px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 700;
  background: color-mix(in srgb, var(--fg) 6%, transparent); color: var(--muted); border: 2px solid color-mix(in srgb, var(--fg) 9%, transparent);
}
.tab[aria-selected='true'] { background: var(--fg); color: var(--panel-solid); border-color: var(--fg); }
.luoi { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 6px; }
.o {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px 0;
  background: none; border: 0; color: var(--fg); font: inherit; cursor: pointer; text-align: center;
}
.o b {
  font-weight: 600; font-size: 11.5px; line-height: 1.2; hyphens: auto; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.khoa .o b { color: var(--muted); }
.xong { text-align: center; margin: 24px 0; }

/* Tờ chi tiết: trượt từ đáy panel lên, nền mờ phủ lưới */
.nen-to { position: absolute; inset: 0; z-index: 2; display: flex; align-items: flex-end; background: rgba(10, 14, 40, .45); }
.to {
  width: 100%; padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px)); border-radius: 26px 26px 0 0;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  background: var(--panel-solid); color: var(--fg); box-shadow: 0 -6px 30px rgba(0, 0, 0, .25);
}
.keo { width: 44px; height: 5px; border-radius: 9px; background: var(--line); margin: -8px 0 16px; }
.to h4 { margin: 16px 0 4px; font: 800 24px/1.15 var(--font-display); }
.to p { margin: 0; color: var(--muted); }
.nhan {
  margin-top: 10px; padding: 3px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
  background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--fg);
}
.tien { width: 100%; margin-top: 16px; text-align: left; font-size: 13px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.nut-di { width: 100%; margin-top: 18px; min-height: 52px; border-radius: 18px; font: 800 19px var(--font-display); }
.khoa-theme, .da-co { margin-top: 16px !important; font-weight: 700; }
.da-co { color: var(--ok-solid, #2f8a16) !important; }
.to-enter-active, .to-leave-active { transition: opacity .2s ease; }
.to-enter-active .to, .to-leave-active .to { transition: transform .25s cubic-bezier(.2, .9, .3, 1); }
.to-enter-from, .to-leave-to { opacity: 0; }
.to-enter-from .to, .to-leave-to .to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) { .to-enter-active .to, .to-leave-active .to { transition: none; } }
</style>
