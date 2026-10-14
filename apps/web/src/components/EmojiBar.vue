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
import { QUICK_EMOJIS, QUICK_SAYS, type QuickSay } from '@mm/engine';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t, td } from '@/lib/i18n';
import { EMOJI_NOI } from '@/lib/noi-nhanh';
import { useBackCloser } from '@/composables/useBackGuard';

const props = defineProps<{
  /** Composable useOnlineRoom — nhận cả cụm để không phải xâu 4 prop. */
  o: {
    spectator: { value: boolean };
    emojiReady: { value: boolean };
    emojiCooldown: { value: number };
    sendEmoji: (e: string) => void;
    sendSay: (id: QuickSay) => void;
  };
}>();

/*
 * NÓI NHANH (14.10.2026, mockup chủ dự án duyệt): nút 💬 ĐỨNG ĐẦU thanh (con thứ
 * nhất — luật ẩn bớt ở dưới chỉ đụng con thứ 6 trở đi nên nó luôn còn) mở bảng
 * 12 câu có sẵn nổi lên trên thanh. Chọn là gửi và đóng; chạm ra ngoài / Back
 * cũng đóng. Câu hiện thành bong bóng dưới chip người nói (LoiNoi.vue).
 */
const moNoi = ref(false);
const goc = ref<HTMLElement | null>(null);
useBackCloser(25, () => moNoi.value, () => { moNoi.value = false; });
function guiCau(id: QuickSay): void { props.o.sendSay(id); moNoi.value = false; }
function chamNgoai(e: PointerEvent): void {
  if (moNoi.value && goc.value && !goc.value.contains(e.target as Node)) moNoi.value = false;
}
onMounted(() => document.addEventListener('pointerdown', chamNgoai, true));
onBeforeUnmount(() => document.removeEventListener('pointerdown', chamNgoai, true));
</script>

<template>
  <!-- Khán giả không gửi được -->
  <div v-if="!props.o.spectator.value" ref="goc" class="eb-goc">
  <div
    class="emoji-bar"
    :class="{ spent: !props.o.emojiReady.value }"
    :aria-label="props.o.emojiReady.value ? t('eb.guiEmoji') : t('eb.doiChut')"
  >
    <button
      class="emoji say" type="button" :class="{ mo: moNoi }"
      :aria-label="t('eb.noiNhanh')" :aria-expanded="moNoi"
      :disabled="!props.o.emojiReady.value"
      @click="moNoi = !moNoi"
    >💬</button>
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
  <div v-if="moNoi" class="bang-noi" role="menu" :aria-label="t('eb.noiNhanh')">
    <p class="bn-dau">{{ t('eb.noiNhanh') }} <span>{{ t('eb.chamGui') }}</span></p>
    <button
      v-for="id in QUICK_SAYS" :key="id" class="cau" type="button" role="menuitem"
      :disabled="!props.o.emojiReady.value" @click="guiCau(id)"
    ><span class="e" aria-hidden="true">{{ EMOJI_NOI[id] }}</span>{{ td(`say.${id}`) }}</button>
  </div>
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
@container (max-width: 435px) { .emoji:nth-child(n+10) { display: none; } }
@container (max-width: 391px) { .emoji:nth-child(n+9) { display: none; } }
@container (max-width: 347px) { .emoji:nth-child(n+8) { display: none; } }
@container (max-width: 303px) { .emoji:nth-child(n+7) { display: none; } }
@container (max-width: 259px) { .emoji:nth-child(n+6) { display: none; } }
/* Gốc chứa thanh + bảng nói nhanh: bảng neo theo gốc chứ không theo thanh (thanh
   có `overflow: hidden` để ẩn bớt nút, bảng nằm trong đó là bị cắt mất). */
.eb-goc { position: relative; }
/* Nút 💬: cùng cỡ nút emoji (nằm trong phép tính mốc ẩn bớt), tô nhấn để nổi */
.emoji.say { background: var(--chon-nen); color: var(--chon-chu); border-color: transparent; }
.emoji.say.mo { background: var(--fg); color: var(--panel-solid); }
.bang-noi {
  position: absolute; left: 6px; right: 6px; bottom: calc(100% + 8px); z-index: 30;
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px;
  background: var(--panel-solid); border: 2px solid var(--line); border-radius: var(--r-lg, 16px);
  box-shadow: var(--elev-3, 0 14px 30px rgba(0, 0, 0, .25));
}
.bn-dau {
  grid-column: 1 / -1; margin: 0 2px 2px; display: flex; justify-content: space-between; gap: 8px;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm); color: var(--fg);
}
.bn-dau span { font-family: var(--font-body); font-weight: 600; color: var(--muted); }
.cau {
  /* 44px: ngưỡng chạm (NF-07) */
  min-height: 44px; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 4px 10px;
  border: 1.5px solid var(--line); border-radius: 12px; background: var(--panel-soft); color: var(--fg);
  font: inherit; font-size: var(--text-sm); font-weight: 700; text-align: left; line-height: 1.2; cursor: pointer;
}
.cau .e { font-size: 17px; flex-shrink: 0; }
.cau:disabled { opacity: .45; cursor: not-allowed; }
@media (hover: hover) { .cau:not(:disabled):hover { border-color: var(--accent); } }
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
  /* Cao 32 chứ không 36: glyph 18px không cần thêm chỗ, mà 4px này là chiều cao
     lấy thẳng từ BÀN THẺ — bàn đang bị chặn bởi chiều cao nên mỗi px đều thành
     bề rộng bỏ phí. Bề rộng và cỡ chữ giữ nguyên (đã chốt +30%). */
  min-height: 32px; font-size: 18px; border: 1px solid var(--line);
  border-radius: var(--r-full); background: var(--panel);
  transition: transform .12s ease;
  /* .btn toàn cục đặt 44px — phải ghi đè, không thì nút phình lại */
  padding: 0; position: relative;
}
/* Vùng chạm ≠ HÌNH của nút (NF-07): nút 32px, nới thêm 6px mỗi bên là tròn
   44px, chứ KHÔNG phình cái nút lên. */
.emoji::after { content: ''; position: absolute; inset: -6px; }
.emoji:disabled { cursor: not-allowed; }
@media (hover: hover) {
  .emoji:not(:disabled):hover { transform: translateY(-2px) scale(1.1); }
}
</style>
