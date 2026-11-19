<script setup lang="ts">
/** Xô bỏng ngô — biểu tượng NGƯỜI XEM (19.11.2026, chủ dự án chê con mắt 👁/👀 cũ xấu). */
withDefaults(defineProps<{ size?: number }>(), { size: 20 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="7.5" cy="7.5" r="3.4" fill="#fff6d6" stroke="#e0a82e" stroke-width="1.2" />
    <circle cx="16.5" cy="7.5" r="3.4" fill="#fff6d6" stroke="#e0a82e" stroke-width="1.2" />
    <circle cx="12" cy="5.4" r="3.8" fill="#fffaf0" stroke="#e0a82e" stroke-width="1.2" />
    <path d="M4.5 9.5h15l-1.8 12.5H6.3z" fill="#fff" stroke="#b5172e" stroke-width="1.2" stroke-linejoin="round" />
    <path d="M7.6 9.5h2.6l.5 12.5H8.6zM13.8 9.5h2.6l-1.1 12.5h-2.1z" fill="#e5243b" />
  </svg>
</template>
