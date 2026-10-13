<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { byId, dangKhoe, iconCua, vuaMo } from '@/lib/achievements';
import HuyHieu from './HuyHieu.vue';
import { sfx } from '@/lib/audio';
import { BoHat, MAU_BAC, type BacDanhHieu } from '@/lib/ketcuc-fx';
import { rung } from '@/lib/rung';
import { t, td } from '@/lib/i18n';

/**
 * CẢNH MỞ KHOÁ DANH HIỆU — "lật mở có nhịp" (mockup B+ đã duyệt 13.10.2026,
 * https://claude.ai/artifact/JeMCujSeYa2cgqX2tHFDAQ). Huy hiệu là MỘT LÁ BÀI:
 *  1. hồi hộp  — lá úp rơi vào, rung mạnh dần, quầng sáng màu bậc dâng lên;
 *  2. bùng nổ  — LẬT đúng một lần: loé trắng, tia toả, sóng tròn, hạt bung;
 *  3. khoe     — mặt huy hiệu nảy ra, vệt bóng quét qua, tên hiện;
 *  4. bay VÀO viên 🏅 trên thanh trên — viên nảy, số nhích lên lúc chạm.
 * Bản cũ xoay đĩa phẳng 720° quanh trục đứng: hình không dày nên dẹt thành một
 * đường rồi phình lại, nhìn như đồng xu giấy (chủ dự án chê). Lật = co ngang
 * (scaleX), không dựa vào 3D: preserve-3d bị làm phẳng là lộ lưng bài.
 *
 * Từng cái một, bậc cao trước (xếp ở `moKhoa`). Không chặn chạm và ở z 19:
 * trên bảng kết quả (10) để khoe được khi bảng đang mở, dưới hộp thoại (20).
 */
const RUNG: Record<BacDanhHieu, number> = { dong: 2, bac: 4, vang: 6, 'bi-mat': 6 };
/** Lúc LẬT (khớp delay của .mk-mat.sau/.truoc ở ketcuc-fx.css). */
const LAT_MS = 860;
/** Đốm lấp lánh quanh lá sau khi khoe — toạ độ so với tâm lá. */
const LAP = [[-96, -64], [90, -52], [-108, 34], [102, 44], [-40, -106], [56, 96]] as const;
const dang = ref<{ id: string; key: number } | null>(null);
const di = ref(false);
const huy = ref<HTMLElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
let hen: ReturnType<typeof setTimeout>[] = [];
let hat: BoHat | null = null;
const giam = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sau = (ms: number, f: () => void) => hen.push(setTimeout(f, giam() ? Math.min(ms, 80) : ms));

const dh = computed(() => (dang.value ? byId(dang.value.id) : undefined));
/** Toạ độ viên 🏅 — lớp phủ chừa một vòng sáng ở đó (đích huy hiệu bay vào). */
const vongSang = ref<Record<string, string>>({});
function doVongSang(): void {
  // Toạ độ tính theo #app — lớp phủ nằm trong cột game chứ không phủ cả cửa sổ
  const r = document.querySelector('header .dh')?.getBoundingClientRect();
  const g = document.getElementById('app')?.getBoundingClientRect() ?? { left: 0, top: 0 };
  vongSang.value = r ? { '--x': `${r.left - g.left + r.width / 2}px`, '--y': `${r.top - g.top + r.height / 2}px` } : {};
}
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
  doVongSang();
  di.value = false;
  sau(30, () => { if (!hat && cv.value) hat = new BoHat(cv.value); });
  // Tiếng + rung + hạt ĐÚNG NHỊP LẬT (CSS: lá lưng co lại ở .8s, mặt nở ở .94s)
  sau(LAT_MS, () => {
    sfx.moKhoa(bac.value);
    rung.ghep(RUNG[bac.value]);
    const r = huy.value?.getBoundingClientRect();
    if (r && hat) hat.long(...hat.diem(r.left + r.width / 2, r.top + r.height / 2), bac.value === 'dong' ? 26 : bac.value === 'bac' ? 38 : 60, [mau.value.a, mau.value.b, '#ffffff'], bac.value === 'bi-mat' ? 8 : 6.5);
  });
  // Hàng còn dài thì giữ ngắn hơn: năm danh hiệu × 3 giây là quá lâu. Mốc phải
  // sau lúc khoe xong (~1,6s), không thì lá bay đi khi người chơi chưa kịp đọc.
  const giu = vuaMo.value.length > 1 ? 2000 : 2600;
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
      if (hat) hat.long(...hat.diem(r.left + r.width / 2, r.top + r.height / 2), 14, ['#ffd76a', '#ffffff'], 3);
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
    <div class="mk-fx" aria-hidden="true">
      <canvas ref="cv" class="fx-hat" />
      <template v-if="dang && dh">
        <div class="mk-toi" :class="{ di }" :style="vongSang" />
        <div ref="huy" :key="dang.key" class="mk-huy" :style="{ '--tia': mau.tia, '--glow': mau.a }">
          <div class="mk-halo" :class="{ di }" />
          <div class="mk-tia" :class="{ di }" />
          <div class="mk-song" />
          <div class="mk-flash" />
          <div class="mk-la">
            <div class="mk-mat sau"><HuyHieu mat="sau" /></div>
            <div class="mk-mat truoc"><HuyHieu :bac="bac" :icon="iconCua(dh)" /></div>
            <div class="mk-quet" />
          </div>
          <span
            v-for="([x, y], k) in LAP" :key="k" class="mk-lap" :class="{ di }"
            :style="{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, '--tre': `${1.5 + k * 0.27}s` }"
          >✦</span>
        </div>
        <div class="mk-chu" :class="{ di }" role="status">
          <small>{{ t('fx.moKhoa') }}</small>
          <b>{{ dh.name }}</b>
          <em>{{ dh.hint }}</em>
          <span class="mk-bac" :style="{ background: `linear-gradient(135deg, ${mau.a}, ${mau.b})` }">{{ td(`fx.bac.${bac}`) }}</span>
        </div>
      </template>
    </div>
</template>
