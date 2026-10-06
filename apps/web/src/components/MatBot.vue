<script setup lang="ts">
import { MAT_BAO_DEN } from '@mm/engine';

/**
 * MẶT NGƯỜI CHƠI: emoji, TRỪ một mặt tự vẽ.
 *
 * Avatar chạy xuyên engine, lưu trữ và server dưới dạng CHUỖI, và mọi chỗ hiện
 * nó đều là `{{ avatar }}` chữ trơn. Bot báo đen (06.10.2026) là mặt đầu tiên
 * không có emoji nào tả được — 🐆 là báo đốm, 🐈‍⬛ là mèo — nên chủ dự án duyệt
 * bản SVG tự vẽ (mắt vàng, viền sáng để không chìm trên nền tím của chip).
 * Chuỗi avatar của nó là KHOÁ `MAT_BAO_DEN`, không phải ký tự; component này
 * là cửa DUY NHẤT dịch khoá đó ra hình. Chỗ nào hiện avatar mà in thẳng chuỗi
 * là ra chữ ":bao-den:" — `test/mat-bot.test.ts` canh các màn có bot.
 *
 * SVG đo theo `1em` để theo đúng cỡ chữ của chỗ đặt (18px trong chip, 15px ở
 * hàng avatar nhỏ, 28–48px ở bước chọn mức) — không phải cỡ cứng.
 */
defineProps<{ mat: string }>();
</script>

<template>
  <svg v-if="mat === MAT_BAO_DEN" class="mat-svg" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 14 L25 21 L39 21 L56 14 L54 38 C54 51 44 60 32 60 C20 60 10 51 10 38 Z" fill="#1e1a28" stroke="#4b4260" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M11 17 L25 23 L21 31Z M53 17 L39 23 L43 31Z" fill="#5a4e70" />
    <ellipse cx="24" cy="38" rx="6" ry="5" fill="#ffd23f" /><ellipse cx="40" cy="38" rx="6" ry="5" fill="#ffd23f" />
    <ellipse cx="24" cy="38" rx="2" ry="4" fill="#1e1a28" /><ellipse cx="40" cy="38" rx="2" ry="4" fill="#1e1a28" />
    <circle cx="22.5" cy="36" r="1" fill="#fff" /><circle cx="38.5" cy="36" r="1" fill="#fff" />
    <path d="M28.5 48 L35.5 48 L32 51.5Z" fill="#8a7aa3" />
    <path d="M32 51.5 V54 M32 54 Q28 56.5 25.5 54 M32 54 Q36 56.5 38.5 54" stroke="#8a7aa3" stroke-width="1.8" fill="none" stroke-linecap="round" />
  </svg>
  <template v-else>{{ mat }}</template>
</template>

<style scoped>
/* Emoji chiếm ~1,15em bề ngang và nằm thấp hơn đường cơ sở một chút; SVG bám
   theo đúng hộp đó để chip không nhúc nhích khi đổi từ emoji sang mặt vẽ. */
.mat-svg { width: 1.15em; height: 1.15em; vertical-align: -.17em; display: inline-block; }
</style>
