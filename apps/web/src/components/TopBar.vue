<script setup lang="ts">
import { Moon, Sun, Volume2, VolumeX } from 'lucide-vue-next';

defineProps<{ dark: boolean; sound: boolean; totalScore: number }>();
defineEmits<{ 'toggle-dark': []; 'toggle-sound': []; home: [] }>();
</script>

<template>
  <header class="topbar">
    <h1>
      <button class="brand" type="button" aria-label="Về trang chủ" @click="$emit('home')">
        <span class="logo" aria-hidden="true">🃏</span><span class="name">Memory Match</span>
      </button>
    </h1>
    <span class="total" :title="`Tổng điểm tích lũy: ${totalScore}`">⭐ {{ totalScore }}</span>
    <button class="btn" :aria-label="dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'" type="button" @click="$emit('toggle-dark')">
      <Sun v-if="dark" :size="20" />
      <Moon v-else :size="20" />
    </button>
    <button class="btn" :aria-pressed="sound" aria-label="Bật/tắt âm thanh" type="button" @click="$emit('toggle-sound')">
      <Volume2 v-if="sound" :size="20" />
      <VolumeX v-else :size="20" />
    </button>
  </header>
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
/* Wordmark co cỡ chữ theo bề rộng máy: máy hẹp (320px) không xuống 2 dòng
   làm TopBar cao gấp đôi, cũng không bị cắt chữ */
h1 { flex: 1; min-width: 0; margin: 0; font-size: clamp(17px, 5.2vw, var(--text-xl)); font-weight: 800; }
.brand {
  display: flex; align-items: center; gap: var(--sp-2);
  border: 0; background: none; padding: 0;
  font: inherit; cursor: pointer;
  min-width: 0; max-width: 100%;
}
.logo { font-size: 24px; flex-shrink: 0; filter: drop-shadow(0 2px 6px var(--card-back-glow)); }
.name {
  background: linear-gradient(100deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  white-space: nowrap;
}
/* Huy hiệu điểm không bao giờ bị flex nén hay ngắt dòng */
.total {
  flex-shrink: 0; white-space: nowrap;
  font-size: var(--text-sm); font-weight: 700; color: var(--muted);
  font-variant-numeric: tabular-nums;
  padding: 4px 10px; border-radius: var(--r-full);
  background: var(--accent-soft);
}
/* Máy rất hẹp (320px): nới chỗ cho wordmark bằng cách thu padding/gap,
   không thu chữ thêm nữa — dưới 17px là khó đọc */
@media (max-width: 359px) {
  .topbar { gap: 6px; padding: var(--sp-2); }
  .total { padding: 4px 8px; }
}
</style>
