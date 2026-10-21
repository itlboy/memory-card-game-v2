<script setup lang="ts">
import { computed } from 'vue';
import { MAU_BAC, type BacDanhHieu } from '@/lib/ketcuc-fx';
import type { IconHuyHieu } from '@/lib/achievements';

/**
 * HUY HIỆU = MỘT LÁ BÀI (mockup B+ đã duyệt 13.10.2026). Chưa có = lá ÚP (lưng
 * bài), đã có = lá NGỬA: khung màu bậc, icon của danh hiệu, nơ có dấu tích.
 * Danh sách danh hiệu vì thế đọc như một bàn chơi dở; cảnh mở khoá là cú lật.
 *
 * Viền lấy `--ink` của skin (Kẹo navy, Gỗ nâu) chứ không viết cứng, để huy hiệu
 * đứng cùng một nét vẽ với phần còn lại của giao diện — huy hiệu bóng bẩy cũ
 * lạc tông chính vì nó không theo skin.
 */
/** `nho` = vẽ cho cỡ danh sách (~46px): bỏ nơ, icon chiếm gần hết mặt bài — ở cỡ
 *  đó bản đầy đủ chỉ còn icon 10px, không đọc ra (đã chụp thấy). */
const props = defineProps<{ bac?: BacDanhHieu; icon?: IconHuyHieu; mat?: 'truoc' | 'sau'; nho?: boolean }>();
const mau = computed(() => MAU_BAC[props.bac ?? 'dong']);
</script>

<template>
  <svg class="hh" viewBox="0 0 136 146" aria-hidden="true">
    <!-- LÁ ÚP = ĐÚNG mặt lưng lá bài trong ván + quạt lá (MỘT mặt lưng ở mọi nơi, 18.10.2026): viền giấy
         trắng, nền xanh sâu (cùng màu --la-lung), sao 3D mập ~40% bề ngang, mép dày 2 tầng.
         KHÔNG lưới quả trám, KHÔNG đường chỉ vàng (chủ dự án: "trang danh hiệu lá bài vẫn có xọc"). -->
    <template v-if="mat === 'sau'">
      <defs>
        <radialGradient id="hh-lung" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#2f4fa6" /><stop offset="1" stop-color="#1a3172" /></radialGradient>
      </defs>
      <rect x="21" y="14" width="94" height="124" rx="16" fill="rgba(10,20,60,.22)" />
      <rect x="20" y="10" width="96" height="124" rx="16" fill="#b9c3da" />
      <rect x="20" y="6" width="96" height="124" rx="16" fill="#fdfdfb" stroke="rgba(20,30,70,.18)" stroke-width="1.5" />
      <rect x="26" y="12" width="84" height="112" rx="11" fill="url(#hh-lung)" />
      <!-- Sao 3D mập dùng chung (public/img/sao-3d.svg, 19.10.2026) — 40% bề ngang lá như mặt lưng trong ván -->
      <image href="/img/sao-3d.svg" x="51" y="51" width="34" height="34" />
    </template>
    <template v-else-if="nho">
      <rect class="bong" x="22" y="12" width="92" height="124" rx="16" />
      <rect class="vien" x="20" y="6" width="96" height="124" rx="16" :fill="mau.a" />
      <rect class="vien-vua" x="30" y="16" width="76" height="104" rx="10" fill="#fffaea" />
      <text v-if="icon?.so" class="so-nho" x="68" y="88" text-anchor="middle" :font-size="icon.chu.length > 1 ? 44 : 54">{{ icon.chu }}</text>
      <image v-else-if="!icon" href="/img/sao-3d.svg" x="40" y="40" width="56" height="56" />
      <text v-else x="68" y="88" font-size="52" text-anchor="middle">{{ icon.chu }}</text>
    </template>
    <template v-else>
      <rect class="bong" x="22" y="12" width="92" height="124" rx="16" />
      <rect class="vien" x="20" y="6" width="96" height="124" rx="16" :fill="mau.a" />
      <rect class="vien-vua" x="30" y="16" width="76" height="104" rx="10" fill="#fffaea" />
      <circle class="vien-vua" cx="68" cy="62" r="27" :fill="mau.a" />
      <text
        v-if="icon?.so" class="so" x="68" y="73" text-anchor="middle"
        :font-size="icon.chu.length > 1 ? 26 : 30"
      >{{ icon.chu }}</text>
      <image v-else-if="!icon" href="/img/sao-3d.svg" x="50" y="44" width="36" height="36" />
      <text v-else x="68" y="74" font-size="30" text-anchor="middle">{{ icon.chu }}</text>
      <text v-if="icon?.goc" x="99" y="36" font-size="15" text-anchor="middle" class="goc">{{ icon.goc }}</text>
      <path class="vien-vua" d="M40 98h56l-6 9 6 9H40l6-9z" :fill="mau.b" />
      <path d="M56 103l3 3 6-6" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="76" cy="107" r="2.6" fill="#fff" /><circle cx="84" cy="107" r="2.6" fill="#fff" />
    </template>
  </svg>
</template>

<style scoped>
.hh { display: block; width: 100%; height: 100%; overflow: visible; }
.bong { fill: var(--ink, #1d2a5a); }
.vien { stroke: var(--ink, #1d2a5a); stroke-width: 4; }
.vien-vua { stroke: var(--ink, #1d2a5a); stroke-width: 3; stroke-linejoin: round; }
.vien-mong { stroke: var(--ink, #1d2a5a); stroke-width: 3; stroke-linejoin: round; }
.so {
  font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 800; fill: #fff;
  stroke: var(--ink, #1d2a5a); stroke-width: 2.4; paint-order: stroke;
}
.goc { paint-order: stroke; }
/* Số trên nền KEM của kiểu nhỏ: chữ đậm màu mực, không phải chữ trắng viền (trắng trên kem không đọc ra) */
.so-nho { font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 800; fill: var(--ink, #1d2a5a); }
</style>
