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
import { Award, ChartColumn, Check, Crown, Gift, Heart, Image, Layers, LoaderCircle, MessageCircle, Music, ShieldCheck, Sparkles, X } from 'lucide-vue-next';
import { EMOJI_PREMIUM } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { bcp, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { GIA_TAM, NGAY_DUNG_THU, NGAY_TANG, huyHieu, conDungThu, conQuaTang, cuaHangThat, daMuaPremium, giaThat, goiDangCo, huyGoiThu, khoiPhucMua, maPremium, muaGoi, ngayConLai, nhanQuaTang, type Goi, type NoiMoPremium } from '@/lib/premium';
import { CANH, canh, canhNgauNhien } from '@/lib/canh';
import { LUNG } from '@/lib/lung-la';
import { BAI_NHAC } from '@/lib/nhac';
import { SITE_URL, nenApp } from '@/lib/native';

/** `nhacHien`: chữ hiện ở dòng cài đặt "Nhạc nền" (Tắt · Ngẫu nhiên · tên bài) — trạng thái nhạc nằm ở App.vue. */
const props = withDefaults(defineProps<{ tu?: NoiMoPremium; nhacHien?: string }>(), { tu: 'menu', nhacHien: '' });
/** `mo`: người chơi bấm một dòng "Cài đặt Premium" — App đóng bảng này, mở bảng Chủ đề / Nhạc nền, đóng bảng đó là quay lại đây. */
const emit = defineEmits<{ close: []; mo: ['nen' | 'nhac' | 'hh'] }>();

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
 * THẺ QUYỀN LỢI (26.11.2026, mockup duyệt https://claude.ai/artifact/ALpRKG88kcozoAgRgw9gCh — chủ dự án: "trang này đẹp hơn,
 * thu hút hơn"): lưới 2 cột, mỗi quyền lợi một thẻ có biểu tượng màu + tên + một dòng mô tả, thay bảng so sánh Thường/Premium
 * dài. CON SỐ LẤY TỪ CODE (số chủ đề, mặt lưng, bài nhạc, emoji) — đổi nội dung là thẻ tự đúng. Mọi quyền lợi ĐÃ LÀM (hết
 * nhãn "Sắp có"); thêm quyền lợi chưa làm thì PHẢI ghi rõ là sắp có — quảng cáo thứ chưa có là store gỡ app.
 * `tu` = mở bảng từ chỗ nào thì thẻ đó sáng lên (bấm chủ đề khoá → thẻ Chủ đề).
 */
const soNen = CANH.length, soBai = BAI_NHAC.length;
/** Mặt lưng lá: bản thường chỉ có lưng ngôi sao; Premium thêm cả bộ của từng chủ đề (lib/lung-la.ts). */
const soLung = Object.values(LUNG).reduce((n, bo) => n + bo.length, 0);
interface The { id: string; ic: typeof Crown; mau: string; ten: string; moTa: string; tu?: NoiMoPremium }
const QL = computed<The[]>(() => [
  { id: 'nen', ic: Image, mau: '#6c5ce7', ten: t('pm.s.nen'), moTa: t('pm.d.nen', { n: soNen }), tu: 'nen' },
  { id: 'lung', ic: Layers, mau: '#0fa3b1', ten: t('pm.s.lung'), moTa: t('pm.d.lung', { n: soLung }) },
  { id: 'nhac', ic: Music, mau: '#e17055', ten: t('tb.nhacNen'), moTa: t('pm.d.nhac', { n: soBai }), tu: 'nhac' },
  { id: 'huyHieu', ic: Award, mau: '#f0a500', ten: t('pm.s.huyHieu'), moTa: t('pm.d.huyHieu') },
  { id: 'thongKe', ic: ChartColumn, mau: '#00b894', ten: t('pm.s.thongKe'), moTa: t('pm.d.thongKe'), tu: 'tri-nho' },
  { id: 'hieuUng', ic: Sparkles, mau: '#e8559b', ten: t('pm.s.hieuUng'), moTa: t('pm.d.hieuUng') },
  { id: 'chat', ic: MessageCircle, mau: '#0984e3', ten: t('pm.s.emoji'), moTa: t('pm.d.emoji', { n: EMOJI_PREMIUM.length }), tu: 'chat' },
  { id: 'hoTro', ic: Heart, mau: '#d6336c', ten: t('pm.s.hoTro'), moTa: t('pm.d.hoTro') }
]);
/** Thẻ ứng với thứ người chơi vừa chạm (mở từ chủ đề khoá → thẻ Chủ đề sáng lên). */
const theNoi = computed(() => QL.value.find((d) => d.tu && (d.tu === props.tu || (props.tu === 'cai-dat' && d.tu === 'nen')))?.id ?? '');

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
/*
 * QUÀ TẶNG 1 THÁNG (26.11.2026, mockup duyệt https://claude.ai/artifact/5y6jdDcExegghTLJbfWKUc; lib/premium.ts `nhanQuaTang`).
 * Còn quà thì bảng mở bằng thẻ quà + nút "Nhận miễn phí" THAY cho hai gói mua. THỐNG KÊ (chủ dự án: "đặt thống kê trước"):
 * `premium_tang_hien` lúc bảng mời · `premium_tang_nhan` lúc bấm nhận · `premium_tang_bo_qua` lúc đóng bảng mà không nhận.
 */
const duocMoi = conQuaTang.value;
let daNhan = false;
const hetHanTang = computed(() => ngay(Date.now() + NGAY_TANG * 86_400_000));
const conLai = computed(() => ngayConLai());
/** Thanh "còn bao nhiêu ngày" ở khối đầu: tổng số ngày của gói đang có (gói tặng 30, gói tháng 30…), null = không có hạn. */
const tongNgay = computed(() => { const g = goiDangCo.value; return g && !g.vinhVien ? Math.max(1, Math.round((g.het - g.tu) / 86_400_000)) : null; });
/** Dòng phụ dưới "Bạn đang có Premium". */
const trangThaiCo = computed(() => {
  const g = goiDangCo.value;
  if (g?.tang) return t('pm.tang.hetHan', { ngay: ngayGiaHan.value });
  if (g?.vinhVien) return t('pm.vinhVien');
  if (dangThu.value) return t('pm.dangThu', { ngay: dangThu.value });
  return g ? t('pm.giaHan', { ngay: ngayGiaHan.value }) : t('pm.khauHieu');
});
function nhanTang(): void {
  if (!nhanQuaTang()) return;
  daNhan = true;
  moChucNang('premium_tang_nhan', { tu: props.tu });
}
/** Chữ ở ô cài đặt "Chủ đề". */
const chuDeHien = computed(() => (canhNgauNhien.value ? t('cn.ngauNhien') : td(`pm.nen.${canh.value}`)));
onMounted(() => { nutDong.value?.focus(); moChucNang('premium', { tu: props.tu }); if (duocMoi) moChucNang('premium_tang_hien', { tu: props.tu }); });
const dong = (): void => {
  if (buoc.value === 'dang') return;
  if (duocMoi && !daNhan) moChucNang('premium_tang_bo_qua', { tu: props.tu });
  emit('close');
};

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
      <header class="pm-dau">
        <h2 id="pmTitle">{{ t('tp.premium') }}</h2>
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
        <!-- KHỐI ĐẦU (mockup duyệt 26.11.2026): khối màu nổi bật — vàng trên nền sáng, tím đêm trên nền tối — có vài đốm sao.
             Đang có Premium: trạng thái + thanh số ngày còn lại · còn quà: lời mời + nút nhận ngay trong khối · còn lại: lời mời mua. -->
        <section class="pm-hero" :class="{ qua: !daMuaPremium && conQuaTang }" role="status">
          <i class="pm-sao s1" aria-hidden="true" /><i class="pm-sao s2" aria-hidden="true" /><i class="pm-sao s3" aria-hidden="true" />
          <div class="pm-hero-t">
            <span class="pm-hero-ic" aria-hidden="true"><Gift v-if="!daMuaPremium && conQuaTang" :size="24" :stroke-width="2.4" /><Crown v-else :size="24" :stroke-width="2.6" /></span>
            <span v-if="daMuaPremium"><b>{{ t('pm.daCo') }}</b><small>{{ trangThaiCo }}</small></span>
            <span v-else-if="conQuaTang"><b>{{ t('pm.tang.tieuDe') }}</b><small>{{ t('pm.tang.moTa') }}</small></span>
            <span v-else><b>{{ t('pm.moi.menu') }}</b><small>{{ t('pm.khauHieu') }}</small></span>
          </div>
          <template v-if="daMuaPremium && tongNgay">
            <span class="pm-han" aria-hidden="true"><i :style="{ width: `${Math.min(100, Math.round((conLai / tongNgay) * 100))}%` }" /></span>
            <span class="pm-han-chu">{{ t('pm.han', { con: conLai, tong: tongNgay }) }}</span>
          </template>
          <template v-else-if="!daMuaPremium && conQuaTang">
            <button class="pm-nhan thach" type="button" @click="nhanTang">{{ t('pm.tang.nhan') }}</button>
            <span class="pm-han-chu">{{ t('pm.tang.hetHan', { ngay: hetHanTang }) }}</span>
          </template>
        </section>

        <!-- CÀI ĐẶT PREMIUM GỘP MỘT HÀNG BA Ô (chủ dự án: "nút settings premium gộp lại thành menu cho đỡ tốn diện tích") -->
        <nav v-if="daMuaPremium" class="pm-menu" :aria-label="t('pm.caiDat')">
          <button class="thach pm-o" type="button" @click="emit('mo', 'nen')"><span class="ic" style="--c: #6c5ce7" aria-hidden="true"><Image :size="18" :stroke-width="2.4" /></span><b>{{ t('pm.s.nen') }}</b><small>{{ chuDeHien }}</small></button>
          <button class="thach pm-o" type="button" @click="emit('mo', 'nhac')"><span class="ic" style="--c: #e17055" aria-hidden="true"><Music :size="18" :stroke-width="2.4" /></span><b>{{ t('tb.nhacNen') }}</b><small>{{ nhacHien }}</small></button>
          <button class="thach pm-o" type="button" @click="emit('mo', 'hh')"><span class="ic" style="--c: #f0a500" aria-hidden="true"><Award :size="18" :stroke-width="2.4" /></span><b>{{ t('pm.cd.huyHieu') }}</b><small>{{ huyHieu ? t(`hhb.${huyHieu}`) : t('tb.amNgan.off') }}</small></button>
        </nav>

        <h3 class="pm-nh">{{ daMuaPremium ? t('pm.quyenLoi') : t('pm.banSeCo') }}</h3>
        <ul class="pm-ql">
          <li v-for="q in QL" :key="q.id" class="q" :class="{ noi: theNoi === q.id }">
            <span class="ic" :style="{ '--c': q.mau }" aria-hidden="true"><component :is="q.ic" :size="16" :stroke-width="2.4" /></span>
            <b>{{ q.ten }}</b><small>{{ q.moTa }}</small>
          </li>
        </ul>

        <!-- MUA GÓI (chưa có Premium, hết quà): hai gói + dùng thử + nút + câu tự gia hạn — Apple bắt buộc có đủ cạnh nút mua -->
        <template v-if="!daMuaPremium && !conQuaTang">
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
          <p class="pm-yen"><ShieldCheck :size="14" :stroke-width="2.6" aria-hidden="true" />{{ t(coThu ? 'pm.sauThu' : 'pm.khongThu', { gia: goi === 'nam' ? t('pm.giaNam', { gia: gia.nam }) : t('pm.giaThang', { gia: gia.thang }) }) }}</p>
          <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
        </template>

        <nav class="pm-link">
          <a v-if="daMuaPremium && goiDangCo && !goiDangCo.tang && !goiDangCo.vinhVien" :href="LINK_QUAN_LY" target="_blank" rel="noopener">{{ t('pm.quanLy') }}</a>
          <button v-if="!daMuaPremium && !conQuaTang" data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
          <button v-if="daMuaPremium && !cuaHangThat" data-phang type="button" @click="huy">{{ t('pm.tat') }}</button>
          <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
          <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
        </nav>
        <p v-if="daMuaPremium && !cuaHangThat" class="pm-luat">{{ t('pm.thu') }}</p>
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
.pm-dau { display: flex; align-items: center; justify-content: space-between; }
.pm-dau h2 { margin: 0; font: 900 21px/1.15 var(--font-display); }

/* ---------- KHỐI ĐẦU (mockup duyệt 26.11.2026) ---------- */
.pm-hero {
  position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 9px; padding: 14px; border-radius: 20px;
  background: radial-gradient(120% 90% at 100% 0%, #ffe6a3 0, transparent 55%), linear-gradient(135deg, #ffd166, #f5a524 60%, #e8891a);
  color: #4a2f00; box-shadow: 0 4px 0 #c47a12;
}
:global([data-theme='dark'] .pm-hero) {
  background: radial-gradient(120% 90% at 100% 0%, #7d5cff 0, transparent 55%), linear-gradient(135deg, #3b2a8f, #2a1f6b 60%, #1c1550);
  color: #fff3d1; box-shadow: 0 4px 0 #120d38;
}
.pm-hero-t { position: relative; display: flex; align-items: center; gap: 11px; }
.pm-hero-t > span:last-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pm-hero-t b { font: 900 18px/1.2 var(--font-display); }
.pm-hero-t small { font: 700 12.5px/1.3 var(--font-body); opacity: .88; }
.pm-hero-ic { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: #fff; color: #d48806; box-shadow: 0 3px 0 rgba(0, 0, 0, .12); }
.pm-han { position: relative; height: 8px; border-radius: 99px; background: rgba(0, 0, 0, .14); overflow: hidden; }
.pm-han i { position: absolute; inset: 0 auto 0 0; border-radius: 99px; background: #fff; }
.pm-han-chu { position: relative; font: 800 12px/1 var(--font-body); opacity: .9; }
/* Nút nhận: thạch TRẮNG trên khối vàng (nền sáng) · thạch VÀNG trên khối tím (nền tối) — màu qua biến của hệ thạch
   (--b1 sáng · --b2 thân · --b3 đế · --bc chữ), ghi background thẳng thì luật thạch (!important) đè mất */
.pm-nhan { position: relative; min-height: 48px; border-radius: 15px; font: 900 18px/1 var(--font-display); cursor: pointer; --b1: #ffffff; --b2: #fff7e6; --b3: #d9962a; --bc: #a86200; color: #a86200; }
:global([data-theme='dark'] .pm-nhan) { --b1: #ffe28a; --b2: #f5b324; --b3: #b47a0c; --bc: #4a2f00; color: #4a2f00; }
.pm-sao { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #fff; opacity: .75; box-shadow: 0 0 8px #fff; animation: pm-nhap 2.4s ease-in-out infinite; }
.pm-sao.s1 { top: 12px; right: 24px; } .pm-sao.s2 { top: 42px; right: 72px; width: 4px; height: 4px; animation-delay: .8s; } .pm-sao.s3 { bottom: 14px; right: 40px; width: 5px; height: 5px; animation-delay: 1.5s; }
@keyframes pm-nhap { 50% { opacity: .15; transform: scale(.6); } }

/* ---------- CÀI ĐẶT: một hàng ba ô ---------- */
.pm-menu { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pm-o { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; padding: 10px 4px 9px; border-radius: 16px; color: inherit; cursor: pointer; }
.pm-o b { font: 800 13.5px/1.15 var(--font-body); }
.pm-o small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 12px/1.15 var(--font-body); color: var(--muted); }
.ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--c); color: #fff; }

/* ---------- QUYỀN LỢI: lưới thẻ ---------- */
.pm-nh { margin: 2px 0 0; font: 800 11px/1.2 var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
.pm-ql { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.pm-ql .q { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 9px; align-items: center; padding: 9px; border-radius: 14px; background: var(--o); }
.pm-ql .q .ic { grid-row: 1 / span 2; width: 30px; height: 30px; }
.pm-ql .q b { align-self: end; font: 800 13.5px/1.2 var(--font-body); }
.pm-ql .q small { align-self: start; font: 600 11.5px/1.25 var(--font-body); color: var(--muted); }
/* Thẻ ứng với chỗ người chơi vừa bấm: viền vàng */
.pm-ql .q.noi { outline: 2.5px solid #f0b429; outline-offset: -1px; }


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

.pm-xong { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 14px 6px 6px; text-align: center; }
.pm-xong-ic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; animation: pm-no .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pm-no { from { transform: scale(.4); opacity: 0; } }
.pm-xong h3 { margin: 4px 0 0; font-size: var(--text-xl); }
.pm-xong p { margin: 0 0 8px; color: var(--muted); font-size: var(--text-md); line-height: 1.45; }
.pm-xong .pm-mua { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic, .pm-sao { animation: none; } }
</style>
