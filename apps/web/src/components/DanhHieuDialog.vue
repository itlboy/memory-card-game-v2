<script setup lang="ts">
import { t, td } from '@/lib/i18n';
import { MAU_BAC, type BacDanhHieu } from '@/lib/ketcuc-fx';
import { X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { dsHien, NHOM, type Achievement, type ThongKe } from '@/lib/achievements';
import DanhHieu from './DanhHieu.vue';

/**
 * MÀN DANH HIỆU — mở từ viên 🏅 trên thanh trên. Khung giống RulesDialog:
 * tiêu đề + nút đóng đứng yên, ruột cuộn, nên không phá luật KHÔNG SCROLL.
 * Ngăn "Đã có" đứng TRƯỚC và mở sẵn (chủ dự án 19.10.2026: "ưu tiên hiện những huy hiệu đã có
 * trước" — thay luật cũ mở sẵn "Chưa có"). Chưa có danh hiệu nào thì mở "Chưa có", khỏi màn trống.
 */
const props = defineProps<{ daCo: ReadonlySet<string>; tk: ThongKe; themeKhoa: ReadonlySet<string> }>();
const emit = defineEmits<{ close: []; 'chinh-phuc': [Achievement] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

// Hai ngăn KHÔNG chồng nhau: chưa có · đã có (bản cũ "Tất cả" lặp lại cả ngăn chưa có)
const so = computed(() => dsHien.value.filter((a) => props.daCo.has(a.id)).length);
const loc = ref<'chua' | 'co'>(so.value > 0 ? 'co' : 'chua');
/* Khối tổng (mockup A chủ dự án duyệt 19.10.2026 https://claude.ai/artifact/2SBFXNhJQgs9EAk9cyjtMd):
   đếm danh hiệu ĐÃ CÓ theo bậc — vàng · bạc · đồng (+ bí mật khi có). */
const BAC_HIEN: BacDanhHieu[] = ['vang', 'bac', 'dong', 'bi-mat'];
const demBac = computed(() => {
  const d: Record<BacDanhHieu, number> = { vang: 0, bac: 0, dong: 0, 'bi-mat': 0 };
  for (const a of dsHien.value) if (props.daCo.has(a.id)) d[a.bac ?? 'dong']++;
  return d;
});
const chipBac = computed(() => BAC_HIEN.filter((b) => b !== 'bi-mat' || demBac.value[b] > 0));
const nhom = computed(() => NHOM.map((n) => {
  const tatCa = dsHien.value.filter((a) => a.nhom === n.id);
  const ds = tatCa.filter((a) => props.daCo.has(a.id) === (loc.value === 'co'));
  return { ...n, ds, co: tatCa.filter((a) => props.daCo.has(a.id)).length, tong: tatCa.length };
}).filter((n) => n.ds.length));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('dhd.danhHieu')" @keydown.esc="emit('close')">
    <div class="panel">
      <header class="head">
        <h2>{{ t('dhd.danhHieu') }}</h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <div class="tong">
        <p class="so"><b>{{ so }}</b><span>/{{ dsHien.length }}</span></p>
        <p class="bac">
          <span v-for="b in chipBac" :key="b" class="o-bac" :title="td(`fx.bac.${b}`)">
            <i :style="{ '--a': MAU_BAC[b].a, '--b': MAU_BAC[b].b }" /><span class="sr-only">{{ td(`fx.bac.${b}`) }}</span>{{ demBac[b] }}
          </span>
        </p>
        <div class="thanh"><i :style="{ width: `${Math.max(2, (so / dsHien.length) * 100)}%` }" /></div>
      </div>
      <div class="tabs" role="tablist">
        <button class="tab thach th-chon th-chon-do" role="tab" type="button" :aria-selected="loc === 'co'" @click="loc = 'co'">
          {{ t('dhd.daCo', { n: so }) }}
        </button>
        <button class="tab thach th-chon th-chon-do" role="tab" type="button" :aria-selected="loc === 'chua'" @click="loc = 'chua'">
          {{ t('dhd.chuaCo', { n: dsHien.length - so }) }}
        </button>
      </div>
      <div class="body">
        <section v-for="n in nhom" :key="n.id">
          <h3>{{ n.ten }} <small>{{ n.co }}/{{ n.tong }}</small></h3>
          <DanhHieu :ds="n.ds" :da-co="daCo" :tk="tk" :theme-khoa="themeKhoa" @chinh-phuc="emit('chinh-phuc', $event)" />
        </section>
        <p v-if="!nhom.length" class="xong">{{ loc === 'co' ? t('dhd.chuaCoGi') : t('dhd.coHet') }}</p>
      </div>
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
  width: 100%; max-width: var(--col-w); max-height: 100%;   /* = cao lớp phủ trừ đệm (đã gồm vùng an toàn) */
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
/* Khối tổng: khối thạch VÀNG (khối màu kẹo giữ nguyên ở nền tối — chữ nâu đậm đi cặp, không đọc token) */
.tong {
  display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 12px;
  margin: 10px 0 12px; padding: 12px 14px; border-radius: 18px;
  background: linear-gradient(135deg, #ffe680, #ffb12b); color: #4a2c00;
  box-shadow: 0 4px 0 #d98a00, 0 10px 18px rgba(200, 120, 0, .25);
}
.tong p { margin: 0; }
.so { font: 900 34px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.so span { font-size: 18px; opacity: .7; }
.bac { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
/* KHÔNG `.chip` — lớp toàn cục (xếp cột), từng làm bốn viên chồng dọc to tướng */
.o-bac {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px 5px 6px; border-radius: 999px;
  background: rgba(255, 255, 255, .75); font-weight: 800; font-size: 13px; line-height: 1; font-variant-numeric: tabular-nums;
}
/* Đồng xu màu bậc (cùng bảng màu huy hiệu MAU_BAC), có điểm sáng — không emoji huy chương */
.o-bac i {
  width: 14px; height: 14px; border-radius: 50%; flex: none;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .85), transparent 45%), linear-gradient(var(--a), var(--b));
  box-shadow: 0 1.5px 0 rgba(0, 0, 0, .25);
}
.thanh { grid-column: 1 / -1; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, .55); }
.thanh i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(#fff6c8, #ff8a00); }
.tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.tab {
  flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font: inherit; font-weight: 700; cursor: pointer;
}
.tab[aria-selected='true'] { background: var(--nhan-nen); color: var(--nhan-chu); border-color: transparent; }
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
/* Tên nhóm: nhãn viên tròn (không chữ xám in hoa nhỏ như cũ) */
h3 {
  display: inline-flex; align-items: baseline; gap: 6px; margin: 14px 0 8px; padding: 5px 12px; border-radius: 999px;
  background: color-mix(in srgb, var(--fg) 8%, transparent); color: var(--fg);
  font: 900 13px/1.1 var(--font-display); letter-spacing: .02em;
}
section:first-child h3 { margin-top: 0; }
h3 small { font-family: var(--font-body, inherit); font-weight: 700; opacity: .7; }
.xong { text-align: center; margin: 24px 0; }
</style>
