<script setup lang="ts">
// Đồng xu = ĐIỂM (chủ dự án 17.10.2026 chọn mẫu D: xu dày 3D — ở cỡ 16–18px đọc ra "xu" rõ nhất;
// mockup https://claude.ai/artifact/KomN6pYcLrM6v5asqnNRw6). Tách khỏi ngôi sao
// vì sao là ĐÁNH GIÁ ván Chiến dịch — hai thứ cùng hình sao thì người chơi đọc lẫn.
// Màu vàng cố định ở mọi skin: đây là hình vẽ (như emoji), không phải chữ trên nền.
defineProps<{ size?: number }>();
</script>

<template>
  <svg class="dong-xu" viewBox="0 0 24 24" :width="size ?? 18" :height="size ?? 18" aria-hidden="true">
    <ellipse cx="12" cy="14" rx="10" ry="8" fill="#C27F00" />
    <rect x="2" y="11" width="20" height="3" fill="#C27F00" />
    <ellipse cx="12" cy="11" rx="10" ry="8" fill="#FFC531" stroke="#D08E00" stroke-width="1.4" />
    <ellipse cx="12" cy="11" rx="6" ry="4.6" fill="none" stroke="#D08E00" stroke-width="1.2" opacity=".6" />
    <path d="M7 9.4a5.5 4 0 0 1 4-2.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9" />
  </svg>
</template>
