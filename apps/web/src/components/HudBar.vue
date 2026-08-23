<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { computed } from 'vue';
import { clock, num } from '@/lib/format';

const props = defineProps<{
  score: number;
  moves: number;
  matched: number;
  totalPairs: number;
  combo: number;
  elapsed: number;
  timeLeft: number | null;
  movesLeft: number | null;
  lives: number | null;
  levelId?: number;
  /** Nhiều người chơi: ẩn Điểm/Lượt/Combo — các số này nằm trong chip từng người. */
  multiplayer?: boolean;
  /** Đổi số này để con số Điểm nảy một nhịp (khi điểm vừa bay tới). */
  scoreBump?: number;
}>();

defineEmits<{ quit: [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
/* Nhãn thời gian là BIỂU TƯỢNG, không phải chữ: cả HUD giờ nằm một dòng, mà
 * "Thời gian" một mình đã ăn ~70px trong 320px bề ngang. Đồng hồ = đang đếm
 * lên, cát chảy = đang đếm ngược. */
const timeLabel = computed(() => (props.timeLeft === null ? '⏱' : '⏳'));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
</script>

<template>
  <div class="hud panel">
    <div class="stats">
    <div v-if="levelId" class="stat"><span>Cấp</span><b>{{ levelId }}</b></div>
    <div v-if="!multiplayer" class="stat" data-score-target>
      <span>Điểm</span><b :key="scoreBump" :class="{ bump: scoreBump }">{{ num(score) }}</b>
    </div>
    <div v-if="!multiplayer" class="stat"><span>Lượt</span><b>{{ moves }}<i v-if="movesLeft !== null">/{{ moves + movesLeft }}</i></b></div>
    <div class="stat"><span>Cặp</span><b>{{ matched }}/{{ totalPairs }}</b></div>
    <div class="stat" :class="{ urgent }"><span>{{ timeLabel }}</span><b>{{ timeText }}</b></div>
    <!-- Combo và Mạng KHÔNG cần nhãn: "x2" và "❤️ 5" tự nói ra nó là gì, mà
         hai chữ đó ăn hơn 90px của một dòng chỉ rộng 320px. -->
    <div v-if="!multiplayer" class="stat combo" :class="{ hot: combo >= 1.5, max: combo >= 2 }">
      <b :key="combo" aria-label="Combo">x{{ combo }}</b>
    </div>
    <div v-if="lives !== null" class="stat">
      <b aria-label="Mạng còn lại">{{ lives > 0 ? `❤️ ${lives}` : '—' }}</b>
    </div>
    </div>
    <button class="btn quit" aria-label="Thoát về menu" type="button" @click="$emit('quit')"><X :size="20" /></button>
  </div>
</template>

<style scoped>
/* Nút thoát KHÔNG nằm cùng dòng wrap với các số: trước đây nhiều chỉ số
   (Màn·Điểm·Lượt·Cặp·Còn lại·Combo·Mạng) đẩy nó rơi xuống hàng dưới. Giờ các
   số wrap trong .stats, nút luôn dính góc phải. */
.hud { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.stats { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
/*
 * Nút thoát giữ NGUYÊN vùng chạm 44px (NF-07) nhưng không được kéo cao cả HUD:
 * `margin-block` âm cho nó tràn ra ngoài dòng, chiều cao HUD do các con số
 * quyết định. Bỏ 44px để HUD thấp lại là sai — ngón tay không bấm được.
 */
.quit {
  flex-shrink: 0; width: 44px; height: 44px; padding: 0;
  margin-block: -10px;
}
/* Cùng một dòng thì phải có vạch ngăn, không thì "Cấp 8 Cặp 0/8" đọc thành một
   chuỗi số liền nhau. */
.stat + .stat { border-left: 1px solid var(--line); padding-left: 6px; }
/* Nhãn và số NẰM CÙNG DÒNG ("Cấp 8"), không xếp chồng: xếp chồng làm HUD cao
   gấp đôi trong khi bề ngang vẫn còn dư chỗ — mà chiều cao ở đây lấy từ bàn thẻ. */
.stat { display: flex; flex-direction: row; align-items: baseline; gap: 4px; min-width: 0; }
/* Cột app luôn hẹp (≤440px) nên đây là bố cục duy nhất, không đặt trong media
   query: 6 chỉ số của Sinh tồn phải vừa MỘT dòng, trước đây vượt vài pixel nên
   xuống hàng làm HUD cao gấp đôi. */
.hud { gap: 6px; padding: 8px 10px; }
.stats { gap: 6px; }
/* Nhãn KHÔNG in hoa và không giãn chữ: in hoa + letter-spacing làm mỗi nhãn
   rộng thêm ~12%, đủ để 7 chỉ số của Sinh tồn tràn xuống dòng hai. */
/* Cả HUD gói trong MỘT dòng thấp: nhãn không in hoa (in hoa + letter-spacing
   rộng thêm ~12%, đủ để 7 chỉ số của Sinh tồn tràn xuống dòng hai), số 15px
   thay vì --text-lg, và padding mỏng — chiều cao ở đây là chỗ lấy từ bàn thẻ. */
.stat span { font-size: 9.5px; letter-spacing: 0; text-transform: none; }
.stat b { font-size: 15px; line-height: 1.1; }
.stat { gap: 3px; }
.stat + .stat { padding-left: 4px; }
.hud { gap: 4px; padding: 7px 8px; }
.stats { gap: 4px; }
.stat span { color: var(--muted); font-weight: 700; }
.stat b {
  font-variant-numeric: tabular-nums; font-family: var(--font-display);
}
.stat b i { font-style: normal; color: var(--muted); font-weight: 400; font-size: 13px; }
/* Điểm vừa được cộng bay tới: con số nảy và thắp vàng — nối liền hiệu ứng
   trên bàn với chỗ điểm thật sự được ghi */
.stat b.bump { animation: score-bump .4s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes score-bump {
  45% { transform: scale(1.4); color: var(--gold); }
}
.stat.urgent b { color: var(--bad); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.combo b { display: inline-block; animation: bump .3s cubic-bezier(.3, 1.6, .5, 1); }
.combo.hot b { color: var(--warn); }
.combo.max b {
  color: var(--gold);
  text-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent);
}
@keyframes bump { 40% { transform: scale(1.35); } }
</style>
