<script setup lang="ts">
import { t } from '@/lib/i18n';
import { ChevronLeft, Hourglass, Layers, Pause, RotateCcw, Star, Timer } from 'lucide-vue-next';
import OptionIcon from './OptionIcon.vue';
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
  /** Khoá đổi mỗi lần MẤT mạng — dùng để chạy lại hiệu ứng giật đỏ. */
  lifeLostKey?: number;
  levelId?: number;
  /** Nhiều người chơi: ẩn Điểm/Lượt/Combo — các số này nằm trong chip từng người. */
  multiplayer?: boolean;
  /** Đổi số này để con số Điểm nảy một nhịp (khi điểm vừa bay tới). */
  scoreBump?: number;
  /** Có nút tạm dừng không — chỉ ván offline (online: đồng hồ ở server, người khác đang chờ). */
  pausable?: boolean;
  /** Chiến dịch: số lần sai tối đa cho 2★/3★ và số lần đã sai — viên sao sống. */
  starMisses?: readonly [number, number];
  misses?: number;
  /** Có nút CHƠI LẠI không — ván một mình / đấu máy (chủ dự án 16.10.2026); ván nhiều
   *  người chung máy thì không (bỏ ván của cả bàn chỉ vì một người bấm là không công bằng). */
  choiLai?: boolean;
}>();

defineEmits<{ quit: []; pause: []; 'choi-lai': [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
/** Sao đang giữ được nếu ván kết thúc ngay bây giờ, và còn được sai bao nhiêu
 *  lần trước khi rớt sao kế tiếp (1★ thì không còn gì để giữ). */
const soSao = computed(() => {
  const m = props.misses ?? 0, [max2, max3] = props.starMisses ?? [0, 0];
  return m <= max3 ? 3 : m <= max2 ? 2 : 1;
});
/** Còn được quên bao nhiêu lần trước khi rớt sao kế tiếp. Chưa quên lần nào
 *  thì ngôi thứ 4 còn sáng và lần quên đầu tiên là mất nó — không cần con số. */
const conLai = computed(() => {
  const m = props.misses ?? 0, [max2, max3] = props.starMisses ?? [0, 0];
  if (m === 0) return null;
  return soSao.value === 3 ? max3 - m : soSao.value === 2 ? max2 - m : null;
});
const sao4 = computed(() => (props.misses ?? 0) === 0);
const tienDo = computed(() => (props.totalPairs ? props.matched / props.totalPairs : 0));
</script>

<!--
  HUD GỌN (13.10.2026, theo mockup chủ dự án duyệt): nút thoát · các VIÊN số ·
  nút tạm dừng. Bản cũ dồn 6–7 chỉ số kèm nhãn chữ vào một dải ("Cấp 15 | Điểm
  770 | Lượt 5 | Cặp 5/12 | 0:10 | x2") — chủ dự án chê "gộp hơi xấu". Nay:
  · mỗi số là một viên có ICON, không nhãn chữ (nhãn nằm ở aria-label);
  · chỉ hiện thứ đang có nghĩa: mạng / giới hạn lượt chỉ khi luật đó bật,
    combo chỉ khi đang lên chuỗi;
  · số cặp thành VẠCH TIẾN ĐỘ mảnh dưới đáy, nằm trong khe sẵn có giữa HUD và
    bàn (absolute) — không lấy thêm px nào của bàn thẻ;
  · cấp Chiến dịch chuyển vào màn tạm dừng.
-->
<template>
  <div class="hud">
    <button class="tron quit" :aria-label="t('hud.thoat')" type="button" @click="$emit('quit')"><ChevronLeft :size="22" /></button>
    <div class="vien-hang">
      <span class="vien" :class="{ urgent }" :aria-label="t('hud.thoiGian')">
        <component :is="timeLeft === null ? Timer : Hourglass" :size="16" aria-hidden="true" /><b>{{ timeText }}</b>
      </span>
      <span v-if="!multiplayer" class="vien diem" data-score-target :aria-label="t('hud.diem')">
        <Star :size="16" aria-hidden="true" /><b :key="scoreBump" :class="{ bump: scoreBump }">{{ num(score) }}</b>
        <!-- COMBO là huy hiệu ở góc viên điểm, KHÔNG phải một viên trong hàng: viên
             riêng bật/tắt mỗi chuỗi làm cả hàng xô lệch và ép các viên kia tràn chữ
             trên iPhone (chủ dự án báo 14.10.2026, đo được ở cả ba cỡ máy). -->
        <span v-if="combo > 1" :key="combo" class="combo" :class="{ max: combo >= 2 }" aria-label="Combo">x{{ combo }}</span>
      </span>
      <!-- SAO SỐNG (Chiến dịch, 14.10.2026): sai quá mốc là một sao tắt ngay trước
           mắt — người chơi hiểu luật sao mà không phải đọc chữ nào. Số nhỏ là số
           lần còn được sai trước khi rớt sao kế tiếp. key đổi → nhịp rớt sao. -->
      <span
        v-if="!multiplayer && starMisses" :key="`sao-${soSao}-${sao4}`" class="vien sao" :class="{ rot: !sao4 }"
        :aria-label="sao4 ? t('hud.sao4') : conLai === null ? t('hud.sao1', { n: soSao }) : t('hud.sao', { n: soSao, m: conLai })"
      >
        <span class="sao-hang" aria-hidden="true"><i v-for="i in 3" :key="i" :class="{ tat: i > soSao }">★</i><i class="sao4" :class="sao4 ? 'song' : 'tat'">★</i></span>
        <b v-if="conLai !== null" aria-hidden="true">{{ conLai }}</b>
      </span>
      <span v-if="!multiplayer && movesLeft !== null" class="vien" :aria-label="t('hud.luot')">
        <Layers :size="16" aria-hidden="true" /><b>{{ moves }}<i>/{{ moves + movesLeft }}</i></b>
      </span>
      <span
        v-if="lives !== null" :key="`hp-${lifeLostKey ?? 0}`" class="vien"
        :class="{ hurt: (lifeLostKey ?? 0) > 0 }" :aria-label="t('hud.mangConLai')"
      >
        <OptionIcon name="lives" :size="16" /><b>{{ lives > 0 ? lives : '—' }}</b>
      </span>
    </div>
    <button v-if="choiLai" class="tron" :aria-label="t('hud.choiLai')" type="button" @click="$emit('choi-lai')"><RotateCcw :size="18" /></button>
    <button v-if="pausable" class="tron" :aria-label="t('hud.tamDung')" type="button" @click="$emit('pause')"><Pause :size="18" /></button>
    <span v-else class="tron-cho" aria-hidden="true" />
    <span
      class="tien-do" role="progressbar" :aria-label="t('hud.cap2')"
      :aria-valuenow="matched" aria-valuemin="0" :aria-valuemax="totalPairs"
    ><i :style="{ transform: `scaleX(${tienDo})` }" /><span class="sr-only">{{ matched }}/{{ totalPairs }}</span></span>
  </div>
</template>

<style scoped>
.hud { position: relative; display: flex; align-items: center; gap: 8px; min-height: 44px; }
.vien-hang {
  flex: 1; min-width: 0; display: flex; justify-content: center; align-items: center; gap: 6px; flex-wrap: nowrap;
  container-type: inline-size;
}
/* Nút tròn 44px (NF-07) — hình và vùng chạm trùng nhau, không cần ::after */
.tron {
  flex: none; width: 44px; height: 44px; border-radius: 50%; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--panel-solid); color: var(--fg);
  border: var(--vien-nut, 1px solid var(--line)); box-shadow: var(--elev-1);
}
.tron:active { transform: translateY(2px); }
.tron-cho { flex: none; width: 44px; }
.vien {
  /* flex: none — viên KHÔNG BAO GIỜ co nhỏ hơn chữ (min-width: 0 cũ cho nó co,
     chữ lòi ra ngoài viên). Hết chỗ thì khối @container dưới gọn cả hàng. */
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  height: 34px; padding: 0 11px; border-radius: 999px; white-space: nowrap;
  background: var(--panel-solid); color: var(--fg);
  border: var(--vien-vien, 1px solid var(--line)); box-shadow: var(--elev-1);
}
.vien b { font-family: var(--font-display); font-weight: 800; font-size: 16px; line-height: 1; font-variant-numeric: tabular-nums; }
.vien b i { font-style: normal; color: var(--muted); font-size: 13px; }
.vien svg { flex: none; color: var(--accent); }
.vien.urgent b, .vien.urgent svg { color: var(--bad); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.vien.diem { position: relative; }
.combo {
  position: absolute; top: -9px; right: -9px; z-index: 1;
  padding: 1px 6px; border-radius: 999px; font: 800 11px/1.3 var(--font-display);
  background: var(--chon-nen); color: var(--chon-chu); box-shadow: var(--elev-1);
  animation: bump .3s cubic-bezier(.3, 1.6, .5, 1);
}
.combo.max { background: var(--nhan-nen); color: var(--nhan-chu); }
@keyframes bump { 40% { transform: scale(1.25); } }
/* Điểm vừa được cộng bay tới: con số nảy và thắp vàng */
.vien b.bump { display: inline-block; animation: score-bump .4s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes score-bump { 45% { transform: scale(1.4); color: var(--gold); } }
.vien :deep(.opt-ico) { border-radius: 4px; }
/* Vừa mất một mạng: giật đỏ một nhịp (key đổi → chạy lại từ đầu) */
.vien.hurt { animation: hp-hurt .55s ease-out; }
.vien.hurt b { color: var(--bad); }
@keyframes hp-hurt {
  18% { transform: scale(1.3); filter: drop-shadow(0 0 8px var(--bad)); }
  40% { transform: scale(.95) translateX(-3px); }
  60% { transform: scale(1.05) translateX(3px); }
  100% { transform: none; }
}
/* Viên sao sống: ngôi tắt xám; vừa rớt sao thì cả viên giật một nhịp */
.sao-hang { display: inline-flex; gap: 1px; font-size: 14px; line-height: 1; letter-spacing: 0; }
.sao-hang i { font-style: normal; color: var(--gold); }
.sao-hang i.tat { color: color-mix(in srgb, var(--fg) 22%, transparent); }
/* Ngôi thứ 4: trả màu chữ về trong suốt để dải cầu vồng (.sao4 ở global.css)
   hiện ra — rule vàng ngay trên đè mất nó (đo bằng ảnh 14.10.2026) */
.sao-hang i.sao4:not(.tat) { color: transparent; }
.vien.sao b { font-size: 14px; color: var(--muted); }
.vien.sao.rot { animation: hp-hurt .55s ease-out; }
/* Vạch tiến độ: nằm trong khe 10px giữa HUD và bàn (gap của .game) */
.tien-do {
  position: absolute; left: 52px; right: 52px; bottom: -8px; height: 4px; border-radius: 2px;
  background: color-mix(in srgb, var(--fg) 14%, transparent); overflow: hidden;
}
.tien-do i { display: block; height: 100%; background: var(--ok); transform-origin: left; transition: transform .4s ease; }
/* Hàng hẹp: GỌN ĐỀU cả hàng (đệm, icon, chữ) theo bề rộng THẬT của hàng, không
   theo cỡ màn — ca xấu nhất "8:42 · 12.345 · ★★★★ 12" cần ~250px ở cỡ thường. */
@container (max-width: 320px) {
  .vien { padding: 0 8px; gap: 4px; }
  .vien b { font-size: 15px; }
  .vien svg { width: 14px; height: 14px; }
  .sao-hang { font-size: 12px; }
  .vien.sao b { font-size: 13px; }
}
@container (max-width: 270px) {
  .vien { padding: 0 6px; gap: 3px; }
  .vien b { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) { .vien.hurt, .combo, .vien.sao.rot { animation: none; } }
</style>
