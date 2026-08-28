<script setup lang="ts">
import type { Player } from '@mm/engine';
import OptionIcon from './OptionIcon.vue';
import { Timer, List } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  players: Player[];
  currentId: string;
  /** Giây còn lại của lượt hiện tại (đồng hồ 30s); null = không dùng. */
  turnLeft?: number | null;
  /** Người vừa được +10s (ghép đúng), kèm key để lặp animation. */
  bonusFor?: { playerId: string; key: number } | null;
  /** Số ván đã thắng trong loạt (theo tên) — cho biết ai đang dẫn cả loạt. */
  seriesWins?: Record<string, number>;
}>();

// Đủ 10 con — bàn local nay tới 10 người, lặp lại là hai người cùng mặt.
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐨', '🦁', '🐷', '🐧', '🐙'];
const avatarOf = (p: Player, i: number): string => p.avatar ?? AVATARS[i % AVATARS.length]!;

/**
 * TỪ 5 NGƯỜI TRỞ LÊN ĐỔI SANG DẢI GỌN.
 *
 * Tới 4 người thì mỗi chip còn ~85px trên iPhone SE — vừa đủ avatar, tên và
 * điểm, nên giữ nguyên dạng cũ (người chơi đã quen). Từ 5 người, chia đều một
 * hàng là mỗi chip 68px rồi 33px ở 10 người: tên biến thành "Ma…" và điểm rơi
 * ra ngoài. Xếp hai hàng thì đọc được tên nhưng ăn thêm 20px chiều cao của bàn
 * thẻ — mà bàn nay tới 88 thẻ, 20px đó thấy rõ.
 *
 * Dải gọn nói đúng hai điều người chơi cần giữa ván: ĐANG TỚI AI (chip lớn có
 * tên + đồng hồ) và SẮP TỚI AI (avatar đầu hàng được tô nền). Tên đầy đủ của
 * những người còn lại đọc ở bảng bên dưới (nút ☰) và ở bảng kết quả cuối ván.
 */
const gon = computed(() => props.players.length > 4);

const nguoiDangDi = computed(() =>
  props.players.find((p) => p.id === props.currentId) ?? props.players[0]!);

/**
 * Những người KHÔNG đang đi, xoay vòng để người ĐI NGAY SAU đứng đầu hàng.
 * Giữ đúng thứ tự lượt: đọc từ trái sang phải là biết mình phải chờ mấy người.
 */
const nhungNguoiKhac = computed(() => {
  const ps = props.players;
  const at = ps.findIndex((p) => p.id === props.currentId);
  const start = at < 0 ? 1 : at + 1;
  return Array.from({ length: ps.length - 1 }, (_, k) => {
    const i = (start + k) % ps.length;
    return { p: ps[i]!, i };
  });
});

/** Bảng đầy đủ (tên, điểm, mạng) — chỉ mở khi người chơi bấm. */
const moBang = ref(false);
// Bàn khác / số người khác thì đóng lại, đừng để bảng treo che bàn mới.
watch(() => props.players.length, () => { moBang.value = false; });
</script>

<template>
  <div class="wrap">
    <!-- TỚI 4 NGƯỜI: dạng cũ, mỗi người một chip có tên -->
    <ul v-if="!gon" class="strip" aria-label="Người chơi">
      <li
        v-for="(p, i) in players"
        :key="p.id"
        class="player panel"
        :class="{ active: p.id === currentId, frozen: p.frozenTurns > 0 }"
        :aria-current="p.id === currentId ? 'true' : undefined"
      >
        <span class="avatar" aria-hidden="true">{{ avatarOf(p, i) }}</span>
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

    <!-- TỪ 5 NGƯỜI: chip lượt + hàng avatar -->
    <div v-else class="strip gon" aria-label="Người chơi">
      <div class="turn-chip" :class="{ frozen: nguoiDangDi.frozenTurns > 0 }" aria-current="true">
        <span class="avatar" aria-hidden="true">{{ avatarOf(nguoiDangDi, players.indexOf(nguoiDangDi)) }}</span>
        <span class="tb">
          <b class="name">{{ nguoiDangDi.name }}</b>
          <span class="sub">
            <template v-if="turnLeft !== null && turnLeft !== undefined">
              <Timer :size="11" /><span :class="{ urgent: turnLeft <= 10 }">{{ Math.ceil(turnLeft) }}s</span> ·
            </template>
            đang đi
          </span>
        </span>
        <Transition name="plus">
          <span v-if="bonusFor && bonusFor.playerId === nguoiDangDi.id" :key="bonusFor.key" class="plus10">+10s</span>
        </Transition>
        <span class="pts" :data-pts-for="nguoiDangDi.id">{{ nguoiDangDi.score }}</span>
        <span class="sr-only">Đang chơi</span>
      </div>

      <ul class="rest">
        <li
          v-for="({ p, i }, k) in nhungNguoiKhac" :key="p.id"
          class="mini" :class="{ next: k === 0, frozen: p.frozenTurns > 0 }"
          :title="`${p.name} — ${p.score} điểm`"
        >
          <span class="avatar" aria-hidden="true">{{ avatarOf(p, i) }}</span>
          <span class="mpts" :data-pts-for="p.id">{{ p.score }}</span>
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

    <!--
      Bảng đầy đủ: nổi ĐÈ lên bàn (position: absolute), không chen vào dòng —
      chen vào là mỗi lần mở lại bóp bàn thẻ nhỏ đi rồi bung ra, thẻ nhảy chỗ
      giữa ván. Sắp theo ĐIỂM, không theo thứ tự lượt: mở bảng là để xem ai
      đang dẫn.
    -->
    <Transition name="sheet">
      <ul v-if="moBang && gon" class="sheet panel" aria-label="Bảng người chơi">
        <li
          v-for="(p, i) in [...players].sort((a, b) => b.score - a.score)" :key="p.id"
          :class="{ active: p.id === currentId }"
        >
          <span class="rank">{{ i + 1 }}</span>
          <span class="avatar" aria-hidden="true">{{ avatarOf(p, players.indexOf(p)) }}</span>
          <b class="name">{{ p.name }}</b>
          <small v-if="Number.isFinite(p.lives)" class="lives">
            <template v-if="p.lives <= 0">💔</template>
            <template v-else-if="p.lives <= 5">{{ '❤️'.repeat(p.lives) }}</template>
            <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
          </small>
          <span v-if="(seriesWins?.[p.name] ?? 0) > 0" class="wins">🏅{{ seriesWins?.[p.name] }}</span>
          <span v-if="p.frozenTurns > 0" class="tag" title="Bị đóng băng"><OptionIcon name="freeze" :size="13" /></span>
          <span v-else-if="p.doubleNext" class="tag" title="Cặp tới nhân đôi điểm"><OptionIcon name="x2" :size="13" /></span>
          <span class="pts">{{ p.score }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
/* Bọc để bảng đầy đủ neo được (absolute) mà không đụng tới dòng của bàn thẻ. */
.wrap { position: relative; }

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
.player.frozen, .mini.frozen, .turn-chip.frozen { opacity: .6; }
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

/* ---------- DẢI GỌN (từ 5 người) ---------- */

.strip.gon { align-items: stretch; }
/* Chip người đang đi: khối gradient đặc, KHÔNG viền nhấp nháy như dạng cũ —
   ở đây nó đã là thứ duy nhất có màu, thêm animation nữa là dải bồn chồn. */
.turn-chip {
  position: relative; flex-shrink: 0;
  display: flex; align-items: center; gap: 7px; padding: 5px 9px;
  border-radius: 12px; color: #fff;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: 0 4px 16px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .3);
}
.turn-chip .tb { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.turn-chip .name { font-family: var(--font-display); font-size: 12.5px; font-weight: 800; max-width: 92px; }
.turn-chip .sub {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9.5px; font-weight: 700; opacity: .92;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
/* Sắp hết giờ: nhấp nháy NGAY TRONG chip lượt — đồng hồ đã ở chỗ mắt đang nhìn */
.turn-chip .sub .urgent { animation: clock-pulse .5s steps(2) infinite; }
.turn-chip .pts {
  margin-left: 2px; font-family: var(--font-display); font-size: 17px; font-weight: 800;
}
.turn-chip .plus10 { color: #fff; }

.rest {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px;
  padding: 0 4px; list-style: none; margin: 0;
  border: 1px solid var(--line); border-radius: 12px; background: var(--panel);
}
.mini {
  flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center;
  border-radius: 9px; padding: 1px 0;
}
/* Người ĐI NGAY SAU: nền nhạt. Chỉ một dấu hiệu, không viền — mười ô có viền
   thì hàng này thành một dãy hộp, mắt không bắt được ô nào đang được chỉ. */
.mini.next { background: var(--accent-soft); }
.mini .avatar { font-size: 15px; line-height: 1.05; }
.mini .mpts {
  font-size: 10px; font-weight: 800; color: var(--muted);
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
.more { flex-shrink: 0; display: flex; align-items: center; }
/* Nút nhỏ mà vùng chạm vẫn phải 44px: nới bằng ::after, KHÔNG phình cái nút
   (phình là dải cao thêm, ăn chỗ của bàn thẻ — đúng thứ dải gọn đang tiết kiệm).
   Phải ghi đè cả min-width/min-height vì `.btn` toàn cục đặt 44px. */
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
.sheet .rank {
  flex-shrink: 0; width: 17px; text-align: center;
  font-family: var(--font-display); font-size: 12px; font-weight: 800; color: var(--muted);
}
.sheet .name { flex: 1; font-size: 13.5px; font-weight: 700; }
.sheet .pts { font-size: 15px; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .14s ease, transform .14s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
