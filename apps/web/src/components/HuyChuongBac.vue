<script setup lang="ts">
/**
 * HUY CHƯƠNG BẬC TRÍ NHỚ (25.11.2026): đĩa tròn tô màu theo bậc 0–4 — Đồng · Bạc · Vàng · Bạch kim · Kim cương.
 * Vẽ bằng CSS (không emoji hệ thống: mỗi máy một kiểu). Cỡ theo `1em` của chỗ đặt; chỉ là hình trang trí — chỗ dùng
 * tự ghi tên bậc bằng chữ.
 */
defineProps<{ bac: number }>();
</script>

<template>
  <i class="hc-bac" :class="`b${bac}`" aria-hidden="true" />
</template>

<style scoped>
.hc-bac {
  display: inline-block; flex: none; width: 1.15em; height: 1.15em; border-radius: 50%; vertical-align: -0.2em; box-sizing: border-box;
  background: radial-gradient(circle at 35% 30%, var(--h1), var(--h2) 70%); border: 2px solid var(--h3);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35);
}
.b0 { --h1: #f3c79c; --h2: #c27a3d; --h3: #8a4a18; }
.b1 { --h1: #ffffff; --h2: #aab3c5; --h3: #6f7a90; }
.b2 { --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; }
.b3 { --h1: #e6f8ff; --h2: #7fc4e8; --h3: #3f84ad; }
.b4 { --h1: #e3d9ff; --h2: #7a5cf0; --h3: #4a34b0; }
</style>
