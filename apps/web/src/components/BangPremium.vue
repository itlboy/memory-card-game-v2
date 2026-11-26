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
import { GIA_TAM, NGAY_DUNG_THU, conDungThu, cuaHangThat, daMuaPremium, giaThat, goiDangCo, huyGoiThu, khoiPhucMua, maPremium, muaGoi, type Goi, type NoiMoPremium } from '@/lib/premium';
import { CANH } from '@/lib/canh';
import { BAI_NHAC, BAI_PREMIUM } from '@/lib/nhac';
import { SITE_URL, nenApp } from '@/lib/native';

const props = withDefaults(defineProps<{ tu?: NoiMoPremium }>(), { tu: 'menu' });
const emit = defineEmits<{ close: [] }>();

const goi = ref<Goi>('nam');
const buoc = ref<'chon' | 'dang' | 'xong'>('chon');
const bao = ref<'' | 'khoiPhucKhong' | 'loiMua'>('');
const tien = (v: number): string => `${num(v)}đ`;
/* GIÁ + DÙNG THỬ: có cửa hàng thật thì lấy từ store (đã quy đổi theo nước), chưa có thì số tạm của bản giả lập */
const gia = computed(() => giaThat.value ?? {
  thang: tien(GIA_TAM.thang), nam: tien(GIA_TAM.nam), namMoiThang: tien(Math.round(GIA_TAM.nam / 12 / 100) * 100),
  tietKiem: Math.round((1 - GIA_TAM.nam / (GIA_TAM.thang * 12)) * 100), ngayThu: NGAY_DUNG_THU, duocThu: conDungThu.value
});
/** Nút mua có chào dùng thử không. Store thật: ưu đãi mở đầu nằm ở gói NĂM. */
const coThu = computed(() => gia.value.duocThu && gia.value.ngayThu > 0 && (!giaThat.value || goi.value === 'nam'));

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

const ngay = (ms: number): string => new Intl.DateTimeFormat(bcp(), { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(ms));
/** Đang trong thời gian dùng thử (chưa bị tính tiền). */
const dangThu = computed(() => { const g = goiDangCo.value; return g?.thuDen && g.thuDen > Date.now() ? ngay(g.thuDen) : ''; });
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
function huy(): void { huyGoiThu(); buoc.value = 'chon'; bao.value = ''; }
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pmTitle" @keydown.esc="dong" @click.self="dong" v-cham-ngoai="dong">
    <div class="panel pm" :aria-busy="buoc === 'dang'">
      <!-- ĐẦU BẢNG GỌN (26.11.2026, chủ dự án: phần trời đêm + hành tinh "thừa quá", chỉ cần một câu; cả bảng phải vừa MỘT màn hình) -->
      <header class="pm-dau">
        <span class="pm-vm" aria-hidden="true"><Crown :size="20" :stroke-width="2.6" /></span>
        <span class="pm-td"><h2 id="pmTitle">{{ daMuaPremium && buoc !== 'xong' ? t('pm.daCo') : t('pm.moi.menu') }}</h2><small>{{ t('pm.khauHieu') }}</small></span>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" :disabled="buoc === 'dang'" @click="dong"><X :size="20" /></button>
      </header>

      <!-- ĐÃ MUA XONG: lời cảm ơn -->
      <section v-if="buoc === 'xong'" class="pm-xong" role="status">
        <span class="pm-xong-ic" aria-hidden="true"><Check :size="34" :stroke-width="3" /></span>
        <h3>{{ t('pm.camOn') }}</h3>
        <p>{{ dangThu ? t('pm.dangThu', { ngay: dangThu }) : t('pm.camOnMoTa') }}</p>
        <button class="thach th-vang pm-mua" type="button" @click="buoc = 'chon'">{{ t('pm.tiepTuc') }}</button>
      </section>

      <template v-else>
        <!-- BẢNG SO SÁNH: mỗi quyền lợi MỘT dòng, cột Premium là dải vàng chạy suốt -->
        <table class="pm-so">
          <thead><tr><th scope="col"><span class="sr-only">{{ t('pm.cot.quyenLoi') }}</span></th><th scope="col">{{ t('pm.cot.thuong') }}</th><th scope="col" class="p"><Crown :size="12" :stroke-width="2.8" aria-hidden="true" />{{ t('tp.premium') }}</th></tr></thead>
          <tbody>
            <tr v-for="d in SO" :key="d.id" :class="{ noi: dongNoi === d.id }">
              <th scope="row"><span class="ic" aria-hidden="true"><component :is="d.ic" :size="15" :stroke-width="2.4" /></span><span class="chu">{{ td(`pm.s.${d.id}`) }}<em v-if="d.sap">{{ t('pm.sapCo') }}</em></span></th>
              <td><Check v-if="d.thuong === true" :size="17" :stroke-width="3" :aria-label="t('pm.co')" /><Minus v-else-if="d.thuong === false" :size="15" :stroke-width="3" :aria-label="t('pm.khong')" /><template v-else>{{ gt(d.thuong) }}</template></td>
              <td class="p"><Heart v-if="d.id === 'hoTro'" :size="17" :stroke-width="0" fill="currentColor" :aria-label="t('pm.co')" /><Check v-else-if="d.premium === true" :size="17" :stroke-width="3.2" :aria-label="t('pm.co')" /><template v-else>{{ gt(String(d.premium)) }}</template></td>
            </tr>
          </tbody>
        </table>

        <!-- ĐANG CÓ GÓI -->
        <template v-if="daMuaPremium">
          <div class="pm-co" role="status">
            <Check :size="22" :stroke-width="3" aria-hidden="true" />
            <span><b>{{ goiDangCo && !goiDangCo.vinhVien ? t(goiDangCo.goi === 'nam' ? 'pm.nam' : 'pm.thang') : t('tp.premium') }}</b>
              <small v-if="goiDangCo?.vinhVien">{{ t('pm.vinhVien') }}</small>
              <small v-else-if="dangThu">{{ t('pm.dangThu', { ngay: dangThu }) }}</small>
              <small v-else-if="goiDangCo">{{ t('pm.giaHan', { ngay: ngayGiaHan }) }}</small></span>
          </div>
          <a class="thach th-nho pm-ql" :href="LINK_QUAN_LY" target="_blank" rel="noopener">{{ t('pm.quanLy') }}</a>
          <nav class="pm-link">
            <button v-if="!cuaHangThat" data-phang type="button" @click="huy">{{ t('pm.tat') }}</button>
            <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
            <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
          </nav>
          <p v-if="!cuaHangThat" class="pm-luat">{{ t('pm.thu') }}</p>
        </template>

        <!-- CHƯA CÓ GÓI: hai gói cạnh nhau + dùng thử + nút -->
        <template v-else>
          <div class="pm-goi" role="radiogroup" :aria-label="t('pm.chonGoi')">
            <button data-phang class="pm-g" type="button" role="radio" :aria-checked="goi === 'nam'" :disabled="buoc === 'dang'" @click="chonGoi('nam')">
              <em v-if="gia.tietKiem > 0">{{ t('pm.tietKiem', { pct: gia.tietKiem }) }}</em>
              <b>{{ t('pm.nam') }}</b><strong>{{ gia.nam }}</strong><small>{{ t('pm.moiThang', { gia: gia.namMoiThang }) }}</small>
            </button>
            <button data-phang class="pm-g" type="button" role="radio" :aria-checked="goi === 'thang'" :disabled="buoc === 'dang'" @click="chonGoi('thang')">
              <b>{{ t('pm.thang') }}</b><strong>{{ gia.thang }}</strong><small>{{ t('pm.thangPhu') }}</small>
            </button>
          </div>
          <p v-if="bao" class="pm-bao" role="status">{{ t(`pm.${bao}`) }}</p>
          <button class="thach th-vang pm-mua" type="button" :disabled="buoc === 'dang'" @click="mua">
            <template v-if="buoc === 'dang'"><LoaderCircle class="pm-quay" :size="20" :stroke-width="2.8" aria-hidden="true" />{{ t('pm.dangXuLy') }}</template>
            <template v-else-if="coThu">{{ t('pm.thuNgay', { n: gia.ngayThu }) }}</template>
            <template v-else><Crown :size="20" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.nangCap') }}</template>
          </button>
          <!-- Sau dùng thử bao nhiêu tiền — Apple bắt buộc nói rõ ngay cạnh nút -->
          <p class="pm-yen"><ShieldCheck :size="14" :stroke-width="2.6" aria-hidden="true" />{{ t(coThu ? 'pm.sauThu' : 'pm.khongThu', { gia: goi === 'nam' ? t('pm.giaNam', { gia: gia.nam }) : t('pm.giaThang', { gia: gia.thang }) }) }}</p>
          <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
          <nav class="pm-link">
            <button data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
            <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
            <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
          </nav>
        </template>
        <!-- Mã người dùng bên cửa hàng: cần khi nhờ tặng gói. Chỉ có khi nối cửa hàng thật. -->
        <p v-if="cuaHangThat && maPremium" class="pm-ma">{{ t('pm.ma', { ma: maPremium }) }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(10px + env(safe-area-inset-top, 0px)) 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Vàng ĐẬM trên nền sáng · vàng SÁNG trên nền tối — một tông không đạt tương phản ở cả hai.
   VỪA MỘT MÀN HÌNH: mọi khoảng cách tính theo --d, máy thấp (SE) thì --d nhỏ lại; chỉ khi vẫn không vừa mới cuộn. */
.pm {
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-cot: #fff6dc; --pm-vien: #f0cf7a; --o: #f1f3fb; --ke: #e3e7f5; --d: 10px; --h: 36px;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: var(--d);
  padding: 14px 16px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .pm) { --pm: #ffd36b; --pm-nen: #3a3160; --pm-cot: #2f2a5c; --pm-vien: #7a6530; --o: #2a3170; --ke: #343c80; }
@media (max-height: 700px) { .pm { --d: 7px; --h: 31px; padding-block: 10px; } }
.pm > * { flex-shrink: 0; }
.pm-dau { display: flex; align-items: center; gap: 10px; }
.pm-vm { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 13px; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; box-shadow: 0 2px 0 #c98f12; }
.pm-td { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pm-td h2 { margin: 0; font: 900 20px/1.15 var(--font-display); }
.pm-td small { color: var(--muted); font: 600 12.5px/1.3 var(--font-body); text-wrap: pretty; }

/* ---------- bảng so sánh ---------- */
.pm-so { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed; }
.pm-so th, .pm-so td { height: var(--h); padding: 0 4px; text-align: center; vertical-align: middle; border-bottom: 1px solid var(--ke); }
.pm-so thead th { height: 28px; border-bottom: 0; font: 800 11px/1.2 var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.pm-so thead th:nth-child(2), .pm-so td:nth-child(2) { width: 62px; }
.pm-so thead th.p, .pm-so td.p { width: 80px; background: var(--pm-cot); color: var(--pm); border-inline: 2px solid var(--pm-vien); }
.pm-so thead th.p { border-top: 2px solid var(--pm-vien); border-radius: 12px 12px 0 0; }
.pm-so thead th.p svg { vertical-align: -1px; margin-right: 3px; }
.pm-so tbody tr:last-child > * { border-bottom: 0; }
.pm-so tbody tr:last-child td.p { border-bottom: 2px solid var(--pm-vien); border-radius: 0 0 12px 12px; }
.pm-so tbody th { text-align: left; padding-left: 0; }
.pm-so tbody th { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pm-so .ic { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 9px; background: var(--o); color: var(--pm); }
.pm-so .chu { min-width: 0; font: 800 13.5px/1.2 var(--font-body); }
.pm-so em { display: inline-block; margin-left: 5px; padding: 1px 6px; border-radius: 999px; background: var(--o); color: var(--muted); font: 800 10px/1.4 var(--font-body); font-style: normal; white-space: nowrap; vertical-align: 1px; }
.pm-so td { font: 800 13px/1.2 var(--font-body); color: var(--muted); }
.pm-so td.p { font-weight: 900; }
.pm-so td svg { vertical-align: middle; }
.pm-so tr.noi .ic { background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; }
.pm-so tr.noi .chu { color: var(--pm); }

/* ---------- hai gói cạnh nhau ---------- */
.pm-goi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 8px; }
.pm-g { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 12px 6px 8px; border: 2px solid var(--ke); border-radius: 18px; background: none; color: inherit; cursor: pointer; line-height: 1.2; }
.pm-g[aria-checked='true'] { border-color: #f0b429; background: var(--pm-cot); box-shadow: 0 3px 0 var(--pm-vien); }
.pm-g b { font: 800 13px/1.2 var(--font-body); }
.pm-g strong { font: 900 20px/1.15 var(--font-display); }
.pm-g small { font: 700 11.5px/1.2 var(--font-body); color: var(--muted); }
.pm-g em { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); padding: 2px 9px; border-radius: 999px; background: #1f9d6b; color: #fff; font: 900 11px/1.3 var(--font-body); font-style: normal; white-space: nowrap; }

.pm-mua { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 18px; font: 900 17.5px/1.2 var(--font-body); }
.pm-yen { display: flex; align-items: center; justify-content: center; gap: 5px; margin: calc(var(--d) * -.4) 0 0; color: var(--fg); font: 700 12.5px/1.3 var(--font-body); text-align: center; }
.pm-yen svg { flex: none; color: #1f9d6b; }
.pm-quay { animation: pm-quay .9s linear infinite; }
@keyframes pm-quay { to { transform: rotate(360deg); } }
.pm-bao { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--pm-nen); color: var(--pm); font: 700 13px/1.35 var(--font-body); text-align: center; }
.pm-ma { margin: 0; text-align: center; color: var(--muted); font: 600 10.5px/1.3 ui-monospace, monospace; user-select: all; -webkit-user-select: all; overflow-wrap: anywhere; }
.pm-luat { margin: 0; text-align: center; color: var(--muted); font: 600 11px/1.35 var(--font-body); }
.pm-link { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 16px; margin-top: calc(var(--d) * -.6); }
.pm-link button, .pm-link a {
  border: 0; background: none; padding: 0; min-height: 28px; display: inline-flex; align-items: center; cursor: pointer;
  color: var(--accent); font: 700 12.5px/1.2 var(--font-body); text-decoration: underline;
}
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
.pm-xong .pm-mua { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic { animation: none; } }
</style>
