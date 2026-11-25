<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
import { BellRing, Hourglass } from 'lucide-vue-next';
/**
 * CHỦ PHÒNG BẤM BẮT ĐẦU KHI CÒN NGƯỜI CHƯA SẴN SÀNG (19.11.2026, mockup duyệt
 * https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH). KHÔNG có "Bắt đầu luôn" (chủ dự án: "chỉ có nhắc
 * thôi") — chỉ Nhắc (máy người kia rung + dải vàng "X muốn bắt đầu…") và Đợi thêm. Server chặn nhắc dồn
 * (NHAC_CACH_MS); nút ở đây cũng khoá đúng chừng đó để người bấm thấy.
 */
import type { PublicPlayer } from '@mm/engine';
import { t } from '@/lib/i18n';
import { tenNguoi } from '@/lib/ten';
import { useBackCloser } from '@/composables/useBackGuard';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{ chua: readonly PublicPlayer[]; conGiay: number }>();
const emit = defineEmits<{ nhac: []; dong: [] }>();
useBackCloser(40, () => true, () => emit('dong'));
const ten = (): string => (props.chua.length === 1 ? tenNguoi(props.chua[0]!) : '');
</script>

<template>
  <div class="nhac-phu" @click.self="emit('dong')" v-cham-ngoai="() => { emit('dong'); }">
    <div class="nhac-bang khay" role="dialog" :aria-label="t('on.nhac.tieuDe', { n: chua.length })">
      <p class="nhac-tieu"><Hourglass :size="18" :stroke-width="2.5" class="ic" aria-hidden="true" /> {{ t('on.nhac.tieuDe', { n: chua.length }) }}</p>
      <p class="nhac-mo">{{ t('on.nhac.moTa') }}</p>
      <div v-for="p in chua" :key="p.id" class="nhac-ng">
        <span class="nhac-mat" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /></span>
        <b>{{ tenNguoi(p) }}</b>
        <small>{{ t('on.nhac.chuaBam') }}</small>
      </div>
      <div class="nhac-hang">
        <button class="thach th-vang nhac-nut" type="button" :disabled="conGiay > 0" @click="emit('nhac')">
          <template v-if="conGiay > 0">{{ t('on.nhac.choGiay', { n: conGiay }) }}</template>
          <template v-else><BellRing :size="17" :stroke-width="2.5" class="ic" aria-hidden="true" /> {{ ten() ? t('on.nhac.nhacTen', { ten: ten() }) : t('on.nhac.nhacTatCa') }}</template>
        </button>
        <button class="thach nhac-nut" type="button" @click="emit('dong')">{{ t('on.nhac.doiThem') }}</button>
      </div>
      <p class="nhac-ghi">{{ t('on.nhac.ghi') }}</p>
    </div>
  </div>
</template>

<style scoped>
.nhac-phu {
  position: fixed; inset: 0; z-index: 40; background: rgba(10, 18, 45, .45);
  display: flex; align-items: flex-end; justify-content: center;
}
.nhac-bang {
  width: min(100%, 520px); display: flex; flex-direction: column; gap: 10px;
  padding: 16px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px 24px 0 0;
}
.nhac-tieu { margin: 0; font-family: var(--font-display); font-weight: 900; font-size: var(--text-lg); }
.nhac-mo { margin: 0; font-size: var(--text-sm); color: var(--muted); font-weight: 600; }
.nhac-ng {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 16px;
  background: #fff5e8; border: 2px solid #f0b46a; box-shadow: 0 3px 0 #e6b57a; color: #1d2b55;
}
.nhac-mat { font-size: 24px; width: 30px; display: grid; place-items: center; }
.nhac-mat :deep(img) { width: 30px; height: 30px; border-radius: 50%; }
.nhac-ng b { font-family: var(--font-display); font-size: 17px; }
.nhac-ng small { margin-left: auto; font-weight: 800; font-size: 12.5px; color: #8a4a00; }
.nhac-hang { display: flex; gap: 10px; margin-top: 2px; }
.nhac-nut { flex: 1; min-height: 52px; font: 800 18px var(--font-display); border-radius: 18px; }
.nhac-ghi { margin: 0; text-align: center; font-size: 12.5px; color: var(--muted); }
.ic { vertical-align: -3px; }
</style>
