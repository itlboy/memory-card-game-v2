<script setup lang="ts">
import { t } from '@/lib/i18n';
import { X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { dsHien, NHOM, type Achievement, type ThongKe } from '@/lib/achievements';
import DanhHieu from './DanhHieu.vue';

/**
 * MÀN DANH HIỆU — mở từ viên 🏅 trên thanh trên. Khung giống RulesDialog:
 * tiêu đề + nút đóng đứng yên, ruột cuộn, nên không phá luật KHÔNG SCROLL.
 * Lọc "Chưa có" đặt sẵn: thứ người chơi cần thấy là việc còn phải làm.
 */
const props = defineProps<{ daCo: ReadonlySet<string>; tk: ThongKe; themeKhoa: ReadonlySet<string> }>();
const emit = defineEmits<{ close: []; 'chinh-phuc': [Achievement] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

// Hai ngăn KHÔNG chồng nhau: chưa có · đã có (bản cũ "Tất cả" lặp lại cả ngăn chưa có)
const loc = ref<'chua' | 'co'>('chua');
const so = computed(() => dsHien.value.filter((a) => props.daCo.has(a.id)).length);
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
        <h2>{{ t('dhd.danhHieu') }} <small>{{ so }}/{{ dsHien.length }}</small></h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <div class="thanh"><i :style="{ width: `${(so / dsHien.length) * 100}%` }" /></div>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" type="button" :aria-selected="loc === 'chua'" @click="loc = 'chua'">
          {{ t('dhd.chuaCo', { n: dsHien.length - so }) }}
        </button>
        <button class="tab" role="tab" type="button" :aria-selected="loc === 'co'" @click="loc = 'co'">
          {{ t('dhd.daCo', { n: so }) }}
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
.head h2 small { font-size: var(--text-md); color: var(--muted); font-variant-numeric: tabular-nums; }
.thanh { height: 6px; margin: 8px 0 10px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--fg) 10%, transparent); }
.thanh i { display: block; height: 100%; background: linear-gradient(90deg, #ffd76a, #f0a500); }
.tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.tab {
  flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font: inherit; font-weight: 700; cursor: pointer;
}
.tab[aria-selected='true'] { background: var(--nhan-nen); color: var(--nhan-chu); border-color: transparent; }
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
h3 { margin: 12px 0 6px; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
section:first-child h3 { margin-top: 0; }
h3 small { font-weight: 400; letter-spacing: 0; text-transform: none; }
.xong { text-align: center; margin: 24px 0; }
</style>
