<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * CHIP NGƯỜI XEM (19.11.2026, mockup duyệt https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH). Nằm ở ô
 * bên phải hàng trên cùng (HudBar slot `phai`) — KHÔNG thêm hàng nào (chủ dự án: "làm sao để ko tốn
 * diện tích"). Xô bỏng ngô + mặt thú từng người xem + TÊN (chủ dự án: "luôn hiện tên người xem"). Bấm →
 * bảng "Đang xem trận". Thay dải "👁️ Phòng đã bắt đầu — bạn đang xem trận đấu" chiếm cả hàng.
 */
import { computed, ref } from 'vue';
import type { NguoiXem } from '@mm/engine';
import { t } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { useBackCloser } from '@/composables/useBackGuard';
import MatNguoi from './MatNguoi.vue';
import BongNgo from './BongNgo.vue';

const props = defineProps<{ xem: readonly NguoiXem[]; toi?: string }>();
const mo = ref(false);
useBackCloser(40, () => mo.value, () => { mo.value = false; });
/** Mình (người xem) lên ĐẦU và đọc là "Bạn". */
const ds = computed(() => {
  const ra = props.xem.map((x) => ({ ...x, laToi: !!props.toi && x.ten === props.toi }));
  const i = ra.findIndex((x) => x.laToi);
  if (i > 0) ra.unshift(...ra.splice(i, 1));
  return ra;
});
const tenNgan = computed(() => {
  const ten = ds.value.map((x) => (x.laToi ? t('xem.ban') : x.ten));
  return ten.length > 2 ? `${ten.slice(0, 2).join(', ')} +${ten.length - 2}` : ten.join(', ');
});
</script>

<template>
  <button
    class="chip-xem thach th-nho" type="button" :aria-label="t('xem.chip', { ds: ds.map((x) => x.ten).join(', ') })"
    @click="sfx.select(); mo = true"
  >
    <span class="bong"><BongNgo :size="18" /></span>
    <span class="chong" aria-hidden="true">
      <span v-for="x in ds.slice(0, 3)" :key="`${x.ten}|${x.mat}`" class="mn"><MatNguoi :mat="x.mat" :anh="x.anh" /></span>
    </span>
    <span class="ten-xem">{{ tenNgan }}</span>
  </button>
  <Teleport to="body">
    <div v-if="mo" class="xem-phu" @click.self="mo = false" v-cham-ngoai="() => { mo = false; }">
      <div class="xem-bang khay" role="dialog" :aria-label="t('xem.tieuDe', { n: ds.length })">
        <p class="xem-tieu"><BongNgo :size="22" /> {{ t('xem.tieuDe', { n: ds.length }) }}</p>
        <div v-for="x in ds" :key="`${x.ten}|${x.mat}`" class="xem-ng">
          <span class="mn to"><MatNguoi :mat="x.mat" :anh="x.anh" /></span>
          <b>{{ x.ten }}</b>
          <small v-if="x.laToi">{{ t('xem.ban') }}</small>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chip-xem {
  flex: none; display: inline-flex; align-items: center; gap: 5px; max-width: 150px; min-height: 40px;
  padding: 2px 10px 2px 4px; border-radius: 20px; font: 800 13px var(--font-display); white-space: nowrap;
}
.bong { flex: none; width: 26px; height: 26px; border-radius: 50%; background: #ffefe3; display: grid; place-items: center; }
.chong { display: flex; flex: none; }
.mn {
  width: 22px; height: 22px; border-radius: 50%; background: var(--panel-soft, #eef4fd); border: 2px solid var(--panel-solid, #fff);
  display: grid; place-items: center; font-size: 13px; line-height: 1; overflow: hidden;
}
.mn + .mn { margin-left: -8px; }
.mn :deep(img) { width: 100%; height: 100%; object-fit: cover; }
.ten-xem { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.xem-phu {
  position: fixed; inset: 0; z-index: 60; background: rgba(10, 18, 45, .45);
  display: flex; align-items: flex-end; justify-content: center;
}
.xem-bang {
  width: min(100%, 520px); max-height: 70vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
  padding: 16px 16px calc(18px + env(safe-area-inset-bottom, 0px)); border-radius: 24px 24px 0 0;
}
.xem-tieu { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-family: var(--font-display); font-weight: 900; font-size: var(--text-lg); }
.xem-ng {
  display: flex; align-items: center; gap: 12px; padding: 7px 12px; border-radius: 16px;
  border: 2px solid var(--line); background: var(--panel-soft);
}
.xem-ng b { font-family: var(--font-display); font-size: 17px; }
.xem-ng small { margin-left: auto; font-weight: 800; color: var(--muted); }
.mn.to { width: 36px; height: 36px; font-size: 21px; margin: 0; }
</style>
