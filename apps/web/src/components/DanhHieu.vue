<script setup lang="ts">
import { t, td } from '@/lib/i18n';
import type { Achievement, ThongKe } from '@/lib/achievements';
import { num } from '@/lib/format';
import { MAU_BAC } from '@/lib/ketcuc-fx';

/**
 * Danh sách danh hiệu của MỘT nhóm. Đã có thì sáng; chưa có thì mờ, kèm thanh
 * tiến độ (danh hiệu đếm) và nút "Chinh phục" mở ngay bàn đúng điều kiện.
 * Bí mật thì ẩn tên tới khi đạt. Theme còn khoá thì báo cần bao nhiêu điểm thay
 * vì để nút bấm vào bàn không dựng được.
 */
defineProps<{
  ds: Achievement[];
  daCo: ReadonlySet<string>;
  tk: ThongKe;
  /** theme id → số điểm cần để mở, chỉ chứa theme ĐANG KHOÁ. */
  themeKhoa: Record<string, number>;
}>();
const emit = defineEmits<{ 'chinh-phuc': [Achievement] }>();
</script>

<template>
  <ul class="danh-hieu">
    <li v-for="a in ds" :key="a.id" :class="{ co: daCo.has(a.id) }">
      <!-- Huy hiệu tròn mang MÀU BẬC, cùng bảng màu với cảnh mở khoá (MoKhoaFx) -->
      <span
        class="huy" :class="{ khoa: !daCo.has(a.id) }" :title="td(`fx.bac.${a.bac ?? 'dong'}`)"
        :style="{ background: `linear-gradient(135deg, ${MAU_BAC[a.bac ?? 'dong'].a}, ${MAU_BAC[a.bac ?? 'dong'].b})` }"
        aria-hidden="true"
      >{{ daCo.has(a.id) ? '★' : a.biMat ? '?' : '' }}</span>
      <span class="chu">
        <b>{{ a.biMat && !daCo.has(a.id) ? t('dh.biMat') : a.name }}</b><br>
        <small>{{ a.biMat && !daCo.has(a.id) ? t('dh.biMatGoiY') : a.hint }}</small>
        <span v-if="a.tienDo && !daCo.has(a.id)" class="tien-do">
          <i :style="{ width: `${Math.min(100, (a.tienDo(tk)[0] / a.tienDo(tk)[1]) * 100)}%` }" />
          <em>{{ num(Math.min(a.tienDo(tk)[0], a.tienDo(tk)[1])) }}/{{ num(a.tienDo(tk)[1]) }}</em>
        </span>
      </span>
      <template v-if="!daCo.has(a.id) && a.chinhPhuc">
        <small v-if="a.chinhPhuc.theme && themeKhoa[a.chinhPhuc.theme]" class="khoa">
          {{ t('dhd.moO', { n: num(themeKhoa[a.chinhPhuc.theme]!) }) }}
        </small>
        <button
          v-else class="di" type="button"
          :aria-label="t('kq.chinhPhucAria', { ten: a.name })" @click="emit('chinh-phuc', a)"
        >{{ t('kq.chinhPhuc') }}</button>
      </template>
    </li>
  </ul>
</template>

<style scoped>
.danh-hieu { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.danh-hieu li {
  display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 6px 8px 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm);
}
.danh-hieu li:not(.co) .huy, .danh-hieu li:not(.co) .chu > b, .danh-hieu li:not(.co) .chu > small { opacity: .62; }
.danh-hieu li.co { background: color-mix(in srgb, var(--warn) 14%, transparent); }
.huy {
  flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; font-size: 15px; font-weight: 800; color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .45); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .45);
}
/* Chưa có: vẫn thấy màu bậc (biết đây là danh hiệu vàng hay đồng) nhưng mờ hẳn */
.huy.khoa { filter: grayscale(.55) brightness(.75); opacity: .55; }
.chu { flex: 1; min-width: 0; }
.chu small { color: var(--muted); }
.tien-do {
  position: relative; display: block; height: 14px; margin-top: 4px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--fg) 10%, transparent);
}
.tien-do i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.tien-do em {
  position: relative; display: block; text-align: center; font-style: normal;
  font-size: 10px; line-height: 14px; font-weight: 800; color: var(--fg);
}
.khoa { flex: 0 0 auto; max-width: 84px; text-align: right; color: var(--muted); font-size: 11px; }
/* Nút nhỏ hơn 44px về hình nhưng vùng chạm đủ: li cao ≥44 và ::after nới ra */
.di {
  position: relative; flex: 0 0 auto; min-height: 34px; padding: 0 12px; border-radius: 999px;
  border: 0; background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap;
}
.di::after { content: ''; position: absolute; inset: -6px -4px; }
</style>
