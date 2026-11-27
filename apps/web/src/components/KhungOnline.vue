<script setup lang="ts">
/**
 * KHUNG MÀN CHƠI ONLINE — DÙNG CHUNG cho MỌI kiểu chơi online (28.11.2026, chủ dự án: "phải làm cơ chế để tái sử dụng, vì
 * sau này có thể làm ra các thể loại chơi khác"). Mỗi kiểu chơi CHỈ viết phần riêng của mình rồi cắm vào khe:
 *   · `#hud`    — thanh trên cùng của kiểu chơi (ghép cặp: HudBar; Tìm Thẻ: điểm + lượt);
 *   · `#nguoi`  — hàng người chơi: DaiNguoiChoi (dùng chung) hoặc dạng riêng (thanh đội);
 *   · `#bao`    — dải báo của kiểu chơi, nổi trên bàn (chuyển lượt, mất mạng…);
 *   · mặc định  — BÀN CHƠI;
 *   · `#ket`    — ăn mừng + bảng kết quả hết ván.
 * Khung tự lo phần CHUNG, giữ đúng thứ tự + chữ + CSS của màn ghép cặp cũ (tách nguyên văn từ OnlineGame):
 *   · đang vào lại / nước bấm không tới server (dòng vàng), mạng của mình mất hẳn (dòng đỏ dưới bàn);
 *   · bong bóng emoji + câu nói nhanh (EmojiBlast, LoiNoi — neo theo `data-chip-for` của hàng người chơi);
 *   · đếm ngược vào ván trên lớp phủ tối (DemNguocPhu; `diTruoc` = dòng "X đi trước" của ván có lượt);
 *   · thanh emoji ở đáy + phần chừa chỗ cho nó.
 * Thêm thứ CHUNG cho mọi kiểu chơi thì thêm Ở ĐÂY, không chép vào từng màn (bài học Tìm Thẻ 27.11.2026: thiếu báo mất mạng,
 * bong bóng chat sai chỗ, đếm ngược không lớp phủ — vì màn đó tự dựng lại khung).
 */
import { TriangleAlert } from 'lucide-vue-next';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';
import { t } from '@/lib/i18n';
import DemNguocPhu from './DemNguocPhu.vue';
import EmojiBlast from './EmojiBlast.vue';
import EmojiDock from './EmojiDock.vue';
import LoiNoi from './LoiNoi.vue';

defineProps<{
  o: ReturnType<typeof useOnlineRoom>;
  /** Dòng "X đi trước" dưới số đếm ngược vào ván (ván có lượt); bỏ trống = chỉ con số. */
  diTruoc?: { mat?: string; anh?: string; chu: string } | null;
}>();
</script>

<template>
  <section class="khung-online">
    <slot name="hud" />
    <slot name="nguoi" />

    <!-- Người xem: KHÔNG còn dải "👁️ … bạn đang xem trận đấu" chiếm cả hàng — chip ChipXem ở hàng trên cùng nói thay -->
    <p v-if="o.reconnecting.value" class="reconnect" role="status">{{ t('og.dangVaoLai') }}</p>
    <!-- Nước bấm không tới được server: phải NÓI RA. Im lặng thì người chơi cứ
         bấm vào chỗ không ai nghe cho tới khi hết lượt. -->
    <p v-else-if="o.netTrouble.value" class="reconnect" role="status"><TriangleAlert :size="15" :stroke-width="2.5" class="ic-n" aria-hidden="true" /> {{ o.netTrouble.value }}</p>
    <!-- Người khác mất kết nối: DẢI BÁO CHUNG (useBaoPhong, đứng yên tới khi họ vào lại) + nhãn trên hàng người chơi -->

    <!-- Dải thông báo TRÊN bàn (không che thẻ) — quy tắc ở global.css -->
    <div class="notice-bar">
      <EmojiBlast :o="o" />
      <LoiNoi :o="o" />
      <slot name="bao" />
    </div>

    <slot />

    <!-- Đếm ngược vào ván — lớp phủ tối kín màn (DemNguocPhu teleport ra #app) -->
    <DemNguocPhu v-if="o.countdownLeft.value !== null" :n="o.countdownLeft.value" :di-truoc="diTruoc" />

    <!-- Mất mạng hẳn thì nói to, vì lúc đó bấm gì cũng không ăn -->
    <p v-if="o.netHien.value === 'lost'" class="mynet lost" role="status">
      {{ t('og.mangCoVanDe') }}
    </p>

    <!-- Emoji chat (ON-08): thanh CỐ ĐỊNH đáy màn, dùng chung cho ván và màn kết quả (EmojiDock.vue) — chừa chỗ -->
    <EmojiDock :o="o" />
    <div class="eb-cho" aria-hidden="true" />

    <slot name="ket" />
  </section>
</template>

<style scoped>
.reconnect {
  margin: 0; padding: 6px 12px; border-radius: var(--r-sm); text-align: center;
  font-size: var(--text-sm); background: color-mix(in srgb, var(--warn) 16%, transparent);
}
/* Mạng của mình: một dòng mảnh, chỉ hiện khi có gì đáng nói */
.mynet {
  margin: 0; text-align: center; font-size: var(--text-xs); color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.mynet.lost { color: var(--bad); font-weight: 800; }
.ic-n { vertical-align: -2px; flex: none; }
</style>
