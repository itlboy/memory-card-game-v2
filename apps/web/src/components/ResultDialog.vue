<script setup lang="ts">
import type { Summary } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { byId } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { clock, num } from '@/lib/format';

const props = defineProps<{
  summary: Summary;
  isRecord: boolean;
  showStars: boolean;
  multiplayer: boolean;
  freshAchievements: string[];
  /** Tổng điểm tích luỹ trước và sau ván — dùng cho hiệu ứng cộng vào tổng. */
  totalBefore: number;
  totalAfter: number;
  /** Có màn kế tiếp trong Chiến dịch không. */
  hasNext: boolean;
}>();

const emit = defineEmits<{ replay: []; next: []; menu: [] }>();
const primary = ref<HTMLButtonElement | null>(null);
const shownStars = ref(0);
/** Điểm chạy dần từ 0 lên tổng — con số nhảy sẵn thì không ai cảm nhận được
 *  là mình vừa ghi được bao nhiêu. */
const shownScore = ref(0);

onMounted(() => {
  primary.value?.focus();
  if (props.showStars && props.summary.status === 'won') {
    // Sao hiện lần lượt, mỗi ngôi kèm một nốt cao dần
    for (let i = 1; i <= props.summary.stars; i++) {
      setTimeout(() => { shownStars.value = i; sfx.star(i); }, 350 * i);
    }
  }
  countScoreUp();
});

/** Tổng tích luỹ đang hiển thị + trạng thái hiệu ứng cộng vào tổng. */
const shownTotal = ref(props.totalBefore);
const totalGain = computed(() => Math.max(0, props.totalAfter - props.totalBefore));
const totalPhase = ref<'idle' | 'flying' | 'landed'>('idle');

/** Chạy một con số từ `from` tới `to`, gọi onDone khi xong. */
function runCount(
  from: number, to: number, dur: number,
  set: (v: number) => void, tick: boolean, onDone?: () => void
): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    set(to); onDone?.(); return;
  }
  const t0 = performance.now();
  let lastTick = 0;
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    set(Math.round(from + (to - from) * eased));
    // Tick theo mốc thời gian, không theo frame — 60fps sẽ thành tiếng rè
    if (tick && now - lastTick > 90 && p < 1) { lastTick = now; sfx.tick(); }
    if (p < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

/** Điểm ván đếm lên, rồi BAY vào tổng tích luỹ — hai con số phải nối được với
 *  nhau, không thì người chơi không thấy ván này đóng góp gì vào tổng. */
function countScoreUp(): void {
  const target = props.summary.score;
  if (target <= 0) { shownScore.value = target; shownTotal.value = props.totalAfter; return; }
  runCount(0, target, Math.min(1400, 500 + target * 1.2), (v) => { shownScore.value = v; }, true, () => {
    if (!totalGain.value) return;
    totalPhase.value = 'flying';
    setTimeout(() => {
      totalPhase.value = 'landed';
      sfx.star(2);
      runCount(props.totalBefore, props.totalAfter, 700, (v) => { shownTotal.value = v; }, false);
    }, 480);
  });
}

const REASON: Record<Summary['reason'], string> = {
  cleared: 'Bạn đã mở hết các cặp!',
  timeout: 'Hết thời gian.',
  'no-moves': 'Hết lượt lật.',
  'no-lives': 'Hết mạng.',
  forfeit: 'Đối thủ đã rời trận.'
};

const title = computed(() => {
  // Nhiều người: LUÔN xếp hạng, kể cả khi ván dừng vì hết giờ hay hết mạng —
  // lúc đó engine trả status 'lost' nhưng vẫn có người dẫn điểm, mà báo
  // "Chưa xong" thì cả phòng không biết ai thắng.
  if (props.multiplayer) return `${props.summary.ranking[0]?.name} thắng! 🏆`;
  if (props.summary.status !== 'won') return 'Chưa xong 😢';
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
          <b>{{ num(p.score) }}</b>
          <small>{{ p.pairs }} cặp · chuỗi {{ p.bestStreak }}</small>
        </li>
      </ol>

      <!-- Điểm là phần thưởng của cả ván: cho nó cỡ chữ xứng đáng và đếm dần lên -->
      <p v-if="!multiplayer" class="score-big" :aria-label="`${summary.score} điểm`">
        <svg class="star-ico" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="mmStarBig" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffd76a" /><stop offset="1" stop-color="#f59e0b" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.6l2.83 6.05 6.62.72-4.95 4.45 1.4 6.5L12 16.9l-5.9 3.42 1.4-6.5L2.55 9.37l6.62-.72z"
            fill="url(#mmStarBig)"
          />
        </svg>
        <b>{{ num(shownScore) }}</b>
        <small>điểm</small>
        <!-- Điểm ván bay xuống nhập vào tổng tích luỹ -->
        <i v-if="totalPhase === 'flying'" class="fly" aria-hidden="true">+{{ num(totalGain) }}</i>
      </p>

      <!-- Tổng tích luỹ: đích của điểm ván, sáng lên đúng lúc nhận -->
      <p v-if="totalGain" class="total-row" :class="{ landed: totalPhase === 'landed' }">
        <span>Tổng điểm</span>
        <b>{{ num(shownTotal) }}</b>
      </p>

      <dl v-if="!multiplayer" class="stats">
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

/* Điểm tổng: con số lớn nhất trong dialog, có nền sáng và ngôi sao dẫn */
.score-big {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 4px 0 12px; padding: 10px 16px;
  border-radius: var(--r-md);
  background: linear-gradient(150deg,
    color-mix(in srgb, var(--gold) 16%, transparent),
    color-mix(in srgb, var(--accent) 12%, transparent));
  animation: score-in .45s cubic-bezier(.3, 1.5, .5, 1);
}
.score-big .star-ico {
  width: 26px; height: 26px;
  filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--gold) 55%, transparent));
}
.score-big b {
  font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-2xl); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.score-big small { color: var(--muted); font-size: var(--text-sm); font-weight: 700; }
@keyframes score-in { from { opacity: 0; transform: scale(.86); } }

/* Con số "+N" rời khối điểm ván, bay xuống dòng Tổng điểm */
.score-big { position: relative; }
.fly {
  position: absolute; left: 50%; top: 50%;
  font-style: normal; font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-lg); color: #f0a500;
  text-shadow: 0 2px 10px rgba(240, 165, 0, .55);
  pointer-events: none;
  animation: total-fly .5s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes total-fly {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.7); }
  25% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
  100% { opacity: 0; transform: translate(-50%, 190%) scale(.6); }
}

/* Dòng tổng tích luỹ */
.total-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 0 0 12px; padding: 8px 14px;
  border: 1px solid var(--line); border-radius: var(--r-md);
  font-size: var(--text-sm); color: var(--muted);
  transition: border-color .25s ease, background .25s ease;
}
.total-row b {
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg);
  font-variant-numeric: tabular-nums; color: var(--fg);
}
/* Lúc điểm cập bến: viền vàng thắp lên rồi số bắt đầu chạy */
.total-row.landed {
  border-color: color-mix(in srgb, var(--gold) 65%, transparent);
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  animation: total-land .45s cubic-bezier(.3, 1.6, .5, 1);
}
@keyframes total-land { 40% { transform: scale(1.03); } }

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
