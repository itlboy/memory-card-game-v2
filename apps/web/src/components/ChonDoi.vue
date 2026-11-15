<script setup lang="ts">
/**
 * BẢNG CHỌN ĐỘI ở phòng chờ online (15.11.2026, chủ dự án: "mỗi người được chọn đội, mặc định
 * 1/2/3/4 khác nhau, chọn cùng thì cùng đội"). Bốn ô to, mỗi ô ghi ai đang ở đội đó — chọn ô có
 * người là vào chung đội với họ. Cùng khuôn với ChonMucMay (tấm trượt từ đáy, chạm nền / Back là đóng).
 */
import { DOI_IDS } from '@mm/engine';
import type { DoiId, PublicPlayer } from '@mm/engine';
import { t } from '@/lib/i18n';
import { tenNguoi } from '@/lib/ten';
import { sfx } from '@/lib/audio';
import { useBackCloser } from '@/composables/useBackGuard';

defineProps<{ players: readonly PublicPlayer[]; doi: DoiId | undefined; boQua: string }>();
const emit = defineEmits<{ chon: [DoiId]; dong: [] }>();
useBackCloser(40, () => true, () => emit('dong'));
function chon(d: DoiId): void { sfx.select(); emit('chon', d); }
</script>

<template>
  <div class="doi-phu" @click.self="emit('dong')">
    <div class="doi-bang khay" role="dialog" :aria-label="t('dd.chonDoi')">
      <p class="doi-tieu">{{ t('dd.chonDoi') }}</p>
      <p class="doi-goi-y">{{ t('dd.chamDoiDoi') }}</p>
      <button
        v-for="d in DOI_IDS" :key="d" class="o-doi thach" :class="`d-${d}`" type="button"
        :aria-pressed="doi === d" @click="chon(d)"
      >
        <b>{{ t('dd.doiN', { n: d }) }}</b>
        <small>{{ players.filter((p) => p.doiSo === d && p.id !== boQua).map((p) => tenNguoi(p)).join(', ') || '—' }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.doi-phu {
  position: fixed; inset: 0; z-index: 40; background: rgba(10, 18, 45, .45);
  display: flex; align-items: flex-end; justify-content: center;
}
.doi-bang {
  width: min(100%, 520px); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 14px 12px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px 24px 0 0;
}
.doi-tieu { grid-column: 1 / -1; margin: 0 4px; font-family: var(--font-display); font-weight: 900; font-size: var(--text-lg); }
.doi-goi-y { grid-column: 1 / -1; margin: 0 4px 2px; font-size: var(--text-sm); color: var(--muted); }
.o-doi {
  min-height: 64px; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  gap: 2px; padding: 8px 14px; text-align: left; border-left: 8px solid var(--mau);
}
.o-doi b { font-family: var(--font-display); font-weight: 900; font-size: var(--text-md, 16px); }
.o-doi small { max-width: 100%; font-size: var(--text-xs); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.o-doi[aria-pressed='true'] { outline: 3px solid var(--mau); outline-offset: 1px; }
.d-1 { --mau: #ff8a3d; } .d-2 { --mau: #3d9bff; } .d-3 { --mau: #3fbf6b; } .d-4 { --mau: #a66bff; }
</style>
