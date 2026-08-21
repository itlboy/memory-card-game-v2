<script setup lang="ts">
defineProps<{ dark: boolean; sound: boolean; totalScore: number }>();
defineEmits<{ 'toggle-dark': []; 'toggle-sound': [] }>();
</script>

<template>
  <header class="topbar">
    <h1>Memory Match</h1>
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
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
h1 { flex: 1; margin: 0; font-size: 18px; }
.total { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
</style>
