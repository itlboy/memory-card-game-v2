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
import { ChartColumn, Check, Crown, Gamepad2, Heart, Image, LoaderCircle, MessageCircle, Minus, Music, ShieldCheck, Sparkles, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { bcp, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { GIA_TAM, daMuaPremium, goiDangCo, huyGoiThu, khoiPhucMua, muaGoi, type Goi, type NoiMoPremium } from '@/lib/premium';
import { CANH, CANH_TRON_BO, canh, datCanh, type Canh } from '@/lib/canh';
import { BAI_NHAC, BAI_PREMIUM } from '@/lib/nhac';
import { SITE_URL, nenApp } from '@/lib/native';

const props = withDefaults(defineProps<{ tu?: NoiMoPremium; xemTruoc?: string }>(), { tu: 'menu', xemTruoc: undefined });
const emit = defineEmits<{ close: [] }>();

const goi = ref<Goi>('nam');
const buoc = ref<'chon' | 'dang' | 'xong'>('chon');
const bao = ref<'' | 'khoiPhucKhong' | 'loiMua'>('');
const tien = (v: number): string => `${num(v)}đ`;
const tietKiem = Math.round((1 - GIA_TAM.nam / (GIA_TAM.thang * 12)) * 100);
const namMoiThang = Math.round(GIA_TAM.nam / 12 / 100) * 100;

/*
 * BẢNG SO SÁNH (26.11.2026, chủ dự án: "bảng so sánh phải nói rõ premium khác với thường thế nào"). Mỗi dòng: bản
 * Thường có gì · Premium có gì. CON SỐ LẤY TỪ CODE (số hình nền, số bài nhạc) — đổi nội dung là bảng tự đúng.
 * `sap` = quyền lợi ĐÃ CHỐT nhưng CHƯA LÀM: đeo nhãn "Sắp có" cho tới khi làm xong. Bán thật mà còn nhãn này thì
 * hoặc làm xong, hoặc giữ nhãn — tuyệt đối không bỏ nhãn của thứ chưa có (quảng cáo sai là store gỡ app).
 * Dòng đầu cố ý là thứ HAI BÊN ĐỀU CÓ: người chơi thấy bản thường không bị cắt xén, Premium là thêm chứ không phải chuộc.
 */
const soNen = CANH.length, soBai = BAI_NHAC.length, soBaiThuong = BAI_NHAC.filter((b) => !BAI_PREMIUM.has(b)).length;
interface Dong { id: string; ic: typeof Crown; thuong: string | boolean; premium: string | boolean; sap?: boolean; tu?: NoiMoPremium }
const SO: Dong[] = [
  { id: 'choi', ic: Gamepad2, thuong: true, premium: true },
  { id: 'nen', ic: Image, thuong: '1', premium: String(soNen), tu: 'nen' },
  { id: 'nhac', ic: Music, thuong: String(soBaiThuong), premium: String(soBai), tu: 'nhac' },
  { id: 'thongKe', ic: ChartColumn, thuong: 'pm.v.14ngay', premium: 'pm.v.tronVen', sap: true, tu: 'tri-nho' },
  { id: 'hieuUng', ic: Sparkles, thuong: 'pm.v.coBan', premium: 'pm.v.dacBiet', sap: true },
  { id: 'chat', ic: MessageCircle, thuong: 'pm.v.coBan', premium: 'pm.v.dacBiet', sap: true },
  { id: 'hoTro', ic: Heart, thuong: false, premium: true }
];
const gt = (v: string): string => (v.startsWith('pm.') ? td(v) : v);
/** Dòng ứng với thứ người chơi vừa chạm (mở từ hình nền khoá → dòng Hình nền sáng lên). */
const dongNoi = computed(() => SO.find((d) => d.tu && (d.tu === props.tu || (props.tu === 'cai-dat' && d.tu === 'nen')))?.id ?? '');

/** Hành tinh đang trưng ở đầu bảng — bấm ô hình nền bên dưới là đổi, kể cả khi chưa mua (xem trước, không áp). */
const HANH_TINH = CANH.filter((c) => c !== 'goc');
const xem = ref<Canh>(HANH_TINH.find((c) => c === props.xemTruoc) ?? (canh.value !== 'goc' ? canh.value : 'sao-tho'));

const ngayGiaHan = computed(() => {
  const g = goiDangCo.value;
  return g ? new Intl.DateTimeFormat(bcp(), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(g.het)) : '';
});
/** Trang quản lý gói của store — bán thật thì người chơi huỷ / đổi gói ở đó. */
const LINK_QUAN_LY = nenApp === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
const LINK_DIEU_KHOAN = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const LINK_RIENG_TU = `${SITE_URL}/privacy.html`;

const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('premium', { tu: props.tu }); });
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
  if (c !== 'goc') xem.value = c;
  if (c !== 'goc' && !daMuaPremium.value) { moChucNang('premium_nen_khoa', { canh: c }); return; }
  datCanh(c);
}
function huy(): void { huyGoiThu(); buoc.value = 'chon'; bao.value = ''; }
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pmTitle" @keydown.esc="dong" @click.self="dong" v-cham-ngoai="dong">
    <div class="panel pm" :aria-busy="buoc === 'dang'">
      <div class="pm-cuon">
        <!-- ĐẦU BẢNG: bầu trời đêm + hành tinh đang xem — bán bằng HÌNH, không bằng chữ -->
        <header class="pm-troi">
          <i class="pm-sao" aria-hidden="true" /><i class="pm-bang" aria-hidden="true" />
          <Transition name="pm-ht" mode="out-in"><i :key="xem" class="pm-ht" :class="[xem, { tron: CANH_TRON_BO.has(xem) }]" :style="{ backgroundImage: `var(--ht-${xem})` }" aria-hidden="true" /></Transition>
          <button ref="nutDong" data-phang class="pm-dong" :aria-label="t('dhd.dong')" type="button" :disabled="buoc === 'dang'" @click="dong"><X :size="20" /></button>
          <span class="pm-nhan"><Crown :size="14" :stroke-width="2.8" aria-hidden="true" />{{ t('tp.premium') }}</span>
          <h2 id="pmTitle">{{ daMuaPremium && buoc !== 'xong' ? t('pm.daCo') : t('pm.tieuDe') }}</h2>
          <p>{{ t('pm.khauHieu') }}</p>
        </header>

        <!-- ĐÃ MUA XONG: lời cảm ơn -->
        <section v-if="buoc === 'xong'" class="pm-xong" role="status">
          <span class="pm-xong-ic" aria-hidden="true"><Check :size="34" :stroke-width="3" /></span>
          <h3>{{ t('pm.camOn') }}</h3>
          <p>{{ t('pm.camOnMoTa') }}</p>
        </section>

        <template v-else>
          <!-- HÌNH NỀN: ô tròn vẽ đúng hành tinh; bấm là đầu bảng đổi theo (chưa mua vẫn xem được, có gói thì áp luôn) -->
          <section class="pm-nen" :aria-label="t('pm.l.nen')">
            <button v-for="c in HANH_TINH" :key="c" data-phang class="pm-o-nen" type="button" :class="{ xem: xem === c }" :aria-pressed="daMuaPremium ? canh === c : xem === c" :disabled="buoc === 'dang'" @click="chonNen(c)">
              <i :class="c" :style="{ backgroundImage: `var(--ht-${c})` }" aria-hidden="true" />
              <span>{{ td(`pm.nen.${c}`) }}</span>
              <Check v-if="daMuaPremium && canh === c" class="pm-dang" :size="12" :stroke-width="3.4" aria-hidden="true" />
            </button>
          </section>
          <button v-if="daMuaPremium && canh !== 'goc'" data-phang class="pm-ve-goc" type="button" @click="chonNen('goc')">{{ t('pm.veGoc') }}</button>

          <!-- BẢNG SO SÁNH: cột Premium là một dải vàng chạy suốt -->
          <table class="pm-so">
            <thead><tr><th scope="col"><span class="sr-only">{{ t('pm.cot.quyenLoi') }}</span></th><th scope="col">{{ t('pm.cot.thuong') }}</th><th scope="col" class="p"><Crown :size="13" :stroke-width="2.8" aria-hidden="true" />{{ t('tp.premium') }}</th></tr></thead>
            <tbody>
              <tr v-for="d in SO" :key="d.id" :class="{ noi: dongNoi === d.id }">
                <th scope="row"><span class="ic" aria-hidden="true"><component :is="d.ic" :size="16" :stroke-width="2.4" /></span><span class="chu"><b>{{ td(`pm.s.${d.id}`) }}</b><small>{{ td(`pm.sp.${d.id}`) }}<em v-if="d.sap">{{ t('pm.sapCo') }}</em></small></span></th>
                <td><Check v-if="d.thuong === true" :size="18" :stroke-width="3" :aria-label="t('pm.co')" /><Minus v-else-if="d.thuong === false" :size="16" :stroke-width="3" :aria-label="t('pm.khong')" /><template v-else>{{ gt(d.thuong) }}</template></td>
                <td class="p"><Heart v-if="d.id === 'hoTro'" :size="18" :stroke-width="0" fill="currentColor" :aria-label="t('pm.co')" /><Check v-else-if="d.premium === true" :size="18" :stroke-width="3.2" :aria-label="t('pm.co')" /><template v-else>{{ gt(String(d.premium)) }}</template></td>
              </tr>
            </tbody>
          </table>

          <!-- ĐANG CÓ GÓI -->
          <template v-if="daMuaPremium">
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
            <p class="pm-luat">{{ t('pm.thu') }}</p>
          </template>

          <!-- CHƯA CÓ GÓI: hai gói -->
          <template v-else>
            <div class="pm-goi" role="radiogroup" :aria-label="t('pm.chonGoi')">
              <button data-phang class="pm-g" type="button" role="radio" :aria-checked="goi === 'nam'" :disabled="buoc === 'dang'" @click="chonGoi('nam')">
                <i class="cham" aria-hidden="true" />
                <span class="ten"><b>{{ t('pm.nam') }}<em>{{ t('pm.tietKiem', { pct: tietKiem }) }}</em></b><small>{{ t('pm.namPhu', { gia: tien(GIA_TAM.nam) }) }}</small></span>
                <span class="gia"><strong>{{ tien(namMoiThang) }}</strong><small>{{ t('pm.motThang') }}</small></span>
              </button>
              <button data-phang class="pm-g" type="button" role="radio" :aria-checked="goi === 'thang'" :disabled="buoc === 'dang'" @click="chonGoi('thang')">
                <i class="cham" aria-hidden="true" />
                <span class="ten"><b>{{ t('pm.thang') }}</b><small>{{ t('pm.thangPhu') }}</small></span>
                <span class="gia"><strong>{{ tien(GIA_TAM.thang) }}</strong><small>{{ t('pm.motThang') }}</small></span>
              </button>
            </div>
            <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
            <nav class="pm-link">
              <button data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
              <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
              <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
            </nav>
          </template>
        </template>
      </div>

      <!-- ĐÁY DÍNH: nút mua luôn trong tầm ngón cái, cuộn bảng so sánh tới đâu cũng thấy -->
      <footer v-if="buoc === 'xong'" class="pm-day">
        <button class="thach th-vang pm-mua" type="button" @click="buoc = 'chon'">{{ t('pm.tiepTuc') }}</button>
      </footer>
      <footer v-else-if="!daMuaPremium" class="pm-day">
        <p v-if="bao" class="pm-bao" role="status">{{ t(`pm.${bao}`) }}</p>
        <button class="thach th-vang pm-mua" type="button" :disabled="buoc === 'dang'" @click="mua">
          <template v-if="buoc === 'dang'"><LoaderCircle class="pm-quay" :size="20" :stroke-width="2.8" aria-hidden="true" />{{ t('pm.dangXuLy') }}</template>
          <template v-else><Crown :size="20" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.nangCap') }}<span>{{ goi === 'nam' ? t('pm.giaNam', { gia: tien(GIA_TAM.nam) }) : t('pm.giaThang', { gia: tien(GIA_TAM.thang) }) }}</span></template>
        </button>
        <p class="pm-yen"><ShieldCheck :size="14" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.yenTam') }}</p>
      </footer>
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
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-cot: #fff6dc; --pm-vien: #f0cf7a; --o: #f1f3fb; --ke: #e3e7f5; --nen: var(--panel-solid, #fff);
  width: min(410px, 100%); max-height: 100%; display: flex; flex-direction: column; padding: 0; overflow: hidden;
  background: var(--nen); border-radius: 28px;
}
:global([data-theme='dark'] .pm) { --pm: #ffd36b; --pm-nen: #3a3160; --pm-cot: #2f2a5c; --pm-vien: #7a6530; --o: #2a3170; --ke: #343c80; }
.pm-cuon { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-bottom: 14px; }
.pm-cuon > * { flex-shrink: 0; }
.pm-cuon > :not(.pm-troi) { margin-inline: 16px; }

/* ---------- đầu bảng: trời đêm, giống nhau ở nền sáng và tối (đây là "ảnh sản phẩm") ---------- */
.pm-troi {
  position: relative; overflow: hidden; padding: 18px 150px 20px 20px; min-height: 164px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px;
  color: #fff; background: radial-gradient(120% 90% at 85% 20%, #4b3aa8 0%, #2a2470 42%, #141440 100%);
}
.pm-sao {
  position: absolute; inset: 0; opacity: .9;
  background:
    radial-gradient(1.4px 1.4px at 12% 22%, #fff 50%, transparent 52%), radial-gradient(1px 1px at 28% 58%, #cfd6ff 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 44% 14%, #fff 50%, transparent 52%), radial-gradient(1px 1px at 58% 70%, #fff 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 7% 76%, #ffe9a8 50%, transparent 52%), radial-gradient(1px 1px at 36% 86%, #cfd6ff 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 66% 34%, #ffe9a8 50%, transparent 52%), radial-gradient(1px 1px at 93% 82%, #fff 50%, transparent 52%),
    radial-gradient(1px 1px at 20% 40%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 52% 44%, #cfd6ff 50%, transparent 52%);
}
.pm-bang { position: absolute; top: 26px; left: 46%; width: 62px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, #fff); transform: rotate(-24deg); opacity: .75; }
.pm-ht {
  position: absolute; right: 6px; top: 50%; width: 150px; height: 150px; margin-top: -75px;
  background: center / contain no-repeat; filter: drop-shadow(0 0 22px rgba(160, 150, 255, .55)); animation: pm-troi 7s ease-in-out infinite alternate;
}
.pm-ht.sao-tho { width: 200px; right: -22px; }
.pm-ht.tron { width: 124px; height: 124px; margin-top: -62px; right: 22px; border-radius: 50%; background-size: 62%, cover; box-shadow: 0 0 0 4px rgba(255, 255, 255, .25); }
@keyframes pm-troi { from { transform: translateY(-4px) rotate(-3deg); } to { transform: translateY(5px) rotate(3deg); } }
.pm-ht-enter-active, .pm-ht-leave-active { transition: opacity .18s, scale .18s; }
.pm-ht-enter-from, .pm-ht-leave-to { opacity: 0; scale: .7; }
.pm-dong { position: absolute; top: 10px; right: 10px; z-index: 1; display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .16); color: #fff; cursor: pointer; }
.pm-nhan { position: relative; align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px 4px 8px; border-radius: 999px; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; font: 900 12px/1.2 var(--font-body); letter-spacing: .04em; text-transform: uppercase; }
.pm-troi h2 { position: relative; margin: 2px 0 0; font: 900 25px/1.12 var(--font-display); color: #fff; text-wrap: balance; }
.pm-troi p { position: relative; margin: 0; color: #d6daff; font: 600 13.5px/1.4 var(--font-body); text-wrap: pretty; }

/* ---------- ô hình nền ---------- */
.pm-nen { display: flex; gap: 4px; margin: -2px 0 0 !important; padding: 0 12px 2px; overflow-x: auto; scrollbar-width: none; }
.pm-nen::-webkit-scrollbar { display: none; }
.pm-o-nen { flex: 0 0 66px; }
.pm-o-nen { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 6px 2px; border: 2px solid transparent; border-radius: 16px; background: none; color: inherit; cursor: pointer; }
.pm-o-nen i { width: 44px; height: 44px; border-radius: 50%; background: #1a1a4a center / 118% no-repeat; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .12); }
.pm-o-nen i.sao-tho { background-size: 150%; }
.pm-o-nen i.anh-dao { background-size: 62%, cover; }
.pm-o-nen i.thien-ha { background-size: cover; }
.pm-o-nen span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 11.5px/1.2 var(--font-body); color: var(--muted); }
.pm-o-nen.xem { border-color: var(--pm-vien); background: var(--pm-nen); }
.pm-o-nen.xem span { color: var(--pm); }
.pm-dang { position: absolute; top: 2px; right: 6px; padding: 2px; border-radius: 50%; background: #1f9d6b; color: #fff; }
.pm-ve-goc { align-self: center; margin-top: -8px; border: 0; background: none; color: var(--accent); font: 700 13px/1.2 var(--font-body); text-decoration: underline; min-height: 30px; cursor: pointer; }

/* ---------- bảng so sánh ---------- */
.pm-so { border-collapse: separate; border-spacing: 0; width: calc(100% - 32px); table-layout: fixed; }
.pm-so th, .pm-so td { padding: 7px 4px; text-align: center; vertical-align: middle; border-bottom: 1px solid var(--ke); }
.pm-so thead th { padding-block: 8px; border-bottom: 0; font: 800 11px/1.2 var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.pm-so thead th:nth-child(2), .pm-so td:nth-child(2) { width: 62px; }
.pm-so thead th.p, .pm-so td.p { width: 80px; background: var(--pm-cot); color: var(--pm); border-inline: 2px solid var(--pm-vien); }
.pm-so thead th.p { border-top: 2px solid var(--pm-vien); border-radius: 14px 14px 0 0; }
.pm-so thead th.p svg { vertical-align: -2px; margin-right: 3px; }
.pm-so tbody tr:last-child > * { border-bottom: 0; }
.pm-so tbody tr:last-child td.p { border-bottom: 2px solid var(--pm-vien); border-radius: 0 0 14px 14px; }
.pm-so tbody th { text-align: left; padding-left: 0; }
.pm-so tbody th { display: flex; align-items: center; gap: 9px; min-width: 0; }
.pm-so .ic { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: var(--o); color: var(--pm); }
.pm-so .chu { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.pm-so .chu b { font: 800 13.5px/1.25 var(--font-body); }
.pm-so .chu small { font: 600 11.5px/1.3 var(--font-body); color: var(--muted); text-wrap: pretty; }
.pm-so em { margin-left: 5px; display: inline-block; padding: 1px 6px; border-radius: 999px; background: var(--o); color: var(--muted); font: 800 10px/1.4 var(--font-body); font-style: normal; white-space: nowrap; vertical-align: 1px; }
.pm-so td { font: 800 13px/1.2 var(--font-body); color: var(--muted); }
.pm-so td.p { font-weight: 900; font-size: 14px; }
.pm-so td svg { vertical-align: middle; }
.pm-so tr.noi .ic { background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; }
.pm-so tr.noi .chu b { color: var(--pm); }

/* ---------- gói ---------- */
.pm-goi { display: flex; flex-direction: column; gap: 8px; }
.pm-g { display: flex; align-items: center; gap: 10px; padding: 11px 14px 11px 12px; border: 2px solid var(--ke); border-radius: 18px; background: none; color: inherit; text-align: left; cursor: pointer; }
.pm-g[aria-checked='true'] { border-color: #f0b429; background: var(--pm-cot); box-shadow: 0 3px 0 var(--pm-vien); }
.pm-g .cham { flex: none; width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--muted); }
.pm-g[aria-checked='true'] .cham { border: 6px solid #f0b429; background: #fff; }
.pm-g .ten { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pm-g .ten b { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 7px; font: 900 15px/1.2 var(--font-body); }
.pm-g .ten em { padding: 2px 8px; border-radius: 999px; background: #1f9d6b; color: #fff; font: 900 11px/1.3 var(--font-body); font-style: normal; white-space: nowrap; }
.pm-g small { font: 600 12px/1.3 var(--font-body); color: var(--muted); }
.pm-g .gia { flex: none; display: flex; flex-direction: column; align-items: flex-end; }
.pm-g .gia strong { font: 900 19px/1.1 var(--font-display); }
.pm-luat { margin: 0; text-align: center; color: var(--muted); font: 600 11.5px/1.4 var(--font-body); }
.pm-link { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; margin-top: -8px; }
.pm-link button, .pm-link a {
  border: 0; background: none; padding: 0; min-height: 32px; display: inline-flex; align-items: center; cursor: pointer;
  color: var(--accent); font: 700 13px/1.2 var(--font-body); text-decoration: underline;
}

/* ---------- đáy dính ---------- */
.pm-day { flex: none; display: flex; flex-direction: column; gap: 7px; padding: 12px 16px 14px; background: var(--nen); box-shadow: 0 -1px 0 var(--ke), 0 -10px 18px -12px rgba(10, 12, 40, .35); }
.pm-mua { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 56px; border-radius: 18px; font: 900 18px/1.2 var(--font-body); }
.pm-mua span { margin-left: 2px; padding-left: 10px; border-left: 2px solid rgba(90, 60, 0, .28); font: 800 14px/1.2 var(--font-body); opacity: .9; }
.pm-yen { display: flex; align-items: center; justify-content: center; gap: 5px; margin: 0; color: var(--muted); font: 700 12px/1.3 var(--font-body); }
.pm-quay { animation: pm-quay .9s linear infinite; }
@keyframes pm-quay { to { transform: rotate(360deg); } }
.pm-bao { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--pm-nen); color: var(--pm); font: 700 13px/1.35 var(--font-body); text-align: center; }

.pm-co { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; border-radius: 18px; background: var(--pm-nen); color: var(--pm); border: 2px solid var(--pm-vien); }
.pm-co span { display: flex; flex-direction: column; line-height: 1.25; }
.pm-co b { font: 800 16px/1.2 var(--font-body); }
.pm-co small { font: 600 12.5px/1.3 var(--font-body); }
.pm-ql { align-self: center; display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 18px; text-decoration: none; font: 800 14px/1.2 var(--font-body); }

.pm-xong { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 14px 6px 6px; text-align: center; }
.pm-xong-ic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; animation: pm-no .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pm-no { from { transform: scale(.4); opacity: 0; } }
.pm-xong h3 { margin: 4px 0 0; font-size: var(--text-xl); }
.pm-xong p { margin: 0 0 8px; color: var(--muted); font-size: var(--text-md); line-height: 1.45; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic, .pm-ht { animation: none; } }
</style>
