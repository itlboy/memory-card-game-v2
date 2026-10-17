<script setup lang="ts">
// Đồng xu = ĐIỂM (chủ dự án 17.10.2026, mẫu B: xu trơn + một vệt sáng). Tách khỏi ngôi sao
// vì sao là ĐÁNH GIÁ ván Chiến dịch — hai thứ cùng hình sao thì người chơi đọc lẫn.
// Màu vàng cố định ở mọi skin: đây là hình vẽ (như emoji), không phải chữ trên nền.
defineProps<{ size?: number }>();
</script>

<template>
  <svg class="dong-xu" viewBox="0 0 24 24" :width="size ?? 18" :height="size ?? 18" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#FFC531" stroke="#D08E00" stroke-width="2" />
    <path d="M7.5 9.5a5 5 0 0 1 4-3.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85" />
  </svg>
</template>
