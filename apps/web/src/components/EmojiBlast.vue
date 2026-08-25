<script setup lang="ts">
/**
 * "Emoji người kia gửi" — TELEPORT ra <body> và dùng position: fixed.
 * Vì sao không để trong dải thông báo: `main` có `overflow: auto` (bản đồ cấp
 * cần cuộn), nên mọi thứ nhô lên trên mép `main` đều BỊ CẮT — nhìn ra thành
 * "emoji nằm dưới header". Không phải chuyện z-index, mà là bị cắt. Ra ngoài
 * body thì nó nổi trên tất cả, kể cả header và bảng kết quả (z-index 60 > 10).
 *
 * CHỈ ĐƯỢC MOUNT MỘT LẦN trong cây: hai lần là hiện hai emoji chồng nhau.
 */
import type { QuickEmoji } from '@mm/engine';

const props = defineProps<{
  o: { emojiBlast: { value: { emoji: QuickEmoji; name: string; key: number } | null } };
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="blast">
      <div v-if="props.o.emojiBlast.value" :key="props.o.emojiBlast.value.key" class="emoji-blast" aria-hidden="true">
        <span class="big">{{ props.o.emojiBlast.value.emoji }}</span>
        <span class="from">{{ props.o.emojiBlast.value.name }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Emoji người kia gửi: nằm trong dải thông báo TRÊN bàn, xếp ngang một dòng —
   trước đây nó phóng 110px giữa bàn, đúng lúc đối thủ đang chờ mình đi thì cả
   bàn bị che.

   Xếp DỌC: biểu tượng trên, TÊN người gửi ngay dưới — đọc được ai vừa nói mà
   không cần dấu nhỏ trên chip người chơi (đã bỏ). Cả cụm trôi lên và mờ dần như
   một câu nói bay đi. 1,9s đúng bằng lúc composable xoá emojiBlast nên nó tan
   hết rồi mới rời DOM, không bị cắt ngang. */
.emoji-blast {
  /* fixed + z-index cao: nổi trên MỌI thứ kể cả header. Neo theo mép trên màn
     hình vì nó đã ra khỏi cây DOM của màn chơi. */
  position: fixed; top: 10px; left: 50%; z-index: 60;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  pointer-events: none;
  animation: blast-float 1.15s ease-out forwards;
}
/* Trôi lên NHANH và dứt khoát: nó là một câu nói bay đi, không phải thứ cần đọc
   lâu — tên người gửi ở ngay dưới đã nói đủ. */
@keyframes blast-float {
  0%   { opacity: 0; transform: translateX(-50%) translateY(16px) scale(.9); }
  14%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  55%  { opacity: 1; transform: translateX(-50%) translateY(-26px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-72px); }
}
/* Gấp đôi cỡ cũ (30–44px → 60–88px): emoji người kia gửi là lời "nói", phải đọc
   được từ xa. Nó nằm trong .notice-bar (cao 0px) nên phóng to KHÔNG đẩy bàn thẻ
   xuống — chỉ đè lên HUD một nhịp rồi tan. Nút BẤM để gửi giữ nguyên cỡ. */
.emoji-blast .big {
  font-size: clamp(60px, 16vw, 88px); line-height: 1;
  filter: drop-shadow(0 8px 26px rgba(0, 0, 0, .35));
  animation: blast-pop .5s cubic-bezier(.2, 1.4, .4, 1);
}
.emoji-blast .from {
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-md);
  color: #fff; padding: 2px 12px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--accent) 85%, black);
  box-shadow: 0 4px 14px var(--card-back-glow);
}
/* Nảy vào một nhịp. KHÔNG có translateX ở đây: cụm CHA mới là cái căn giữa,
   để đây thì nó lệch nửa bề rộng. */
@keyframes blast-pop {
  0%   { transform: scale(.3) rotate(-14deg); }
  55%  { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0); }
}
.blast-enter-active { transition: opacity .1s; }
.blast-leave-active { transition: opacity .25s; }
.blast-leave-to { opacity: 0; }
</style>
