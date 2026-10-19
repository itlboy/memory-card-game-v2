<script setup lang="ts">
import { t, td } from '@/lib/i18n';
import type { Achievement, ThongKe } from '@/lib/achievements';
import { num } from '@/lib/format';
import { iconCua } from '@/lib/achievements';
import HuyHieu from './HuyHieu.vue';

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
  themeKhoa: ReadonlySet<string>;
}>();
const emit = defineEmits<{ 'chinh-phuc': [Achievement] }>();
</script>

<template>
  <ul class="danh-hieu">
    <li
      v-for="(a, i) in ds" :key="a.id" :class="daCo.has(a.id) ? 'co' : 'khay-nho'"
      :title="daCo.has(a.id) ? a.hint : undefined" :style="{ '--tre': `${(i % 7) * -0.6}s` }"
    >
      <!-- Huy hiệu = lá bài: chưa có thì ÚP, có rồi thì NGỬA (HuyHieu.vue, cùng
           hình với cảnh mở khoá MoKhoaFx) -->
      <span class="huy" :title="td(`fx.bac.${a.bac ?? 'dong'}`)">
        <HuyHieu nho :bac="a.bac" :icon="iconCua(a)" :mat="daCo.has(a.id) ? 'truoc' : 'sau'" />
      </span>
      <span class="chu">
        <b>{{ a.biMat && !daCo.has(a.id) ? t('dh.biMat') : a.name }}</b>
        <small :class="{ 'sr-only': daCo.has(a.id) }">{{ a.biMat && !daCo.has(a.id) ? t('dh.biMatGoiY') : a.hint }}</small>
        <span v-if="a.tienDo && !daCo.has(a.id)" class="tien-do">
          <i :style="{ width: `${Math.min(100, (a.tienDo(tk)[0] / a.tienDo(tk)[1]) * 100)}%` }" />
          <em>{{ num(Math.min(a.tienDo(tk)[0], a.tienDo(tk)[1])) }}/{{ num(a.tienDo(tk)[1]) }}</em>
        </span>
      </span>
      <template v-if="!daCo.has(a.id) && a.chinhPhuc">
        <small v-if="a.chinhPhuc.theme && themeKhoa.has(a.chinhPhuc.theme)" class="khoa">
          {{ t('dhd.premium') }}
        </small>
        <button
          v-else class="di thach th-xanh th-nho" type="button"
          :aria-label="t('kq.chinhPhucAria', { ten: a.name })" @click="emit('chinh-phuc', a)"
        >{{ t('kq.chinhPhuc') }}</button>
      </template>
    </li>
  </ul>
</template>

<style scoped>
/* ALBUM THẺ (mockup A chủ dự án duyệt 19.10.2026 https://claude.ai/artifact/2SBFXNhJQgs9EAk9cyjtMd):
   lưới 3 cột, mỗi danh hiệu một ô thẻ dọc. Đã có = thẻ NGỬA, nền vàng, vệt sáng quét qua huy hiệu;
   chưa có = thẻ ÚP (mặt lưng sao), gợi ý ngắn, tiến độ, nút Chinh phục. Gợi ý của thẻ đã có ẩn khỏi
   mắt (đọc ở `title` + trình đọc màn hình) — ô hẹp, chỗ dành cho tên. */
.danh-hieu { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.danh-hieu li {
  display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0;
  padding: 10px 6px; border-radius: 16px; text-align: center; font-size: var(--text-sm);
  background: color-mix(in srgb, var(--fg) 5%, transparent);
}
/* Thẻ đã có: khối kẹo vàng nhạt (giữ nguyên ở nền tối), chữ xanh đậm đi cặp. KHÔNG mang `khay-nho`:
   khay của Kẹo tối đè nền thành navy → chữ đậm trên nền đậm (đã dính lúc làm) */
.danh-hieu li.co {
  background: linear-gradient(#fffbea, #fff0bf); color: #24305e;
  box-shadow: 0 3px 0 #f0c85a, 0 8px 16px rgba(240, 170, 0, .22);
}
.huy { position: relative; flex: none; width: 66px; height: 72px; overflow: hidden; border-radius: 10px; }
/* Vệt sáng: mỗi thẻ lệch nhịp (`--tre`) để cả album không nhấp nháy cùng lúc */
.co .huy::after {
  content: ''; position: absolute; inset: -20% 30%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .85), transparent);
  transform: translateX(-120%) rotate(20deg); animation: dh-quet 4.2s ease-in-out infinite; animation-delay: var(--tre, 0s);
}
@keyframes dh-quet { 0%, 60% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(160%) rotate(20deg); } }
@media (prefers-reduced-motion: reduce) { .co .huy::after { animation: none; display: none; } }
.chu { display: flex; flex-direction: column; gap: 2px; width: 100%; min-width: 0; }
.chu b { font-weight: 800; font-size: 12.5px; line-height: 1.2; overflow-wrap: break-word; }
.chu small { color: var(--muted); font-size: 10.5px; line-height: 1.25; }
/* Ô hẹp + từ dài ("«Божественного"): ngắt có gạch nối theo `lang`, cùng lắm mới bẻ từ — không tràn ô */
.chu b, .chu small { hyphens: auto; overflow-wrap: anywhere; }
.danh-hieu li:not(.co) .chu > b, .danh-hieu li:not(.co) .chu > small { opacity: .8; }
.tien-do {
  position: relative; display: block; height: 14px; margin-top: 4px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--fg) 10%, transparent);
}
.tien-do i { position: absolute; inset: 0 auto 0 0; background: var(--nhan-nen); }
.tien-do em {
  position: relative; display: block; text-align: center; font-style: normal;
  font-size: 10px; line-height: 14px; font-weight: 800; color: var(--fg);
}
.khoa { color: var(--muted); font-size: 11px; }
/* Nút nhỏ hơn 44px về hình nhưng vùng chạm đủ: ::after nới ra */
.di {
  position: relative; width: 100%; margin-top: auto; min-height: 30px; padding: 0 6px; border-radius: 999px;
  border: 0; background: var(--nhan-nen);
  color: var(--nhan-chu); font: inherit; font-size: 11.5px; font-weight: 800; line-height: 1.1; cursor: pointer;
  padding-block: 4px; text-wrap: balance;   /* "Nächstes Ziel", "Следующая цель" không vừa một dòng ô hẹp */
}
.di::after { content: ''; position: absolute; inset: -7px -3px; }
</style>
