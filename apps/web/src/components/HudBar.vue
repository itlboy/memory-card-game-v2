<script setup lang="ts">
import { t } from '@/lib/i18n';
import { ChevronLeft, Hourglass, Layers, Pause, Star, Timer } from 'lucide-vue-next';
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
}>();

defineEmits<{ quit: []; pause: [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
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
      <span v-if="!multiplayer" class="vien" data-score-target :aria-label="t('hud.diem')">
        <Star :size="16" aria-hidden="true" /><b :key="scoreBump" :class="{ bump: scoreBump }">{{ num(score) }}</b>
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
      <span v-if="!multiplayer && combo > 1" :key="combo" class="vien combo" :class="{ max: combo >= 2 }" aria-label="Combo">
        <b>x{{ combo }}</b>
      </span>
    </div>
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
.vien-hang { flex: 1; min-width: 0; display: flex; justify-content: center; align-items: center; gap: 6px; flex-wrap: nowrap; }
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
  display: inline-flex; align-items: center; gap: 5px; min-width: 0;
  height: 34px; padding: 0 11px; border-radius: 999px; white-space: nowrap;
  background: var(--panel-solid); color: var(--fg);
  border: var(--vien-vien, 1px solid var(--line)); box-shadow: var(--elev-1);
}
.vien b { font-family: var(--font-display); font-weight: 800; font-size: 16px; line-height: 1; font-variant-numeric: tabular-nums; }
.vien b i { font-style: normal; color: var(--muted); font-size: 13px; }
.vien svg { flex: none; color: var(--accent); }
.vien.urgent b, .vien.urgent svg { color: var(--bad); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.vien.combo { background: var(--chon-nen); color: var(--chon-chu); animation: bump .3s cubic-bezier(.3, 1.6, .5, 1); }
.vien.combo.max { background: var(--nhan-nen); color: var(--nhan-chu); }
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
/* Vạch tiến độ: nằm trong khe 10px giữa HUD và bàn (gap của .game) */
.tien-do {
  position: absolute; left: 52px; right: 52px; bottom: -8px; height: 4px; border-radius: 2px;
  background: color-mix(in srgb, var(--fg) 14%, transparent); overflow: hidden;
}
.tien-do i { display: block; height: 100%; background: var(--ok); transform-origin: left; transition: transform .4s ease; }
/* Máy hẹp (SE): viên co lại trước khi phải ẩn */
@media (max-width: 380px) {
  .vien { padding: 0 8px; gap: 4px; }
  .vien b { font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) { .vien.hurt, .vien.combo { animation: none; } }
</style>
