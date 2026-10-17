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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { buildAgeText } from '@/lib/format';
import { apOtaNgay, banNative, kiemOta, trangThaiOta } from '@/lib/ota';
import { t, td } from '@/lib/i18n';
import { SKINS, datSkin, skin, skinVeMacDinh } from '@/lib/skin';
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
/* Phiên bản ngay đầu khối (16.10.2026: xem nhanh khi cần, khỏi mở Luật chơi). Gói web
   (`__OTA_ID__`) có thể mới hơn bản app store nhờ cập nhật nóng — hai dòng khác nhau là thường. */
const version = __APP_VERSION__;
const builtAt = __BUILD_AT__;
const otaId = __OTA_ID__;
const ago = ref(buildAgeText(Date.now() - Date.parse(__BUILD_ISO__)));
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => { tick = setInterval(() => { ago.value = buildAgeText(Date.now() - Date.parse(__BUILD_ISO__)); }, 1000); });
onUnmounted(() => clearInterval(tick));
const native = ref<string | null>(null);
void banNative().then((v) => { native.value = v; });

/** Dòng trạng thái cập nhật nóng (lib/ota.ts): kiểm / tải x% / chờ mở lại / lỗi gì. */
const chuOta = computed(() => {
  const o = trangThaiOta.value;
  return o.buoc === 'tai' ? t('ota.tai', { pct: o.pct ?? 0 })
    : o.buoc === 'loi' ? t('ota.loi', { loi: o.loi ?? '?' })
    : o.buoc === 'cuQua' ? t('ota.cuQua', { ban: o.ban ?? '?' })
    : t(`ota.${o.buoc}` as 'ota.kiem');
});

const tenBoEmoji = computed(() => ({ may: t('lc.boEmojiMay'), noto3d: 'Noto 3D' })[boEmojiHien()]);

function veMacDinh(): void {
  datPremiumThu(false);
  datPingSo(false);
  boEmojiVeMacDinh();
  skinVeMacDinh();
  emit('update:doNhip', false);
}
</script>

<template>
  <div class="dbg" role="group" :aria-label="t('tb.debug')">
    <p class="dbg-dau">
      <span />
      <button data-phang class="dbg-nho" type="button" @click="veMacDinh">{{ t('tb.debugMacDinh') }}</button>
      <button data-phang class="dbg-nho tat" type="button" @click="emit('tat')">{{ t('tb.debugTat') }}</button>
    </p>
    <p class="dbg-ban">
      <b>v{{ version }}</b> · build {{ builtAt }} <span>({{ ago }})</span><br>
      <span class="ota">{{ otaId }}</span>
      <template v-if="native"><br>{{ t('lc.banApp', { ban: native }) }}</template>
    </p>
    <p class="dbg-ota" :class="trangThaiOta.buoc" role="status">
      <span>{{ t('ota.tieuDe') }}: {{ chuOta }}<template v-if="trangThaiOta.id && trangThaiOta.buoc !== 'moiNhat'"><br><span class="ota">{{ trangThaiOta.id }}</span></template></span>
      <button data-phang v-if="trangThaiOta.buoc !== 'web' && trangThaiOta.buoc !== 'kiem' && trangThaiOta.buoc !== 'tai'" class="dbg-nho" type="button" @click="kiemOta()">{{ t('ota.kiemLai') }}</button>
      <button data-phang v-if="trangThaiOta.buoc === 'choMoLai'" class="dbg-nho tat" type="button" @click="apOtaNgay()">{{ t('ota.apNgay') }}</button>
    </p>
    <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="daMuaPremium" @click="datPremiumThu(!daMuaPremium)">
      <i :class="{ bat: daMuaPremium }" aria-hidden="true" />{{ t('lc.premiumThu') }}
    </button>
    <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="props.doNhip" @click="emit('update:doNhip', !props.doNhip)">
      <i :class="{ bat: props.doNhip }" aria-hidden="true" />{{ t('lc.doNhip') }}
    </button>
    <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="pingSo" @click="datPingSo(!pingSo)">
      <i :class="{ bat: pingSo }" aria-hidden="true" />{{ t('lc.pingSo') }}
    </button>
    <button data-phang class="dbg-cong" type="button" role="menuitem" @click="doiBoEmojiThu()">
      <i class="xoay" aria-hidden="true">↻</i>{{ t('lc.boEmoji', { ten: tenBoEmoji }) }}
    </button>
    <!-- Skin cũ (Neon, Gỗ, Đêm Sao, Kẹo Bông) chỉ còn ở đây — người chơi chỉ có Kẹo (lib/skin.ts) -->
    <p class="dbg-nhom">{{ t('tb.giaoDien') }}</p>
    <div class="dbg-fx">
      <button data-phang v-for="s in SKINS" :key="s" class="dbg-nho" :class="{ chon: skin === s }" type="button" :aria-pressed="skin === s" @click="datSkin(s, true)">{{ td(`tb.skin.${s}`) }}</button>
    </div>
    <p class="dbg-nhom">{{ t('lc.xemThu') }}</p>
    <div class="dbg-fx">
      <button data-phang v-for="x in XEM_THU" :key="x.ten" class="dbg-nho" type="button" @click="emit('xem-fx', x.fx)">{{ x.ten }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Cố tình NHẠT, nhỏ, viền đứt: công cụ soi lỗi, không phải tính năng chơi */
.dbg { display: grid; gap: 4px; }   /* nằm trong trang riêng (DebugDialog) — không cần khung viền */
.dbg-dau { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--bad); }
.dbg-dau > span { flex: 1; }
.dbg-ban { margin: 0 4px 4px; font-size: 12.5px; line-height: 1.45; color: var(--muted); white-space: normal; user-select: text; -webkit-user-select: text; }
.dbg-ban b { color: var(--fg); font-variant-numeric: tabular-nums; }
.dbg-ban .ota { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; word-break: break-all; }
.dbg-ota { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin: 0 4px 4px; font-size: 11.5px; font-weight: 700; color: var(--muted); white-space: normal; }
.dbg-ota > span { flex: 1 1 100%; }
.dbg-ota.tai, .dbg-ota.choMoLai { color: var(--accent); }
.dbg-ota.loi, .dbg-ota.cuQua { color: var(--bad); }
.dbg-ota.moiNhat { color: var(--ok); }
.dbg-nhom { margin: 6px 4px 2px; font-size: 11px; font-weight: 800; color: var(--muted); }
.dbg-cong {
  position: relative; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 6px;
  border: 0; border-radius: 8px; background: none; color: var(--fg); font: inherit; font-size: 14px; font-weight: 700;
  text-align: left; white-space: normal; cursor: pointer;
}
.dbg-cong::after { content: ''; position: absolute; inset: -4px 0; }
.dbg-cong i { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--muted); font-style: normal; }
.dbg-cong i.bat { border-color: var(--bad); background: var(--bad); }
.dbg-cong i.xoay { border: 0; display: grid; place-items: center; color: var(--muted); font-weight: 900; }
.dbg-nho {
  position: relative; min-height: 28px; padding: 2px 8px; border: 1px dashed var(--line-strong); border-radius: 8px;
  background: none; color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
  text-transform: none; letter-spacing: 0;
}
.dbg-nho.tat { border-color: var(--bad); color: var(--bad); }
.dbg-fx { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.dbg-fx .dbg-nho { white-space: normal; text-align: left; }
@media (hover: hover) { .dbg-cong:hover, .dbg-nho:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); } }
.dbg-nho.chon { border-style: solid; border-color: var(--bad); color: var(--bad); }
</style>
