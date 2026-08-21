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
      <span class="meta">
        <b>{{ p.name }}</b>
        <small>{{ p.score }} điểm · {{ p.pairs }} cặp</small>
      </span>
      <span v-if="p.frozenTurns > 0" class="tag" title="Bị đóng băng">❄️</span>
      <span v-else-if="p.doubleNext" class="tag" title="Cặp tới nhân đôi điểm">✖️2</span>
      <span v-if="p.id === currentId" class="tag turn">Đang chơi</span>
    </li>
  </ul>
</template>

<style scoped>
.strip { display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
.player {
  flex: 1 1 150px; display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-width: 2px;
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
.avatar { font-size: 22px; }
.meta { display: flex; flex-direction: column; min-width: 0; }
.meta b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta small { color: var(--muted); font-size: 12px; }
.tag { margin-left: auto; font-size: 11px; }
.tag.turn { color: var(--accent); font-weight: 600; }
</style>
