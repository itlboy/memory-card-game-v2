<script setup lang="ts">
import type { Player } from '@mm/engine';

defineProps<{ players: Player[]; currentId: string }>();

const AVATARS = ['🦊', '🐼', '🐯', '🐸'];
</script>

<template>
  <ul class="strip" aria-label="Người chơi">
    <li
      v-for="(p, i) in players"
      :key="p.id"
      class="player panel"
      :class="{ active: p.id === currentId, frozen: p.frozenTurns > 0 }"
      :aria-current="p.id === currentId ? 'true' : undefined"
    >
      <span class="avatar" aria-hidden="true">{{ p.avatar ?? AVATARS[i % AVATARS.length] }}</span>
      <b class="name">{{ p.name }}</b>
      <span class="pts">{{ p.score }}</span>
      <small v-if="Number.isFinite(p.lives)" class="lives">{{ '❤️'.repeat(Math.max(0, p.lives)) || '💔' }}</small>
      <span v-if="p.frozenTurns > 0" class="tag" title="Bị đóng băng">❄️</span>
      <span v-else-if="p.doubleNext" class="tag" title="Cặp tới nhân đôi điểm">✖️2</span>
      <span v-if="p.id === currentId" class="sr-only">Đang chơi</span>
    </li>
  </ul>
</template>

<style scoped>
.strip { display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; }
.player {
  /* Chip 1 dòng, nén hết cỡ để nhường diện tích cho bàn thẻ trên mobile */
  flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border-width: 2px; border-radius: 12px;
}
.player.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 4px 18px var(--card-back-glow);
  animation: breathe 1.8s ease-in-out infinite;
}
@keyframes breathe {
  50% { box-shadow: 0 0 0 1px var(--accent), 0 4px 26px var(--card-back-glow); transform: translateY(-1px); }
}
.player.frozen { opacity: .6; }
.avatar { font-size: 18px; }
.name {
  font-size: 13px; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pts {
  margin-left: auto; font-family: var(--font-display); font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.player.active .pts { color: var(--accent); }
.lives { font-size: 10px; letter-spacing: -2px; white-space: nowrap; }
.tag { font-size: 11px; }
.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
</style>
