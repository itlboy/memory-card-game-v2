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
import { apOtaNgay, banNative, kiemOta, nguonGoi, trangThaiOta } from '@/lib/ota';
import { bcp, t, td } from '@/lib/i18n';
import { SKINS, datSkin, skin, skinVeMacDinh } from '@/lib/skin';
import { daMuaPremium, datPremiumThu } from '@/lib/premium';
import { datPingSo, pingSo } from '@/lib/ping-so';
import { boEmojiHien, boEmojiVeMacDinh, doiBoEmojiThu } from '@/lib/emoji';
import { BIEN_THE, TEN_BIEN_THE, type BienThe, type LoaiKetCuc } from '@/lib/ketcuc-fx';

/** Khu "Xem thử hiệu ứng": duyệt từng cảnh kết ván mà không phải chơi tới cuối. */
export interface XemFx { loai: LoaiKetCuc; bienThe?: BienThe; kyLuc?: boolean }

const props = defineProps<{ doNhip: boolean }>();
const emit = defineEmits<{ 'update:doNhip': [boolean]; 'xem-fx': [XemFx]; tat: []; 'mua-the': [] }>();

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
/** Lần cập nhật gần nhất là bản APP (store) hay CẬP NHẬT NÓNG (kèm lúc tải). */
const nguon = ref<string | null>(null);
void nguonGoi().then((n) => {
  if (!n) return;
  if (n.loai === 'app') { nguon.value = t('ota.nguonApp'); return; }
  const d = n.luc ? new Date(n.luc) : null;
  const luc = d && !Number.isNaN(d.getTime()) ? d.toLocaleString(bcp(), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '?';
  nguon.value = t('ota.nguonOta', { luc });
});

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
    <!-- Thử nghiệm đứng ĐẦU: thứ chủ dự án mở trang này để chơi -->
    <button class="thach th-troi dbg-thu" type="button" @click="emit('mua-the')">
      <span class="dbg-thu-ic" aria-hidden="true">🌧️</span>
      <span class="dbg-thu-chu"><small>{{ t('mt.thuNghiem') }}</small><b>{{ t('mt.ten') }}</b><span>{{ t('mt.moTa') }}</span></span>
      <span class="dbg-thu-mui" aria-hidden="true">›</span>
    </button>

    <section class="khay-nho dbg-khoi">
      <h3>{{ t('dbg.phienBan') }}</h3>
      <p class="dbg-ban">
        <b>v{{ version }}</b> · {{ builtAt }} <span>({{ ago }})</span>
        <template v-if="native"><br>{{ t('lc.banApp', { ban: native }) }}</template>
        <template v-if="nguon"><br><b class="nguon">{{ nguon }}</b></template>
        <br><span class="ota">{{ otaId }}</span>
      </p>
      <div class="dbg-ota" :class="trangThaiOta.buoc" role="status">
        <i aria-hidden="true" />
        <span>{{ t('ota.tieuDe') }}: {{ chuOta }}<template v-if="trangThaiOta.id && trangThaiOta.buoc !== 'moiNhat'"><br><span class="ota">{{ trangThaiOta.id }}</span></template></span>
      </div>
      <div v-if="trangThaiOta.buoc !== 'web' && trangThaiOta.buoc !== 'kiem' && trangThaiOta.buoc !== 'tai'" class="dbg-hang-nut">
        <button class="thach th-nho" type="button" @click="kiemOta()">{{ t('ota.kiemLai') }}</button>
        <button v-if="trangThaiOta.buoc === 'choMoLai'" class="thach th-nho th-xanh" type="button" @click="apOtaNgay()">{{ t('ota.apNgay') }}</button>
      </div>
    </section>

    <section class="khay-nho dbg-khoi">
      <h3>{{ t('dbg.congTac') }}</h3>
      <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="daMuaPremium" @click="datPremiumThu(!daMuaPremium)">
        <span>{{ t('lc.premiumThu') }}</span><i class="sw" :class="{ bat: daMuaPremium }" aria-hidden="true" />
      </button>
      <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="props.doNhip" @click="emit('update:doNhip', !props.doNhip)">
        <span>{{ t('lc.doNhip') }}</span><i class="sw" :class="{ bat: props.doNhip }" aria-hidden="true" />
      </button>
      <button data-phang class="dbg-cong" type="button" role="menuitemcheckbox" :aria-checked="pingSo" @click="datPingSo(!pingSo)">
        <span>{{ t('lc.pingSo') }}</span><i class="sw" :class="{ bat: pingSo }" aria-hidden="true" />
      </button>
      <button data-phang class="dbg-cong" type="button" role="menuitem" @click="doiBoEmojiThu()">
        <span>{{ t('lc.boEmoji', { ten: tenBoEmoji }) }}</span><i class="doi" aria-hidden="true">↻</i>
      </button>
    </section>

    <!-- Skin cũ (Neon, Gỗ, Đêm Sao, Kẹo Bông) chỉ còn ở đây — người chơi chỉ có Kẹo (lib/skin.ts) -->
    <section class="khay-nho dbg-khoi">
      <h3>{{ t('tb.giaoDien') }}</h3>
      <div class="dbg-luoi ba">
        <button v-for="s in SKINS" :key="s" class="thach th-nho th-chon" type="button" :aria-pressed="skin === s" @click="datSkin(s, true)">{{ td(`tb.skin.${s}`) }}</button>
      </div>
    </section>

    <section class="khay-nho dbg-khoi">
      <h3>{{ t('lc.xemThu') }}</h3>
      <div class="dbg-luoi">
        <button v-for="x in XEM_THU" :key="x.ten" class="thach th-nho" type="button" @click="emit('xem-fx', x.fx)">{{ x.ten }}</button>
      </div>
    </section>

    <div class="dbg-dau">
      <button class="thach" type="button" @click="veMacDinh">{{ t('tb.debugMacDinh') }}</button>
      <button class="thach th-do" type="button" @click="emit('tat')">{{ t('tb.debugTat') }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Trang công cụ nhưng vẫn theo ngôn ngữ THẠCH của Kẹo (chủ dự án 27.10.2026: bản viền đứt "xấu xí qua loa"):
   mỗi nhóm là một khay nhỏ, công tắc là `.sw` như menu Cài đặt, nút là thạch nhỏ. */
.dbg { display: flex; flex-direction: column; gap: 12px; padding: 2px 2px 6px; }
.dbg-khoi { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 18px; background: var(--panel-soft); border: 1px solid var(--line); }
.dbg-khoi h3 { margin: 0 0 2px; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

.dbg-thu { display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 10px 14px; text-align: left; border-radius: 20px; }
.dbg-thu-ic { flex: none; width: 52px; height: 52px; display: grid; place-items: center; font-size: 34px; border-radius: 16px; background: rgba(255, 255, 255, .28); }
.dbg-thu-chu { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; line-height: 1.2; }
.dbg-thu-chu small { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
.dbg-thu-chu b { font-family: var(--font-display); font-size: 22px; }
.dbg-thu-chu span { font-size: 13px; font-weight: 600; opacity: .92; white-space: normal; }
.dbg-thu-mui { flex: none; font-size: 30px; font-weight: 900; opacity: .8; }

.dbg-ban { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); user-select: text; -webkit-user-select: text; }
.dbg-ban b { color: var(--fg); font-variant-numeric: tabular-nums; }
.dbg-ban > b:first-child { font-size: 18px; }
.ota { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; word-break: break-all; }
.nguon { color: var(--fg); font-weight: 800; }
.dbg-ota { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 12px; background: color-mix(in srgb, var(--muted) 10%, transparent); font-size: 12.5px; font-weight: 700; color: var(--fg); }
.dbg-ota > i { flex: none; width: 10px; height: 10px; margin-top: 4px; border-radius: 50%; background: var(--muted); }
.dbg-ota.tai > i, .dbg-ota.choMoLai > i { background: var(--accent); }
.dbg-ota.loi > i, .dbg-ota.cuQua > i { background: var(--bad); }
.dbg-ota.moiNhat > i { background: var(--ok); }
.dbg-hang-nut { display: flex; gap: 8px; flex-wrap: wrap; }

.dbg-cong {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px;
  padding: 0 2px; border: 0; border-top: 1px solid var(--line); background: none; color: var(--fg);
  font: inherit; font-size: 14.5px; font-weight: 700; text-align: left; white-space: normal; cursor: pointer;
}
.dbg-khoi h3 + .dbg-cong { border-top: 0; }
.sw { position: relative; flex: 0 0 auto; width: 38px; height: 22px; border-radius: 999px; background: var(--line); }
.sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); }
.sw.bat { background: var(--nhan-nen); }
.sw.bat::after { left: 19px; }
.doi { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); font-style: normal; font-weight: 900; }

.dbg .thach { border-radius: 14px; }
.dbg-luoi { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.dbg-luoi.ba { grid-template-columns: repeat(3, 1fr); }
.dbg-luoi .thach { min-height: 40px; padding: 6px 8px; font-size: 13px; white-space: normal; line-height: 1.2; }
.dbg-dau { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 2px; }
.dbg-dau .thach { min-height: 46px; }
</style>
