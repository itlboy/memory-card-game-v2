<script setup lang="ts">
/**
 * "Emoji người kia gửi" — TELEPORT ra <body> và dùng position: fixed.
 * Vì sao không để trong dải thông báo: `main` có `overflow: auto` (bản đồ cấp
 * cần cuộn), nên mọi thứ nhô lên trên mép `main` đều BỊ CẮT — nhìn ra thành
 * "emoji nằm dưới header". Không phải chuyện z-index, mà là bị cắt. Ra ngoài
 * body thì nó nổi trên tất cả, kể cả header và bảng kết quả (z-index 60 > 10).
 *
 * CHỈ ĐƯỢC MOUNT MỘT LẦN trong cây: hai lần là hiện hai emoji chồng nhau.
 *
 * BAY LÊN TỪ ĐÚNG CÁI TÊN, không phải từ tâm chip: mắt đang đọc tên để biết ai
 * đang nói, nên emoji phải mọc lên ngay từ chữ đó. Tâm chip thì rơi vào khoảng
 * giữa avatar và điểm số — một chỗ chẳng thuộc về ai.
 *
 * Ba mức, lấy được cái nào thì dùng cái đó:
 *   1. `<b>` trong chip = TÊN. Neo vào MÉP TRÁI của nó (chữ bắt đầu ở đâu thì
 *      emoji mọc ở đó), cả bốn dạng chip đều đặt tên trong `<b>`.
 *   2. Chip hẹp không còn chỗ cho tên (dạng `.mini` từ 5 người trở lên): neo vào
 *      TÂM avatar — đó là toàn bộ những gì nhận ra người đó.
 *   3. Không tìm thấy chip nào (khán giả, người vừa rời): mép trên giữa màn hình
 *      như cũ, kèm cái tên dán dưới emoji.
 *
 * Chip được đánh dấu bằng `data-chip-for="<id người chơi>"` (màn chơi: `.pchip`,
 * `.turn-chip`, `.mini`; phòng chờ: `li` trong `.lobby-list`) — đo
 * `getBoundingClientRect` ngay lúc hiện.
 */
import type { QuickEmoji } from '@mm/engine';
import { ref, watch } from 'vue';

const props = defineProps<{
  o: { emojiBlast: { value: { emoji: QuickEmoji; name: string; from: string; key: number } | null } };
}>();

/** Toạ độ điểm xuất phát (tâm chip). null = chưa đo được → dùng mép trên giữa. */
const neo = ref<{ x: number; y: number } | null>(null);

watch(() => props.o.emojiBlast.value?.key, () => {
  const blast = props.o.emojiBlast.value;
  if (!blast) return;
  const chip = document.querySelector(`[data-chip-for="${CSS.escape(blast.from)}"]`);
  const r = chip?.getBoundingClientRect();
  // Chip cao 0 = đang ẩn (màn khác đang hiện): coi như không tìm thấy.
  if (!r || r.height === 0) { neo.value = null; return; }

  const ten = chip!.querySelector('b')?.getBoundingClientRect();
  const av = chip!.querySelector('.avatar')?.getBoundingClientRect();
  let x: number;
  /*
   * `y` là ĐÁY của dòng tên, không phải mép trên chip — emoji mọc LÊN từ đúng
   * dòng chữ đó (xem `.anchored` trong style: nó tự dịch lên 100% chiều cao
   * mình, nên cạnh dưới emoji nằm ngay trên dòng tên). Lấy mép trên chip thì
   * emoji lơ lửng cao hơn cái tên một đoạn, đọc ra thành "của ai đó ở trên".
   */
  let y: number;
  if (ten && ten.width > 0) { x = ten.left; y = ten.bottom; }
  else if (av && av.width > 0) { x = av.left + av.width / 2; y = av.bottom; }
  else { x = r.left + r.width / 2; y = r.bottom; }

  /* Emoji rộng tới 88px và căn giữa quanh `x`, nên tên nằm sát mép màn hình là
     nó thò ra ngoài. Kẹp lại vừa đủ để cả con emoji còn trong khung. */
  const le = 48;
  neo.value = { x: Math.min(Math.max(x, le), window.innerWidth - le), y };
}, { flush: 'post' });
</script>

<template>
  <Teleport to="body">
    <Transition name="blast">
      <div
        v-if="props.o.emojiBlast.value"
        :key="props.o.emojiBlast.value.key"
        class="emoji-blast"
        :class="{ anchored: !!neo }"
        :style="neo ? { left: `${neo.x}px`, top: `${neo.y}px` } : undefined"
        aria-hidden="true"
      >
        <span class="big">{{ props.o.emojiBlast.value.emoji }}</span>
        <span v-if="!neo" class="from">{{ props.o.emojiBlast.value.name }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.emoji-blast {
  /* fixed + z-index cao: nổi trên MỌI thứ kể cả header. */
  /* Teleport ra <body> nên KHÔNG hưởng đệm vùng an toàn của #app — phải tự
     cộng, không thì trên máy có tai thỏ nó nằm dưới thanh trạng thái. */
  position: fixed; top: calc(10px + env(safe-area-inset-top, 0px)); left: 50%; z-index: 60;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  pointer-events: none;
  animation: blast-float 1.15s ease-out forwards;
}
/* Trôi lên NHANH và dứt khoát: nó là một câu nói bay đi, không phải thứ cần đọc
   lâu. */
@keyframes blast-float {
  0%   { opacity: 0; transform: translateX(-50%) translateY(16px) scale(.9); }
  14%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  55%  { opacity: 1; transform: translateX(-50%) translateY(-26px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-72px); }
}
/*
 * Bản NEO VÀO TÊN: `top` được đặt đúng đáy dòng tên, nên phải tự kéo mình lên
 * trọn chiều cao (-100%) thì cạnh dưới emoji mới nằm ngay trên dòng chữ — và
 * nó mọc lên TỪ ĐÓ. Thiếu -100% thì emoji đổ xuống che mất cái tên.
 */
.emoji-blast.anchored { animation-name: blast-float-neo; }
@keyframes blast-float-neo {
  0%   { opacity: 0; transform: translate(-50%, calc(-100% + 16px)) scale(.9); }
  14%  { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  55%  { opacity: 1; transform: translate(-50%, calc(-100% - 26px)); }
  100% { opacity: 0; transform: translate(-50%, calc(-100% - 72px)); }
}
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

/*
 * NEO VÀO CHIP NGƯỜI GỬI. `left`/`top` do JS đặt = tâm ngang và mép trên của
 * chip; `translate(-50%, -100%)` kéo emoji lên nằm ngay TRÊN chip rồi bay tiếp.
 *
 * Bỏ nhãn tên ở nhánh này: chỗ xuất phát đã nói ai gửi, mà giữ cái nhãn thì nó
 * che đúng cái chip vừa chỉ vào.
 *
 * Cỡ chữ 20px — bằng avatar trong chip (`.pchip .avatar` 18px, `.lobby-list
 * .avatar` cũng cỡ đó), nhỉnh một chút để nổi hơn nền. Bản cũ 60–88px là để đọc
 * từ xa khi nó nổi một mình giữa màn hình; neo vào chip rồi thì cỡ đó phủ kín
 * cả dải người chơi.
 */
.emoji-blast.anchored { animation: blast-rise 1.15s ease-out forwards; }
.emoji-blast.anchored .big {
  font-size: 20px;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, .3));
}
@keyframes blast-rise {
  0%   { opacity: 0; transform: translate(-50%, -100%) translateY(10px) scale(.6); }
  16%  { opacity: 1; transform: translate(-50%, -100%) translateY(0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -100%) translateY(-58px) scale(1); }
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
