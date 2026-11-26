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
import { EMOJI_NHOM, EMOJI_PREMIUM, NOI_NHANH, type QuickSay } from '@mm/engine';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
/*
 * KHUNG CHAT GOM THEO Ô (26.11.2026, chủ dự án duyệt mockup https://claude.ai/artifact/1ZwuoozRFvTHxkdK9wRNeo mục 3 — "các icon
 * chat text gom lại thành từng ô riêng cho đỡ rối"). Hai nút bong bóng / ＋ mở CÙNG một khung; hàng nút trên cùng chọn Ô:
 * Câu nói · Cảm xúc · Tay · Vui · Trêu · Premium — mỗi lần chỉ hiện một ô (trước: hai khung riêng, khung emoji một lưới dài trộn
 * mọi nhóm). Bong bóng mở thẳng ô Câu nói, ＋ mở ô vừa dùng gần nhất (mặc định Cảm xúc). Người xem không có ô Câu nói.
 * Ô Premium chỉ bày khi đã có Premium hoặc đang được mời (`moiNangCap`) — chưa mua được thì không thấy đồ khoá (luật App Review).
 */
type O = 'cau' | 'camXuc' | 'tay' | 'vui' | 'treu' | 'premium';
const mo = ref(false);
const o = ref<O>('camXuc');
let oEmojiCuoi: O = 'camXuc';
const goc = ref<HTMLElement | null>(null);
useBackCloser(25, () => mo.value, () => { mo.value = false; });
/** Bấm bong bóng / ＋: mở đúng ô; bấm lại nút đang mở ô đó thì đóng. */
function batTat(b: 'noi' | 'emoji'): void {
  const muon: O = b === 'noi' ? 'cau' : oEmojiCuoi;
  if (mo.value && (b === 'noi' ? o.value === 'cau' : o.value !== 'cau')) { mo.value = false; return; }
  o.value = muon; mo.value = true;
}
function chonO(x: O): void { o.value = x; if (x !== 'cau') oEmojiCuoi = x; moChucNang('chat_o', { o: x }); }
function guiNoi(id: QuickSay): void { props.o.sendSay(id); mo.value = false; }
function guiEmoji(e: string): void { ghiDung(e); props.o.sendEmoji(e); mo.value = false; }
/** 8 cái: cùng ＋ là 9 nút, vừa khít Pro Max; máy hẹp ẩn bớt từ cuối. Thứ tự chốt theo phiên. */
const hangNgoai = hayDung(8);
const hienPremium = (): boolean => daMuaPremium.value || moiNangCap.value;
/** Các ô của khung — icon là chính emoji đại diện của nhóm (Câu nói và Premium dùng icon nét). */
const CAC_O = computed(() => [
  ...(props.o.spectator.value ? [] : [{ id: 'cau' as const, hinh: '' }]),
  { id: 'camXuc' as const, hinh: '😂' }, { id: 'tay' as const, hinh: '👍' }, { id: 'vui' as const, hinh: '🎉' }, { id: 'treu' as const, hinh: '🐔' },
  ...(hienPremium() ? [{ id: 'premium' as const, hinh: '' }] : [])
]);
/** Emoji của ô đang mở. Số cột theo số emoji: 21 → 7 cột (3 hàng kín), còn lại 8 cột. */
const dsO = computed<readonly string[]>(() => (o.value === 'cau' ? [] : EMOJI_NHOM[o.value]));
const cot = computed(() => (dsO.value.length % 7 === 0 && dsO.value.length % 8 !== 0 ? 7 : 8));
/*
 * EMOJI PREMIUM (26.11.2026): 24 cái (`EMOJI_PREMIUM`, trước 8 — chủ dự án: "icon premium làm cho nhiều vào"), đeo vương miện kể
 * cả khi đã có Premium ("để họ hiểu quyền lợi của mình"). Chưa có thì ô mờ, bấm emoji hay nút dưới đều mở bảng Premium.
 */
function guiEmojiPremium(e: string): void {
  if (!daMuaPremium.value) { moChucNang('premium_emoji_khoa', { emoji: e }); mo.value = false; moPremium('chat'); return; }
  props.o.sendEmoji(e); mo.value = false;   // KHÔNG `ghiDung`: không cho emoji Premium lọt ra hàng ngoài của người hết Premium
}
function moBangPremium(): void { moChucNang('premium_emoji_khoa', { emoji: 'nut' }); mo.value = false; moPremium('chat'); }
function chamNgoai(e: PointerEvent): void {
  if (mo.value && goc.value && !goc.value.contains(e.target as Node)) mo.value = false;
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
      class="emoji noi thach th-nho" type="button" :class="{ mo: mo && o === 'cau' }"
      :aria-label="t('eb.noiNhanh')" :aria-expanded="mo && o === 'cau'"
      :disabled="!props.o.emojiReady.value"
      @click="batTat('noi')"
    ><MessageCircleMore :size="18" :stroke-width="2.4" /></button>
    <button
      class="emoji chon thach th-nho" type="button" :class="{ mo: mo && o !== 'cau' }"
      :aria-label="t('eb.chonEmoji')" :aria-expanded="mo && o !== 'cau'"
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
  <div v-if="mo" class="khung-chat khay" role="dialog" :aria-label="t('eb.chonEmoji')">
    <div class="tab-o" role="tablist">
      <button
        v-for="x in CAC_O" :key="x.id" class="thach th-nho" type="button" role="tab"
        :class="{ chon: o === x.id, pm: x.id === 'premium' }" :aria-selected="o === x.id" :aria-label="t(`eb.o.${x.id}` as 'eb.o.cau')"
        @click="chonO(x.id)"
      ><MessageCircleMore v-if="x.id === 'cau'" :size="18" :stroke-width="2.4" aria-hidden="true" /><Crown v-else-if="x.id === 'premium'" :size="18" :stroke-width="2.6" aria-hidden="true" /><template v-else>{{ x.hinh }}</template></button>
    </div>
    <!-- NỘI DUNG Ô (26.11.2026, chủ dự án: "bấm ô bên trên nút bị tụt xuống, khó chịu"): khung neo ở ĐÁY, ô Câu nói (cao) ↔ ô
         emoji (thấp) làm khung đổi cao — nên HÀNG Ô nằm DƯỚI CÙNG (CSS `order`) để không dời chỗ dưới ngón tay. Máy thấp thì
         phần nội dung cuộn bên trong. -->
    <div class="noi-dung">
    <!-- Ô CÂU NÓI -->
    <div v-if="o === 'cau'" class="bang-noi" role="menu" :aria-label="t('eb.noiNhanh')">
      <button
        v-for="id in NOI_NHANH" :key="id" class="cau thach th-nho" type="button" role="menuitem"
        :disabled="!props.o.emojiReady.value" @click="guiNoi(id)"
      ><IconNoi :id="id" /><span>{{ t(`say.${id}` as 'say.gioi') }}</span></button>
    </div>
    <!-- Ô PREMIUM -->
    <div v-else-if="o === 'premium'" class="o-emoji" role="menu" :aria-label="t('tp.premium')">
      <div v-if="hienPremium()" class="be-luoi be-premium" :style="{ '--cot': 8 }">
        <button
          v-for="e in EMOJI_PREMIUM" :key="e"
          class="emoji thach th-nho" type="button" role="menuitem" :class="{ khoa: !daMuaPremium }"
          :disabled="!props.o.emojiReady.value" :aria-label="`${e} — ${t('tp.premium')}`" @click="guiEmojiPremium(e)"
        >{{ e }}<Crown class="vm" :size="9" :stroke-width="3" aria-hidden="true" /></button>
      </div>
      <button v-if="!daMuaPremium" class="thach th-vang mo-pm" type="button" @click="moBangPremium"><Crown :size="17" :stroke-width="2.6" aria-hidden="true" />{{ t('eb.moPremium') }}</button>
    </div>
    <!-- Ô EMOJI THƯỜNG -->
    <div v-else class="o-emoji" role="menu" :aria-label="t(`eb.o.${o}` as 'eb.o.cau')">
      <div class="be-luoi" :style="{ '--cot': cot }">
        <button
          v-for="e in dsO" :key="e"
          class="emoji thach th-nho" type="button" role="menuitem"
          :disabled="!props.o.emojiReady.value" @click="guiEmoji(e)"
        >{{ e }}</button>
      </div>
    </div>
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
/* KHUNG CHAT (26.11.2026): một khung neo góc trái ngay trên thanh; hàng ô ở trên, nội dung ô ở dưới. NỀN ĐẶC — bản trong suốt
   (1.10.45) bị chủ dự án bỏ ngay: "khó nhìn quá". Đừng làm mờ khung chọn nữa. */
.khung-chat {
  position: absolute; left: 6px; bottom: calc(100% + 6px); z-index: 30;
  width: min(340px, calc(100% - 12px)); display: flex; flex-direction: column; gap: 7px; padding: 7px;
  background: var(--panel-solid); border: 2px solid var(--line); border-radius: var(--r-lg, 16px);
  box-shadow: var(--elev-3, 0 14px 30px rgba(0, 0, 0, .25));
}
.tab-o { display: flex; gap: 4px; }
.tab-o .thach { flex: 1; min-width: 0; height: 36px; border-radius: 11px; display: grid; place-items: center; padding: 0; font-size: 18px; line-height: 1; }
.tab-o .thach.chon { --b1: #cfe0ff; --b2: #a9c4ff; --b3: #6a8ee6; --bc: #122a6b; color: #122a6b; }
:global([data-theme='dark'] .tab-o .thach.chon) { --b1: #b3c4ff; --b2: #8fa6ff; --b3: #6a83e0; --bc: #121729; color: #121729; }
.tab-o .thach.pm { --b1: #ffe590; --b2: #ffc83a; --b3: #d69a12; --bc: #4a3300; color: #4a3300; }
.tab-o .thach.pm.chon { outline: 3px solid #8a5a00; outline-offset: 1px; }
:global([data-theme='dark'] .tab-o .thach.pm.chon) { outline-color: #ffd36b; }
/* Ô câu nói: 10 câu cuộn trong ô trên máy thấp (SE) thay vì trồi khỏi màn */
.noi-dung { max-height: min(214px, 38vh); overflow-y: auto; overscroll-behavior: contain; }
/* HÀNG Ô Ở DƯỚI CÙNG khung, sát thanh emoji: khung neo đáy nên hàng ô đứng yên khi đổi ô (nội dung co giãn PHÍA TRÊN) —
   bản đầu để hàng ô trên cùng thì đổi ô là hàng ô nhảy dưới ngón tay; cố định chiều cao thì ô emoji thừa khoảng trống */
.khung-chat .tab-o { order: 2; }
.bang-noi {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  max-height: min(52vh, 420px);
}
.bang-noi .cau { min-height: 38px; padding: 4px 8px 6px 6px; display: flex; align-items: center; gap: 6px; text-align: left; justify-content: flex-start; font: 800 13px/1.2 var(--font-body); color: var(--fg); border-radius: 11px; min-width: 0; }
.bang-noi .cau span { min-width: 0; }
.o-emoji { display: flex; flex-direction: column; gap: 7px; }
.mo-pm { min-height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center; gap: 7px; font: 900 14.5px/1.2 var(--font-body); }
/* Nút ＋: icon nét, căn giữa (glyph emoji tự căn theo dòng chữ, svg thì không) */
.emoji.chon { display: inline-flex; align-items: center; justify-content: center; color: var(--fg); }
.be-luoi { display: grid; grid-template-columns: repeat(var(--cot, 8), minmax(0, 1fr)); gap: 4px; }
/* Trong lưới: nút giãn theo ô (không giữ 40px cố định của thanh) */
.be-luoi .emoji { flex: none; width: 100%; min-height: 36px; font-size: 21px; }
/* Hàng Premium: vạch vàng ngăn với ba hàng thường, mỗi nút có vương miện nhỏ ở góc */
.be-premium { gap: 5px; }
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
