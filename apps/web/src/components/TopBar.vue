<script setup lang="ts">
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
      {{ dark ? '☀️' : '🌙' }}
    </button>
    <button class="btn" :aria-pressed="sound" aria-label="Bật/tắt âm thanh" type="button" @click="$emit('toggle-sound')">
      {{ sound ? '🔊' : '🔇' }}
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
h1 { flex: 1; margin: 0; font-size: var(--text-xl); font-weight: 800; }
.brand {
  display: flex; align-items: center; gap: var(--sp-2);
  border: 0; background: none; padding: 0;
  font: inherit; cursor: pointer;
}
.logo { font-size: 24px; filter: drop-shadow(0 2px 6px var(--card-back-glow)); }
.name {
  background: linear-gradient(100deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.total {
  font-size: var(--text-sm); font-weight: 700; color: var(--muted);
  font-variant-numeric: tabular-nums;
  padding: 4px 10px; border-radius: var(--r-full);
  background: var(--accent-soft);
}
</style>
