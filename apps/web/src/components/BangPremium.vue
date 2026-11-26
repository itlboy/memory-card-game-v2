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
import { Award, Bell, ChartColumn, Check, Crown, Gift, Image, LoaderCircle, Music, ShieldCheck, SlidersHorizontal, Smile, Undo2, X } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { bcp, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { GIA_TAM, NGAY_DUNG_THU, NGAY_TANG, huyHieu, conDungThu, conQuaTang, cuaHangThat, daMuaPremium, giaThat, goiDangCo, huyGoiThu, khoiPhucMua, maPremium, muaGoi, ngayConLai, nhanQuaTang, type Goi, type NoiMoPremium } from '@/lib/premium';
import { canh, canhNgauNhien } from '@/lib/canh';
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
 * PHƯƠNG ÁN B (26.11.2026, chủ dự án chọn từ mockup https://claude.ai/artifact/1ZwuoozRFvTHxkdK9wRNeo — "chọn B", sau khi
 * bảo "xem các bên làm trang premium thế nào, tham khảo đi"). Theo cách các app lớn làm (Duolingo; tổng kết của RevenueCat /
 * Adapty): (1) bán bằng HÌNH — đầu bảng là ảnh hai hình nền, tự chuyển qua lại; (2) chỉ BỐN dòng quyền lợi (gom 8 thứ cũ);
 * (3) còn quà thì một DÒNG THỜI GIAN nói rõ quà chạy ra sao (hôm nay mở · trước 3 ngày nhắc · hết hạn tự về bản thường, không
 * trừ tiền) — thứ giúp người dùng yên tâm bấm nhất; (4) một nút chính. Đang có Premium: thanh còn bao nhiêu ngày + khối
 * "Cài đặt Premium" NỔI BẬT (chủ dự án: "cài đặt premium cho vào trong nút premium, settings nổi bật chút").
 * Mọi quyền lợi ĐÃ LÀM; thêm quyền lợi chưa làm thì phải ghi rõ là sắp có — quảng cáo thứ chưa có là store gỡ app.
 * `tu` = mở bảng từ chỗ nào thì dòng đó sáng lên.
 */
interface Dong { id: string; ic: typeof Crown; mau: string; tu: NoiMoPremium[] }
const QL: Dong[] = [
  { id: 'nen', ic: Image, mau: '#6c5ce7', tu: ['nen', 'cai-dat'] },
  { id: 'nhac', ic: Music, mau: '#e17055', tu: ['nhac'] },
  { id: 'chat', ic: Smile, mau: '#0984e3', tu: ['chat'] },
  { id: 'triNho', ic: ChartColumn, mau: '#00b894', tu: ['tri-nho'] }
];
const dongNoi = computed(() => QL.find((d) => d.tu.includes(props.tu))?.id ?? '');
/** Ảnh đầu bảng: tự chuyển giữa hai hình nền mỗi 3,5 giây, bấm chấm để chọn. Máy giảm chuyển động thì đứng yên. */
const ANH = ['thien-ha', 'anh-dao'] as const;
const anh = ref(0);
let henAnh: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  henAnh = setInterval(() => { anh.value = (anh.value + 1) % ANH.length; }, 3500);
});
onUnmounted(() => clearInterval(henAnh));
function chonAnh(i: number): void { anh.value = i; clearInterval(henAnh); }

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
      <!-- ẢNH ĐẦU BẢNG: hai hình nền thu nhỏ (vẽ bằng CSS, không tải ảnh), mờ dần vào nền bảng -->
      <header class="pm-anh" :class="{ gon: daMuaPremium }">
        <Transition name="pm-anh"><span :key="ANH[anh]" class="ca" :class="ANH[anh]" aria-hidden="true"><i class="l1" /><i class="l2" /><i class="l3" /><i class="l4" /></span></Transition>
        <span class="ten-anh"><Crown :size="12" :stroke-width="2.8" aria-hidden="true" />{{ td(`pm.nen.${ANH[anh]}`) }}</span>
        <button ref="nutDong" class="btn dong" :aria-label="t('dhd.dong')" type="button" :disabled="buoc === 'dang'" @click="dong"><X :size="20" /></button>
        <span v-if="!daMuaPremium" class="cham" role="group" :aria-label="t('pm.s.nen')">
          <button v-for="(c, i) in ANH" :key="c" data-phang type="button" :class="{ on: anh === i }" :aria-label="td(`pm.nen.${c}`)" :aria-pressed="anh === i" @click="chonAnh(i)" />
        </span>
      </header>

      <div class="pm-than">
        <div class="pm-td">
          <span class="vm" aria-hidden="true"><Crown :size="23" :stroke-width="2.6" /></span>
          <span><h2 id="pmTitle">{{ t('tb.thuongHieu') }} {{ t('tp.premium') }}</h2><small>{{ daMuaPremium && buoc !== 'xong' ? t('pm.b.camOn') : t('pm.b.phu') }}</small></span>
        </div>

        <!-- ĐÃ MUA / NHẬN XONG: lời cảm ơn -->
        <section v-if="buoc === 'xong'" class="pm-xong" role="status">
          <span class="pm-xong-ic" aria-hidden="true"><Check :size="34" :stroke-width="3" /></span>
          <h3>{{ t('pm.camOn') }}</h3>
          <p>{{ dangThu ? t('pm.dangThu', { ngay: dangThu }) : t('pm.camOnMoTa') }}</p>
          <button class="thach th-vang pm-mua" type="button" @click="buoc = 'chon'">{{ t('pm.tiepTuc') }}</button>
        </section>

        <template v-else-if="daMuaPremium">
          <!-- ĐANG CÓ: trạng thái + thanh số ngày còn lại -->
          <section class="pm-con" role="status">
            <b><Gift v-if="goiDangCo?.tang" :size="19" :stroke-width="2.4" aria-hidden="true" /><Crown v-else :size="19" :stroke-width="2.6" aria-hidden="true" />{{ tongNgay ? t('pm.b.con', { n: conLai }) : t('pm.daCo') }}</b>
            <span v-if="tongNgay" class="thanh" aria-hidden="true"><i :style="{ width: `${Math.min(100, Math.round((conLai / tongNgay) * 100))}%` }" /></span>
            <small>{{ trangThaiCo }}</small>
          </section>
          <!-- CÀI ĐẶT PREMIUM: khối vàng NỔI BẬT, ba ô mở bảng chọn như cũ -->
          <section class="pm-cd" :aria-label="t('pm.caiDat')">
            <p class="pm-cd-dau"><span class="ic" aria-hidden="true"><SlidersHorizontal :size="17" :stroke-width="2.6" /></span>{{ t('pm.caiDat') }}</p>
            <div class="pm-cd-o">
              <button class="thach" type="button" @click="emit('mo', 'nen')"><span class="ic" style="--c: #6c5ce7" aria-hidden="true"><Image :size="17" :stroke-width="2.4" /></span><b>{{ t('pm.s.nen') }}</b><small>{{ chuDeHien }}</small></button>
              <button class="thach" type="button" @click="emit('mo', 'nhac')"><span class="ic" style="--c: #e17055" aria-hidden="true"><Music :size="17" :stroke-width="2.4" /></span><b>{{ t('tb.nhacNen') }}</b><small>{{ nhacHien }}</small></button>
              <button class="thach" type="button" @click="emit('mo', 'hh')"><span class="ic" style="--c: #f0a500" aria-hidden="true"><Award :size="17" :stroke-width="2.4" /></span><b>{{ t('pm.cd.huyHieu') }}</b><small>{{ huyHieu ? t(`hhb.${huyHieu}`) : t('tb.amNgan.off') }}</small></button>
            </div>
          </section>
        </template>

        <template v-else>
          <!-- BỐN DÒNG QUYỀN LỢI -->
          <ul class="pm-ql">
            <li v-for="d in QL" :key="d.id" :class="{ noi: dongNoi === d.id }">
              <span class="ic" :style="{ '--c': d.mau }" aria-hidden="true"><component :is="d.ic" :size="16" :stroke-width="2.4" /></span>
              <span><b>{{ td(`pm.b.${d.id}`) }}</b><small>{{ td(`pm.b.${d.id}P`) }}</small></span>
            </li>
          </ul>

          <!-- CÒN QUÀ: dòng thời gian + một nút -->
          <template v-if="conQuaTang">
            <section class="pm-moc" :aria-label="t('pm.b.moc')">
              <p>{{ t('pm.b.moc') }}</p>
              <div><span class="ic" style="--c: #f0a500" aria-hidden="true"><Gift :size="14" :stroke-width="2.6" /></span><span><b>{{ t('pm.b.homNay') }}</b><small>{{ t('pm.b.homNayP') }}</small></span></div>
              <div><span class="ic" style="--c: #2f8ff0" aria-hidden="true"><Bell :size="14" :stroke-width="2.6" /></span><span><b>{{ t('pm.b.ngay', { n: NGAY_TANG - 3 }) }}</b><small>{{ t('pm.b.nhoP') }}</small></span></div>
              <div><span class="ic" style="--c: #1f9d6b" aria-hidden="true"><Undo2 :size="14" :stroke-width="2.6" /></span><span><b>{{ t('pm.b.ngay', { n: NGAY_TANG }) }}</b><small>{{ t('pm.b.hetP') }}</small></span></div>
            </section>
            <button class="thach th-vang pm-mua" type="button" @click="nhanTang"><Gift :size="21" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.b.nhan') }}</button>
            <p class="pm-yen">{{ t('pm.b.khongThe') }}</p>
          </template>

          <!-- HẾT QUÀ: hai gói + nút mua + câu tự gia hạn — Apple bắt buộc có đủ cạnh nút mua -->
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
            <p class="pm-yen"><ShieldCheck :size="14" :stroke-width="2.6" aria-hidden="true" />{{ t(coThu ? 'pm.sauThu' : 'pm.khongThu', { gia: goi === 'nam' ? t('pm.giaNam', { gia: gia.nam }) : t('pm.giaThang', { gia: gia.thang }) }) }}</p>
            <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
          </template>
        </template>

        <nav v-if="buoc !== 'xong'" class="pm-link">
          <!-- "Quản lý gói" CHỈ khi gói mua qua cửa hàng THẬT (chủ dự án 26.11.2026: "quản lý gói chưa có thì nên tắt đi") -->
          <a v-if="cuaHangThat && daMuaPremium && goiDangCo && !goiDangCo.tang && !goiDangCo.vinhVien" :href="LINK_QUAN_LY" target="_blank" rel="noopener">{{ t('pm.quanLy') }}</a>
          <button v-if="!daMuaPremium && !conQuaTang" data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
          <button v-if="daMuaPremium && !cuaHangThat" data-phang type="button" @click="huy">{{ t('pm.tat') }}</button>
          <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
          <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
        </nav>
        <p v-if="daMuaPremium && !cuaHangThat && buoc !== 'xong'" class="pm-luat">{{ t('pm.thu') }}</p>
        <p v-if="cuaHangThat && maPremium" class="pm-ma">{{ t('pm.ma', { ma: maPremium }) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(10px + env(safe-area-inset-top, 0px)) 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Vàng ĐẬM trên nền sáng · vàng SÁNG trên nền tối. Máy thấp (SE) thì khoảng cách nhỏ lại; vẫn không vừa mới cuộn. */
.pm {
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-cot: #fff6dc; --pm-vien: #f0cf7a; --o: #f1f3fb; --ke: #e3e7f5; --nen: var(--panel-solid, #fff); --d: 12px;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  padding: 0; background: var(--nen); border-radius: 28px;
}
:global([data-theme='dark'] .pm) { --pm: #ffd36b; --pm-nen: #3a3160; --pm-cot: #2f2a5c; --pm-vien: #7a6530; --o: #2a3170; --ke: #343c80; }

.pm > * { flex-shrink: 0; }

/* ---------- ảnh đầu bảng ---------- */
.pm-anh { position: relative; height: 172px; overflow: hidden; border-radius: 28px 28px 0 0; }
.pm-anh.gon { height: 112px; }
/* Ảnh mờ dần vào nền bảng bằng MẶT NẠ (không phủ màu): nền `.panel` có lớp riêng, phủ màu đoán sai là ra vệt ranh giới */
.pm-anh { background: none; }
.ca { -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }
.ca { position: absolute; inset: 0; overflow: hidden; }
.ca i { position: absolute; }
.pm-anh-enter-active, .pm-anh-leave-active { transition: opacity .6s ease; }
.pm-anh-enter-from, .pm-anh-leave-to { opacity: 0; }
/* THIÊN HÀ thu nhỏ: trời xanh thẳm, tinh vân, Sao Thổ, lá giữa trong quỹ đạo */
.ca.thien-ha { background:
  radial-gradient(circle 1.4px at 12% 22%, #fff 95%, transparent), radial-gradient(circle 1px at 30% 60%, #cfe6ff 95%, transparent),
  radial-gradient(circle 1.6px at 46% 16%, #fff 95%, transparent), radial-gradient(circle 1px at 64% 78%, #fff 95%, transparent),
  radial-gradient(circle 1.2px at 90% 66%, #fff 95%, transparent), radial-gradient(circle 1px at 8% 80%, #fff 95%, transparent),
  radial-gradient(60% 40% at 20% 30%, rgba(60, 200, 255, .3), transparent 72%), radial-gradient(70% 45% at 92% 70%, rgba(80, 110, 255, .35), transparent 72%),
  linear-gradient(#030719, #0d2466 70%, #153a8c); }
.ca.thien-ha .l1 { right: 6%; top: 10%; width: 128px; height: 86px; background: var(--ht-sao-tho) center / contain no-repeat; }
.ca.thien-ha .l2 { left: 18%; top: 50%; width: 64%; height: 46px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .75); rotate: -12deg; box-shadow: 0 0 10px rgba(130, 200, 255, .9); }
.ca.thien-ha .l3 { left: 43%; top: 40%; width: 40px; height: 54px; border-radius: 9px; border: 2.5px solid #5f9bff; background: linear-gradient(#fffdf2, #fff1c9); rotate: 4deg; box-shadow: 0 0 14px rgba(130, 200, 255, .9); }
.ca.thien-ha .l4 { left: 6%; top: 18%; width: 120px; height: 44px; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(255, 255, 255, .85) 0 6%, rgba(160, 210, 255, .45) 22%, transparent 70%); rotate: -24deg; }
/* HOA ANH ĐÀO thu nhỏ: trời hồng, mặt trời, núi tuyết, lá bài rơi */
.ca.anh-dao { background: radial-gradient(circle at 84% 24%, #fffbe8 0 9%, rgba(255, 248, 214, .6) 10% 19%, transparent 20%), linear-gradient(#ff9fc0, #ffc1d4 45%, #ffe9d6); }
.ca.anh-dao .l1 { left: 16%; bottom: 0; width: 68%; height: 100px; background: linear-gradient(#d98ab6, rgba(246, 195, 216, 0)); clip-path: polygon(0 100%, 30% 40%, 43% 15%, 50% 11%, 57% 15%, 70% 40%, 100% 100%); }
.ca.anh-dao .l2 { left: 10%; top: 18%; width: 34px; height: 46px; border-radius: 8px; border: 2.5px solid #fff; background: radial-gradient(circle, #fff 0 14%, transparent 15%), linear-gradient(155deg, #ff9dc0, #e2558c); rotate: -22deg; }
.ca.anh-dao .l3 { left: 62%; top: 46%; width: 26px; height: 35px; border-radius: 7px; border: 2px solid #fff; background: linear-gradient(155deg, #ff9dc0, #e2558c); rotate: 26deg; opacity: .9; }
.ca.anh-dao .l4 { left: 34%; top: 8%; width: 20px; height: 27px; border-radius: 6px; border: 2px solid #f27aa6; background: linear-gradient(#fffdf2, #fff1c9); rotate: 12deg; opacity: .85; }
.ten-anh { position: absolute; z-index: 1; left: 12px; top: 12px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: rgba(0, 0, 0, .45); color: #fff; font: 800 12px/1.2 var(--font-body); }
.pm-anh .dong { position: absolute; z-index: 1; top: 10px; right: 10px; }
.cham { position: absolute; z-index: 1; left: 0; right: 0; bottom: 12px; display: flex; justify-content: center; gap: 4px; }
.cham button { width: 22px; height: 22px; border: 0; padding: 0; background: none; cursor: pointer; display: grid; place-items: center; }
.cham button::before { content: ''; width: 7px; height: 7px; border-radius: 4px; background: rgba(255, 255, 255, .55); transition: width .3s; }
.cham button.on::before { width: 18px; background: #fff; }

/* ---------- thân ---------- */
.pm-than { display: flex; flex-direction: column; gap: var(--d); padding: 0 16px 14px; margin-top: -10px; position: relative; }
.pm-than > * { flex-shrink: 0; }
.pm-td { display: flex; align-items: center; gap: 11px; }
.pm-td .vm { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 15px; background: linear-gradient(#ffe08a, #f5b324); color: #5b3d00; box-shadow: 0 3px 0 #c98f12; }
.pm-td > span:last-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pm-td h2 { margin: 0; font: 900 23px/1.1 var(--font-display); }
.pm-td small { font: 700 13.5px/1.3 var(--font-body); color: var(--muted); }

.pm-ql { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pm-ql li { display: flex; align-items: center; gap: 11px; }
.pm-ql .ic, .pm-cd .ic, .pm-moc .ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--c); color: #fff; }
.pm-ql b { display: block; font: 800 15px/1.25 var(--font-body); }
.pm-ql small { display: block; font: 700 12px/1.3 var(--font-body); color: var(--muted); }
.pm-ql li.noi b { color: var(--pm); }
.pm-ql li.noi .ic { box-shadow: 0 0 0 3px var(--pm-vien); }

.pm-moc { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 16px; background: var(--o); }
.pm-moc p { margin: 0; font: 800 11.5px/1.2 var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pm-moc div { position: relative; display: flex; align-items: center; gap: 10px; }
.pm-moc .ic { width: 26px; height: 26px; border-radius: 50%; }
.pm-moc b { display: block; font: 800 13.5px/1.2 var(--font-body); }
.pm-moc small { display: block; font: 700 11.5px/1.25 var(--font-body); color: var(--muted); }
.pm-moc div + div::before { content: ''; position: absolute; left: 12px; top: -11px; height: 10px; border-left: 2px dashed var(--ke); }

.pm-con { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 18px; background: var(--pm-nen); border: 2px solid var(--pm-vien); color: var(--pm); }
.pm-con b { display: flex; align-items: center; gap: 7px; font: 900 16px/1.2 var(--font-body); }
.pm-con small { font: 700 12.5px/1.3 var(--font-body); }
.pm-con .thanh { height: 8px; border-radius: 99px; background: rgba(0, 0, 0, .1); overflow: hidden; }
.pm-con .thanh i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #f5b324, #ffd96a); }

/* Cài đặt Premium: khối vàng nổi khối — vàng nắng nền sáng · vàng nâu nền tối */
.pm-cd { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 20px; background: linear-gradient(160deg, #ffe7a0, #ffc94a); box-shadow: 0 4px 0 #d69a12, 0 10px 20px rgba(214, 154, 18, .28); }
:global([data-theme='dark'] .pm-cd) { background: linear-gradient(160deg, #6b5418, #4a3a10); box-shadow: 0 4px 0 #2e2408, 0 10px 20px rgba(0, 0, 0, .35); }
.pm-cd-dau { margin: 0; display: flex; align-items: center; gap: 9px; font: 900 17px/1.2 var(--font-display); color: #4a3300; }
:global([data-theme='dark'] .pm-cd-dau) { color: #ffe39a; }
.pm-cd-dau .ic { width: 32px; height: 32px; border-radius: 11px; display: grid; place-items: center; background: #fff; color: #b07800; }
:global([data-theme='dark'] .pm-cd-dau .ic) { background: #ffd36b; color: #4a3300; }
.pm-cd-o { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pm-cd-o .thach { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 9px; border-radius: 15px; cursor: pointer; }
.pm-cd-o b { font: 800 13.5px/1.2 var(--font-body); }
.pm-cd-o small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 11.5px/1.2 var(--font-body); color: var(--muted); }

/* ---------- mua gói (hết quà) ---------- */
.pm-goi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 8px; }
.pm-g { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 12px 6px 8px; border: 2px solid var(--ke); border-radius: 18px; background: none; color: inherit; cursor: pointer; line-height: 1.2; }
.pm-g[aria-checked='true'] { border-color: #f0b429; background: var(--pm-cot); box-shadow: 0 3px 0 var(--pm-vien); }
.pm-g b { font: 800 13px/1.2 var(--font-body); }
.pm-g strong { font: 900 20px/1.15 var(--font-display); }
.pm-g small { font: 700 11.5px/1.2 var(--font-body); color: var(--muted); }
.pm-g em { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); padding: 2px 9px; border-radius: 999px; background: #1f9d6b; color: #fff; font: 900 11px/1.3 var(--font-body); font-style: normal; white-space: nowrap; }

.pm-mua { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 56px; border-radius: 18px; font: 900 18px/1.2 var(--font-body); cursor: pointer; }
.pm-yen { display: flex; align-items: center; justify-content: center; gap: 5px; margin: calc(var(--d) * -.5) 0 0; color: var(--muted); font: 700 12.5px/1.3 var(--font-body); text-align: center; }
.pm-yen svg { flex: none; color: #1f9d6b; }
.pm-quay { animation: pm-quay .9s linear infinite; }
@keyframes pm-quay { to { transform: rotate(360deg); } }
.pm-bao { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--pm-nen); color: var(--pm); font: 700 13px/1.35 var(--font-body); text-align: center; }
.pm-luat { margin: 0; text-align: center; color: var(--muted); font: 600 11px/1.35 var(--font-body); }
.pm-ma { margin: 0; text-align: center; color: var(--muted); font: 600 10.5px/1.3 ui-monospace, monospace; user-select: all; -webkit-user-select: all; overflow-wrap: anywhere; }
.pm-link { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 16px; margin-top: calc(var(--d) * -.5); }
.pm-link button, .pm-link a {
  border: 0; background: none; padding: 0; min-height: 28px; display: inline-flex; align-items: center; cursor: pointer;
  color: var(--accent); font: 700 12.5px/1.2 var(--font-body); text-decoration: underline;
}

.pm-xong { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 6px 6px 2px; text-align: center; }
.pm-xong-ic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; animation: pm-no .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pm-no { from { transform: scale(.4); opacity: 0; } }
.pm-xong h3 { margin: 4px 0 0; font-size: var(--text-xl); }
.pm-xong p { margin: 0 0 8px; color: var(--muted); font-size: var(--text-md); line-height: 1.45; }
.pm-xong .pm-mua { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic { animation: none; } .pm-anh-enter-active, .pm-anh-leave-active { transition: none; } }
/* Máy thấp (iPhone SE 667): ảnh thấp lại, dòng thời gian và danh sách gọn lại — vừa một màn, không phải cuộn */
@media (max-height: 700px) {
  .pm { --d: 7px; }
  .pm-anh { height: 112px; } .pm-anh.gon { height: 84px; }
  .pm-ql { gap: 6px; } .pm-ql .ic { width: 28px; height: 28px; }
  .pm-moc { gap: 6px; padding: 8px 12px; }
  .pm-mua { min-height: 50px; }
}</style>
