<script setup lang="ts">
/**
 * Icon của tuỳ chọn bàn chơi và thẻ đặc biệt: ô bo góc ĐỔ GRADIENT với hình
 * trắng bên trong.
 *
 * Vì sao một component chứ không phải emoji: emoji không đổi màu theo trạng
 * thái, mỗi hệ điều hành vẽ một kiểu, và cỡ thì không kiểm soát được. Ở đây
 * năm màu tuỳ chọn chính là năm màu chế độ cũ (cam = đua thời gian, đỏ hồng =
 * sinh tồn, xanh ngọc = chớp nhoáng, xanh dương = cổ điển) — thứ người chơi đã
 * quen không mất đi, chỉ đổi vai.
 *
 * DÙNG CHUNG cho màn tuỳ chọn, bảng Luật chơi và chip phòng chờ: đọc luật xong
 * là nhận ra ngay hàng nào trong màn cài đặt (quy tắc ở CLAUDE.md).
 *
 * Gradient khai báo MỘT LẦN cho cả trang qua <IconDefs>, ở đây chỉ <use>: mỗi
 * icon tự mang <defs> riêng thì id trùng nhau và trình duyệt lấy cái đầu tiên,
 * nên cả bàn ra cùng một màu.
 */
export type IconName =
  | 'time' | 'lives' | 'peek' | 'shuffle' | 'special'
  | 'swap' | 'x2' | 'eye' | 'freeze' | 'campaign';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 24 });
</script>

<template>
  <svg
    class="opt-ico" :width="props.size" :height="props.size" viewBox="0 0 40 40"
    aria-hidden="true" focusable="false"
  >
    <use :href="`#mmi-${props.name}`" />
  </svg>
</template>

<style scoped>
/* inline-block chứ KHÔNG phải block: icon hay nằm GIỮA một dòng chữ ("Sắp mở cả
   bàn — chuẩn bị ghi nhớ!"), mà block thì nó tự chiếm trọn một dòng và đẩy chữ
   xuống dòng thứ hai — đã thấy thật ở thông báo đếm ngược trước ván.
   vertical-align: middle để nó ngồi giữa dòng chữ thay vì tụt xuống đường cơ sở. */
.opt-ico {
  display: inline-block; vertical-align: middle;
  flex: 0 0 auto; border-radius: 8px;
}
</style>
