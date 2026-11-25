<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * BẢNG PREMIUM — màn bán gói THÁNG / NĂM, luồng Y NHƯ THẬT (chủ dự án 25.11.2026: "có các nút mua các thứ giống hệt…
 * chỉ bật debug lên là nó xuất hiện"). CHƯA BÁN THẬT: chỉ mở được khi đang bật debug (App.vue chặn), và "cửa hàng" là
 * bản giả lập trong lib/premium.ts — không thu tiền. Nối In-App Purchase thì chỉ đổi ba hàm ở lib đó, màn này giữ nguyên.
 *
 * BỐN TRẠNG THÁI:
 *  - `chon`: quyền lợi + chọn hình nền + hai gói + nút mua + dòng tự gia hạn + Khôi phục / Điều khoản / Quyền riêng tư
 *    (Apple bắt buộc màn mua gói định kỳ phải có: giá, kỳ hạn, câu tự gia hạn, hai link pháp lý, nút khôi phục).
 *  - `dang`: đang chờ cửa hàng — khoá mọi nút, không đóng bảng được (tránh bấm mua hai lần).
 *  - `xong`: lời cảm ơn, bấm "Tiếp tục" về trạng thái đã có gói.
 *  - đã có gói (`daMuaPremium`): tên gói + ngày gia hạn + "Quản lý gói" (mở trang quản lý gói của store).
 *
 * HÌNH NỀN: chọn ngay trong bảng. Chưa có Premium thì hành tinh mang vương miện, bấm vào chỉ nhắc "cần Premium".
 * GIÁ LÀ SỐ TẠM (`GIA_TAM`) — bán thật thì đọc giá đã quy đổi theo nước từ store.
 */
import { ChartColumn, Check, Crown, Heart, Image, LoaderCircle, MessageCircle, Music, Sparkles, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { bcp, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { GIA_TAM, daMuaPremium, goiDangCo, huyGoiThu, khoiPhucMua, muaGoi, type Goi } from '@/lib/premium';
import { CANH, canh, datCanh, type Canh } from '@/lib/canh';
import { SITE_URL, nenApp } from '@/lib/native';

const emit = defineEmits<{ close: [] }>();

const goi = ref<Goi>('nam');
const buoc = ref<'chon' | 'dang' | 'xong'>('chon');
const bao = ref<'' | 'canPremium' | 'khoiPhucKhong' | 'loiMua'>('');
const tien = (v: number): string => `${num(v)}đ`;
const tietKiem = Math.round((1 - GIA_TAM.nam / (GIA_TAM.thang * 12)) * 100);

/* Sáu dòng — thứ tự chủ dự án chốt 25.11.2026. KHÔNG có dòng theme: chưa theme nào là premium, khoe ra là sai. */
const LOI = computed(() => [
  { ic: Heart, chu: t('pm.l.hoTro') },
  { ic: Image, chu: t('pm.l.nen') },
  { ic: Music, chu: t('pm.l.amThanh') },
  { ic: ChartColumn, chu: t('pm.l.thongKe') },
  { ic: Sparkles, chu: t('pm.l.hieuUng') },
  { ic: MessageCircle, chu: t('pm.l.chat') }
]);

const ngayGiaHan = computed(() => {
  const g = goiDangCo.value;
  return g ? new Intl.DateTimeFormat(bcp(), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(g.het)) : '';
});
/** Trang quản lý gói của store — bán thật thì người chơi huỷ / đổi gói ở đó. */
const LINK_QUAN_LY = nenApp === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
const LINK_DIEU_KHOAN = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const LINK_RIENG_TU = `${SITE_URL}/privacy.html`;

const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('premium'); });
const dong = (): void => { if (buoc.value !== 'dang') emit('close'); };

function chonGoi(g: Goi): void {
  if (goi.value === g || buoc.value === 'dang') return;
  goi.value = g;
  moChucNang('premium_chon_goi', { goi: g });
}
async function mua(): Promise<void> {
  if (buoc.value === 'dang') return;
  bao.value = ''; buoc.value = 'dang';
  moChucNang('premium_mua', { goi: goi.value });
  const kq = await muaGoi(goi.value);
  if (kq === 'ok') { buoc.value = 'xong'; moChucNang('premium_mua_xong', { goi: goi.value }); return; }
  buoc.value = 'chon';
  if (kq === 'loi') bao.value = 'loiMua';
}
async function khoiPhuc(): Promise<void> {
  if (buoc.value === 'dang') return;
  bao.value = ''; buoc.value = 'dang';
  const co = await khoiPhucMua();
  moChucNang('premium_khoi_phuc', { co: co ? 1 : 0 });
  buoc.value = 'chon';
  if (!co) bao.value = 'khoiPhucKhong';
}
function chonNen(c: Canh): void {
  if (c !== 'goc' && !daMuaPremium.value) { bao.value = 'canPremium'; moChucNang('premium_nen_khoa', { canh: c }); return; }
  bao.value = '';
  datCanh(c);
}
function huy(): void { huyGoiThu(); buoc.value = 'chon'; bao.value = ''; }
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pmTitle" @keydown.esc="dong" @click.self="dong" v-cham-ngoai="dong">
    <div class="panel pm" :aria-busy="buoc === 'dang'">
      <header class="pm-head">
        <h2 id="pmTitle"><span class="pm-vm" aria-hidden="true"><Crown :size="20" :stroke-width="2.5" /></span>{{ t('tp.premium') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" :disabled="buoc === 'dang'" @click="dong"><X :size="20" /></button>
      </header>

      <!-- ĐÃ MUA XONG: lời cảm ơn -->
      <section v-if="buoc === 'xong'" class="pm-xong" role="status">
        <span class="pm-xong-ic" aria-hidden="true"><Check :size="34" :stroke-width="3" /></span>
        <h3>{{ t('pm.camOn') }}</h3>
        <p>{{ t('pm.camOnMoTa') }}</p>
        <button class="thach th-vang pm-mua" type="button" @click="buoc = 'chon'">{{ t('pm.tiepTuc') }}</button>
      </section>

      <template v-else>
        <p class="pm-mo">{{ t('pm.moTa') }}</p>
        <ul class="pm-loi">
          <li v-for="l in LOI" :key="l.chu"><span aria-hidden="true"><component :is="l.ic" :size="18" :stroke-width="2.4" /></span>{{ l.chu }}</li>
        </ul>

        <section class="pm-nen" :aria-label="t('pm.l.nen')">
          <h3>{{ t('pm.l.nen') }}</h3>
          <div class="pm-nen-luoi">
            <button v-for="c in CANH" :key="c" class="thach th-nho th-chon" type="button" :aria-pressed="canh === c" :disabled="buoc === 'dang'" @click="chonNen(c)">
              <Crown v-if="c !== 'goc' && !daMuaPremium" class="pm-khoa" :size="12" :stroke-width="2.6" aria-hidden="true" />{{ td(`pm.nen.${c}`) }}
            </button>
          </div>
        </section>

        <!-- CHƯA CÓ GÓI: chọn gói + mua -->
        <template v-if="!daMuaPremium">
          <div class="pm-goi" role="group" :aria-label="t('tp.premium')">
            <button class="thach th-chon pm-o" type="button" :aria-pressed="goi === 'nam'" :disabled="buoc === 'dang'" @click="chonGoi('nam')">
              <em>{{ t('pm.tietKiem', { pct: tietKiem }) }}</em>
              <b>{{ t('pm.nam') }}</b>
              <strong>{{ tien(GIA_TAM.nam) }}</strong>
              <small>{{ t('pm.moiThang', { gia: tien(Math.round(GIA_TAM.nam / 12 / 100) * 100) }) }}</small>
            </button>
            <button class="thach th-chon pm-o" type="button" :aria-pressed="goi === 'thang'" :disabled="buoc === 'dang'" @click="chonGoi('thang')">
              <b>{{ t('pm.thang') }}</b>
              <strong>{{ tien(GIA_TAM.thang) }}</strong>
            </button>
          </div>
          <p v-if="bao" class="pm-bao" role="status">{{ t(`pm.${bao}`) }}</p>
          <button class="thach th-vang pm-mua" type="button" :disabled="buoc === 'dang'" @click="mua">
            <template v-if="buoc === 'dang'"><LoaderCircle class="pm-quay" :size="20" :stroke-width="2.8" aria-hidden="true" />{{ t('pm.dangXuLy') }}</template>
            <template v-else>{{ t('pm.mua') }}</template>
          </button>
          <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
          <nav class="pm-link">
            <button data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
            <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
            <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
          </nav>
        </template>

        <!-- ĐANG CÓ GÓI -->
        <template v-else>
          <div class="pm-co" role="status">
            <Check :size="22" :stroke-width="3" aria-hidden="true" />
            <span><b>{{ goiDangCo ? t(goiDangCo.goi === 'nam' ? 'pm.nam' : 'pm.thang') : t('pm.daCo') }}</b>
              <small v-if="goiDangCo">{{ t('pm.giaHan', { ngay: ngayGiaHan }) }}</small></span>
          </div>
          <a class="thach th-nho pm-ql" :href="LINK_QUAN_LY" target="_blank" rel="noopener">{{ t('pm.quanLy') }}</a>
          <nav class="pm-link">
            <button data-phang type="button" @click="huy">{{ t('pm.tat') }}</button>
            <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
            <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
          </nav>
          <!-- Dòng "bản thử" chỉ ở trạng thái đã có gói (cạnh nút Tắt bản thử): màn mua phải giống bản bán thật, và thêm
               dòng này là bảng tràn khỏi iPhone khi có lời nhắc (ảnh soát 25.11.2026) -->
          <p class="pm-thu">{{ t('pm.thu') }}</p>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Vàng ĐẬM trên nền sáng · vàng SÁNG trên nền tối — một tông không đạt tương phản ở cả hai */
.pm {
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-vien: #f0cf7a; --o: #f1f3fb;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 16px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .pm) { --pm: #ffd36b; --pm-nen: #3a3160; --pm-vien: #7a6530; --o: #2a3170; }
.pm > * { flex-shrink: 0; }
.pm-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pm-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: var(--text-xl); }
.pm-vm { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; }
.pm-mo { margin: -4px 0 0; color: var(--muted); font-size: var(--text-md); line-height: 1.4; }

.pm-loi { list-style: none; margin: 0; padding: 2px 12px; border-radius: 18px; background: var(--o); }
.pm-loi li { display: flex; align-items: center; gap: 12px; padding: 7px 0; font: 700 14px/1.3 var(--font-body); }
.pm-loi li + li { border-top: 1px solid color-mix(in srgb, var(--muted) 22%, transparent); }
.pm-loi li span { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 10px; background: var(--pm-nen); color: var(--pm); }

.pm-nen h3 { margin: 0 0 8px; font: 800 12px/1.2 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pm-nen-luoi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pm-nen-luoi button { min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px; font: 800 13px/1.2 var(--font-body); }
.pm-khoa { flex: none; color: #c98f12; }

.pm-goi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 10px; }
.pm-o { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 92px; padding: 14px 6px 10px; border-radius: 20px; line-height: 1.2; }
.pm-o b { font: 800 13.5px/1.2 var(--font-body); }
.pm-o strong { font-size: 22px; font-weight: 900; }
.pm-o small { font: 700 12px/1.2 var(--font-body); opacity: .8; }
.pm-o em {
  position: absolute; top: -11px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: #ffd36b; color: #6b4a00; font: 900 11px/1.3 var(--font-body); font-style: normal; box-shadow: 0 2px 0 #c98f12;
}
.pm-mua { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 54px; border-radius: 18px; font: 900 18px/1.2 var(--font-body); }
.pm-quay { animation: pm-quay .9s linear infinite; }
@keyframes pm-quay { to { transform: rotate(360deg); } }
.pm-bao { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--pm-nen); color: var(--pm); font: 700 13px/1.35 var(--font-body); text-align: center; }
.pm-luat { margin: 0; text-align: center; color: var(--muted); font: 600 11.5px/1.4 var(--font-body); }
.pm-link { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; }
.pm-link button, .pm-link a {
  border: 0; background: none; padding: 0; min-height: 32px; display: inline-flex; align-items: center; cursor: pointer;
  color: var(--accent); font: 700 13px/1.2 var(--font-body); text-decoration: underline;
}
.pm-co { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 4px; padding: 12px; border-radius: 18px; background: var(--pm-nen); color: var(--pm); border: 2px solid var(--pm-vien); }
.pm-co span { display: flex; flex-direction: column; line-height: 1.25; }
.pm-co b { font: 800 16px/1.2 var(--font-body); }
.pm-co small { font: 600 12.5px/1.3 var(--font-body); }
.pm-ql { align-self: center; display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 18px; text-decoration: none; font: 800 14px/1.2 var(--font-body); }
.pm-thu { margin: 0; text-align: center; color: var(--muted); font: 600 11.5px/1.4 var(--font-body); }

.pm-xong { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 6px 6px; text-align: center; }
.pm-xong-ic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; animation: pm-no .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pm-no { from { transform: scale(.4); opacity: 0; } }
.pm-xong h3 { margin: 4px 0 0; font-size: var(--text-xl); }
.pm-xong p { margin: 0 0 8px; color: var(--muted); font-size: var(--text-md); line-height: 1.45; }
.pm-xong .pm-mua { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic { animation: none; } }
</style>
