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
import { EMOJI_PREMIUM, NOI_NHANH, type QuickEmoji, type QuickSay } from '@mm/engine';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Crown, Hourglass, MessageCircleMore, Plus } from 'lucide-vue-next';
import { daMuaPremium, moPremium, moiNangCap } from '@/lib/premium';
import { moChucNang } from '@/lib/phan-tich';
import { ghiDung, hayDung } from '@/lib/emoji-hay-dung';
import { t } from '@/lib/i18n';
import { useBackCloser } from '@/composables/useBackGuard';
import IconNoi from './IconNoi.vue';

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
 * NÓI NHANH: bỏ 09.11.2026 ("ít ai dùng"), CÓ LẠI 22.11.2026 (mockup duyệt https://claude.ai/artifact/54TeMHuUCQA2pxs7FN7C4Q):
 * nút bong bóng ĐỨNG ĐẦU thanh (ngoài cùng bên trái, trước ＋), mở khung 5 câu `NOI_NHANH` do chủ dự án chọn. Gửi id
 * (danh sách đóng) — mỗi máy đọc câu theo ngôn ngữ của mình; bong bóng vẽ ở LoiNoi.vue; chung hạn mức với emoji.
 */
/*
 * BẢNG EMOJI (07.11.2026, mockup chủ dự án duyệt): nút ＋ ĐỨNG ĐẦU thanh (☺ cũ đứng cạnh 😂
 * trông như "hai mặt cười" — đổi 09.11.2026) (luật ẩn bớt
 * chỉ đụng từ con thứ 6 trở đi nên nó luôn còn) mở bảng ~50 emoji chia nhóm. Hàng ngoài là emoji
 * MÌNH hay bấm nhất (lib/emoji-hay-dung.ts), máy mới thì là bộ phổ biến. Một lúc
 * chạm ra ngoài / Back là đóng.
 */
const mo = ref<null | 'emoji' | 'noi'>(null);
const goc = ref<HTMLElement | null>(null);
useBackCloser(25, () => mo.value !== null, () => { mo.value = null; });
const batTat = (b: 'emoji' | 'noi'): void => { mo.value = mo.value === b ? null : b; };
function guiNoi(id: QuickSay): void { props.o.sendSay(id); mo.value = null; }
function guiEmoji(e: string): void { ghiDung(e); props.o.sendEmoji(e); mo.value = null; }
/** 8 cái: cùng ＋ là 9 nút, vừa khít Pro Max; máy hẹp ẩn bớt từ cuối. Thứ tự chốt theo phiên. */
const hangNgoai = hayDung(8);
/*
 * BẢNG GỌN (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 2 — chủ dự án: khung "hơi cao, còn
 * thừa nhiều chỗ"): 24 emoji xếp KÍN 3 hàng × 8, không tiêu đề, không tên nhóm, không cuộn (trước: ~50 cái, 199px + cuộn,
 * hàng cuối mỗi nhóm hở ô). Server vẫn nhận đủ QUICK_EMOJIS — máy bản cũ gửi cái ngoài bảng này vẫn hiện.
 */
const BANG: readonly QuickEmoji[] = [
  '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩',
  '😮', '😱', '🤔', '😅', '😢', '😭', '😡', '🥳',
  '👍', '👎', '👏', '🙏', '💪', '❤️', '🔥', '🎉'
];
/*
 * HÀNG EMOJI PREMIUM (26.11.2026, chủ dự án: "làm thêm một số icon premium"): hàng thứ tư của bảng, 8 emoji `EMOJI_PREMIUM`,
 * đeo vương miện (kể cả khi đã có Premium — "để họ hiểu quyền lợi của mình"). Có Premium thì gửi như emoji thường; chưa có thì
 * bấm vào mở bảng Premium. CHỈ BÀY khi đã có Premium hoặc đang được mời nâng cấp (`moiNangCap` = debug / đã mở bán) — người
 * chơi thường chưa mua được thì không thấy đồ khoá (luật App Review, xem lib/premium.ts). Người NHẬN thì ai cũng thấy.
 */
const hienPremium = (): boolean => daMuaPremium.value || moiNangCap.value;
function guiEmojiPremium(e: string): void {
  if (!daMuaPremium.value) { moChucNang('premium_emoji_khoa', { emoji: e }); mo.value = null; moPremium('chat'); return; }
  props.o.sendEmoji(e); mo.value = null;   // KHÔNG `ghiDung`: không cho emoji Premium lọt ra hàng ngoài của người hết Premium
}
function chamNgoai(e: PointerEvent): void {
  if (mo.value && goc.value && !goc.value.contains(e.target as Node)) mo.value = null;
}
onMounted(() => document.addEventListener('pointerdown', chamNgoai, true));
onBeforeUnmount(() => document.removeEventListener('pointerdown', chamNgoai, true));
</script>

<template>
  <!-- NGƯỜI XEM cũng thả emoji được (23.11.2026) — thưa hơn người chơi, và KHÔNG có nút nói nhanh (chat chữ) -->
  <div ref="goc" class="eb-goc">
  <div
    class="emoji-bar"
    :class="{ spent: !props.o.emojiReady.value }"
    :aria-label="props.o.emojiReady.value ? t('eb.guiEmoji') : t('eb.doiChut')"
  >
    <button
      v-if="!props.o.spectator.value"
      class="emoji noi thach th-nho" type="button" :class="{ mo: mo === 'noi' }"
      :aria-label="t('eb.noiNhanh')" :aria-expanded="mo === 'noi'"
      :disabled="!props.o.emojiReady.value"
      @click="batTat('noi')"
    ><MessageCircleMore :size="18" :stroke-width="2.4" /></button>
    <button
      class="emoji chon thach th-nho" type="button" :class="{ mo: mo === 'emoji' }"
      :aria-label="t('eb.chonEmoji')" :aria-expanded="mo === 'emoji'"
      :disabled="!props.o.emojiReady.value"
      @click="batTat('emoji')"
    ><Plus :size="20" :stroke-width="2.6" /></button>
    <button
      v-for="e in hangNgoai" :key="e" class="emoji thach th-nho" type="button"
      :disabled="!props.o.emojiReady.value"
      @click="guiEmoji(e)"
    >{{ e }}</button>
    <!-- Hết lượt: nói rõ còn phải chờ mấy giây -->
    <span v-if="props.o.emojiCooldown.value" class="cooldown" role="status">
      <Hourglass :size="14" :stroke-width="2.5" aria-hidden="true" /> {{ props.o.emojiCooldown.value }}s
    </span>
  </div>
  <div v-if="mo === 'noi' && !props.o.spectator.value" class="bang-noi khay" role="menu" :aria-label="t('eb.noiNhanh')">
    <button
      v-for="id in NOI_NHANH" :key="id" class="cau thach th-nho" type="button" role="menuitem"
      :disabled="!props.o.emojiReady.value" @click="guiNoi(id)"
    ><IconNoi :id="id" /><span>{{ t(`say.${id}` as 'say.gioi') }}</span></button>
  </div>
  <div v-if="mo === 'emoji'" class="bang-emoji khay" role="menu" :aria-label="t('eb.chonEmoji')">
    <div class="be-luoi">
      <button
        v-for="e in BANG" :key="e"
        class="emoji thach th-nho" type="button" role="menuitem"
        :disabled="!props.o.emojiReady.value" @click="guiEmoji(e)"
      >{{ e }}</button>
    </div>
    <div v-if="hienPremium()" class="be-luoi be-premium">
      <button
        v-for="e in EMOJI_PREMIUM" :key="e"
        class="emoji thach th-nho" type="button" role="menuitem" :class="{ khoa: !daMuaPremium }"
        :disabled="!props.o.emojiReady.value" :aria-label="`${e} — ${t('tp.premium')}`" @click="guiEmojiPremium(e)"
      >{{ e }}<Crown class="vm" :size="9" :stroke-width="3" aria-hidden="true" /></button>
    </div>
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
.emoji.chon.mo { background: var(--fg); color: var(--panel-solid); }
/* Nút nói nhanh: xanh nhạt cho khác hàng emoji (mockup duyệt 22.11.2026) */
/* Màu qua biến của hệ thạch (--b1 sáng · --b2 thân · --b3 viền/đế · --bc chữ): ghi background thẳng thì luật thạch
   (`!important`) đè mất — chụp kiểm 22.11.2026 nút ra trắng như emoji */
.emoji.noi { display: inline-flex; align-items: center; justify-content: center; --b1: #f4f8ff; --b2: #e3ecff; --b3: #9cb6ff; --bc: #2747b8; color: #2747b8; }
.emoji.noi.mo { --b1: #5a78e0; --b2: #2747b8; --b3: #1b3590; --bc: #fff; color: #fff; }
:global([data-theme='dark'] .emoji.noi) { --b1: #2e3d74; --b2: #243262; --b3: #5671d8; --bc: #cdd8ff; color: #cdd8ff; }
:global([data-theme='dark'] .emoji.noi.mo) { --b1: #b3c4ff; --b2: #8fa6ff; --b3: #6a83e0; --bc: #121729; color: #121729; }
/* Khung 5 câu: neo góc trái ngay trên nút, như bảng emoji */
.bang-noi {
  position: absolute; left: 6px; bottom: calc(100% + 6px); z-index: 30;
  width: max-content; max-width: calc(100% - 12px); display: grid; gap: 4px; padding: 6px;
  /* 10 câu (26.11.2026) cao ~410px — máy thấp (SE) thì cuộn trong khung thay vì trồi khỏi màn */
  max-height: min(52vh, 420px); overflow-y: auto; overscroll-behavior: contain;
  background: var(--panel-solid); border: 2px solid var(--line); border-radius: var(--r-lg, 16px);
  box-shadow: var(--elev-3, 0 14px 30px rgba(0, 0, 0, .25));
}
.bang-noi .cau { min-height: 36px; padding: 4px 12px 6px 7px; display: flex; align-items: center; gap: 8px; text-align: left; justify-content: flex-start; font: 800 14px var(--font-body); color: var(--fg); border-radius: 11px; }
/* Nút ＋: icon nét, căn giữa (glyph emoji tự căn theo dòng chữ, svg thì không) */
.emoji.chon { display: inline-flex; align-items: center; justify-content: center; color: var(--fg); }
/* Bảng emoji: KHUNG NHỎ neo góc trái ngay trên nút ＋ (14.11.2026, chủ dự án: bản cũ trải
   hết bề ngang, cao 56vh, "đè lên màn chơi"). Hẹp 8 cột ~290px, thấp ~1/3 màn, cuộn trong khung —
   phần lớn bàn thẻ vẫn nhìn thấy. */
/* NỀN ĐẶC: bản trong suốt (1.10.45, 26.11.2026) bị chủ dự án bỏ ngay — "khó nhìn quá". Đừng làm mờ khung chọn nữa. */
.bang-emoji {
  position: absolute; left: 6px; bottom: calc(100% + 6px); z-index: 30;
  width: min(292px, calc(100% - 12px));
  padding: 5px 6px 7px;
  background: var(--panel-solid); border: 2px solid var(--line); border-radius: var(--r-lg, 16px);
  box-shadow: var(--elev-3, 0 14px 30px rgba(0, 0, 0, .25));
}
.be-luoi { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 3px; }
/* Trong lưới: nút giãn theo ô (không giữ 40px cố định của thanh) */
.be-luoi .emoji { flex: none; width: 100%; min-height: 32px; font-size: 19px; }
/* Hàng Premium: vạch vàng ngăn với ba hàng thường, mỗi nút có vương miện nhỏ ở góc */
.be-premium { margin-top: 5px; padding-top: 5px; border-top: 2px dashed #f0cf7a; }
.be-premium .emoji { position: relative; overflow: visible; }
/* Chưa có Premium: cả hàng MỜ như nút tắt (chủ dự án 26.11.2026: "nó thuộc dạng disable mờ với người thường") — vẫn bấm
   được để mở bảng Premium; vương miện giữ nguyên độ rõ để biết vì sao mờ. Mờ phần HÌNH bằng màu chữ + lọc xám, không
   `opacity` cả nút: opacity kéo mờ luôn vương miện. */
.be-premium .emoji.khoa { color: color-mix(in srgb, currentColor 38%, transparent); filter: grayscale(.75); }
.be-premium .emoji.khoa .vm { filter: none; }
.be-premium .emoji .vm { position: absolute; top: -3px; right: -2px; padding: 1.5px; box-sizing: content-box; border-radius: 50%; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; }
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
