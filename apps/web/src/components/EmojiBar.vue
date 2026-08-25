<script setup lang="ts">
/**
 * Thanh emoji chat (ON-08) — tách khỏi OnlineGame để dùng được ở BA chỗ:
 * trong ván, trong bảng kết quả (overlay che hết màn chơi nên phải có bản
 * riêng ở đó) và ở lobby. Server chưa bao giờ chặn emoji theo trạng thái
 * phòng, nên chat ngoài ván chỉ là chuyện của giao diện.
 *
 * Riêng vụ "emoji người kia gửi" (blast) nằm ở EmojiBlast.vue: nó teleport ra
 * <body>, mount hai lần là hiện hai cái.
 */
import { QUICK_EMOJIS } from '@mm/engine';

const props = defineProps<{
  /** Composable useOnlineRoom — nhận cả cụm để không phải xâu 4 prop. */
  o: {
    spectator: { value: boolean };
    emojiReady: { value: boolean };
    emojiCooldown: { value: number };
    sendEmoji: (e: string) => void;
  };
}>();
</script>

<template>
  <!-- Khán giả không gửi được -->
  <div
    v-if="!props.o.spectator.value" class="emoji-bar"
    :class="{ spent: !props.o.emojiReady.value }"
    :aria-label="props.o.emojiReady.value ? 'Gửi emoji' : 'Gửi emoji — đợi chút, bạn vừa gửi liên tục'"
  >
    <button
      v-for="e in QUICK_EMOJIS" :key="e" class="emoji" type="button"
      :disabled="!props.o.emojiReady.value"
      @click="props.o.sendEmoji(e)"
    >{{ e }}</button>
    <!-- Hết lượt: nói rõ còn phải chờ mấy giây -->
    <span v-if="props.o.emojiCooldown.value" class="cooldown" role="status">
      🧊 {{ props.o.emojiCooldown.value }}s
    </span>
  </div>
</template>

<style scoped>
/* LUÔN một hàng. Cho xuống hàng thì trên điện thoại thành hai hàng, vừa xấu vừa
   ăn chỗ của bàn thẻ. Các nút co giãn để tự vừa bề rộng: 8 emoji trên iPhone SE
   ra ~39px mỗi nút, trên máy rộng thì chặn ở 44px cho khỏi phình to. */
.emoji-bar {
  display: flex; flex-wrap: nowrap; gap: 4px; justify-content: center;
  padding: 0 6px;
  position: relative;
  transition: opacity .18s ease;
}
/* Hết hạn mức: mờ đi để thấy rõ là đang chờ */
.emoji-bar.spent .emoji { opacity: .35; }
.cooldown {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 4px 12px; border-radius: var(--r-full);
  background: var(--panel-solid); border: 2px solid var(--accent);
  box-shadow: var(--shadow-soft);
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  pointer-events: none;
}
.emoji {
  /* Nhỏ đi 30% so với bản đầu (34/44/40/20px): thanh này chỉ là chỗ BẤM, còn
     thứ cần đọc là emoji người kia gửi (EmojiBlast). Nút bé thì nó nhường chỗ
     cho bàn thẻ và không tranh mắt với nút hành động.
     flex 1 1 auto để chúng chia đều chỗ còn lại thay vì tràn ra ngoài khung. */
  flex: 1 1 auto; min-width: 24px; max-width: 31px;
  min-height: 28px; font-size: 14px; border: 1px solid var(--line);
  border-radius: var(--r-full); background: var(--panel);
  transition: transform .12s ease;
  /* .btn toàn cục đặt 44px — phải ghi đè, không thì nút phình lại */
  padding: 0; position: relative;
}
/* Vùng chạm ≠ HÌNH của nút (NF-07): nút bé 28px nhưng nới vùng chạm ra ~44px
   bằng ::after, chứ KHÔNG phình cái nút lên — phình là thanh này lại cao như cũ.
   inset -8px theo trục dọc là 28+16=44px; ngang thì gap 4px đã nối liền nhau. */
.emoji::after { content: ''; position: absolute; inset: -8px; }
.emoji:disabled { cursor: not-allowed; }
@media (hover: hover) {
  .emoji:not(:disabled):hover { transform: translateY(-2px) scale(1.1); }
}
</style>
