<script setup lang="ts">
import { BOARD_SIZES } from '@mm/engine';
import { TriangleAlert } from 'lucide-vue-next';

/**
 * CHỌN SỐ THẺ — bước thay cho "chọn cấp độ" ở mọi chế độ ngoài Chiến dịch.
 *
 * Ngoài Chiến dịch, cấp không còn là độ khó: độ khó nằm ở năm tuỳ chọn bàn chơi
 * ở bước sau. Thứ duy nhất cấp còn quyết định là cỡ bàn, nên hỏi thẳng số thẻ.
 * Giá trị phát ra vẫn là một số CẤP hợp lệ (`BOARD_SIZES[].level`) để engine,
 * server và khoá lưu kỷ lục không phải đổi gì.
 */
const props = defineProps<{
  /** Cấp đang chọn — dùng để tô ô tương ứng. */
  level: number;
  /** Số biểu tượng gom được từ các theme đang chọn. Bàn cần nhiều cặp hơn số
   *  này thì KHÔNG dựng nổi — chặn ở đây, không thì engine ném lỗi trắng màn. */
  symbolCount: number;
}>();
const emit = defineEmits<{ play: [level: number] }>();

const cardsOf = (pairs: number): number => pairs * 2;
const blocked = (pairs: number): boolean => pairs > props.symbolCount;
</script>

<template>
  <div class="options fill size-grid" role="radiogroup" aria-label="Số thẻ">
    <button
      v-for="s in BOARD_SIZES" :key="s.level"
      class="option" type="button" role="radio"
      :aria-checked="props.level === s.level"
      :aria-disabled="blocked(s.pairs)"
      :aria-label="`${cardsOf(s.pairs)} thẻ, bàn ${s.cols} nhân ${s.rows}`"
      :disabled="blocked(s.pairs)"
      @click="emit('play', s.level)"
    >
      <!-- Hình bàn thu nhỏ: đọc "6×7" không hình dung ra bàn, nhìn thì thấy ngay -->
      <span
        class="grid-preview" aria-hidden="true"
        :style="{ gridTemplateColumns: `repeat(${s.cols}, 1fr)`, aspectRatio: `${s.cols * 3} / ${s.rows * 4}` }"
      >
        <i v-for="n in s.cols * s.rows" :key="n" />
      </span>
      <span class="text">
        <strong>{{ cardsOf(s.pairs) }} thẻ</strong>
        <small v-if="blocked(s.pairs)" class="need">
          <TriangleAlert :size="11" /> thiếu biểu tượng
        </small>
        <small v-else>{{ s.cols }}×{{ s.rows }}</small>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* MƯỜI cỡ bàn = 2 cột × 5 hàng, TRÒN HÀNG (không ô lẻ ở hàng cuối). Không dùng
   `.grid3` được: 10 không chia hết cho 3 nên hàng cuối còn một ô lệch hẳn sang
   trái. Cột app cố định 440px nên hai cột vẫn cho ô rộng ~210px. */
.size-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: minmax(0, 1fr); }
/* Ô nằm ngang: hình bàn bên trái, chữ bên phải. Năm hàng thì ô thấp, xếp dọc
   sẽ bóp hình bàn xuống còn vài pixel. */
.size-grid .option {
  flex-direction: row; align-items: center; justify-content: center;
  gap: 10px; padding: 6px 10px;
}
.size-grid .option .text { display: flex; flex-direction: column; align-items: flex-start; }
.size-grid .grid-preview { max-width: none; width: auto; height: 100%; margin: 0; flex: 0 0 auto; }
.size-grid .option[disabled] { opacity: .45; }
.need { display: inline-flex; align-items: center; gap: 3px; color: var(--warn, #f59e0b); }
</style>
