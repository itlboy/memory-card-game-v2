<script setup lang="ts">
/**
 * BONG BÓNG CÂU NÓI NHANH — hiện ngay DƯỚI chip người nói vài giây rồi tự tắt
 * (chủ dự án chọn 14.10.2026: không chiếm chỗ của bàn thẻ).
 *
 * Teleport ra <body> + position: fixed, cùng lý do với EmojiBlast: chip có
 * `overflow: hidden` và `main` cuộn được, gắn bong bóng vào trong là bị cắt.
 * Neo theo `data-chip-for` (chip trong ván, dòng ở phòng chờ); không thấy chip
 * (khán giả, màn khác đang phủ) thì xếp ở mép trên giữa màn kèm tên người nói.
 *
 * CHỈ MOUNT MỘT LẦN trong cây (như EmojiBlast).
 */
import type { QuickSay } from '@mm/engine';
import { ref, watch } from 'vue';
import KhungBong from './KhungBong.vue';
import { td } from '@/lib/i18n';
import { EMOJI_NOI } from '@/lib/noi-nhanh';

type Loi = { from: string; id: QuickSay; name: string; key: number };
const props = defineProps<{ o: { loiNoi: { value: Loi[] } } }>();

/** Vị trí từng bong bóng theo key; null = không có chip → xếp ở mép trên. */
const neo = ref<Record<number, { x: number; y: number; vt: number } | null>>({});

watch(() => props.o.loiNoi.value.map((l) => l.key).join(','), () => {
  const m: Record<number, { x: number; y: number; vt: number } | null> = {};
  for (const l of props.o.loiNoi.value) {
    const chip = document.querySelector(`[data-chip-for="${CSS.escape(l.from)}"]`);
    const r = chip?.getBoundingClientRect();
    if (!r || r.height === 0) { m[l.key] = null; continue; }
    // ĐUÔI CHỈ VÀO AVATAR (19.11.2026, chủ dự án). Bong bóng canh TRÁI từ tâm avatar − 24px (rộng tới ~220px),
    // kẹp vào màn hình rồi dời chân đuôi (`vt`) cho vẫn đúng tâm avatar.
    const av = chip!.querySelector('.avatar')?.getBoundingClientRect();
    const tam = av && av.width > 0 ? av.left + av.width / 2 : r.left + r.width / 2;
    const x = Math.min(Math.max(tam - 24, 8), window.innerWidth - 228);
    m[l.key] = { x, y: r.bottom + 12, vt: Math.max(16, tam - x) };   // chừa chỗ cho đuôi (12px) mọc lên chip
  }
  neo.value = m;
}, { flush: 'post' });
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="loi" tag="div" class="loi-noi" aria-live="polite">
      <div
        v-for="(l, i) in props.o.loiNoi.value" :key="l.key"
        class="bong" :class="{ tren: !neo[l.key], neo: !!neo[l.key] }"
        :style="neo[l.key] ? { left: `${neo[l.key]!.x}px`, top: `${neo[l.key]!.y}px` } : { top: `calc(${10 + i * 46}px + env(safe-area-inset-top, 0px))` }"
      >
        <KhungBong :canh="neo[l.key] ? 'tren' : undefined" :day="2" :r="14" :vt="neo[l.key]?.vt" />
        <span class="e" aria-hidden="true">{{ EMOJI_NOI[l.id] }}</span>
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
}
/* Mũi chỉ lên chip người nói: vẽ chung một nét với thân (KhungBong.vue) */
/* Neo vào avatar: canh trái theo `x` (đã tính sẵn), không căn giữa */
.bong.neo { transform: none; }
.bong .e { font-size: 18px; flex-shrink: 0; }
.bong .chu { min-width: 0; }
.loi-enter-active { transition: opacity .16s ease, translate .16s ease; }
.loi-leave-active { transition: opacity .25s ease; }
.loi-enter-from { opacity: 0; translate: 0 -6px; }
.loi-leave-to { opacity: 0; }
</style>
