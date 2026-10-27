<script setup lang="ts">
/**
 * MÀN TẠM DỪNG DÙNG CHUNG — ván thường (GameScreen) và Mưa Thẻ (MuaThe). Tách ra 27.10.2026 vì Mưa Thẻ
 * tự dựng một hộp khác (chữ thường, không ruy băng) — chủ dự án: "font chữ không đúng với các nút tạm
 * dừng khác". Một chỗ vẽ thì hai màn không lệch nhau được nữa.
 *
 * Teleport vào #app (không phải body): phủ KÍN cột game kể cả thanh trên, nhưng không tràn cả cửa sổ
 * máy tính — cùng luật với lớp hiệu ứng kết ván. NỀN ĐẶC, không mờ kính: bản blur để lộ hình lá nhoè và
 * mép khối — nhìn như lỗi (chủ dự án báo).
 */
import { Pause, Play } from 'lucide-vue-next';
import { t } from '@/lib/i18n';

defineProps<{
  /** Ô số liệu (nhãn + giá trị đã định dạng). */
  soLieu: { nhan: string; gt: string }[];
  /** Vạch tiến độ 0..1 dưới các ô số. */
  tienDo: number;
}>();
const emit = defineEmits<{ tiep: []; thoat: [] }>();
</script>

<template>
  <Teleport to="#app">
    <div class="tam-dung" role="dialog" aria-modal="true" :aria-label="t('hud.tamDung')">
      <div class="panel hop-dung">
        <h2 class="ruy-bang thach th-do"><Pause :size="22" aria-hidden="true" />{{ t('hud.tamDung') }}</h2>
        <dl class="so-lieu">
          <div v-for="o in soLieu" :key="o.nhan" class="khay-nho khay-noi"><dt>{{ o.nhan }}</dt><dd>{{ o.gt }}</dd></div>
        </dl>
        <span class="vach" aria-hidden="true"><i :style="{ transform: `scaleX(${tienDo})` }" /></span>
        <button class="btn-primary" type="button" @click="emit('tiep')"><Play :size="22" aria-hidden="true" /> {{ t('hud.choiTiep') }}</button>
        <button class="btn thoat" type="button" @click="emit('thoat')">{{ t('hud.thoat') }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tam-dung {
  position: absolute; inset: 0; z-index: 18;   /* trên thanh trên (15), dưới hộp thoại (20) */
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  padding: 24px; background: var(--tam-dung-nen, var(--bg));
  animation: dung-vao .18s ease-out;
}
@keyframes dung-vao { from { opacity: 0; } }
.hop-dung {
  position: relative; width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 14px; text-align: center;
  padding: 40px 20px 20px;
}
/* Ruy băng vắt ngang đỉnh hộp — cùng ngôn ngữ với bảng thắng của mockup */
.ruy-bang {
  position: absolute; top: 0; left: 50%; transform: translate(-50%, -55%);
  margin: 0; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  padding: 8px 22px; border-radius: 16px; font-size: 26px;
  background: var(--nhan-nen); color: var(--nhan-chu);
  border: var(--vien-nut, 0); box-shadow: var(--elev-2);
}
.so-lieu { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; }
.so-lieu div {
  display: flex; flex-direction: column-reverse; align-items: center; gap: 2px;
  padding: 12px 4px; border-radius: 14px; background: var(--panel-soft);
  border: var(--vien-vien, 0);
}
.so-lieu dt { color: var(--muted); font-size: 12px; font-weight: 700; }
.so-lieu dd { margin: 0; font-family: var(--font-display); font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.vach { height: 8px; border-radius: 4px; overflow: hidden; background: color-mix(in srgb, var(--fg) 12%, transparent); }
.vach i { display: block; height: 100%; background: var(--ok); transform-origin: left; }
.hop-dung .btn-primary { margin-top: 4px; min-height: 58px; font-size: 22px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.hop-dung .thoat { min-height: 48px; }
</style>
