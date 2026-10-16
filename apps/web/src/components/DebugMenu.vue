<script setup lang="ts">
/**
 * CÔNG CỤ CHẾ ĐỘ DEBUG — nằm NGAY TRONG menu Cài đặt (chủ dự án 16.10.2026; trước đó ở
 * cuối Luật chơi, phải mở thêm một hộp thoại mới tới). Bật debug: chạm 7 lần vào chữ
 * "Cài đặt" trong menu (TopBar), hoặc 7 lần vào dòng phiên bản trong Luật chơi, hoặc
 * `?debug=1`.
 *
 * Mọi công tắc ở đây chỉ đổi MÁY NÀY. "Về mặc định" tắt hết công tắc thử (Premium thử,
 * đo khung hình, ping số, bộ emoji thử) nhưng GIỮ debug bật; "Tắt debug" thì App tự đưa
 * các công tắc về mặc định (App.vue, watch debug).
 */
import { computed } from 'vue';
import { t } from '@/lib/i18n';
import { daMuaPremium, datPremiumThu } from '@/lib/premium';
import { datPingSo, pingSo } from '@/lib/ping-so';
import { boEmojiHien, boEmojiVeMacDinh, doiBoEmojiThu } from '@/lib/emoji';
import { BIEN_THE, TEN_BIEN_THE, type BienThe, type LoaiKetCuc } from '@/lib/ketcuc-fx';

/** Khu "Xem thử hiệu ứng": duyệt từng cảnh kết ván mà không phải chơi tới cuối. */
export interface XemFx { loai: LoaiKetCuc; bienThe?: BienThe; kyLuc?: boolean }

const props = defineProps<{ doNhip: boolean }>();
const emit = defineEmits<{ 'update:doNhip': [boolean]; 'xem-fx': [XemFx]; tat: [] }>();

const XEM_THU = computed((): { ten: string; fx: XemFx }[] => [
  ...BIEN_THE.thang.map((b) => ({ ten: t('lc.xemThang', { ten: TEN_BIEN_THE[b] }), fx: { loai: 'thang' as const, bienThe: b } })),
  { ten: t('fx.canh.ky-luc'), fx: { loai: 'thang', bienThe: 'phao-giay', kyLuc: true } },
  ...BIEN_THE.thua.map((b) => ({ ten: t('lc.xemThua', { ten: TEN_BIEN_THE[b] }), fx: { loai: 'thua' as const, bienThe: b } })),
  { ten: t('fx.canh.hoa'), fx: { loai: 'hoa' } }
]);
const tenBoEmoji = computed(() => ({ may: t('lc.boEmojiMay'), noto3d: 'Noto 3D' })[boEmojiHien()]);

function veMacDinh(): void {
  datPremiumThu(false);
  datPingSo(false);
  boEmojiVeMacDinh();
  emit('update:doNhip', false);
}
</script>

<template>
  <div class="dbg" role="group" :aria-label="t('tb.debug')">
    <p class="dbg-dau">
      <span>{{ t('tb.debug') }}</span>
      <button class="dbg-nho" type="button" @click="veMacDinh">{{ t('tb.debugMacDinh') }}</button>
      <button class="dbg-nho tat" type="button" @click="emit('tat')">{{ t('tb.debugTat') }}</button>
    </p>
    <button class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="daMuaPremium" @click="datPremiumThu(!daMuaPremium)">
      <i :class="{ bat: daMuaPremium }" aria-hidden="true" />{{ t('lc.premiumThu') }}
    </button>
    <button class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="props.doNhip" @click="emit('update:doNhip', !props.doNhip)">
      <i :class="{ bat: props.doNhip }" aria-hidden="true" />{{ t('lc.doNhip') }}
    </button>
    <button class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="pingSo" @click="datPingSo(!pingSo)">
      <i :class="{ bat: pingSo }" aria-hidden="true" />{{ t('lc.pingSo') }}
    </button>
    <button class="dbg-cong" type="button" role="menuitem" @click="doiBoEmojiThu()">
      <i class="xoay" aria-hidden="true">↻</i>{{ t('lc.boEmoji', { ten: tenBoEmoji }) }}
    </button>
    <p class="dbg-nhom">{{ t('lc.xemThu') }}</p>
    <div class="dbg-fx">
      <button v-for="x in XEM_THU" :key="x.ten" class="dbg-nho" type="button" @click="emit('xem-fx', x.fx)">{{ x.ten }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Cố tình NHẠT, nhỏ, viền đứt: công cụ soi lỗi, không phải tính năng chơi */
.dbg { display: grid; gap: 2px; margin-top: 4px; padding: 6px; border: 1px dashed var(--bad); border-radius: 10px; }
.dbg-dau { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--bad); }
.dbg-dau > span { flex: 1; }
.dbg-nhom { margin: 6px 4px 2px; font-size: 11px; font-weight: 800; color: var(--muted); }
.dbg-cong {
  position: relative; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px;
  border: 0; border-radius: 8px; background: none; color: var(--fg); font: inherit; font-size: 12.5px; font-weight: 700;
  text-align: left; white-space: normal; cursor: pointer;
}
.dbg-cong::after { content: ''; position: absolute; inset: -4px 0; }
.dbg-cong i { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--muted); font-style: normal; }
.dbg-cong i.bat { border-color: var(--bad); background: var(--bad); }
.dbg-cong i.xoay { border: 0; display: grid; place-items: center; color: var(--muted); font-weight: 900; }
.dbg-nho {
  position: relative; min-height: 28px; padding: 2px 8px; border: 1px dashed var(--line-strong); border-radius: 8px;
  background: none; color: var(--muted); font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
  text-transform: none; letter-spacing: 0;
}
.dbg-nho.tat { border-color: var(--bad); color: var(--bad); }
.dbg-fx { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.dbg-fx .dbg-nho { white-space: normal; text-align: left; }
@media (hover: hover) { .dbg-cong:hover, .dbg-nho:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); } }
</style>
