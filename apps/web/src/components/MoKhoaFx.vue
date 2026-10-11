<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { byId, dangKhoe, vuaMo } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { BoHat, MAU_BAC, type BacDanhHieu } from '@/lib/ketcuc-fx';
import { rung } from '@/lib/rung';
import { t, td } from '@/lib/i18n';

/**
 * CẢNH MỞ KHOÁ DANH HIỆU (mockup đã duyệt 11.10.2026): màn tối một nấc, huy
 * hiệu xoay 3D bật ra với vầng tia theo BẬC, tên + nhãn bậc, rồi huy hiệu bay
 * VÀO viên 🏅 trên thanh trên — viên nảy và số nhích lên đúng lúc chạm.
 *
 * Từng cái một, bậc cao trước (xếp ở `moKhoa`). Không chặn chạm và ở z 19:
 * trên bảng kết quả (10) để khoe được khi bảng đang mở, dưới hộp thoại (20).
 */
const RUNG: Record<BacDanhHieu, number> = { dong: 2, bac: 4, vang: 6, 'bi-mat': 6 };
const dang = ref<{ id: string; key: number } | null>(null);
const di = ref(false);
const huy = ref<HTMLElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
let hen: ReturnType<typeof setTimeout>[] = [];
let hat: BoHat | null = null;
const giam = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sau = (ms: number, f: () => void) => hen.push(setTimeout(f, giam() ? Math.min(ms, 80) : ms));

const dh = computed(() => (dang.value ? byId(dang.value.id) : undefined));
const bac = computed<BacDanhHieu>(() => dh.value?.bac ?? 'dong');
const mau = computed(() => MAU_BAC[bac.value]);

function tiep(): void {
  if (dang.value || !vuaMo.value.length) return;
  const cho = vuaMo.value[0]!.luc - performance.now();
  if (cho > 0) { sau(cho, tiep); return; }
  const [dau, ...con] = vuaMo.value;
  vuaMo.value = con;
  dang.value = dau!;
  dangKhoe.value = 1;
  di.value = false;
  sfx.moKhoa(bac.value);
  rung.ghep(RUNG[bac.value]);
  sau(30, () => {
    if (!hat && cv.value) hat = new BoHat(cv.value);
    const el = huy.value;
    if (el && typeof el.animate === 'function') el.animate(
      [{ transform: 'scale(0) rotateY(0deg)', opacity: 0 }, { transform: 'scale(1.18) rotateY(540deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotateY(720deg)', opacity: 1 }],
      { duration: giam() ? 1 : 900, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' });
  });
  sau(500, () => {
    const r = huy.value?.getBoundingClientRect();
    if (r && hat) hat.long(r.left + r.width / 2, r.top + r.height / 2, bac.value === 'dong' ? 26 : bac.value === 'bac' ? 38 : 60, [mau.value.a, mau.value.b, '#ffffff'], bac.value === 'bi-mat' ? 8 : 6.5);
  });
  // Hàng còn dài thì giữ ngắn hơn: năm danh hiệu × 2,6 giây là quá lâu
  const giu = vuaMo.value.length > 1 ? 1150 : 1650;
  sau(giu, bayVao);
}

function bayVao(): void {
  di.value = true;
  const vien = document.querySelector('header .dh');
  const h = huy.value;
  const xong = () => {
    dangKhoe.value = 0;
    sfx.dinh(); rung.ghep(1);
    if (vien) {
      vien.classList.remove('nay'); void (vien as HTMLElement).offsetWidth; vien.classList.add('nay');
      const r = vien.getBoundingClientRect();
      hat?.long(r.left + r.width / 2, r.top + r.height / 2, 14, ['#ffd76a', '#ffffff'], 3);
    }
    dang.value = null;
    sau(300, tiep);
  };
  // Không có WAAPI (trình duyệt quá cũ, môi trường test) thì bỏ cú bay, vẫn chốt đúng
  if (!h || !vien || typeof h.animate !== 'function') { xong(); return; }
  const a = vien.getBoundingClientRect(), b = h.getBoundingClientRect();
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const an = h.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(.16)` }],
    { duration: giam() ? 1 : 620, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' });
  an.onfinish = xong;
}

watch(vuaMo, tiep, { immediate: true });
onBeforeUnmount(() => { hen.forEach(clearTimeout); hat?.dung(); dangKhoe.value = 0; });
</script>

<template>
  <Teleport to="body">
    <div class="mk-fx" aria-hidden="true">
      <canvas ref="cv" class="fx-hat" />
      <template v-if="dang && dh">
        <div class="mk-toi" :class="{ di }" />
        <div ref="huy" :key="dang.key" class="mk-huy" :style="{ '--tia': mau.tia }">
          <div class="mk-tia" :class="{ di }" />
          <svg viewBox="0 0 136 136">
            <defs>
              <linearGradient :id="`mk-g-${dang.key}`" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" :stop-color="mau.a" /><stop offset="1" :stop-color="mau.b" />
              </linearGradient>
              <linearGradient :id="`mk-l-${dang.key}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity=".75" /><stop offset=".5" stop-color="#fff" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d="M40 4h22l10 34H50zM96 4H74l-10 34h22z" fill="#ff5fa8" />
            <path d="M50 4h12l10 34H60zM86 4H74l-10 34h12z" fill="#8b7dff" />
            <circle cx="68" cy="84" r="46" :fill="`url(#mk-g-${dang.key})`" stroke="#fff" stroke-opacity=".5" stroke-width="3" />
            <circle cx="68" cy="84" r="34" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3" />
            <path d="M68 58l7.6 15.4 17 2.5-12.3 12 2.9 16.9L68 96.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill="#fff" fill-opacity=".92" />
            <ellipse cx="56" cy="64" rx="26" ry="14" :fill="`url(#mk-l-${dang.key})`" transform="rotate(-25 56 64)" />
          </svg>
        </div>
        <div class="mk-chu" :class="{ di }" role="status">
          <small>{{ t('fx.moKhoa') }}</small>
          <b>{{ dh.name }}</b>
          <em>{{ dh.hint }}</em>
          <span class="mk-bac" :style="{ background: `linear-gradient(135deg, ${mau.a}, ${mau.b})` }">{{ td(`fx.bac.${bac}`) }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>
