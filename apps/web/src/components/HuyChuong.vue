<script setup lang="ts">
/**
 * HUY CHƯƠNG TRÒN của trang Danh hiệu (chủ dự án duyệt mockup 09.11.2026,
 * https://claude.ai/artifact/S6iPWAV8MkwtHe22t58qPf). Thay "lá bài úp" cũ: 93 lá úp giống hệt
 * nhau thì không nhận ra danh hiệu nào. Nay mỗi cái MỘT BIỂU TƯỢNG riêng, VÒNG MÀU theo bậc
 * (đồng/bạc/vàng/bí mật — MAU_BAC). Chưa có = mờ xám, viền bậc nhạt; đang dở = vòng tiến độ xanh.
 * Bí mật chưa có = "?".
 */
import { computed } from 'vue';
import { MAU_BAC } from '@/lib/ketcuc-fx';
import { iconCua, type Achievement } from '@/lib/achievements';

const props = defineProps<{ a: Achievement; co: boolean; /** 0..1, chỉ khi chưa có */ tien?: number | null; lon?: boolean }>();
const mau = computed(() => MAU_BAC[props.a.bac ?? 'dong']);
const icon = computed(() => (props.a.biMat && !props.co ? { chu: '?', so: true } : iconCua(props.a)));
</script>

<template>
  <span class="md" :class="{ co, chua: !co, lon }" :style="{ '--a': mau.a, '--b': mau.b }" aria-hidden="true">
    <svg v-if="!co && tien != null && tien > 0" class="vong" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="29" pathLength="100" :stroke-dasharray="`${Math.round(Math.min(1, tien) * 100)} 100`" />
    </svg>
    <span class="mat">
      <span v-if="icon.so" class="so">{{ icon.chu }}</span>
      <span v-else class="ic">{{ icon.chu }}</span>
    </span>
    <i v-if="co" class="tick">✓</i>
  </span>
</template>

<style scoped>
/* Màu CỐ ĐỊNH (không token skin): huy chương là đồ vật kim loại, giữ nguyên ở nền tối */
.md {
  position: relative; flex: none; display: grid; place-items: center;
  width: 58px; height: 58px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .55), transparent 45%), linear-gradient(145deg, var(--a), var(--b));
  box-shadow: 0 4px 0 color-mix(in srgb, var(--b) 75%, #000), 0 6px 14px rgba(0, 0, 0, .18);
}
.mat {
  width: 76%; height: 76%; border-radius: 50%; display: grid; place-items: center;
  background: #fffaea; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .12);
}
.ic { font-size: 25px; line-height: 1; }
.so { font: 800 18px/1 var(--font-display); color: #5a3a12; }
.tick {
  position: absolute; right: -3px; bottom: -3px; width: 20px; height: 20px; border-radius: 50%;
  background: #3fa320; color: #fff; border: 2px solid #fff;
  font: 800 12px/16px var(--font-body, sans-serif); font-style: normal; text-align: center;
}
.chua { background: linear-gradient(145deg, #e3e8f4, #c8d0e4); box-shadow: 0 4px 0 #b3bdd6; }
.chua .mat { background: #f2f4fa; }
.chua .ic, .chua .so { filter: grayscale(1); opacity: .35; }
/* Viền màu bậc nhạt: chưa có vẫn biết là đồng/bạc/vàng */
.chua::after { content: ''; position: absolute; inset: -1px; border-radius: 50%; border: 3px solid var(--b); opacity: .35; }
.vong { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px); transform: rotate(-90deg); }
.vong circle { fill: none; stroke: #3fa320; stroke-width: 4; stroke-linecap: round; }
.lon { width: 96px; height: 96px; }
.lon .ic { font-size: 42px; }
.lon .so { font-size: 30px; }
.lon .vong { inset: -7px; width: calc(100% + 14px); height: calc(100% + 14px); }
</style>
