<script setup lang="ts">
/**
 * CHỌN THEME — dùng chung cho wizard chơi đơn (MenuScreen) và phòng online
 * (OnlineScreen). Hai tab: Miễn phí · Premium (14.10.2026).
 *
 * Tab premium để người chơi XEM QUA được: chạm một theme còn khoá là mở hộp xem
 * trước đủ bộ biểu tượng + nút mở khoá gói. Đợt này chưa bán thật nên nút mua
 * chỉ báo "sắp có" (`lib/premium.ts`).
 *
 * Một component chứ không chép markup sang hai màn: lưới theme từng có hai bản
 * và chúng lệch nhau hai lần (xem `styles/theme-grid.css`).
 */
import { computed, ref, watch } from 'vue';
import { Check, Crown, Sparkles, X } from 'lucide-vue-next';
import { t } from '@/lib/i18n';
import { tenTheme } from '@/lib/achievements';
import { choiDuoc, daMuaPremium, hienPremium } from '@/lib/premium';
import { anhEmoji } from '@/lib/emoji';
import { daSan, taiAnh, urlTheme } from '@/lib/anh-theme';
import { useBackCloser } from '@/composables/useBackGuard';
import type { CardTheme } from '@/lib/themes';

const props = defineProps<{ themes: CardTheme[]; selected: string[]; nhan: string }>();
const emit = defineEmits<{ toggle: [string]; dat: [string[]] }>();

const tab = ref<'free' | 'premium'>('free');
const mienPhi = computed(() => props.themes.filter((x) => !x.premium));
const premium = computed(() => props.themes.filter((x) => x.premium));
/** Chưa bật bán Premium (`banPremium`) thì không có tab, chỉ bày theme miễn phí. */
const coTabPremium = computed(() => hienPremium.value && premium.value.length > 0);
const dangHien = computed(() => (tab.value === 'free' || !coTabPremium.value ? mienPhi.value : premium.value));

/*
 * HÌNH HIỆN CÙNG LÚC (chủ dự án 17.10.2026: "hình load tuần tự gợn sóng, nhìn như chậm"). Mỗi <img>
 * tự giải mã rồi tự hiện nên 144 hình nhú ra lần lượt. Nay hiện một lượt khi cả tab đã giải mã —
 * hình được TẢI TRƯỚC từ trang chủ (lib/anh-theme.ts) nên thường hiện tức thì.
 */
const anhSan = ref(false);
watch(dangHien, (ds) => {
  const urls = urlTheme(ds);
  if (urls.every((u) => daSan.has(u))) { anhSan.value = true; return; }   // đã tải trước từ trang chủ
  anhSan.value = false;
  const xong = (): void => { anhSan.value = true; };
  const het = setTimeout(xong, 600);   // mạng chậm: không giữ màn trống quá 0,6 giây
  void Promise.all(urls.map(taiAnh)).then(() => { clearTimeout(het); xong(); });
}, { immediate: true });

const xemTruoc = ref<CardTheme | null>(null);
const baoSapCo = ref(false);
useBackCloser(25, () => xemTruoc.value !== null, dong);
function dong(): void { xemTruoc.value = null; baoSapCo.value = false; }

/*
 * CHỌN TẤT CẢ / BỎ CHỌN (14.10.2026) — chỉ tác động TAB ĐANG XEM và chỉ theme chơi
 * được (premium chưa mua thì tab đó không có nút). Luật "còn ít nhất một theme"
 * vẫn giữ: bỏ chọn mà không còn gì thì để lại theme đầu của tab.
 */
const choiDuocTab = computed(() => dangHien.value.filter(choiDuoc).map((x) => x.id));
/** Đếm "đã chọn / tổng" (16.10.2026: theme nhiều rồi, người chơi cần biết mình chọn bao nhiêu) —
 *  tính trên MỌI theme chơi được của cả hai tab, vì bộ chọn áp cho cả ván. */
const tongChoiDuoc = computed(() => props.themes.filter(choiDuoc).map((x) => x.id));
const soDaChon = computed(() => tongChoiDuoc.value.filter((id) => props.selected.includes(id)).length);
const daChonHet = computed(() => choiDuocTab.value.length > 0 && choiDuocTab.value.every((id) => props.selected.includes(id)));
function chonHet(): void {
  if (daChonHet.value) {
    const con = props.selected.filter((id) => !choiDuocTab.value.includes(id));
    emit('dat', con.length ? con : [choiDuocTab.value[0]!]);
  } else {
    emit('dat', [...new Set([...props.selected, ...choiDuocTab.value])]);
  }
}

function cham(x: CardTheme): void {
  if (choiDuoc(x)) emit('toggle', x.id);
  else xemTruoc.value = x;
}
</script>

<template>
  <div v-if="coTabPremium" class="theme-tabs" role="tablist">
    <button
      class="ttab thach th-chon" role="tab" type="button" :aria-selected="tab === 'free'"
      @click="tab = 'free'"
    >{{ t('tp.mienPhi') }} <span class="dem">{{ mienPhi.length }}</span></button>
    <button
      class="ttab prem thach th-chon" role="tab" type="button" :aria-selected="tab === 'premium'"
      @click="tab = 'premium'"
    ><Crown :size="15" aria-hidden="true" /> {{ t('tp.premium') }} <span class="dem">{{ premium.length }}</span></button>
  </div>

  <p v-if="coTabPremium && tab === 'premium' && !daMuaPremium" class="prem-loi">
    <Sparkles :size="15" aria-hidden="true" /> {{ t('tp.loiMoi', { n: premium.length }) }}
  </p>

  <div class="tp-hang">
    <span class="tp-dem" aria-live="polite">{{ t('tp.daChon', { n: soDaChon, tong: tongChoiDuoc.length }) }}</span>
    <button data-phang v-if="choiDuocTab.length" class="tp-het" type="button" @click="chonHet">
      {{ daChonHet ? t('tp.boChon') : t('tp.chonHet', { n: choiDuocTab.length }) }}
    </button>
  </div>

  <div class="options theme-grid" :class="{ 'cho-anh': !anhSan }" role="group" :aria-label="nhan">
    <button
      v-for="x in dangHien" :key="x.id" class="option theme-opt"
      :class="{ 'prem-khoa': !choiDuoc(x) }"
      :role="choiDuoc(x) ? 'checkbox' : undefined"
      :aria-checked="choiDuoc(x) ? selected.includes(x.id) : undefined"
      :aria-label="choiDuoc(x) ? tenTheme(x.id, x.name) : t('tp.khoaAria', { ten: tenTheme(x.id, x.name) })"
      :title="tenTheme(x.id, x.name)"
      type="button"
      @click="cham(x)"
    >
      <!-- 4 icon 2×2, vẽ như mặt bài (ảnh Noto 3D) — nhìn icon là hiểu theme (17.10.2026) -->
      <span class="theme-sample" aria-hidden="true">
        <template v-for="s in x.symbols.slice(0, 4)" :key="s">
          <img v-if="anhEmoji(s)" class="tm-anh" :src="anhEmoji(s, undefined, 128)!" alt="" draggable="false">
          <span v-else class="tm-chu">{{ s }}</span>
        </template>
      </span>
      <strong class="tname">{{ tenTheme(x.id, x.name) }}</strong>
      <!-- Dấu chọn / vương miện nằm TUYỆT ĐỐI ở góc (xem theme-grid.css) -->
      <span v-if="choiDuoc(x) && selected.includes(x.id)" class="tick" aria-hidden="true">
        <Check :size="12" />
      </span>
      <span v-else-if="!choiDuoc(x)" class="tick locked prem" aria-hidden="true">
        <Crown :size="11" />
      </span>
    </button>
  </div>

  <div
    v-if="xemTruoc" class="tp-phu" role="dialog" aria-modal="true"
    :aria-label="tenTheme(xemTruoc.id, xemTruoc.name)" @click.self="dong" @keydown.esc="dong"
  >
    <div class="panel tp-hop">
      <button class="btn tp-dong" type="button" :aria-label="t('tp.dong')" @click="dong"><X :size="20" /></button>
      <p class="tp-nhan"><Crown :size="14" aria-hidden="true" /> {{ t('tp.premium') }}</p>
      <h2>{{ tenTheme(xemTruoc.id, xemTruoc.name) }}</h2>
      <div class="tp-bo" aria-hidden="true">
        <!-- Cùng cách vẽ với mặt bài (`lib/emoji.ts`): máy không phải Apple vẽ ảnh
             Noto 3D — emoji bitmap của Android phóng to là mờ. Hình 28px → cỡ 128 -->
        <span v-for="s in xemTruoc.symbols" :key="s">
          <img v-if="anhEmoji(s)" class="tp-anh" :src="anhEmoji(s, undefined, 128)!" alt="" draggable="false">
          <template v-else>{{ s }}</template>
        </span>
      </div>
      <p class="tp-mo-ta">{{ t('tp.trongGoi', { n: premium.length }) }}</p>
      <button class="btn-primary" type="button" @click="baoSapCo = true">{{ t('tp.moKhoa') }}</button>
      <p v-if="baoSapCo" class="tp-sap-co" role="status">{{ t('tp.sapCo') }}</p>
    </div>
  </div>
</template>

<style scoped>
.theme-tabs {
  display: flex; gap: 8px; margin: 0 0 10px; flex-shrink: 0;
}
.ttab {
  flex: 1; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1.5px solid var(--line); border-radius: 999px; background: var(--panel-solid);
  color: var(--fg); font: inherit; font-size: var(--text-sm); font-weight: 800; cursor: pointer;
}
/* Tab đang mở dùng lớp tô "đang chọn" của skin — không viết màu tay (luật SKIN) */
.ttab[aria-selected='true'] { background: var(--chon-nen); color: var(--chon-chu); border-color: transparent; }
.ttab .dem { opacity: .7; font-weight: 700; }
.tp-hang { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: -2px 0 8px; flex-shrink: 0; }
.tp-dem { min-width: 0; color: var(--muted); font-size: var(--text-sm); font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Nút chữ nhỏ: HÌNH nhỏ, VÙNG CHẠM 44px bằng ::after (luật "Vùng chạm ≠ hình của nút") */
.tp-het {
  position: relative; min-width: 0; min-height: 0; padding: 2px 4px;
  border: 0; background: none; color: var(--accent); font: inherit;
  font-size: var(--text-sm); font-weight: 800; cursor: pointer;
}
.tp-het::after { content: ''; position: absolute; inset: -12px -8px; }
.prem-loi {
  display: flex; align-items: center; gap: 6px; margin: 0 0 10px; flex-shrink: 0;
  color: var(--muted); font-size: var(--text-sm);
}
/* Ô premium còn khoá: vẫn bấm được (mở xem trước) nên KHÔNG mờ như ô disabled —
   mờ là người chơi đọc ra "không chạm được" và không bao giờ thấy bộ hình */
.theme-opt.prem-khoa .tname { opacity: .85; }
.tick.prem { background: linear-gradient(135deg, #ffd76a, #f0a500); color: #4a2f00; }

.tp-phu {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .62);
  /* fixed nằm NGOÀI đệm vùng an toàn của #app — tự cộng env() như ConfirmDialog */
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
.tp-hop { position: relative; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 10px; }
.tp-dong { position: absolute; top: 10px; right: 10px; min-width: 44px; min-height: 44px; padding: 0; }
.tp-nhan { margin: 0; display: inline-flex; align-items: center; gap: 4px; color: #c98a00; font-size: var(--text-sm); font-weight: 800; }
.tp-hop h2 { margin: 0; padding-right: 48px; font-size: var(--text-xl); }
/* Đủ bộ 24 hình, 6 cột: người chơi thấy hết thứ mình sẽ mua */
.tp-bo {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;
  padding: 10px; border-radius: var(--r-md); background: var(--panel-soft);
  font-size: 28px; line-height: 1.2; text-align: center;
}
.tp-anh { width: 1em; height: 1em; display: block; margin: 0 auto; }
.tp-mo-ta { margin: 0; color: var(--muted); font-size: var(--text-sm); }
.tp-sap-co { margin: 0; text-align: center; font-weight: 700; }
.cho-anh .tm-anh { visibility: hidden; }
</style>
