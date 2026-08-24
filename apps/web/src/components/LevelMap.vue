<script setup lang="ts">
import { CHAPTERS, allLevels, type Level } from '@mm/engine';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Lock, TriangleAlert } from 'lucide-vue-next';
import type { LevelProgress } from '@/lib/storage';
import { starText } from '@/lib/format';

const props = defineProps<{
  progress: Record<string, LevelProgress>;
  unlocked: number;
  /** Số biểu tượng lớn nhất có thể gom được. Cấp cần nhiều cặp hơn số này thì
   *  KHÔNG bộ theme nào dựng được bàn — phải chặn ở đây, không thì engine ném
   *  lỗi và màn hình trắng xoá. */
  symbolCount: number;
  /** Chiến dịch xếp sao; các chế độ khác chỉ đánh dấu đã qua. */
  showStars?: boolean;
}>();
const emit = defineEmits<{ play: [id: number] }>();

const levels = allLevels();
const starsOf = (id: number): number => props.progress[String(id)]?.stars ?? 0;
const cleared = (id: number): boolean => starsOf(id) > 0;
const needsMore = (l: Level): boolean => l.pairs > props.symbolCount;

/** Cấp cần chơi tiếp: đã mở khoá nhưng chưa qua. Bản đồ phải chỉ rõ đi đâu
 *  tiếp, không thì người chơi phải tự dò trong 50 ô giống nhau. */
const nextLevel = computed(() =>
  levels.find((l) => l.id <= props.unlocked && !cleared(l.id))?.id ?? null);

const doneCount = computed(() => levels.filter((l) => cleared(l.id)).length);
const totalStars = computed(() => levels.reduce((n, l) => n + starsOf(l.id), 0));

/** Mỗi chặng kèm sẵn số liệu để template không phải tính trong v-for. */
const chapters = computed(() => CHAPTERS.map((c) => {
  const list = levels.filter((l) => l.id >= c.from && l.id <= c.to);
  const done = list.filter((l) => cleared(l.id)).length;
  return {
    ...c, list, done,
    /* Chặng coi là "đang chơi" nếu cấp cần chơi tiếp nằm trong nó — thẻ đó được
       thắp sáng để mắt tìm thấy ngay giữa bốn thẻ. */
    active: nextLevel.value != null && nextLevel.value >= c.from && nextLevel.value <= c.to,
    /* Khoá cả chặng: chưa mở tới cấp đầu tiên của nó. */
    locked: c.from > props.unlocked,
    cards: list[0]!.pairs === list.at(-1)!.pairs
      ? `${list[0]!.pairs * 2} thẻ`
      : `${list[0]!.pairs * 2} – ${list.at(-1)!.pairs * 2} thẻ`,
    /* Nhiều cấp trong chặng dùng chung một cỡ bàn, khác nhau ở thời gian. Nói
       ra, không thì người chơi thấy hai cấp cùng cỡ bàn và tưởng game lặp. */
    byTime: new Set(list.map((l) => l.pairs)).size < list.length,
    blocked: list.filter((l) => l.id <= props.unlocked && needsMore(l)).length
  };
}));

/* Cuộn tới chặng đang chơi. Mở ra mà thấy chặng 1 thì người đã qua 20 cấp phải
   tự cuộn đi tìm mỗi lần vào. */
const list = ref<HTMLElement | null>(null);
async function scrollToActive(): Promise<void> {
  await nextTick();
  const el = list.value?.querySelector<HTMLElement>('.chapter.active');
  if (!el || !list.value) return;
  // scrollIntoView cuộn cả trang trên một số trình duyệt; tính tay để CHỈ khung này cuộn
  list.value.scrollTop = Math.max(0, el.offsetTop - 8);
}
onMounted(scrollToActive);
watch(nextLevel, scrollToActive);
</script>

<template>
  <div class="wrap">
    <p class="summary">
      <template v-if="showStars">
        Đã đạt <b>{{ totalStars }}</b> / {{ levels.length * 3 }} sao
      </template>
      <template v-else>Đã qua <b>{{ doneCount }}</b> / {{ levels.length }} cấp</template>
    </p>

    <!-- Ngoại lệ DUY NHẤT của luật không scroll: 50 cấp không thể nén vừa một
         màn hình mà ô vẫn đủ 44px để bấm. Cuộn nằm TRONG khung này, cả trang
         vẫn khoá 100dvh. -->
    <div ref="list" class="chapters">
      <section
        v-for="c in chapters" :key="c.id"
        class="chapter" :class="{ active: c.active, locked: c.locked, done: c.done === c.list.length }"
      >
        <header>
          <h3>Chặng {{ c.id }} · {{ c.name }}</h3>
          <Lock v-if="c.locked" class="ch-lock" :size="15" />
          <b v-else class="tally">{{ c.done }}/{{ c.list.length }}</b>
        </header>

        <ol class="nodes">
          <li v-for="l in c.list" :key="l.id">
            <button
              class="node"
              :class="{
                locked: l.id > unlocked,
                cleared: cleared(l.id),
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
              <!-- SỐ THẺ LUÔN HIỆN, mọi trạng thái: đây là thông tin để chọn cấp.
                   Trước đây nó nằm trong nhánh v-else của phần sao, nên cấp ĐÃ QUA
                   hiện sao thay cho số thẻ — mất đúng thứ người chơi cần. Sao và
                   ổ khoá chuyển thành dấu ở GÓC nên không giành chỗ của nó. -->
              <small>{{ l.pairs * 2 }} thẻ</small>
              <span v-if="cleared(l.id)" class="stars" aria-hidden="true">
                {{ showStars ? starText(starsOf(l.id)) : '✓' }}
              </span>
              <Lock v-if="l.id > unlocked" class="node-lock" :size="10" aria-hidden="true" />
            </button>
          </li>
        </ol>

        <footer>
          <span>{{ c.cards }}<template v-if="c.byTime"> · giờ siết dần</template></span>
          <span v-if="c.blocked" class="need-theme">
            <TriangleAlert :size="13" /> {{ c.blocked }} cấp cần thêm theme
          </span>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.summary { margin: 0 0 8px; color: var(--muted); font-size: var(--text-sm); }
.chapters {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;   /* cuộn hết bản đồ thì KHÔNG kéo theo cả trang */
  padding: 2px;
}

/* ---------- thẻ một chặng ---------- */

.chapter {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--panel-soft); padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
/* Chặng đang chơi: viền tím + bóng, ô duy nhất mắt dừng lại ở giữa bốn thẻ */
.chapter.active {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: var(--elev-1);
}
.chapter.done { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.chapter.locked { opacity: .62; }

.chapter header { display: flex; align-items: center; gap: 8px; }
.chapter h3 {
  margin: 0; flex: 1; min-width: 0;
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-md);
}
.chapter.done h3 { color: var(--ok); }
.tally { font-size: var(--text-xs); font-weight: 800; color: var(--muted); }
.chapter.active .tally { color: var(--accent); }
.chapter.done .tally { color: var(--ok); }
.ch-lock { color: var(--muted); flex-shrink: 0; }

.chapter footer {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: var(--text-xs); color: var(--muted);
}
.need-theme {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--warn); font-weight: 700; margin-left: auto;
}

/* ---------- ô một cấp ---------- */

/* 5 cột: cỡ chặng đều là bội của 5 nên hàng cuối luôn đầy. Ô vuông theo bề
   rộng, tối thiểu 44px cho ngón tay (NF-07). */
.nodes {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px; list-style: none; margin: 0; padding: 0;
}
.nodes li { display: flex; }
.node {
  width: 100%; aspect-ratio: 1; min-height: 44px;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 1px; padding: 2px; overflow: hidden;
  border: 2px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-solid); color: var(--fg);
  container-type: inline-size;   /* số cấp co theo cỡ ô, như các ô lựa chọn khác */
}
.node b {
  font-family: var(--font-display); font-weight: 800; font-size: clamp(15px, 38cqw, 21px);
  line-height: 1.05;
}
.node.cleared b { margin-top: 13px; }   /* chừa hàng sao ở trên */
.node small { color: var(--muted); font-size: clamp(8px, 22cqw, 11px); white-space: nowrap; }
/* Sao/dấu tick ở GÓC TRÊN, không chiếm dòng: dòng đó là của số thẻ. Cách mép
   trên một khoảng thở — dán sát mép trông như bị tràn ra ngoài ô. */
.node .stars {
  position: absolute; top: 6px; left: 0; right: 0;
  font-size: clamp(7px, 19cqw, 10px); color: var(--gold); letter-spacing: 0;
  /* line-height 1 cắt mất phần dưới của ngôi sao (đo được scrollHeight vượt
     clientHeight); overflow: hidden thì cắt im lặng, không ai thấy. */
  line-height: 1.2; white-space: nowrap;
}

/* Đã qua: nền xanh nhạt + viền xanh, đọc được ngay là "xong rồi" */
.node.cleared {
  border-color: color-mix(in srgb, var(--ok) 50%, transparent);
  background: color-mix(in srgb, var(--ok) 12%, var(--panel-solid));
}
/* Cấp cần chơi tiếp: ô duy nhất mang gradient thương hiệu, hơi lớn hơn */
.node.next {
  border-color: transparent; color: #fff;
  background: linear-gradient(150deg, var(--brand-500), #8b5cf6);
  /* Bóng trung tính + vòng mảnh, không glow màu — glow lan vào khe giữa các ô
     làm chúng dính vào nhau */
  box-shadow: 0 0 0 3px var(--accent-soft), var(--elev-1);
}
.node.next small { color: rgba(255, 255, 255, .88); font-weight: 700; }
/* Khoá: mờ đi nhưng vẫn đọc được số cấp và số thẻ, kèm ổ khoá nhỏ ở góc */
.node.locked { background: transparent; color: var(--muted); opacity: .72; }
.node { position: relative; }
.node-lock { position: absolute; top: 2px; right: 2px; color: var(--muted); }
/* Đã mở nhưng không bộ theme nào đủ biểu tượng cho bàn này */
.node.nosym {
  border-color: color-mix(in srgb, var(--warn) 60%, var(--line));
  background: color-mix(in srgb, var(--warn) 12%, transparent);
}

@media (hover: hover) {
  .node:not(:disabled):hover { border-color: var(--accent); transform: translateY(-1px); }
}
</style>
