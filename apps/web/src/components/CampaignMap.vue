<script setup lang="ts">
import { allLevels } from '@mm/engine';
import { computed } from 'vue';
import type { LevelProgress } from '@/lib/storage';
import { starText } from '@/lib/format';

const props = defineProps<{
  progress: Record<string, LevelProgress>;
  unlocked: number;
  /** Số biểu tượng của các theme đang chọn. Màn cần nhiều cặp hơn số này thì
   *  KHÔNG dựng được bàn — phải chặn ở đây, không thì engine ném lỗi và màn
   *  hình trắng xoá. */
  symbolCount: number;
}>();
const emit = defineEmits<{ play: [id: number] }>();

const levels = allLevels();
const totalStars = computed(() => Object.values(props.progress).reduce((n, p) => n + p.stars, 0));
/** Màn cần chơi tiếp: đã mở khoá nhưng chưa có sao nào. Bản đồ phải chỉ rõ đi
 *  đâu tiếp, không thì người chơi phải tự dò trong 20 ô giống nhau. */
const nextLevel = computed(() =>
  levels.find((l) => l.id <= props.unlocked && (props.progress[String(l.id)]?.stars ?? 0) === 0)?.id ?? null);
const pairsOf = (l: { cols: number; rows: number }): number => Math.floor((l.cols * l.rows) / 2);
/** Màn đòi nhiều biểu tượng hơn bộ theme đang chọn. */
const needsMore = (l: { cols: number; rows: number }): boolean => pairsOf(l) > props.symbolCount;
/** Màn bị chặn vì thiếu biểu tượng — nhắc người chơi bật thêm theme. */
const blocked = computed(() => levels.filter((l) => l.id <= props.unlocked && needsMore(l)).length);
</script>

<template>
  <div class="wrap">
    <p class="summary">
      Đã đạt <b>{{ totalStars }}</b> / {{ levels.length * 3 }} sao
      <span v-if="blocked" class="need-theme">· cần thêm theme cho {{ blocked }} màn lớn</span>
    </p>
    <ol class="map">
      <li v-for="l in levels" :key="l.id">
        <button
          class="node"
          :class="{
            locked: l.id > unlocked,
            cleared: (progress[String(l.id)]?.stars ?? 0) > 0,
            next: l.id === nextLevel && !needsMore(l),
            nosym: l.id <= unlocked && needsMore(l)
          }"
          :disabled="l.id > unlocked || needsMore(l)"
          :aria-label="`Màn ${l.id}, lưới ${l.cols}×${l.rows}, ${l.timeLimit} giây${
            l.id > unlocked ? ', chưa mở khoá' : needsMore(l) ? ', cần chọn thêm theme' : ''
          }`"
          type="button"
          @click="emit('play', l.id)"
        >
          <b>{{ l.id }}</b>
          <small>{{ l.cols }}×{{ l.rows }}</small>
          <span class="stars">{{ l.id > unlocked ? '🔒' : starText(progress[String(l.id)]?.stars ?? 0) }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* KHÔNG SCROLL: 30 màn nén vừa chỗ còn lại. 5 cột để TRÒN HÀNG (30 = 5×6);
   4 cột cho hàng cuối lẻ 2 ô, trông như thiếu. */
.wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.summary { margin: 0 0 8px; color: var(--muted); font-size: 14px; }
.map {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: minmax(0, 1fr); overflow: hidden;
  gap: 8px; list-style: none; margin: 0; padding: 0;
}
/* Ô LẤP TRỌN hàng. Trước đây `max-height: 96px` giữ ô ở 72px trong hàng cao
   125px, để lại khoảng trắng lớn giữa các hàng nên 20 màn nhìn rời rạc chứ
   không ra một bản đồ. */
li { display: flex; min-height: 0; align-items: stretch; }
.node {
  width: 100%; height: 100%; min-height: 0;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; padding: 4px 2px; overflow: hidden;
  border: 2px solid var(--line); border-radius: 12px; background: var(--panel-soft);
  container-type: inline-size;   /* số màn co theo cỡ ô, như các ô lựa chọn khác */
}
.node b { font-family: var(--font-display); font-weight: 800; font-size: clamp(18px, 26cqw, 30px); }
.node small { color: var(--muted); font-size: clamp(11px, 15cqw, 15px); }
.node .stars { font-size: clamp(11px, 15cqw, 17px); color: var(--gold); letter-spacing: 1px; }

/* Đã qua: nền xanh nhạt + viền xanh, đọc được ngay là "xong rồi" */
.node.cleared {
  border-color: var(--ok);
  background: color-mix(in srgb, var(--ok) 14%, var(--panel-soft));
}
/* Màn cần chơi tiếp: ô duy nhất mang gradient thương hiệu — mắt tìm thấy ngay */
.node.next {
  border-color: transparent; color: #fff;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  /* Bóng trung tính, không glow màu — glow lan vào khe giữa các ô làm chúng dính vào nhau */
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
}
.node.next small { color: rgba(255, 255, 255, .85); }
/* Sao vàng trên nền tím gần như không đọc được */
.node.next .stars { color: rgba(255, 255, 255, .9); }
/* Khoá: mờ nhưng vẫn đọc được số màn và cỡ lưới — .45 nhợt quá, mất cấu trúc */
.node.locked { opacity: .6; background: transparent; }
/* Đã mở nhưng bộ theme đang chọn không đủ biểu tượng cho bàn này */
.node.nosym {
  border-color: color-mix(in srgb, var(--warn) 60%, var(--line));
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  opacity: .85;
}
.need-theme { color: var(--warn); font-weight: 700; }
</style>
