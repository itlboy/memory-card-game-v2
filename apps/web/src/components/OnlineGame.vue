<script setup lang="ts">
import { ROOM_LIMITS } from '@mm/engine';
import type { Card } from '@mm/engine';
import { List, Timer } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import BoardGrid from './BoardGrid.vue';
import { useBoardFit } from '@/composables/useBoardFit';
import CelebrationFx from './CelebrationFx.vue';
import DefeatFx from './DefeatFx.vue';
import HudBar from './HudBar.vue';
import ResultDialog from './ResultDialog.vue';
import EmojiBar from './EmojiBar.vue';
import OptionIcon from './OptionIcon.vue';
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
    // Đi qua `symbolNeuDuocPhep`, KHÔNG đọc bàn-biết-trước trực tiếp: nó chỉ
    // nhả symbol cho ô server đã báo ngửa, hoặc ô mình vừa bấm đang chờ trả
    // lời. Nhờ vậy thẻ úp vẫn nhận `''` đúng như khi chưa có tính năng này.
    // `giuMo`: hai lá vừa lật sai được GHIM ngửa đủ thời gian xem, kể cả khi
    // view mới đã báo úp — xem chú thích ở useOnlineRoom. Chỉ chứa thẻ server
    // vừa báo ngửa nên không lộ bài.
    symbol: o.symbolNeuDuocPhep(c.index, c.symbol, c.state !== 'down')
      || o.giuMo.value.get(c.index) || '',
    ...(c.power ? { power: c.power as Card['power'] } : {}),
    ...(c.blank ? { blank: true } : {})
  })));
/**
 * Ô nào đang ngửa. Gồm cả ô mình VỪA BẤM còn chờ server, NHƯNG chỉ khi đã biết
 * trước nội dung ô đó — đây chính là chỗ tiết kiệm ~180ms: lật hẳn luôn thay vì
 * treo 90° chờ trả lời.
 *
 * Server tắt cờ PREDEAL thì `symbolNeuDuocPhep` trả '' nên ô chờ KHÔNG vào tập
 * này, và mọi thứ về đúng hành vi treo 90° như trước — không cần cờ ở client.
 *
 * Server từ chối nước đi (bấm sai lượt chẳng hạn) thì `settlePending` bỏ ô khỏi
 * `pending`, ô rời tập này và úp lại.
 */
const faceUp = computed(() => {
  const s = new Set(
    (o.view.value?.cards ?? []).filter((c) => c.state !== 'down').map((c) => c.index));
  for (const i of o.pending.value) {
    if (o.symbolNeuDuocPhep(i, undefined, false)) s.add(i);
  }
  // Hai lá vừa lật sai: giữ ngửa cho đủ thời gian xem, dù server đã úp
  for (const i of o.giuMo.value.keys()) s.add(i);
  return s;
});
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
/**
 * TỪ 5 NGƯỜI TRỞ LÊN ĐỔI SANG DẢI GỌN — cùng luật với PlayerStrip (chơi cùng
 * máy), xem chú thích đầy đủ ở đó. Tóm lại: chia đều một hàng cho 10 người là
 * mỗi chip 33px, tên biến mất và điểm rơi ra ngoài; xếp hai hàng thì ăn thêm
 * 20px chiều cao của bàn — mà bàn nay tới 88 thẻ.
 */
const gonStrip = computed(() => (o.view.value?.players.length ?? 0) > 4);

const dangDi = computed(() => {
  const ps = o.view.value?.players ?? [];
  return ps.find((p) => p.id === o.view.value?.currentId) ?? ps[0];
});

/** Những người không đang đi, xoay vòng để người ĐI NGAY SAU đứng đầu hàng. */
const khac = computed(() => {
  const ps = o.view.value?.players ?? [];
  if (!ps.length) return [];
  const at = ps.findIndex((p) => p.id === o.view.value?.currentId);
  const start = at < 0 ? 1 : at + 1;
  return Array.from({ length: ps.length - 1 }, (_, k) => ps[(start + k) % ps.length]!);
});

/** Bảng đầy đủ (tên, điểm, mạng, ai mất mạng) — chỉ mở khi người chơi bấm. */
const moBang = ref(false);
watch(() => o.view.value?.players.length, () => { moBang.value = false; });

const iWon = computed(() => o.view.value?.summary?.ranking[0]?.id === o.myId.value);
watch(() => o.view.value?.summary, (s) => {
  clearTimeout(resultTimer);
  showResult.value = false;
  if (!s) return;
  /*
   * BẢNG TỈ SỐ HIỆN SỚM. Mốc cũ là 5 giây cho người thắng — đủ dài để hết pháo
   * hoa, nhưng người chơi thì muốn biết NGAY tỉ số, và năm giây nhìn một bàn
   * đứng im là lâu thật. Hiệu ứng vẫn chạy tiếp phía sau bảng, nên rút xuống
   * không mất gì. Người thua sớm hơn nữa: họ không có gì để xem.
   */
  resultTimer = setTimeout(() => { showResult.value = true; }, iWon.value ? 2200 : 1100);
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

    <div class="strip-wrap">
      <!-- TỚI 4 NGƯỜI: dạng cũ, mỗi người một chip có tên -->
      <div v-if="!gonStrip" class="strip">
        <div
          v-for="p in o.view.value?.players" :key="p.id"
          class="pchip" :class="{ active: p.id === o.view.value?.currentId, off: !p.connected || p.forfeited }"
          :data-chip-for="p.id"
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
          <!-- Quá 5 mạng thì hiện SỐ: bàn 42 thẻ có tới 56 mạng, 56 trái tim thì
               tràn cả chip người chơi. -->
          <small v-if="p.lives !== null" class="lives">
            <template v-if="p.lives <= 0">💔</template>
            <template v-else-if="p.lives <= 5">{{ '❤️'.repeat(p.lives) }}</template>
            <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
          </small>
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

      <!-- TỪ 5 NGƯỜI: chip lượt + hàng avatar. `data-chip-for` phải có ở CẢ HAI
           dạng — EmojiBlast tìm chip theo id để bay lên từ đúng chỗ người gửi. -->
      <div v-else-if="dangDi" class="strip gon">
        <div class="turn-chip" :data-chip-for="dangDi.id" :class="{ off: !dangDi.connected || dangDi.forfeited }">
          <span class="avatar">{{ dangDi.avatar }}</span>
          <span class="tb">
            <b class="nm">{{ dangDi.name }}</b>
            <span class="sub">
              <template v-if="o.turnTimeLeft.value !== null">
                <Timer :size="11" /><span :class="{ urgent: o.turnTimeLeft.value <= 10 }">{{ Math.ceil(o.turnTimeLeft.value) }}s</span> ·
              </template>
              <template v-if="dangDi.id === o.myId.value">lượt bạn</template>
              <template v-else>đang đi</template>
            </span>
          </span>
          <Transition name="plus">
            <span
              v-if="o.timeBonusFor.value && o.timeBonusFor.value.playerId === dangDi.id"
              :key="o.timeBonusFor.value.key" class="plus10"
            >+5s</span>
          </Transition>
          <span class="pts">{{ dangDi.score }}</span>
        </div>

        <ul class="rest">
          <li
            v-for="(p, k) in khac" :key="p.id"
            class="mini" :class="{ next: k === 0, off: !p.connected || p.forfeited }"
            :data-chip-for="p.id"
            :title="`${p.name} — ${p.score} điểm`"
          >
            <span class="avatar">{{ p.avatar }}</span>
            <!-- Mất mạng / đã rời: một chấm đỏ thay cho chữ. Ở cỡ này không có
                 chỗ cho "📴 mất mạng", mà bỏ hẳn thì bên kia biến mất không lý do. -->
            <span v-if="p.forfeited || !p.connected" class="dot" :title="p.forfeited ? 'Đã rời phòng' : 'Mất kết nối'"></span>
            <span class="mpts">{{ p.score }}</span>
            <span class="sr-only">{{ p.name }}: {{ p.score }} điểm</span>
          </li>
          <li class="more">
            <button
              type="button" class="more-btn"
              :aria-expanded="moBang" aria-label="Bảng người chơi"
              @click="moBang = !moBang"
            ><List :size="15" /></button>
          </li>
        </ul>
      </div>

      <!-- Bảng đầy đủ: nổi ĐÈ lên bàn, không chen vào dòng — chen vào là mỗi lần
           mở lại bóp bàn thẻ rồi bung ra, thẻ nhảy chỗ giữa ván. Sắp theo ĐIỂM. -->
      <Transition name="sheet">
        <ul v-if="moBang && gonStrip" class="sheet panel" aria-label="Bảng người chơi">
          <li
            v-for="(p, i) in [...(o.view.value?.players ?? [])].sort((a, b) => b.score - a.score)" :key="p.id"
            :class="{ active: p.id === o.view.value?.currentId, off: !p.connected || p.forfeited }"
          >
            <span class="rank">{{ i + 1 }}</span>
            <span class="avatar">{{ p.avatar }}</span>
            <b class="nm">{{ p.name }}</b>
            <span v-if="p.forfeited" class="netbad">🚪 đã rời</span>
            <span v-else-if="!p.connected" class="netbad">📴 mất mạng</span>
            <small v-if="p.lives !== null" class="lives">
              <template v-if="p.lives <= 0">💔</template>
              <template v-else-if="p.lives <= 5">{{ '❤️'.repeat(p.lives) }}</template>
              <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
            </small>
            <span v-if="(o.seriesWins.value[p.name] ?? 0) > 0" class="wins">🏅{{ o.seriesWins.value[p.name] }}</span>
            <span class="pts">{{ p.score }}</span>
          </li>
        </ul>
      </Transition>
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

      <!--
        HÉ MỞ CẢ BÀN (Chớp nhoáng đầu ván, hoặc thẻ Mắt thần): phải NÓI RA và
        đếm ngược. Trước đây phòng online không hiện gì cả — người chơi thấy cả
        bàn mở ra rồi tự úp lại, phải tự đoán còn mấy giây, đúng ở cái chế độ mà
        từng giây đều đáng giá. Dùng lại y hệt .toast.peek của GameScreen để
        chơi đơn và chơi online nhìn ra là cùng một thứ.
      -->
      <Transition name="banner">
        <p v-if="o.revealingAll.value" class="toast peek" role="status">
          <OptionIcon name="peek" :size="20" /> Ghi nhớ vị trí!
          <b v-if="o.peekLeft.value !== null" class="peek-clock">{{ Math.ceil(o.peekLeft.value) }}s</b>
        </p>
      </Transition>

      <Transition name="banner">
        <div v-if="o.lifeLost.value" :key="`hp-${o.lifeLost.value.key}`" class="turn-banner hurt" role="status" aria-live="polite">
          <span class="who">
            <OptionIcon name="lives" :size="19" />
            <b>{{ o.lifeLost.value.cuaToi ? 'Bạn' : o.lifeLost.value.name }}</b>
            {{ o.lifeLost.value.left > 0 ? `mất 1 mạng — còn ${o.lifeLost.value.left}` : 'hết mạng!' }}
          </span>
        </div>
        <div v-else-if="o.lifeGain.value" :key="`life-${o.lifeGain.value.key}`" class="turn-banner life" role="status" aria-live="polite">
          <span class="who"><OptionIcon name="lives" :size="19" /> <b>{{ o.lifeGain.value.name }}</b> hồi 1 mạng</span>
          <small>Ghép đúng hai lần liền khi đang nguy</small>
        </div>
        <div v-else-if="o.turnBanner.value" :key="o.turnBanner.value.key" class="turn-banner" role="status" aria-live="polite">
          <small v-if="o.turnBanner.value.frozen" class="ico-line">
            <OptionIcon name="freeze" :size="15" /> {{ o.turnBanner.value.frozen }} bị đóng băng, mất lượt
          </small>
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
        :revealing-all="o.revealingAll.value" :locked="locked"
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
    <!-- Thua phải có hình RIÊNG, không được để trống: xem DefeatFx. -->
    <DefeatFx v-else-if="o.view.value?.summary" />
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
      @lobby="o.veLobby()"
      @menu="emit('quit')"
    >
      <template #chat><EmojiBar :o="o" /></template>
    </ResultDialog>
  </section>
</template>

<style scoped>
.game { display: flex; flex-direction: column; gap: 8px; height: 100%; }
/* Bọc để bảng đầy đủ neo được (absolute) mà không đụng tới dòng của bàn thẻ. */
.strip-wrap { position: relative; }
.strip { display: flex; gap: 6px; }

/* ---------- DẢI GỌN (từ 5 người) — cùng ngôn ngữ với PlayerStrip ---------- */

.strip.gon { align-items: stretch; }
/* Chip người đang đi: khối gradient đặc, KHÔNG viền nhấp nháy như .pchip.active —
   ở đây nó đã là thứ duy nhất có màu, thêm animation nữa là dải bồn chồn. */
.turn-chip {
  position: relative; flex-shrink: 0;
  display: flex; align-items: center; gap: 7px; padding: 5px 9px;
  border-radius: 12px; color: #fff;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: 0 4px 16px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .3);
}
.turn-chip.off { opacity: .55; }
.turn-chip .avatar { font-size: 18px; }
.turn-chip .tb { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.turn-chip .nm {
  font-family: var(--font-display); font-size: 12.5px; font-weight: 800;
  max-width: 92px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.turn-chip .sub {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9.5px; font-weight: 700; opacity: .92;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
/* Sắp hết giờ: nhấp nháy NGAY TRONG chip lượt — đồng hồ đã ở chỗ mắt đang nhìn */
.turn-chip .sub .urgent { animation: clock-pulse .5s steps(2) infinite; }
.turn-chip .pts {
  margin-left: 2px; font-family: var(--font-display); font-size: 17px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.turn-chip .plus10 { color: #fff; }

.rest {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px;
  padding: 0 4px; list-style: none; margin: 0;
  border: 1px solid var(--line); border-radius: 12px; background: var(--panel);
}
.mini {
  position: relative; flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center;
  border-radius: 9px; padding: 1px 0;
  /* Mỗi ô tự biết mình rộng bao nhiêu, để quyết định có đủ chỗ cho điểm không */
  container-type: inline-size;
}
/* Người ĐI NGAY SAU: nền nhạt. Chỉ một dấu hiệu, không viền — mười ô có viền
   thì hàng này thành một dãy hộp, mắt không bắt được ô nào đang được chỉ. */
.mini.next { background: var(--accent-soft); }
.mini.off { opacity: .5; }
.mini .avatar { font-size: 15px; line-height: 1.05; }
.mini .mpts {
  font-size: 10px; font-weight: 800; color: var(--muted);
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
/*
 * Ô QUÁ HẸP THÌ BỎ ĐIỂM, giữ avatar.
 *
 * Đo trên iPhone SE (vùng web 375×553) với 10 người: mỗi ô chỉ còn 17,2px, mà
 * "100" đã cần 18px — cả chín ô đều tràn, và số càng lớn càng thò sang ô bên
 * cạnh (12345 thò 6,4px). Chữ chồng lên nhau đọc còn tệ hơn không có chữ.
 *
 * 22px là mốc đủ cho ba chữ số ở cỡ 10px. Mất điểm ở đây không mất thông tin:
 * bảng đầy đủ (nút danh sách cuối dải) vẫn có điểm của mọi người, và người
 * ĐANG ĐI thì điểm nằm ngay trên chip lượt.
 */
@container (max-width: 22px) {
  .mini .mpts { display: none; }
}
.mini .dot {
  position: absolute; top: 0; right: 12%;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--bad); box-shadow: 0 0 0 1.5px var(--panel-solid);
}
.more { flex-shrink: 0; display: flex; align-items: center; }
/* Nút nhỏ mà vùng chạm vẫn phải 44px: nới bằng ::after, KHÔNG phình cái nút
   (phình là dải cao thêm — đúng thứ dải gọn đang tiết kiệm). Phải ghi đè cả
   min-width/min-height vì `.btn` toàn cục đặt 44px. */
.more-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; min-width: 0; min-height: 0; padding: 0;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
}
.more-btn::after { content: ''; position: absolute; inset: -9px; }
.more-btn[aria-expanded='true'] { background: var(--accent-soft); color: var(--accent); }

/* ---------- BẢNG ĐẦY ĐỦ ---------- */

.sheet {
  position: absolute; z-index: 12; top: calc(100% + 6px); left: 0; right: 0;
  display: flex; flex-direction: column; gap: 3px;
  max-height: 58vh; overflow: auto;
  list-style: none; margin: 0; padding: 8px;
}
.sheet li {
  display: flex; align-items: center; gap: 8px;
  min-height: 34px; padding: 3px 7px; border-radius: 9px;
}
.sheet li.active { background: var(--accent-soft); }
.sheet li.off { opacity: .6; }
.sheet .rank {
  flex-shrink: 0; width: 17px; text-align: center;
  font-family: var(--font-display); font-size: 12px; font-weight: 800; color: var(--muted);
}
.sheet .avatar { font-size: 17px; }
.sheet .nm {
  flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sheet .pts { font-family: var(--font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .14s ease, transform .14s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; transform: translateY(-6px); }
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
.pchip .lives { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; letter-spacing: -2px; white-space: nowrap; }
/* Dạng SỐ (trên 5 mạng): bỏ letter-spacing âm vốn dành cho chuỗi trái tim */
.pchip .lives:has(.opt-ico) { letter-spacing: 0; font-size: 11px; font-weight: 800; }
.pchip .lives :deep(.opt-ico) { border-radius: 4px; }
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

/* HÉ MỞ CẢ BÀN: cùng dáng với banner chuyển lượt (đều nổi trong .notice-bar),
   chỉ đổi viền sang màu cảnh báo — giống hệt .toast.peek ở GameScreen, để chơi
   đơn và chơi online đọc ra là cùng một thứ. Một dòng, không che thêm hàng thẻ:
   đây đúng là lúc người chơi cần nhìn cả bàn. */
.toast.peek {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 16px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  border: 2px solid color-mix(in srgb, var(--warn) 65%, var(--line));
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px); pointer-events: none; z-index: 5; white-space: nowrap;
  font-size: clamp(15px, 4vw, 19px); font-weight: 700;
}
/* Số cố định bề rộng: 3s→2s không được làm dòng chữ nhảy qua nhảy lại */
.peek-clock {
  display: inline-block; min-width: 2.2em; text-align: center;
  padding: 1px 7px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn);
  font-variant-numeric: tabular-nums;
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
.ico-line { display: inline-flex; align-items: center; gap: 5px; }
.turn-banner .who { display: flex; align-items: center; gap: 8px; font-size: clamp(17px, 4.5vw, 22px); }
.turn-banner.life { border-color: color-mix(in srgb, var(--ok) 70%, var(--line)); }
/* Mất mạng: viền đỏ + lắc một nhịp — tin xấu không được trông như mọi thông báo khác */
.turn-banner.hurt {
  border-color: color-mix(in srgb, var(--bad) 75%, var(--line));
  animation: hp-shake .4s ease-out;
}
.turn-banner.hurt b { color: var(--bad); }
@keyframes hp-shake {
  0%, 100% { margin-left: 0; }
  25% { margin-left: -5px; }
  60% { margin-left: 4px; }
}
@media (prefers-reduced-motion: reduce) { .turn-banner.hurt { animation: none; } }
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
