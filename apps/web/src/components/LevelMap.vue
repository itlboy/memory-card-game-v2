<script setup lang="ts">
import { allLevels } from '@mm/engine';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { LevelProgress } from '@/lib/storage';
import { starText } from '@/lib/format';

const props = defineProps<{
  progress: Record<string, LevelProgress>;
  unlocked: number;
  /** Số biểu tượng của các theme đang chọn. Cấp độ cần nhiều cặp hơn số này thì
   *  KHÔNG dựng được bàn — phải chặn ở đây, không thì engine ném lỗi và màn
   *  hình trắng xoá. */
  symbolCount: number;
  /** Chiến dịch xếp sao; các chế độ khác chỉ đánh dấu đã qua. */
  showStars?: boolean;
}>();
const emit = defineEmits<{ play: [id: number] }>();

const levels = allLevels();
const totalStars = computed(() => Object.values(props.progress).reduce((n, p) => n + p.stars, 0));
const cleared = computed(() => Object.values(props.progress).filter((p) => p.stars > 0).length);
/** Cấp cần chơi tiếp: đã mở khoá nhưng chưa qua. Bản đồ phải chỉ rõ đi đâu
 *  tiếp, không thì người chơi phải tự dò trong 50 ô giống nhau. */
const nextLevel = computed(() =>
  levels.find((l) => l.id <= props.unlocked && (props.progress[String(l.id)]?.stars ?? 0) === 0)?.id ?? null);
/** Cấp đòi nhiều biểu tượng hơn bộ theme đang chọn. */
const needsMore = (l: { pairs: number }): boolean => l.pairs > props.symbolCount;
const blocked = computed(() => levels.filter((l) => l.id <= props.unlocked && needsMore(l)).length);

/* Cuộn tới cấp đang chờ chơi. 50 ô không vừa một màn hình, mà mở ra thấy cấp 1
   thì người chơi đã qua 20 cấp phải tự cuộn đi tìm mỗi lần vào. */
const list = ref<HTMLElement | null>(null);
async function scrollToNext(): Promise<void> {
  await nextTick();
  const el = list.value?.querySelector<HTMLElement>('.node.next, .node.last-cleared');
  if (!el || !list.value) return;
  // scrollIntoView cuộn cả trang trên một số trình duyệt; tính tay để CHỈ khung này cuộn
  list.value.scrollTop = Math.max(0, el.offsetTop - list.value.clientHeight / 2 + el.offsetHeight / 2);
}
onMounted(scrollToNext);
watch(nextLevel, scrollToNext);
</script>

<template>
  <div class="wrap">
    <p class="summary">
      <template v-if="showStars">Đã đạt <b>{{ totalStars }}</b> / {{ levels.length * 3 }} sao</template>
      <template v-else>Đã qua <b>{{ cleared }}</b> / {{ levels.length }} cấp</template>
      <span v-if="blocked" class="need-theme">· cần thêm theme cho {{ blocked }} cấp lớn</span>
    </p>
    <!-- Ngoại lệ DUY NHẤT của luật không scroll: 50 cấp không thể nén vừa một
         màn hình mà ô vẫn đủ 44px để bấm. Cuộn nằm TRONG khung này, cả trang
         vẫn khoá 100dvh. -->
    <ol ref="list" class="map">
      <li v-for="l in levels" :key="l.id">
        <button
          class="node"
          :class="{
            locked: l.id > unlocked,
            cleared: (progress[String(l.id)]?.stars ?? 0) > 0,
            'last-cleared': l.id === unlocked - 1,
            next: l.id === nextLevel && !needsMore(l),
            nosym: l.id <= unlocked && needsMore(l)
          }"
          :disabled="l.id > unlocked || needsMore(l)"
          :aria-label="`Cấp ${l.id}, ${l.pairs * 2} thẻ${
            l.id > unlocked ? ', chưa mở khoá' : needsMore(l) ? ', cần chọn thêm theme' : ''
          }`"
          type="button"
          @click="emit('play', l.id)"
        >
          <b>{{ l.id }}</b>
          <!-- Ghi SỐ THẺ chứ không ghi cỡ lưới: năm cấp cuối đều nằm trong bàn
               10×10 (chỉ khác số ô trống), ghi lưới thì nhìn như lặp lại. -->
          <small>{{ l.pairs * 2 }} thẻ</small>
          <span v-if="l.id > unlocked" class="stars">🔒</span>
          <span v-else-if="showStars" class="stars">{{ starText(progress[String(l.id)]?.stars ?? 0) }}</span>
          <span v-else-if="(progress[String(l.id)]?.stars ?? 0) > 0" class="stars">✓</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.summary { margin: 0 0 8px; color: var(--muted); font-size: 14px; }
/* 5 cột để tròn hàng (50 = 5×10). Hàng cao cố định + cuộn dọc: nén 50 ô vào
   chỗ còn lại thì mỗi ô chỉ còn ~30px, dưới ngưỡng chạm 44px (NF-07). */
.map {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: 62px;
  gap: 8px; list-style: none; margin: 0; padding: 2px;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;   /* cuộn hết bản đồ thì KHÔNG kéo theo cả trang */
}
li { display: flex; min-height: 0; align-items: stretch; }
.node {
  width: 100%; height: 100%; min-height: 0;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 1px; padding: 4px 2px; overflow: hidden;
  border: 2px solid var(--line); border-radius: 12px; background: var(--panel-soft);
  container-type: inline-size;   /* số cấp co theo cỡ ô, như các ô lựa chọn khác */
}
.node b { font-family: var(--font-display); font-weight: 800; font-size: clamp(16px, 24cqw, 26px); }
.node small { color: var(--muted); font-size: clamp(9px, 13cqw, 13px); white-space: nowrap; }
.node .stars { font-size: clamp(10px, 14cqw, 15px); color: var(--gold); letter-spacing: 1px; }

/* Đã qua: nền xanh nhạt + viền xanh, đọc được ngay là "xong rồi" */
.node.cleared {
  border-color: var(--ok);
  background: color-mix(in srgb, var(--ok) 14%, var(--panel-soft));
}
/* Cấp cần chơi tiếp: ô duy nhất mang gradient thương hiệu — mắt tìm thấy ngay */
.node.next {
  border-color: transparent; color: #fff;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  /* Bóng trung tính, không glow màu — glow lan vào khe giữa các ô làm chúng dính vào nhau */
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
}
.node.next small { color: rgba(255, 255, 255, .85); }
/* Sao vàng trên nền tím gần như không đọc được */
.node.next .stars { color: rgba(255, 255, 255, .9); }
/* Khoá: mờ nhưng vẫn đọc được số cấp và số thẻ — .45 nhợt quá, mất cấu trúc */
.node.locked { opacity: .6; background: transparent; }
/* Đã mở nhưng bộ theme đang chọn không đủ biểu tượng cho bàn này */
.node.nosym {
  border-color: color-mix(in srgb, var(--warn) 60%, var(--line));
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  opacity: .85;
}
.need-theme { color: var(--warn); font-weight: 700; }
</style>
