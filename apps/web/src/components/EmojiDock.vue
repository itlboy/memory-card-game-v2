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
.eb-dock {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 18;
  /* 4/5px (22.11.2026): thanh cao đúng 48px = --eb-dock-h (trước 7/8px ra 54px, lố hơn chỗ màn trên chừa) */
  padding: 4px 6px calc(5px + env(safe-area-inset-bottom, 0px));
  background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
</style>
