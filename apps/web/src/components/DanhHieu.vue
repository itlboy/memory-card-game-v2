<script setup lang="ts">
import { computed } from 'vue';
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements';

/**
 * Danh sách danh hiệu: đã có thì sáng, chưa có thì mờ kèm nút "Chinh phục" mở
 * ngay bàn đúng điều kiện. Dùng cho cả người đăng nhập và người chơi ẩn danh.
 */
const props = defineProps<{ daCo: Set<string> }>();
const emit = defineEmits<{ 'chinh-phuc': [Achievement] }>();
const so = computed(() => ACHIEVEMENTS.filter((a) => props.daCo.has(a.id)).length);
</script>

<template>
  <h3 class="tieu-de">Danh hiệu <small>{{ so }}/{{ ACHIEVEMENTS.length }}</small></h3>
  <ul class="danh-hieu">
    <li v-for="a in ACHIEVEMENTS" :key="a.id" :class="{ co: daCo.has(a.id) }">
      <span class="huy" aria-hidden="true">{{ daCo.has(a.id) ? '🏅' : '🔒' }}</span>
      <span class="chu"><b>{{ a.name }}</b><br><small>{{ a.hint }}</small></span>
      <button
        v-if="!daCo.has(a.id) && a.chinhPhuc" class="di" type="button"
        :aria-label="`Chinh phục: ${a.name}`" @click="emit('chinh-phuc', a)"
      >Chinh phục</button>
    </li>
  </ul>
</template>

<style scoped>
.tieu-de {
  margin: 14px 0 6px; font-size: var(--text-sm);
  text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
}
.tieu-de small { font-weight: 400; letter-spacing: 0; text-transform: none; }
.danh-hieu { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.danh-hieu li {
  display: flex; gap: 10px; align-items: center; padding: 6px 8px 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm);
}
.danh-hieu li:not(.co) .huy, .danh-hieu li:not(.co) .chu { opacity: .6; }
.danh-hieu li.co { background: color-mix(in srgb, var(--warn) 14%, transparent); }
.huy { font-size: 22px; flex: 0 0 auto; }
.chu { flex: 1; min-width: 0; }
.chu small { color: var(--muted); }
/* Nút nhỏ hơn 44px về hình nhưng vùng chạm đủ: li cao ≥44 và nút chiếm cả cạnh phải */
.di {
  position: relative; flex: 0 0 auto; min-height: 34px; padding: 0 12px; border-radius: 999px;
  border: 0; background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap;
}
.di::after { content: ''; position: absolute; inset: -6px -4px; }
</style>
