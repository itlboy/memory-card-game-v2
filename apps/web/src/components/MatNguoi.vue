<script setup lang="ts">
/**
 * MẶT NGƯỜI CHƠI CÓ ẢNH (11.11.2026, mockup duyệt https://claude.ai/artifact/8RyNFCMoTUEE2w8SP5Xybj):
 * đăng nhập Google → ảnh Google tròn viền trắng; còn lại (chưa đăng nhập, Apple, bot) → mặt thú
 * qua MatBot như cũ. Ảnh tải lỗi / mất mạng → tự quay về mặt thú.
 * Cỡ theo `1.3em` để theo cỡ chữ của chỗ đặt, như emoji.
 */
import { ref, watch } from 'vue';
import MatBot from './MatBot.vue';

const props = defineProps<{ mat?: string; anh?: string | null }>();
const loi = ref(false);
watch(() => props.anh, () => { loi.value = false; });
</script>

<template>
  <img v-if="anh && !loi" class="anh-nguoi" :src="anh" alt="" referrerpolicy="no-referrer" loading="lazy" @error="loi = true">
  <MatBot v-else :mat="mat ?? '🙂'" />
</template>

<style scoped>
.anh-nguoi {
  display: inline-block; width: 1.3em; height: 1.3em; border-radius: 50%; object-fit: cover; vertical-align: middle;
  border: 2px solid #fff; box-shadow: 0 2px 0 rgba(29, 42, 90, .35); box-sizing: border-box;
}
</style>
