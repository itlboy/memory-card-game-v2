<script setup lang="ts">
/**
 * BONG BÓNG CÂU NÓI NHANH — hiện TRÊN mặt người nói, ĐÚNG CHỖ của bong bóng emoji (22.11.2026, chủ dự án:
 * "bong bóng chat chữ cũng hiện trên, vị trí giống hệt với chat icon"). Chỗ neo tính ở lib/neo-bong.ts,
 * CHUNG với EmojiBlast — đừng tự tính ở đây. (Bản 14.10.2026 đặt DƯỚI chip để khỏi chiếm bàn thẻ; thành
 * ra emoji một nơi, chữ một nơi.) Cùng một người thì emoji và câu nói THAY nhau (useOnlineRoom), không chồng.
 *
 * Teleport ra <body> + position: fixed, cùng lý do với EmojiBlast: chip có
 * `overflow: hidden` và `main` cuộn được, gắn bong bóng vào trong là bị cắt.
 * Không thấy chip (khán giả, màn khác đang phủ) thì xếp ở mép trên giữa màn kèm tên người nói.
 *
 * CHỈ MOUNT MỘT LẦN trong cây (như EmojiBlast).
 */
import type { QuickSay } from '@mm/engine';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import KhungBong from './KhungBong.vue';
import { td } from '@/lib/i18n';
import { timNeoBong, type NeoBong } from '@/lib/neo-bong';
import IconNoi from './IconNoi.vue';

type Loi = { from: string; id: QuickSay; name: string; key: number };
const props = defineProps<{ o: { loiNoi: { value: Loi[] } } }>();

/** Vị trí từng bong bóng theo key; null = không có chip → xếp ở mép trên. */
const neo = ref<Record<number, NeoBong | null>>({});

function doLai(): void {
  const m: Record<number, NeoBong | null> = {};
  for (const l of props.o.loiNoi.value) {
    // Bề rộng THẬT (max-content, không đổi theo vị trí): chữ dài thì kẹp mép phải sớm hơn, chữ ngắn thì
    // đứng đúng chỗ bong bóng emoji. Chưa đo được (khung hình đầu) thì lấy bề rộng tối đa.
    const el = document.querySelector<HTMLElement>(`.bong[data-loi="${l.key}"]`);
    m[l.key] = timNeoBong(l.from, el?.offsetWidth || 224);
  }
  neo.value = m;
}
watch(() => props.o.loiNoi.value.map((l) => l.key).join(','), doLai, { flush: 'post' });
onMounted(() => window.addEventListener('resize', doLai));
onBeforeUnmount(() => window.removeEventListener('resize', doLai));
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="loi" tag="div" class="loi-noi" aria-live="polite">
      <div
        v-for="(l, i) in props.o.loiNoi.value" :key="l.key"
        class="bong" :class="{ tren: !neo[l.key], neo: !!neo[l.key] }" :data-loi="l.key"
        :style="neo[l.key] ? { left: `${neo[l.key]!.x}px`, top: `${neo[l.key]!.y}px` } : { top: `calc(${10 + i * 46}px + env(safe-area-inset-top, 0px))` }"
      >
        <KhungBong :canh="neo[l.key] ? 'duoi' : undefined" :day="2" :r="14" :vt="neo[l.key]?.vt" />
        <IconNoi :id="l.id" :size="22" />
        <span class="chu"><b v-if="!neo[l.key]">{{ l.name }}: </b>{{ td(`say.${l.id}`) }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.bong {
  /* Nổi trên MỌI thứ kể cả bảng kết quả (10) như EmojiBlast (60) */
  position: fixed; left: 50%; z-index: 59; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px; width: max-content; max-width: min(224px, calc(100vw - 24px));
  /* max-content: neo sát mép phải thì `fixed` tự bóp bề rộng theo chỗ còn lại và chữ
     xuống dòng (ảnh 14.10.2026) — giữ bề rộng theo chữ, vị trí đã được kẹp trong JS */
  /* Nền + viền: KhungBong (một nét liền cả đuôi). Đệm = đệm cũ + 2px viền. */
  padding: 8px 14px;
  --nen: var(--panel-solid); --vien: var(--accent);
  color: var(--fg);
  /* drop-shadow chứ không box-shadow: bóng ăn theo cả đuôi */
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, .22));
  font-size: var(--text-sm); font-weight: 700; line-height: 1.25;
  pointer-events: none;
  /* HƠI TRONG SUỐT (26.11.2026, chủ dự án: "các ô chat bật lên… có độ trong suốt để không cản việc xem thẻ mở"): bong bóng
     nổi ngay trên bàn thẻ, đặc thì che mất lá vừa lật. .78 = vẫn đọc được chữ đậm mà thấy lờ mờ lá phía sau. Cùng số ở
     EmojiBlast.vue — đổi thì đổi cả hai. */
  opacity: .78;
}
/* Đuôi chỉ XUỐNG mặt người nói: vẽ chung một nét với thân (KhungBong.vue) */
/* Neo vào avatar: canh trái theo `x`, `top` là chỗ mũi đuôi → kéo lên trọn chiều cao (y như EmojiBlast `.tren`) */
.bong.neo { transform: translateY(-100%); }
.bong .chu { min-width: 0; }
.loi-enter-active { transition: opacity .16s ease, translate .16s ease; }
.loi-leave-active { transition: opacity .25s ease; }
.loi-enter-from { opacity: 0; translate: 0 6px; }
.loi-leave-to { opacity: 0; }
</style>
