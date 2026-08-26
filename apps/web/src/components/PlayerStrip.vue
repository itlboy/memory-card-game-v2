<script setup lang="ts">
import type { Player } from '@mm/engine';
import OptionIcon from './OptionIcon.vue';
import { Timer } from 'lucide-vue-next';

defineProps<{
  players: Player[];
  currentId: string;
  /** Giây còn lại của lượt hiện tại (đồng hồ 30s); null = không dùng. */
  turnLeft?: number | null;
  /** Người vừa được +10s (ghép đúng), kèm key để lặp animation. */
  bonusFor?: { playerId: string; key: number } | null;
  /** Số ván đã thắng trong loạt (theo tên) — cho biết ai đang dẫn cả loạt. */
  seriesWins?: Record<string, number>;
}>();

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
      <span
        v-if="p.id === currentId && turnLeft !== null && turnLeft !== undefined"
        class="turn-clock"
        :class="{ urgent: turnLeft <= 10 }"
        role="timer"
        :aria-label="`Còn ${Math.ceil(turnLeft)} giây`"
      ><Timer :size="12" />{{ Math.ceil(turnLeft) }}</span>
      <Transition name="plus">
        <span v-if="bonusFor && bonusFor.playerId === p.id" :key="bonusFor.key" class="plus10">+10s</span>
      </Transition>
      <span v-if="(seriesWins?.[p.name] ?? 0) > 0" class="wins" :title="`Đã thắng ${seriesWins?.[p.name]} ván`">
        🏅{{ seriesWins?.[p.name] }}
      </span>
      <span class="pts" :data-pts-for="p.id">{{ p.score }}</span>
      <!--
        Vẽ TỪNG trái tim chỉ tới 5 mạng; hơn thì hiện số. Số mạng giờ neo theo cỡ
        bàn nên bàn 42 thẻ có tới 56 mạng — 56 trái tim thì tràn cả dải và chẳng
        ai đếm.
      -->
      <small v-if="Number.isFinite(p.lives)" class="lives">
        <template v-if="p.lives <= 0">💔</template>
        <template v-else-if="p.lives <= 5">{{ '❤️'.repeat(p.lives) }}</template>
        <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
      </small>
      <span v-if="p.frozenTurns > 0" class="tag" title="Bị đóng băng"><OptionIcon name="freeze" :size="14" /></span>
      <span v-else-if="p.doubleNext" class="tag" title="Cặp tới nhân đôi điểm"><OptionIcon name="x2" :size="14" /></span>
      <span v-if="p.id === currentId" class="sr-only">Đang chơi</span>
    </li>
  </ul>
</template>

<style scoped>
.strip { display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; }
.player {
  /* Chip 1 dòng, nén hết cỡ để nhường diện tích cho bàn thẻ trên mobile */
  position: relative;
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
/* Số ván đã thắng trong loạt — biết ai đang dẫn mà không phải mở bảng kết quả */
.wins {
  flex-shrink: 0; font-size: 11px; font-weight: 800;
  padding: 1px 5px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--gold) 30%, transparent);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.pts {
  margin-left: auto; font-family: var(--font-display); font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.turn-clock {
  display: inline-flex; align-items: center; gap: 2px;
  font-family: var(--font-display); font-size: 13px; font-variant-numeric: tabular-nums;
  padding: 1px 7px; border-radius: var(--r-full);
  background: var(--accent-soft); color: var(--accent); white-space: nowrap;
}
.turn-clock.urgent {
  background: color-mix(in srgb, var(--bad) 16%, transparent);
  color: var(--bad);
  animation: clock-pulse .5s steps(2) infinite;   /* dưới 10s: nhấp nháy nhanh gấp đôi */
}
@keyframes clock-pulse { 50% { opacity: .45; transform: scale(1.12); } }
.plus10 {
  position: absolute; top: -18px; right: 8px;
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  color: var(--ok); text-shadow: 0 1px 6px rgba(0, 0, 0, .2); pointer-events: none;
}
.plus-enter-active { transition: transform .8s ease-out, opacity .8s ease-out; }
.plus-enter-from { transform: translateY(10px); opacity: 0; }
.plus-leave-active { transition: opacity .3s; }
.plus-leave-to { opacity: 0; }
.player.active .pts { color: var(--accent); }
.lives {
  font-size: 10px; letter-spacing: -2px; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 2px;
}
/* Số mạng đi kèm icon: bỏ letter-spacing âm (dành cho chuỗi trái tim), không thì
   số dính vào icon. */
.lives :deep(.opt-ico) { border-radius: 4px; }
.lives:has(.opt-ico) { letter-spacing: 0; font-size: 11px; font-weight: 800; }
.tag { font-size: 11px; display: inline-flex; align-items: center; }
.tag :deep(.opt-ico) { border-radius: 4px; }
.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
</style>
