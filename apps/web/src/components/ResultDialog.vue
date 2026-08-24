<script setup lang="ts">
import { isDraw } from '@mm/engine';
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
  /** Số ván thắng của từng người trong loạt đang chơi (theo tên). */
  seriesWins?: Record<string, number>;
  /** Có màn kế tiếp trong Chiến dịch không. */
  hasNext: boolean;
  /** Cấp đang chơi; không có nghĩa là ván lẻ, không thuộc thang cấp. */
  levelId?: number;
  /** Ván online: không có thang cấp nên không có "cấp tiếp theo". */
  multiplayerOnline?: boolean;
  /** Ván online: mình đã bấm chơi lại chưa, và còn chờ ai. Có hai giá trị này
   *  thì nút đổi thành trạng thái chờ — trước đây bấm xong nút y nguyên nên
   *  người chơi tưởng nút không ăn. */
  rematchSent?: boolean;
  rematchWaiting?: string[];
  /** Tên những người KHÁC đã bấm chơi lại — bên chưa bấm cần thấy để biết mà bấm. */
  rematchFrom?: string[];
  /** Không còn đủ người kết nối để chơi lại — ẩn nút thay vì để bấm vô nghĩa. */
  rematchBlocked?: boolean;
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

const draw = computed(() => props.multiplayer && isDraw(props.summary.ranking));

/**
 * Có chỗ cho nút "Cấp tiếp theo" hay không, và có bấm được hay không — hai
 * chuyện khác nhau. Ván lẻ (không thuộc thang cấp) thì không hiện; còn khi thuộc
 * thang cấp mà cấp sau chưa mở thì HIỆN NHƯNG TẮT, để bố cục đứng yên giữa các
 * ván. Ván online không có thang cấp nên cũng không hiện.
 */
const showNext = computed(() => props.levelId !== undefined && !props.multiplayerOnline);
const canNext = computed(() => props.hasNext && props.summary.status === 'won');
/** Ván thuộc thang cấp thì nói rõ "cấp này", không thì chỉ "Chơi lại". */
const replayLabel = computed(() => (props.levelId === undefined ? 'Chơi lại' : 'Chơi lại cấp này'));

/**
 * "Bạn đã mở hết các cặp!" chỉ đúng khi chơi MỘT MÌNH. Ván thi đấu mà bàn do đối
 * thủ dọn thì câu đó thành sai sự thật — đã thấy thật: dòng trên ghi "Bot siêu
 * đẳng thắng!", dòng dưới lại khen người chơi mở hết cặp.
 */
const reasonText = computed(() =>
  props.multiplayer && props.summary.reason === 'cleared'
    ? 'Bàn đã dọn sạch.'
    : REASON[props.summary.reason]);

/** "Kiên 2 - 1 An" — tỷ số cả loạt, xếp theo số ván thắng. Chỉ hiện khi đã
 *  chơi từ ván thứ hai: ván đầu thì tỷ số 1-0 chẳng nói lên điều gì. */
const series = computed(() => {
  const wins = props.seriesWins;
  if (!props.multiplayer || !wins) return null;
  const rows = props.summary.ranking
    .map((p) => ({ name: p.name, w: wins[p.name] ?? 0 }))
    .sort((a, b) => b.w - a.w);
  const total = rows.reduce((n, r) => n + r.w, 0);
  if (total < 2) return null;
  return rows.length === 2
    ? `${rows[0]!.name} ${rows[0]!.w} - ${rows[1]!.w} ${rows[1]!.name}`
    : rows.map((r) => `${r.name} ${r.w}`).join(' · ');
});

const title = computed(() => {
  // Nhiều người: LUÔN xếp hạng, kể cả khi ván dừng vì hết giờ hay hết mạng —
  // lúc đó engine trả status 'lost' nhưng vẫn có người dẫn điểm, mà báo
  // "Chưa xong" thì cả phòng không biết ai thắng.
  // Bằng điểm thì phải nói HOÀ: lấy người đầu danh sách rồi tuyên bố thắng là
  // sai, thứ tự đó chỉ do sort quyết định.
  if (draw.value) return 'Hoà rồi! 🤝';
  if (props.multiplayer) return `${props.summary.ranking[0]?.name} thắng! 🏆`;
  if (props.summary.status !== 'won') return 'Chưa xong 😢';
  return props.isRecord ? 'Kỷ lục mới! 🏆' : 'Hoàn thành! 🎉';
});
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="resTitle" @keydown.esc="emit('menu')">
    <div class="panel">
      <h2 id="resTitle">{{ title }}</h2>
      <p class="reason">{{ reasonText }}</p>

      <!-- Tỷ số cả loạt: chơi với nhau nhiều ván thì đây mới là con số người ta
           thực sự quan tâm, chứ không phải điểm của riêng ván vừa xong -->
      <p v-if="series" class="series">🏅 {{ series }}</p>

      <p v-if="showStars && summary.status === 'won'" class="stars" :aria-label="`${summary.stars} trên 3 sao`">
        <span
          v-for="i in 3" :key="i"
          class="star"
          :class="{ lit: i <= shownStars, dim: i > summary.stars }"
        >★</span>
      </p>

      <ol v-if="multiplayer" class="ranking">
        <li v-for="(p, i) in summary.ranking" :key="p.id">
          <!-- Hoà thì hai người đầu cùng hạng 1, không phải 1 và 2 -->
          <span>{{ draw && i < 2 ? 1 : i + 1 }}. {{ p.name }}</span>
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

      <!--
        Hàng trên: hai lối đi TIẾP, cạnh nhau, cùng nổi bật — chơi lại bên trái,
        cấp sau bên phải. "Về menu" xuống hàng dưới vì nó là lối RA, không phải
        lối tiếp; để chung một hàng thì ba nút ngang nhau, mắt không biết chọn gì.
      -->
      <div class="row">
        <button
          v-if="!rematchBlocked" ref="primary" class="btn btn-primary" type="button"
          :disabled="rematchSent"
          @click="emit('replay')"
        >
          {{ rematchSent ? 'Đã bấm chơi lại' : replayLabel }}
        </button>
        <!--
          Cấp sau CHƯA MỞ (thua, hoặc thua bot) thì nút vẫn ở đúng chỗ nhưng tắt
          màu và không bấm được — biến mất thì hai nút còn lại nhảy chỗ mỗi ván,
          mà người chơi cần cái nhìn ổn định để bấm theo phản xạ.
        -->
        <button
          v-if="showNext"
          class="btn btn-primary next-level" type="button"
          :disabled="!canNext"
          :title="canNext ? '' : 'Cấp sau chưa mở — thắng ván này trước'"
          @click="canNext && emit('next')"
        >
          Cấp tiếp theo
        </button>
      </div>
      <button class="btn link" type="button" @click="emit('menu')">Về menu</button>
      <!-- Nói rõ đang chờ ai, không thì hai bên cùng ngồi đợi nhau -->
      <p v-if="rematchBlocked" class="waiting" role="status">
        🚪 Người chơi kia đã rời phòng — không chơi lại được nữa.
      </p>
      <p v-else-if="rematchSent && rematchWaiting?.length" class="waiting" role="status">
        ⏳ Chờ <b>{{ rematchWaiting.join(', ') }}</b> bấm chơi lại…
      </p>
      <!-- Mình CHƯA bấm mà người kia đã bấm: phải nói ra, không thì họ chờ mà
           mình không biết là đang chờ cái gì -->
      <p v-else-if="rematchFrom?.length" class="waiting want" role="status">
        🔁 <b>{{ rematchFrom.join(', ') }}</b> muốn chơi lại — bấm <b>Chơi lại</b> để vào ván mới
      </p>
    </div>
  </div>
</template>

<style scoped>
.waiting {
  margin: 10px 0 0; text-align: center; color: var(--muted);
  font-size: var(--text-sm);
}
/* Lời mời chơi lại: nổi hơn dòng "đang chờ", vì đây là việc CẦN người đọc làm gì */
.waiting.want { color: var(--accent); font-weight: 700; }
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

.series {
  margin: 0 0 10px; padding: 8px 14px; border-radius: var(--r-full);
  font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-lg); text-align: center;
  font-variant-numeric: tabular-nums;
  background: var(--accent-soft); color: var(--fg);
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

/* Bảng xếp hạng là NỘI DUNG CHÍNH của bảng kết quả nhiều người, không phải chú
   thích: tên và điểm cỡ chữ lớn, dòng "7 cặp · chuỗi 4" cũng nâng từ 12px lên
   var(--text-sm) cho đọc được mà không phải nhíu mắt. Mỗi hàng có nền riêng để
   tách người này với người kia. */
.ranking { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.ranking li {
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 2px 10px;
  padding: 8px 12px; border-radius: var(--r-md);
  background: var(--panel-soft);
}
.ranking li > span {
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg);
  min-width: 0; overflow-wrap: anywhere;
}
.ranking li b {
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}
.ranking li:first-child { background: color-mix(in srgb, var(--ok) 12%, var(--panel-soft)); }
.ranking li:first-child b { color: var(--ok); }
.ranking small { grid-column: 1 / -1; color: var(--muted); font-size: var(--text-sm); }

.achievements { margin: 14px 0 0; padding: 12px; list-style: none; display: grid; gap: 6px;
  background: color-mix(in srgb, var(--warn) 12%, transparent); border-radius: 10px; font-size: 13px; }

.row { display: flex; gap: 8px; margin-top: 18px; }
.row .btn { flex: 1; }
.row .btn-primary { margin: 0; }
/* Cấp sau chưa mở: xám hẳn, không gradient — nhìn là biết chưa bấm được */
.row .btn-primary:disabled {
  background: var(--line); color: var(--muted);
  box-shadow: none; cursor: not-allowed; opacity: 1;
}
.link { width: 100%; margin-top: 8px; border: 0; background: transparent; color: var(--muted); font-size: 13px; }
</style>
