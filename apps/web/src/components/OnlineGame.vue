<script setup lang="ts">
import { ROOM_LIMITS } from '@mm/engine';
import type { Card } from '@mm/engine';
import { Timer } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import BoardGrid from './BoardGrid.vue';
import { useBoardFit } from '@/composables/useBoardFit';
import CelebrationFx from './CelebrationFx.vue';
import HudBar from './HudBar.vue';
import ResultDialog from './ResultDialog.vue';
import EmojiBar from './EmojiBar.vue';
import EmojiBlast from './EmojiBlast.vue';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';

/**
 * Màn ĐANG CHƠI của phòng online.
 *
 * Tách khỏi OnlineScreen vì bốn màn online (vào phòng, wizard bàn chơi, phòng
 * chờ, đang chơi) trước đây nằm chung một file 1099 dòng và dùng chung 350 dòng
 * CSS — sửa một màn phải lo va chạm với ba màn kia, và đã va chạm thật vài lần.
 */
const props = defineProps<{ o: ReturnType<typeof useOnlineRoom> }>();
const emit = defineEmits<{ quit: [] }>();
const o = props.o;

/** Còn đủ người để chơi lại không. Trước đây đối phương thoát rồi mà nút "chơi
 *  lại" vẫn bấm được — bấm xong ngồi chờ một người đã đi hẳn. */
const enoughToRematch = computed(() =>
  (o.view.value?.players ?? []).filter((p) => p.connected && !p.forfeited).length >= 2);

/**
 * Trạng thái chơi lại của từng người, tra theo ID — nguồn sự thật là
 * `room.againVotes` (ai đã bấm) và `room.players` (ai còn trong phòng).
 *
 * Người đã thoát thì bị xoá khỏi `room.players` nhưng VẪN còn trong
 * `summary.ranking` — chính nhờ vậy mới có chỗ để gắn nhãn "Đã thoát".
 */
const rematchState = computed<Record<string, 'in' | 'out'>>(() => {
  const r = o.room.value;
  if (!r) return {};
  const votes = new Set(r.againVotes ?? []);
  const out: Record<string, 'in' | 'out'> = {};
  for (const p of o.view.value?.players ?? []) {
    const inRoom = r.players.some((q) => q.id === p.id);
    if (votes.has(p.id)) out[p.id] = 'in';
    else if (!inRoom || p.forfeited) out[p.id] = 'out';
  }
  return out;
});

/* ---------- map view server → props của BoardGrid ---------- */
const cards = computed<Card[]>(() =>
  (o.view.value?.cards ?? []).map((c) => ({
    index: c.index,
    pairId: -1,
    symbol: c.symbol ?? '',
    ...(c.power ? { power: c.power as Card['power'] } : {}),
    ...(c.blank ? { blank: true } : {})
  })));
const faceUp = computed(() => new Set(
  (o.view.value?.cards ?? []).filter((c) => c.state !== 'down').map((c) => c.index)));
const matchedSet = computed(() => new Set(
  (o.view.value?.cards ?? []).filter((c) => c.state === 'matched').map((c) => c.index)));
/**
 * Bàn khoá khi: không phải lượt mình, ván chưa chạy, HOẶC đang mất kết nối.
 *
 * Thêm điều kiện mạng vì đo được: lúc mất mạng, bàn vẫn bấm được mà mỗi cú bấm
 * rơi vào hư không — người chơi tưởng game hỏng. Khoá lại thì cái họ thấy khớp
 * với sự thật: đang không nói được với server.
 */
const locked = computed(() =>
  !o.myTurn.value || o.view.value?.status !== 'playing'
  || o.reconnecting.value || !!o.netTrouble.value);

/** Người chơi khác đang mất kết nối — bên còn online phải biết vì sao bàn im. */
const doiThuMatMang = computed(() =>
  (o.view.value?.players ?? []).find((p) => p.id !== o.myId.value && !p.connected && !p.forfeited) ?? null);
const choBaoLau = Math.round(ROOM_LIMITS.reconnectMs / 1000);

/*
 * Emoji chat KHÔNG còn nằm trong dải thông báo (đã teleport ra body, nổi trên
 * header), nên nó không thể đè thông báo chuyển lượt nữa — bỏ luôn phần xếp tầng
 * trước đây phải làm cho hai thứ đó. Màn chơi đơn vẫn cần xếp tầng vì ở đó hai
 * thông báo cùng nằm trong dải (xem GameScreen.vue).
 */

/** Vị trí "+điểm": tâm ô thẻ vừa ghép, tính theo % của lưới. */
const gainStyle = computed(() => {
  const g = o.lastGain.value;
  const v = o.view.value;
  if (!g || !v) return {};
  return {
    left: `${(((g.index % v.cols) + 0.5) / v.cols) * 100}%`,
    top: `${((Math.floor(g.index / v.cols) + 0.5) / v.rows) * 100}%`
  };
});

/**
 * Đo chỗ trống thật, y như màn chơi đơn. Trước đây chỗ này tự tính bằng hằng số
 * `100dvh - 300px` — đoán chiều cao thanh HUD cộng bảng người chơi. Con số đoán
 * sai ngay khi bố cục đổi, và nó không biết gì về khoảng tỷ lệ lá bài, nên cùng
 * một cấp mà bàn online lệch hẳn so với bàn chơi đơn.
 */
const { wrap, fitStyle } = useBoardFit(() => {
  const v = o.view.value;
  return v ? { cols: v.cols, rows: v.rows } : null;
});

/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
let resultTimer: ReturnType<typeof setTimeout> | undefined;
const iWon = computed(() => o.view.value?.summary?.ranking[0]?.id === o.myId.value);
watch(() => o.view.value?.summary, (s) => {
  clearTimeout(resultTimer);
  showResult.value = false;
  if (!s) return;
  resultTimer = setTimeout(() => { showResult.value = true; }, iWon.value ? 5000 : 1500);
});
</script>

<template>
  <section class="game" :style="fitStyle">
    <HudBar
      :score="0" :moves="o.view.value?.moves ?? 0"
      :matched="o.view.value?.matchedPairs ?? 0"
      :total-pairs="o.view.value?.totalPairs ?? 0"
      :combo="1" :elapsed="o.elapsed.value"
      :time-left="o.view.value?.timeLeft ?? null"
      :moves-left="null" :lives="null" :multiplayer="true"
      @quit="emit('quit')"
    />

    <div class="strip">
      <div
        v-for="p in o.view.value?.players" :key="p.id"
        class="pchip" :class="{ active: p.id === o.view.value?.currentId, off: !p.connected || p.forfeited }"
      >
        <span class="avatar">{{ p.avatar }}</span>
        <b>{{ p.name }}</b>
        <!-- Mờ 55% là không đủ để biết chuyện gì: nói thẳng ra. Trước đây bên
             kia mất mạng hay thoát hẳn thì bên này không hay biết. -->
        <span v-if="p.forfeited" class="netbad" title="Đã rời phòng">🚪 đã rời</span>
        <span v-else-if="!p.connected" class="netbad" title="Mất kết nối">📴 mất mạng</span>
        <!-- Ping của MÌNH, gắn cạnh tên mình cho khỏi phải đoán là của ai. Luôn
             hiện: người chơi muốn biết mạng mình thế nào, không chỉ lúc có sự cố. -->
        <span
          v-else-if="p.id === o.myId.value"
          class="ping" :class="o.netQuality.value"
          :title="`Độ trễ mạng của bạn${o.ping.value === null ? ' — đang đo' : `: ${o.ping.value}ms`}`"
        >{{ o.ping.value === null ? '···' : `${o.ping.value}ms` }}</span>
        <small v-if="p.lives !== null" class="lives">{{ '❤️'.repeat(Math.max(0, p.lives)) || '💔' }}</small>
        <span
          v-if="p.id === o.view.value?.currentId && o.turnTimeLeft.value !== null"
          class="turn-clock" :class="{ urgent: o.turnTimeLeft.value <= 10 }"
          role="timer" :aria-label="`Còn ${Math.ceil(o.turnTimeLeft.value)} giây`"
        ><Timer :size="12" />{{ Math.ceil(o.turnTimeLeft.value) }}</span>
        <Transition name="plus">
          <span
            v-if="o.timeBonusFor.value && o.timeBonusFor.value.playerId === p.id"
            :key="o.timeBonusFor.value.key" class="plus10"
          >+5s</span>
        </Transition>
        <span v-if="(o.seriesWins.value[p.name] ?? 0) > 0" class="wins" :title="`Đã thắng ${o.seriesWins.value[p.name]} ván`">
          🏅{{ o.seriesWins.value[p.name] }}
        </span>
        <span class="pts">{{ p.score }}</span>
      </div>
    </div>

    <p v-if="o.spectator.value" class="spectate" role="status">
      👁️ Phòng đã bắt đầu — bạn đang xem trận đấu
    </p>
    <p v-if="o.reconnecting.value" class="reconnect" role="status">📡 Mất kết nối — đang vào lại…</p>
    <!-- Nước bấm không tới được server: phải NÓI RA. Im lặng thì người chơi cứ
         bấm vào chỗ không ai nghe cho tới khi hết lượt. -->
    <p v-else-if="o.netTrouble.value" class="reconnect" role="status">⚠️ {{ o.netTrouble.value }}</p>
    <!-- Đối thủ mất mạng: bàn sẽ im tới khi hết đồng hồ lượt của họ. Không nói ra
         thì người còn lại ngồi nhìn bàn chết mà tưởng game hỏng — đúng thứ đã bị
         phản ánh. -->
    <p v-else-if="doiThuMatMang" class="reconnect" role="status">
      ⏳ <b>{{ doiThuMatMang.name }}</b> mất kết nối — chờ tối đa {{ choBaoLau }} giây
    </p>

    <!-- Dải thông báo TRÊN bàn (không che thẻ) — quy tắc ở global.css -->
    <div class="notice-bar">
      <EmojiBlast :o="o" />

      <Transition name="banner">
        <div v-if="o.lifeGain.value" :key="`life-${o.lifeGain.value.key}`" class="turn-banner life" role="status" aria-live="polite">
          <span class="who">❤️ <b>{{ o.lifeGain.value.name }}</b> hồi 1 mạng</span>
          <small>Ghép đúng hai lần liền khi đang nguy</small>
        </div>
        <div v-else-if="o.turnBanner.value" :key="o.turnBanner.value.key" class="turn-banner" role="status" aria-live="polite">
          <small v-if="o.turnBanner.value.frozen">❄️ {{ o.turnBanner.value.frozen }} bị đóng băng, mất lượt</small>
          <span class="who">
            <span class="avatar">{{ o.turnBanner.value.avatar || '🎮' }}</span>
            Đến lượt <b>{{ o.turnBanner.value.name }}</b>
          </span>
        </div>
      </Transition>
    </div>

    <div ref="wrap" class="board-wrap">
      <BoardGrid
        :cards="cards" :cols="o.view.value?.cols ?? 4"
        :face-up="faceUp" :matched="matchedSet"
        :wrong-pair="o.wrongPair.value" :swap="o.swapPair.value" :pending="o.pending.value"
        :revealing-all="false" :locked="locked"
        :back="o.backStyle.value"
        @flip="o.flip"
      />
      <span v-if="o.lastGain.value" :key="o.lastGain.value.key" class="gain" :style="gainStyle" aria-hidden="true">
        +{{ o.lastGain.value.amount }}
      </span>
      <!-- Đếm ngược trước ván + báo người đi đầu -->
      <div v-if="o.countdownLeft.value !== null" class="countdown" role="status" aria-live="assertive">
        <span class="num" :key="o.countdownLeft.value">{{ o.countdownLeft.value }}</span>
        <span class="first">🎲 <b>{{ o.countdown.value?.firstName }}</b> đi trước!</span>
      </div>

    </div>

    <!-- Mất mạng hẳn thì nói to, vì lúc đó bấm gì cũng không ăn -->
    <p v-if="o.netQuality.value === 'lost'" class="mynet lost" role="status">
      📴 Mạng của bạn đang có vấn đề…
    </p>

    <!-- Emoji chat (ON-08) — xem EmojiBar.vue -->
    <EmojiBar :o="o" />

    <CelebrationFx v-if="o.view.value?.summary && iWon" />
    <ResultDialog
      v-if="o.view.value?.summary && showResult"
      :summary="o.view.value.summary"
      :is-record="false" :show-stars="false" :multiplayer="true"
      :fresh-achievements="[]" :has-next="false" :multiplayer-online="true"
      :total-before="0" :total-after="0"
      :series-wins="o.seriesWins.value"
      :rematch-sent="o.iWantAgain.value"
      :rematch-blocked="!enoughToRematch"
      :rematch-state="rematchState"
      @replay="o.again()"
      @next="o.again()"
      @menu="emit('quit')"
    >
      <template #chat><EmojiBar :o="o" /></template>
    </ResultDialog>
  </section>
</template>

<style scoped>
.game { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.strip { display: flex; gap: 6px; }
.pchip {
  position: relative; flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border: 2px solid var(--line); border-radius: 12px;
  background: var(--panel); box-shadow: var(--shadow-soft);
}
.pchip.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 4px 18px var(--card-back-glow); }
.pchip.off { opacity: .55; }
.netbad {
  flex-shrink: 0; font-size: 10.5px; font-weight: 800; white-space: nowrap;
  padding: 1px 5px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--bad) 18%, transparent); color: var(--bad);
}
/* Mạng của mình: một dòng mảnh, chỉ hiện khi có gì đáng nói */
.mynet {
  margin: 0; text-align: center; font-size: var(--text-xs); color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.mynet.lost { color: var(--bad); font-weight: 800; }
/* Ping: chip nhỏ, đủ đọc mà không tranh chỗ với tên và điểm. Màu nói chất lượng
   nên không cần thêm chữ giải thích. */
.ping {
  flex-shrink: 0; font-size: 10px; font-weight: 800; white-space: nowrap;
  padding: 1px 5px; border-radius: var(--r-full);
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok);
}
.ping.ok  { background: color-mix(in srgb, var(--muted) 16%, transparent); color: var(--muted); }
.ping.bad { background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn); }
.ping.lost { background: color-mix(in srgb, var(--bad) 20%, transparent); color: var(--bad); }
.pchip .avatar { font-size: 18px; }
.pchip b { font-size: 13px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pchip .lives { font-size: 10px; letter-spacing: -2px; white-space: nowrap; }
/* Số ván thắng trong loạt — thấy ai đang dẫn ngay trong ván */
.pchip .wins {
  flex-shrink: 0; font-size: 11px; font-weight: 800;
  padding: 1px 5px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--gold) 30%, transparent);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.pchip .pts { margin-left: auto; font-family: var(--font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
.turn-clock {
  font-family: var(--font-display); font-size: 13px; font-variant-numeric: tabular-nums;
  padding: 1px 7px; border-radius: var(--r-full);
  background: var(--accent-soft); color: var(--accent); white-space: nowrap;
}
.turn-clock.urgent {
  background: color-mix(in srgb, var(--bad) 16%, transparent);
  color: var(--bad);
  animation: clock-pulse .5s steps(2) infinite;
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
.pchip.active .pts { color: var(--accent); }

.reconnect {
  margin: 0; padding: 6px 12px; border-radius: var(--r-sm); text-align: center;
  font-size: var(--text-sm); background: color-mix(in srgb, var(--warn) 16%, transparent);
}
.spectate {
  margin: 0; padding: 6px 12px; border-radius: var(--r-sm); text-align: center;
  font-size: var(--text-sm); background: var(--accent-soft);
}

.board-wrap {
  position: relative; flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}
.board-wrap :deep(.board) { width: var(--fit, 100%); }

.gain {
  position: absolute; transform: translate(-50%, -50%);
  font-weight: 800; font-size: clamp(16px, 4vw, 24px); color: var(--gold);
  text-shadow: 0 1px 8px rgba(0, 0, 0, .35); pointer-events: none;
  animation: rise 1s ease-out forwards;
}
@keyframes rise {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(.7); }
  20% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(1); }
}

/* Nằm trong .notice-bar nên phải gọn MỘT DÒNG: xếp dọc là dải phải cao gấp
   đôi, mà chỗ đó lấy từ bàn thẻ. */
.turn-banner {
  display: flex; flex-direction: row; align-items: center; gap: 8px;
  padding: 7px 16px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  border: 2px solid var(--accent);
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px); pointer-events: none; z-index: 5; white-space: nowrap;
}
.turn-banner .who { display: flex; align-items: center; gap: 8px; font-size: clamp(17px, 4.5vw, 22px); }
.turn-banner.life { border-color: color-mix(in srgb, var(--ok) 70%, var(--line)); }
.turn-banner b { color: var(--accent); }
.turn-banner .avatar { font-size: clamp(24px, 6vw, 32px); }
.turn-banner small { color: var(--muted); font-size: 12.5px; }
.banner-enter-active { transition: opacity .18s ease, transform .25s cubic-bezier(.3, 1.5, .5, 1); }
.banner-enter-from { opacity: 0; transform: translateX(-50%) scale(.6); }
.banner-leave-active { transition: opacity .3s ease, transform .3s ease; }
.banner-leave-to { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.95); }

/* inset: -4px chứ không phải 0: lớp phủ phải TRÙM QUA mép một chút, không thì
   góc bo của khung app hở một vành mỏng nhìn rất khó chịu. Bỏ border-radius vì
   khung app đã cắt (overflow: hidden) — để bán kính 18px trong khi khung bo 28px
   chính là chỗ sinh ra vành hở đó. */
/*
 * Cân giữa CẢ MÀN HÌNH, không phải giữa bàn thẻ. `position: absolute` trong
 * .board-wrap thì tâm cụm nằm ở tâm BÀN — mà bàn bắt đầu dưới HUD nên tâm đó
 * thấp hơn tâm màn hình 63px (đo trên iPhone 13), đọc ra thành lệch xuống dưới,
 * càng rõ trên máy màn ngắn. `fixed` + inset 0 đưa cụm về đúng giữa: con số nhích
 * lên, tên người đi đầu nằm dưới nó.
 */
.countdown {
  position: fixed; inset: 0; z-index: 7;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(3px); pointer-events: none;
}
.countdown .num {
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(80px, 30vw, 150px); line-height: 1; color: var(--accent);
  text-shadow: 0 10px 40px var(--card-back-glow);
  animation: cd-pop .9s cubic-bezier(.2, 1.4, .4, 1);
}
@keyframes cd-pop { 0% { transform: scale(1.7); opacity: 0; } 30% { transform: scale(1); opacity: 1; } }
.countdown .first {
  font-size: clamp(16px, 4.5vw, 22px); padding: 6px 18px; border-radius: var(--r-full);
  background: var(--panel); border: 2px solid var(--accent); box-shadow: var(--shadow);
}
.countdown .first b { color: var(--accent); }




</style>
