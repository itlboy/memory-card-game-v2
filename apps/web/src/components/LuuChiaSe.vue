<script setup lang="ts">
/**
 * BẢNG LƯU / CHIA SẺ ẢNH KẾT QUẢ (11.11.2026, mockup duyệt https://claude.ai/artifact/MkD66nuGdEmYrYf9wmniWy).
 * Mở từ nút vàng dưới bảng kết quả: xem trước ảnh, rồi "Lưu ảnh" hoặc "Chia sẻ".
 * Ảnh vẽ ở lib/anh-ket-qua.ts, trên máy, không gửi đi đâu.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Download, Share2 } from 'lucide-vue-next';
import { t } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { veAnhKetQua, luuAnh, chiaSeAnh, type NoiDungAnh } from '@/lib/anh-ket-qua';
import { SITE_URL } from '@/lib/native';

const props = defineProps<{ noiDung: NoiDungAnh }>();
const emit = defineEmits<{ close: [] }>();

const blob = ref<Blob | null>(null);
const xem = ref('');
const bao = ref('');

onMounted(async () => {
  try {
    blob.value = await veAnhKetQua(props.noiDung);
    xem.value = URL.createObjectURL(blob.value);
  } catch { emit('close'); }
});
onBeforeUnmount(() => { if (xem.value) URL.revokeObjectURL(xem.value); });

async function luu(): Promise<void> {
  if (!blob.value) return;
  sfx.select();
  await luuAnh(blob.value);
}
async function chiaSe(): Promise<void> {
  if (!blob.value) return;
  sfx.select();
  const kq = await chiaSeAnh(blob.value, t('kq.chiaSeChu'), `${SITE_URL}/`);
  if (kq === 'copy') { bao.value = t('cs.daCopyLink'); setTimeout(() => { bao.value = ''; }, 1800); }
}
</script>

<template>
  <div class="nen-lcs" role="dialog" aria-modal="true" :aria-label="t('kq.luuChiaSe')" @click.self="emit('close')" @keydown.esc.stop="emit('close')">
    <div class="to khay">
      <span class="tay" aria-hidden="true" />
      <div class="khung-anh">
        <img v-if="xem" :src="xem" alt="" />
      </div>
      <div class="hang-nut">
        <button class="btn thach th-xanh" type="button" :disabled="!blob" @click="luu"><Download :size="20" />{{ t('kq.luuAnh') }}</button>
        <button class="btn thach th-vang" type="button" :disabled="!blob" @click="chiaSe"><Share2 :size="20" />{{ t('kq.chiaSe') }}</button>
      </div>
      <p v-if="bao" class="bao" role="status">{{ bao }}</p>
    </div>
  </div>
</template>

<style scoped>
.nen-lcs {
  position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(10, 14, 40, .6);
  padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
}
.to {
  width: min(100%, 520px); box-sizing: border-box; padding: 14px 18px 22px;
  border-radius: 28px 28px 0 0 !important; background: var(--panel-solid);
  animation: len .22s ease-out;
}
@keyframes len { from { transform: translateY(40px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .to { animation: none; } }
.tay { display: block; width: 44px; height: 5px; border-radius: 9px; background: var(--line); margin: 0 auto 12px; }
.khung-anh { display: flex; justify-content: center; }
/* Cao theo MÀN (không %: % của ô lưới không chặn được ảnh → ảnh tràn đè lên nút) */
.khung-anh img { display: block; height: min(52vh, 440px); width: auto; max-width: 100%; object-fit: contain; border-radius: 16px; box-shadow: 0 6px 18px rgba(0, 0, 0, .25); }
.hang-nut { display: flex; gap: 12px; margin-top: 16px; }
.hang-nut .btn { flex: 1; min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; }
.bao { margin: 10px 0 0; text-align: center; font-weight: 700; color: var(--muted); }
</style>
