<script setup lang="ts">
import { BOARD_SIZES } from '@mm/engine';

/**
 * CHỌN SỐ THẺ — bước thay cho "chọn cấp độ" ở mọi chế độ ngoài Chiến dịch.
 *
 * Ngoài Chiến dịch, cấp không còn là độ khó: độ khó nằm ở năm tuỳ chọn bàn chơi
 * ở bước sau. Thứ duy nhất cấp còn quyết định là cỡ bàn, nên hỏi thẳng số thẻ.
 * Giá trị phát ra vẫn là một số CẤP hợp lệ (`BOARD_SIZES[].level`) để engine,
 * server và khoá lưu kỷ lục không phải đổi gì.
 *
 * Ô chỉ có MỘT con số. Bản đầu vẽ thêm hình bàn thu nhỏ trong mỗi ô, và nó vừa
 * thừa (người chơi chọn số thẻ, không chọn hình dáng bàn) vừa bóp chữ xuống
 * còn không đọc được — năm hàng thì ô chỉ cao 88px, hình bàn ăn hết chỗ.
 */
const props = defineProps<{
  /** Cấp đang chọn — dùng để tô ô tương ứng. */
  level: number;
  /** Số biểu tượng gom được từ các theme đang chọn. Bàn cần nhiều cặp hơn số
   *  này thì KHÔNG dựng nổi — chặn ở đây, không thì engine ném lỗi trắng màn. */
  symbolCount: number;
}>();
const emit = defineEmits<{ play: [level: number] }>();

const blocked = (pairs: number): boolean => pairs > props.symbolCount;
</script>

<template>
  <div class="options fill size-grid" role="radiogroup" aria-label="Số thẻ">
    <button
      v-for="s in BOARD_SIZES" :key="s.level"
      class="option size-opt" type="button" role="radio"
      :aria-checked="props.level === s.level"
      :aria-disabled="blocked(s.pairs)"
      :aria-label="`${s.pairs * 2} thẻ`"
      :disabled="blocked(s.pairs)"
      @click="emit('play', s.level)"
    >
      <strong class="num">{{ s.pairs * 2 }}</strong>
      <small>{{ blocked(s.pairs) ? 'thiếu biểu tượng' : 'thẻ' }}</small>
    </button>
  </div>
</template>

<style scoped>
/* MƯỜI cỡ bàn = 2 cột × 5 hàng, TRÒN HÀNG (không ô lẻ ở hàng cuối). Không dùng
   `.grid3` toàn cục được: 10 không chia hết cho 3 nên hàng cuối còn một ô lệch
   hẳn sang trái. Cột app cố định 440px nên hai cột vẫn cho ô rộng ~190px.

   Dáng ô, viền, bo góc, hover và trạng thái đang chọn đều lấy từ `.option`
   trong wizard.css — KHÔNG chép lại ở đây. */
.size-grid { grid-template-columns: repeat(2, 1fr); }
.size-opt { gap: 0; padding: 4px; }

/* Con số là toàn bộ nội dung ô nên được phép to hơn `.option strong` chung, và
   co theo CHIỀU CAO ô là chính: năm hàng thì chiều cao mới là thứ khan hiếm.
   tabular-nums để "4" và "56" không làm ô nhảy chữ. */
.size-opt .num {
  font-size: clamp(24px, min(34cqw, 52cqh), 46px);
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}
/* `.option small` toàn cục tính theo 5cqw — hợp với ô có icon và hai dòng chữ,
   nhưng ở đây ô chỉ có số nên nó co xuống 9,5px (đo được), bé đến mức thừa. */
.size-opt small {
  letter-spacing: .3px;
  font-size: clamp(11px, min(11cqw, 17cqh), 15px);
}
</style>
