<script setup lang="ts">
/**
 * THANH ĐỘI — chế độ Đồng đội (docs/che-do-dong-doi.md, mockup phương án A:
 * https://claude.ai/artifact/Tzm34KLSjMtfPRbxEnav7o). HIỆN THAY dải chip người chơi của OnlineGame
 * khi view có `nguoiLat`; ván thường không bao giờ mount component này.
 *
 * MỘT hàng cao 44px (bằng dải chip — luật "chip cao cố định", bàn thẻ không mất px nào): mỗi đội
 * một ô (2–3 đội); đội đang đi nở ra + tô màu đội, mặt người ĐANG ĐI LƯỢT NÀY to, đồng đội mờ,
 * kèm tên người đó; vạch vàng ở đáy là giờ của lượt (từ 15.11.2026 một người lật cả hai lá). Mặt từng người mang `data-chip-for` để bong
 * bóng emoji (EmojiBlast) neo đúng người.
 */
import { TURN_LIMIT_SEC } from '@mm/engine';
import type { PublicPlayer } from '@mm/engine';
import { computed } from 'vue';
import { t } from '@/lib/i18n';
import { tenNguoi } from '@/lib/ten';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{ o: ReturnType<typeof useOnlineRoom> }>();

const doi = computed(() => {
  const v = props.o.view.value;
  const phong = props.o.room.value?.players ?? [];
  if (!v) return [];
  return v.players.map((d) => {
    const tv = (d.thanhVien ?? []).map((id) => phong.find((p) => p.id === id)
      ?? ({ id, name: '?', connected: false } as PublicPlayer));
    const con = tv.filter((m) => !d.vang?.includes(m.id));
    const dang = d.id === v.currentId && !v.summary;
    const lat = dang ? tv.find((m) => m.id === v.nguoiLat) : undefined;
    const ten = lat ? (lat.id === props.o.myId.value ? t('chung.ban') : tenNguoi(lat)) : '';
    return {
      // Mã đội `doi-1`…`doi-4` (ván cũ đang chạy dở lúc đổi bản: `doi-A`/`doi-B`)
      id: d.id, mau: ({ A: '1', B: '2' } as Record<string, string>)[d.id.slice(-1)] ?? d.id.slice(-1), diem: d.score, lives: d.lives,
      tv, dang, latId: lat?.id,
      nhan: con.length > 1 ? ten : '',   // đội một người: mặt người đã đủ nói ai đang đi
      vang: d.vang ?? [], bo: d.forfeited
    };
  });
});
const con = computed(() => {
  const s = props.o.turnTimeLeft.value;
  return s === null ? null : Math.max(0, Math.min(1, s / TURN_LIMIT_SEC));
});
</script>

<template>
  <div class="thanh-doi" role="status">
    <div
      v-for="d in doi" :key="d.id" class="nua" :class="[`doi-${d.mau}`, { dang: d.dang, bo: d.bo }]"
    >
      <span class="mat2">
        <span
          v-for="m in d.tv" :key="m.id" class="m" :data-chip-for="m.id"
          :class="{ lat: m.id === d.latId, mo: d.dang && m.id !== d.latId, vang: d.vang.includes(m.id) || !m.connected }"
        ><MatNguoi :mat="m.avatar" :anh="m.anh" /></span>
      </span>
      <b v-if="d.nhan" class="ai">{{ d.nhan }}</b>
      <small v-if="d.lives !== null" class="mang">♥{{ d.lives }}</small>
      <span class="diem">{{ d.diem }}</span>
      <i v-if="d.dang && con !== null" class="gio" :class="{ gap: con < 0.4 }" :style="{ width: `${con * 100}%` }" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.thanh-doi { display: flex; gap: 6px; height: 44px; }
.nua {
  flex: 1; min-width: 0; height: 44px; box-sizing: border-box; position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 5px; padding: 0 9px;
  border-radius: 14px; border: 2px solid var(--line); background: var(--panel-solid, #fff);
  box-shadow: 0 3px 0 var(--line); font-family: var(--font-display); font-weight: 800; color: var(--fg);
  transition: flex-grow .22s ease;
}
.nua.doi-1 { --mau: #ff8a3d; --mau-d: #d2641a; }
.nua.doi-2 { --mau: #3d9bff; --mau-d: #1f6fd0; }
.nua.doi-3 { --mau: #3fbf6b; --mau-d: #26944a; }
.nua.doi-4 { --mau: #a66bff; --mau-d: #7a3fe0; }
.nua { border-color: var(--mau); }
.nua.dang { flex-grow: 1.7; background: var(--mau); color: #fff; box-shadow: 0 3px 0 var(--mau-d); }
.nua.bo { opacity: .5; }
.mat2 { display: inline-flex; align-items: center; gap: 1px; flex: none; }
.m { font-size: 17px; line-height: 1; transition: font-size .18s ease, opacity .18s ease; }
.m.lat { font-size: 23px; }
.m.mo { opacity: .5; }
.m.vang { opacity: .28; filter: grayscale(1); }
.ai { min-width: 0; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mang { font-size: 11px; flex: none; }
.diem { margin-left: auto; font-size: 18px; font-variant-numeric: tabular-nums; flex: none; }
.gio { position: absolute; left: 0; bottom: 0; height: 4px; background: #ffc83d; transition: width .25s linear; }
.gio.gap { background: #ff5a5a; }
</style>
