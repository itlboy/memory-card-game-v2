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
   ăn chỗ của bàn thẻ.
   
   NÚT GIỮ NGUYÊN CỠ, MÁY HẸP THÌ ẨN BỚT — không cho chúng co lại. Trước đây
   nút co giãn (`flex: 1 1 auto`), nên thêm một emoji là TẤT CẢ bé đi: đo trên
   iPhone SE, cái thứ 9 kéo cả thanh từ 31px xuống 29,4px. Máy rộng thì thừa
   chỗ, chẳng có lý do gì bắt nó chịu theo máy hẹp nhất. */
.emoji-bar {
  display: flex; flex-wrap: nowrap; gap: 4px; justify-content: center;
  padding: 0 6px;
  position: relative;
  overflow: hidden;
  container-type: inline-size;
  transition: opacity .18s ease;
}
/*
 * Không đủ chỗ thì bỏ bớt từ CUỐI danh sách — nên thứ tự trong QUICK_EMOJIS
 * chính là thứ tự ưu tiên: cái hay dùng đặt trước.
 *
 * Mốc tính từ cỡ nút thật: mỗi nút 40px + gap 4px, nên n emoji cần
 * 44n − 4 px. Nút to thêm 30% thì MỌI MỐC PHẢI TÍNH LẠI — để nguyên là máy hẹp
 * cố nhét 9 nút vào chỗ chỉ đủ 7, và cả thanh tràn ra ngoài.
 * 9 cái = 392px, 8 cái = 348px, 7 cái = 304px, 6 cái = 260px.
 */
@container (max-width: 391px) { .emoji:nth-child(n+9) { display: none; } }
@container (max-width: 347px) { .emoji:nth-child(n+8) { display: none; } }
@container (max-width: 303px) { .emoji:nth-child(n+7) { display: none; } }
@container (max-width: 259px) { .emoji:nth-child(n+6) { display: none; } }
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
  /* TO THÊM 30% so với bản trước (31/28/14px): bản đó bé quá, khó bấm trúng và
     khó nhận ra emoji nào (người chơi báo). Vẫn nhỏ hơn bản gốc 34/44/40px nên
     thanh không giành lại chỗ của bàn thẻ.
     CỐ ĐỊNH 40px: thêm một emoji không được phép làm mọi nút khác bé đi. */
  flex: 0 0 40px;
  min-height: 36px; font-size: 18px; border: 1px solid var(--line);
  border-radius: var(--r-full); background: var(--panel);
  transition: transform .12s ease;
  /* .btn toàn cục đặt 44px — phải ghi đè, không thì nút phình lại */
  padding: 0; position: relative;
}
/* Vùng chạm ≠ HÌNH của nút (NF-07): nút 36px, nới thêm 4px mỗi bên là tròn
   44px, chứ KHÔNG phình cái nút lên. */
.emoji::after { content: ''; position: absolute; inset: -4px; }
.emoji:disabled { cursor: not-allowed; }
@media (hover: hover) {
  .emoji:not(:disabled):hover { transform: translateY(-2px) scale(1.1); }
}
</style>
