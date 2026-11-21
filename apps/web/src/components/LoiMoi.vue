<script setup lang="ts">
import { computed } from 'vue';
import { loiMoi, tuChoiMoi } from '@/lib/sanh';
import { t } from '@/lib/i18n';
import { Swords } from 'lucide-vue-next';
import MatNguoi from './MatNguoi.vue';

/**
 * THẺ LỜI MỜI (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 3C/C2).
 * Nổi ở đầu màn, KHÔNG chặn bàn chơi offline phía dưới; vạch dưới chạy hết trong 20 giây rồi tự tắt.
 * "Vào phòng" → App.vue (đang dở ván offline thì dừng ván và hỏi lại trước khi bỏ).
 */
const emit = defineEmits<{ vao: [] }>();
const m = computed(() => loiMoi.value);
const chiTiet = computed(() => {
  const x = m.value;
  if (!x) return '';
  const phan = [t('moi.phong', { ma: x.ma }), t('moi.nguoi', { n: x.nguoi, max: x.toiDa })];
  if (x.soThe) phan.push(t('moi.soThe', { n: x.soThe }));
  return phan.join(' · ');
});
/** Thách đấu từ bảng xếp hạng (mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1b): chữ + huy hiệu kiếm. */
const tieuDe = computed(() => (m.value ? t(m.value.thach ? 'moi.thachTieuDe' : 'moi.tieuDe', { ten: m.value.tu.ten }) : ''));
const conLai = computed(() => (m.value ? Math.max(0, m.value.het - Date.now()) : 0));
</script>

<template>
  <Teleport to="body">
    <Transition name="loi-moi">
      <div v-if="m" :key="m.id" class="loi-moi" role="alertdialog" :aria-label="tieuDe">
        <div class="lm-tren">
          <span class="lm-mat"><MatNguoi :mat="m.tu.mat" :anh="m.tu.anh" /><span v-if="m.thach" class="lm-kiem" aria-hidden="true"><Swords :size="11" :stroke-width="2.8" /></span></span>
          <span class="lm-chu"><b>{{ tieuDe }}</b><small>{{ chiTiet }}</small></span>
        </div>
        <div class="lm-vach" aria-hidden="true"><i :style="{ animationDuration: `${conLai}ms`, width: `${(conLai / m.han) * 100}%` }" /></div>
        <div class="lm-nut">
          <button class="thach lm-sau" type="button" @click="tuChoiMoi()">{{ t('moi.deSau') }}</button>
          <button class="thach th-xanh lm-vao" type="button" @click="emit('vao')">{{ t(m.thach ? 'moi.nhanLoi' : 'moi.vao') }}</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.loi-moi {
  position: fixed; z-index: 95; left: 12px; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 10px);
  max-width: 460px; margin: 0 auto; box-sizing: border-box; display: grid; gap: 9px; padding: 11px 12px 12px;
  border-radius: 18px; border: 2px solid #9c8cff; background: #f1eeff; color: #2a2160;
  box-shadow: 0 4px 0 #c3b9ff, 0 10px 26px rgba(14, 26, 58, .22); font-family: var(--font-body);
}
:global([data-theme='dark'] .loi-moi) { background: #221d48; border-color: #6a5cd6; color: #e4e0ff; box-shadow: 0 4px 0 #120f2c, 0 10px 26px rgba(0, 0, 0, .5); }
.lm-tren { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lm-mat { flex: none; width: 38px; height: 38px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 23px; line-height: 1; }
:global([data-theme='dark'] .loi-moi .lm-mat) { background: #332c66; }
.lm-mat { position: relative; }
.lm-kiem { position: absolute; right: -4px; bottom: -3px; width: 19px; height: 19px; border-radius: 50%; background: #6a5cff; color: #fff; display: grid; place-items: center; }
.lm-mat :deep(img) { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.lm-chu { min-width: 0; display: grid; }
.lm-chu b { font: 800 16px/1.2 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lm-chu small { font-weight: 700; font-size: 12.5px; opacity: .78; }
.lm-vach { height: 4px; border-radius: 4px; background: rgba(106, 92, 255, .18); overflow: hidden; }
.lm-vach i { display: block; height: 100%; border-radius: 4px; background: #6a5cff; animation: lm-can linear forwards; }
:global([data-theme='dark'] .loi-moi .lm-vach i) { background: #a99cff; }
@keyframes lm-can { to { width: 0; } }
.lm-nut { display: flex; gap: 8px; }
.lm-nut button { flex: 1; min-height: 42px; font: 800 15px var(--font-body); border-radius: 12px; }
.lm-sau { background: rgba(106, 92, 255, .12); color: inherit; }
.loi-moi-enter-active, .loi-moi-leave-active { transition: transform .24s cubic-bezier(.3, 1.4, .5, 1), opacity .18s; }
.loi-moi-enter-from, .loi-moi-leave-to { transform: translateY(-18px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .lm-vach i { animation: none; }
  .loi-moi-enter-active, .loi-moi-leave-active { transition: opacity .15s; }
  .loi-moi-enter-from, .loi-moi-leave-to { transform: none; }
}
</style>
