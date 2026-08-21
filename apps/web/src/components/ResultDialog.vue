<script setup lang="ts">
import type { Summary } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { byId } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { clock } from '@/lib/format';

const props = defineProps<{
  summary: Summary;
  isRecord: boolean;
  showStars: boolean;
  multiplayer: boolean;
  freshAchievements: string[];
  /** Có màn kế tiếp trong Chiến dịch không. */
  hasNext: boolean;
}>();

const emit = defineEmits<{ replay: []; next: []; menu: [] }>();
const primary = ref<HTMLButtonElement | null>(null);
const shownStars = ref(0);

onMounted(() => {
  primary.value?.focus();
  if (props.showStars && props.summary.status === 'won') {
    // Sao hiện lần lượt, mỗi ngôi kèm một nốt cao dần
    for (let i = 1; i <= props.summary.stars; i++) {
      setTimeout(() => { shownStars.value = i; sfx.star(i); }, 350 * i);
    }
  }
});

const REASON: Record<Summary['reason'], string> = {
  cleared: 'Bạn đã mở hết các cặp!',
  timeout: 'Hết thời gian.',
  'no-moves': 'Hết lượt lật.',
  'no-lives': 'Hết mạng.',
  forfeit: 'Đối thủ đã rời trận.'
};

const title = computed(() => {
  if (props.summary.status !== 'won') return 'Chưa xong 😢';
  if (props.multiplayer) return `${props.summary.ranking[0]?.name} thắng! 🏆`;
  return props.isRecord ? 'Kỷ lục mới! 🏆' : 'Hoàn thành! 🎉';
});
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="resTitle" @keydown.esc="emit('menu')">
    <div class="panel">
      <h2 id="resTitle">{{ title }}</h2>
      <p class="reason">{{ REASON[summary.reason] }}</p>

      <p v-if="showStars && summary.status === 'won'" class="stars" :aria-label="`${summary.stars} trên 3 sao`">
        <span
          v-for="i in 3" :key="i"
          class="star"
          :class="{ lit: i <= shownStars, dim: i > summary.stars }"
        >★</span>
      </p>

      <ol v-if="multiplayer" class="ranking">
        <li v-for="(p, i) in summary.ranking" :key="p.id">
          <span>{{ i + 1 }}. {{ p.name }}</span>
          <b>{{ p.score }}</b>
          <small>{{ p.pairs }} cặp · chuỗi {{ p.bestStreak }}</small>
        </li>
      </ol>

      <dl v-else class="stats">
        <div><dt>Điểm</dt><dd>{{ summary.score }}</dd></div>
        <div v-if="summary.timeBonus"><dt>Thưởng thời gian</dt><dd>+{{ summary.timeBonus }}</dd></div>
        <div><dt>Số lượt</dt><dd>{{ summary.moves }}</dd></div>
        <div><dt>Thời gian</dt><dd>{{ clock(summary.seconds) }}</dd></div>
        <div><dt>Chuỗi dài nhất</dt><dd>{{ summary.bestStreak }}</dd></div>
      </dl>

      <ul v-if="freshAchievements.length" class="achievements">
        <li v-for="id in freshAchievements" :key="id">
          🏅 <b>{{ byId(id)?.name }}</b> — {{ byId(id)?.hint }}
        </li>
      </ul>

      <div class="row">
        <button v-if="hasNext && summary.status === 'won'" ref="primary" class="btn btn-primary" type="button" @click="emit('next')">
          Màn tiếp theo
        </button>
        <button v-else ref="primary" class="btn btn-primary" type="button" @click="emit('replay')">
          Chơi lại
        </button>
        <button class="btn" type="button" @click="emit('menu')">Về menu</button>
      </div>
      <button v-if="hasNext && summary.status === 'won'" class="btn link" type="button" @click="emit('replay')">
        Chơi lại màn này
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .3);   /* nền nhạt để thấy pháo hoa phía sau */
}
.panel {
  width: 100%; max-width: 400px; position: relative;
  /* Bán trong suốt + blur: nhìn xuyên được màn ăn mừng phía sau */
  background: color-mix(in srgb, var(--panel-solid) 78%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: dialog-in .3s cubic-bezier(.3, 1.4, .5, 1);
}
@keyframes dialog-in { from { transform: translateY(18px) scale(.94); opacity: 0; } }
h2 { margin: 0 0 4px; }
.reason { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
.stars { margin: 0 0 12px; font-size: 32px; letter-spacing: 6px; }
.star { color: var(--line); display: inline-block; transition: color .2s; }
.star.lit {
  color: var(--gold);
  text-shadow: 0 0 14px color-mix(in srgb, var(--gold) 70%, transparent);
  animation: star-in .45s cubic-bezier(.3, 1.8, .5, 1);
}
.star.dim { color: var(--line); }
@keyframes star-in {
  0% { transform: scale(.2) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.35) rotate(8deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

.stats { margin: 0; display: grid; gap: 6px; }
.stats div { display: flex; justify-content: space-between; gap: 12px; }
.stats dt { color: var(--muted); font-size: 14px; }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }

.ranking { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.ranking li { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 4px 10px; }
.ranking li:first-child b { color: var(--ok); }
.ranking small { grid-column: 1 / -1; color: var(--muted); font-size: 12px; }

.achievements { margin: 14px 0 0; padding: 12px; list-style: none; display: grid; gap: 6px;
  background: color-mix(in srgb, var(--warn) 12%, transparent); border-radius: 10px; font-size: 13px; }

.row { display: flex; gap: 8px; margin-top: 18px; }
.row .btn { flex: 1; }
.row .btn-primary { margin: 0; }
.link { width: 100%; margin-top: 8px; border: 0; background: transparent; color: var(--muted); font-size: 13px; }
</style>
