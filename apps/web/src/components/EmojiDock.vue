<script setup lang="ts">
import EmojiBar from './EmojiBar.vue';

/**
 * THANH EMOJI CỐ ĐỊNH ĐÁY MÀN (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 2 —
 * chủ dự án: "hàng icon chat nên cố định bên dưới khi chơi online / phòng chờ / màn cuối, không cần làm một dòng
 * chat khác"). MỘT chỗ duy nhất cho cả ba màn: trước đây phòng chờ có khối chat kẻ ngang giữa trang, màn kết quả
 * nhét thanh vào trong hộp kết quả.
 *
 * Teleport vào #app và `position: absolute; bottom: 0` — #app là `position: relative` và đã khoá chiều cao màn, nên
 * thanh nằm đúng đáy CỘT GAME (máy tính: không trải ra cả cửa sổ) và tự phủ dải home của iPhone (đệm env() bên
 * trong). z 18: TRÊN lớp phủ kết quả (17) để vẫn bấm được khi hộp kết quả mở, DƯỚI các hộp thoại khác (≥ 20).
 * Màn phía trên phải chừa chỗ: đặt `<div class="eb-cho" />` (cao `--eb-dock-h`) ở cuối nội dung.
 * Khán giả: EmojiBar tự không vẽ gì → thanh không hiện.
 */
const props = defineProps<{ o: InstanceType<typeof EmojiBar>['$props']['o'] }>();
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');
</script>

<template>
  <Teleport to="#app" :disabled="!coApp">
    <div v-if="!props.o.spectator.value" class="eb-dock">
      <EmojiBar :o="props.o" />
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * CAO BẰNG HÀNG NÚT, KHÔNG DẢI NỀN (23.11.2026, chủ dự án: "chiều cao thanh icon chat cao quá, đang bị đè vào các nút
 * chức năng… cho bằng với trước kia"). Bản 22.11 là một dải nền mờ có viền, đệm 7/8px rồi 4/5px: trên iPhone dải đó
 * cộng cả vùng an toàn đáy thành 82px, và ở máy nhỏ đè 4px lên nút "Thoát phòng" của bảng kết quả. Nay chỉ còn hàng nút
 * (38px) + 2px mỗi bên = 42px = `--eb-dock-h`; nền trong suốt nên vùng an toàn đáy không thành dải màu.
 */
.eb-dock {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 18;
  /* đáy: vùng an toàn TRỪ phần lún (`--eb-lun`, global.css) — trên iPhone hàng nút cách đáy màn 18px thay vì 36px */
  padding: 2px 6px calc(2px + env(safe-area-inset-bottom, 0px) - var(--eb-lun, 0px));
}
</style>
