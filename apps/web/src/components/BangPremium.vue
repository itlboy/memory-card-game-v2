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
import { EMOJI_PREMIUM } from '@mm/engine';
import DauPremium from './DauPremium.vue';
import { BAI_PREMIUM, ICON_BAI, nhac, type BaiNhac } from '@/lib/nhac';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { dangDebug } from '@/lib/debug';
import { bcp, ngonNgu, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { GIA_TAM, NGAY_DUNG_THU, NGAY_TANG, huyHieu, conDungThu, conQuaTang, cuaHangThat, coMua, daMuaPremium, giaThat, goiDangCo, huyGoiThu, khoiPhucMua, maPremium, muaGoi, ngayConLai, nhanQuaTang, TINH_NANG_PREMIUM, type Goi, type NoiMoPremium } from '@/lib/premium';
import { canh, canhNgauNhien } from '@/lib/canh';
import { SITE_URL, nenApp } from '@/lib/native';
import { tn } from '@/lib/nen-fb';

/** `nhacHien`: chữ hiện ở dòng cài đặt "Nhạc nền" (Tắt · Ngẫu nhiên · tên bài) — trạng thái nhạc nằm ở App.vue. */
/** `nhacDang`: bài đang phát ở trang chủ (null = nhạc tắt) — nghe thử ở slide Nhạc xong thì trả lại đúng bài này. */
const props = withDefaults(defineProps<{ tu?: NoiMoPremium; nhacHien?: string; nhacDang?: BaiNhac | null }>(), { tu: 'menu', nhacHien: '', nhacDang: null });
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
/*
 * SLIDE ĐẦU BẢNG (bản C, 26.11.2026, mockup duyệt https://claude.ai/artifact/FxwKDjFwv2xKyHwQ9cv5KP — chủ dự án: "ưng lắm",
 * "nên chạy tự động", "tính năng premium nào có thì phải cho vào đây", "cả icon chat nữa"). Mỗi tính năng trong
 * `TINH_NANG_PREMIUM` một trang; tự chuyển 3,2 giây, bấm chấm hoặc vuốt ngang để xem (bấm/vuốt thì đặt lại nhịp).
 * Trang Hình nền dùng ẢNH CHỤP THẬT của app (public/img/pm, tiếng Việt cho máy tiếng Việt, tiếng Anh cho mọi ngôn ngữ khác —
 * chữ trong ảnh rất nhỏ); các trang khác vẽ bằng chính CSS của app (mặt lưng `data-lung` ở keo-lung.css, huy hiệu DauPremium,
 * emoji `EMOJI_PREMIUM`). Máy giảm chuyển động: đứng yên ở trang đầu, vẫn bấm chấm được.
 */
const SLIDE = TINH_NANG_PREMIUM;
const slideI = ref(0);
const slide = computed(() => SLIDE[slideI.value]!);
let henSlide: ReturnType<typeof setInterval> | undefined;
const giamDong = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* 2,5 giây một trang (chủ dự án 26.11.2026: 3,2 giây "delay hơi lâu"). Đang nghe thử nhạc thì DỪNG tự chạy — đang nghe mà slide
   trôi đi là mất chỗ bấm bài khác. */
function chaySlide(): void { clearInterval(henSlide); if (!giamDong && !dangNghe.value) henSlide = setInterval(() => { slideI.value = (slideI.value + 1) % SLIDE.length; }, 2500); }
function denSlide(i: number): void { slideI.value = (i + SLIDE.length) % SLIDE.length; chaySlide(); }
onMounted(chaySlide);
onUnmounted(() => clearInterval(henSlide));
let x0: number | null = null;
function vuotBatDau(e: PointerEvent): void { x0 = e.clientX; }
function vuotXong(e: PointerEvent): void { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 30) denSlide(slideI.value + (dx < 0 ? 1 : -1)); }
const toi = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
const ANH_NEN = ['anh-dao-sang', 'anh-dao-toi', 'thien-ha-sang', 'thien-ha-toi'] as const;
const anhNen = (a: string): string => tn(`/img/pm/${a}-${ngonNgu.value === 'vi' ? 'vi' : 'en'}.jpg`);   // tn: bản nhúng đi đường dẫn tương đối
const LUNG_TH = ['ht-moc', 'ht-dat', 'ht-troi'] as const;
const LUNG_AD = ['ad-nui', 'ad-hoa', 'ad-den'] as const;
const LA_VT = [{ x: 36, y: 66, g: -18 }, { x: 76, y: 50, g: -6 }, { x: 116, y: 44, g: 6 }, { x: 192, y: 44, g: -6 }, { x: 232, y: 50, g: 6 }, { x: 272, y: 66, g: 18 }];
const TIA = Array.from({ length: 12 }, (_, k) => ({ x: Math.round(130 + Math.cos(k * 0.52) * (95 + (k % 3) * 12)), y: Math.round(80 + Math.sin(k * 0.52) * (95 + (k % 3) * 12) * 0.75) }));
const COT_NAM = [38, 52, 44, 60, 58, 70, 64, 78, 72, 86, 80, 96];
/*
 * NGHE THỬ NHẠC PREMIUM ở slide Nhạc nền (26.11.2026, chủ dự án: "chưa thấy có phần âm thanh"). Bấm một bài là phát NGAY bài đó
 * (âm thanh chỉ được phát sau một lần chạm — luật trình duyệt, nên KHÔNG tự phát khi slide tới); bấm lại là dừng. Ai cũng nghe
 * thử được, kể cả chưa có Premium — nghe là để muốn mua. Đóng bảng thì trả lại nhạc trang chủ như trước (`nhacDang`).
 */
const BAI_PM = [...BAI_PREMIUM];
const dangNghe = ref<BaiNhac | null>(null);
function ngheThu(b: BaiNhac): void {
  if (dangNghe.value === b) { dangNghe.value = null; traNhac(); chaySlide(); return; }
  dangNghe.value = b; clearInterval(henSlide);
  nhac.chay('menu', b);
  moChucNang('premium_nghe_thu', { bai: b });
}
function traNhac(): void { if (props.nhacDang) nhac.chay('menu', props.nhacDang); else nhac.dung(); }
onUnmounted(() => { if (dangNghe.value) traNhac(); });

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
      <!-- SLIDE: mỗi tính năng Premium một trang (TINH_NANG_PREMIUM) -->
      <header class="pm-anh" @pointerdown="vuotBatDau" @pointerup="vuotXong">
        <div class="truot" :style="{ transform: `translateX(${-100 * slideI}%)` }" aria-hidden="true">
          <div v-for="sl in SLIDE" :key="sl" class="slide">
            <template v-if="sl === 'nen'">
              <i class="sao" />
              <!-- CẢ SÁNG LẪN TỐI của từng chủ đề (chủ dự án 26.11.2026: "phần chủ đề cho cả chủ đề sáng tối vào") -->
              <img v-for="(a, k) in ANH_NEN" :key="a" class="dt" :class="`d${k}`" :src="anhNen(a)" alt="" draggable="false">
            </template>
            <template v-else-if="sl === 'lung'">
              <i class="sao" />
              <span v-for="(m, i) in [...LUNG_TH, ...LUNG_AD]" :key="m" class="la" :class="i < 3 ? 'th' : 'ad'" :data-lung="m" :style="{ left: `${LA_VT[i]!.x}px`, top: `${LA_VT[i]!.y}px`, transform: `rotate(${LA_VT[i]!.g}deg)` }" />
            </template>
            <div v-else-if="sl === 'emoji'" class="e-pm"><span v-for="e in EMOJI_PREMIUM.slice(0, 8)" :key="e">{{ e }}<i><Crown :size="11" :stroke-width="3" /></i></span></div>
            <div v-else-if="sl === 'huyHieu'" class="hh">
              <span style="--m: #f59e0b">🦊<DauPremium loai="vm" /></span><span style="--m: #e25bc8">🐼<DauPremium loai="tim" /></span><span style="--m: #22b8e6">🦁<DauPremium loai="kc" /></span>
            </div>
            <div v-else-if="sl === 'nhac'" class="nghe">
              <button v-for="b in BAI_PM" :key="b" data-phang type="button" :class="{ on: dangNghe === b }" :aria-pressed="dangNghe === b" :aria-label="td(`tb.nhacBai.${b}`)" @pointerdown.stop @click="ngheThu(b)">
                <component :is="ICON_BAI[b]" :size="22" :stroke-width="2.2" aria-hidden="true" /><i class="song" aria-hidden="true"><u /><u /><u /></i>
              </button>
              <p>{{ dangNghe ? td(`tb.nhacBai.${dangNghe}`) : t('pm.c.ngheThu') }}</p>
            </div>
            <div v-else-if="sl === 'hieuUng'" class="fx">
              <i v-for="(c, k) in TIA" :key="k" class="tia" :style="{ left: `${c.x}px`, top: `${c.y}px` }" />
              <span class="cap" style="left: 44px; transform: rotate(-6deg)">🦄</span><span class="cap" style="left: 142px; transform: rotate(6deg)">🦄</span>
            </div>
            <div v-else-if="sl === 'triNho'" class="nam"><b>{{ t('pm.c.thang12') }}</b><i v-for="(h, k) in COT_NAM" :key="k" :class="{ nay: k === 11 }" :style="{ height: `${h}%` }" /></div>
          </div>
        </div>
        <span class="ten-slide">{{ td(`pm.c.sl.${slide}`) }}</span>
        <button ref="nutDong" data-phang class="dong" :aria-label="t('dhd.dong')" type="button" :disabled="buoc === 'dang'" @click="dong"><X :size="19" :stroke-width="2.6" /></button>
        <span class="cham" :class="{ dung: dangNghe }" role="group" :aria-label="t('tp.premium')">
          <button v-for="(sl, i) in SLIDE" :key="sl" data-phang type="button" :class="{ on: slideI === i }" :aria-label="td(`pm.c.sl.${sl}`)" :aria-pressed="slideI === i" @click="denSlide(i)" />
        </span>
        <span class="nhan" aria-hidden="true"><Crown :size="15" :stroke-width="2.8" />PREMIUM</span>
      </header>

      <div class="pm-than">
        <h2 id="pmTitle">{{ t('tb.thuongHieu') }} <b>{{ t('tp.premium') }}</b></h2>

        <!-- ĐÃ MUA / NHẬN XONG: lời cảm ơn -->
        <section v-if="buoc === 'xong'" class="pm-xong" role="status">
          <span class="pm-xong-ic" aria-hidden="true"><Check :size="34" :stroke-width="3" /></span>
          <h3>{{ t('pm.camOn') }}</h3>
          <p>{{ dangThu ? t('pm.dangThu', { ngay: dangThu }) : t('pm.camOnMoTa') }}</p>
          <button class="thach th-vang pm-mua" type="button" @click="buoc = 'chon'">{{ t('pm.tiepTuc') }}</button>
        </section>

        <template v-else-if="daMuaPremium">
          <!-- QUÀ TẶNG TỰ ĐỘNG (27.11.2026): app vừa tự bật 1 tháng — nói rõ MIỄN PHÍ, không cần thanh toán -->
          <section v-if="props.tu === 'qua'" class="pm-qua" role="status">
            <span class="ic" aria-hidden="true"><Gift :size="20" :stroke-width="2.6" /></span>
            <span><b>{{ t('pm.qua.tieuDe') }}</b><small>{{ t('pm.qua.mo') }}</small></span>
          </section>
          <section class="pm-con" role="status">
            <b><Gift v-if="goiDangCo?.tang" :size="19" :stroke-width="2.4" aria-hidden="true" /><Crown v-else :size="19" :stroke-width="2.6" aria-hidden="true" />{{ tongNgay ? t('pm.b.con', { n: conLai }) : t('pm.daCo') }}</b>
            <span v-if="tongNgay" class="thanh" aria-hidden="true"><i :style="{ width: `${Math.min(100, Math.round((conLai / tongNgay) * 100))}%` }" /></span>
            <small>{{ trangThaiCo }}</small>
          </section>
          <section class="pm-cd" :aria-label="t('pm.caiDat')">
            <p class="pm-cd-dau"><span class="ic" aria-hidden="true"><SlidersHorizontal :size="17" :stroke-width="2.6" /></span>{{ t('pm.caiDat') }}</p>
            <div class="pm-cd-o">
              <button class="thach mau-tim" type="button" @click="emit('mo', 'nen')"><span class="ic" style="--c: #6c5ce7" aria-hidden="true"><Image :size="17" :stroke-width="2.4" /></span><b>{{ t('pm.s.nen') }}</b><small>{{ chuDeHien }}</small></button>
              <button class="thach mau-cam" type="button" @click="emit('mo', 'nhac')"><span class="ic" style="--c: #e17055" aria-hidden="true"><Music :size="17" :stroke-width="2.4" /></span><b>{{ t('tb.nhacNen') }}</b><small>{{ nhacHien }}</small></button>
              <button class="thach mau-xanh" type="button" @click="emit('mo', 'hh')"><span class="ic" style="--c: #f0a500" aria-hidden="true"><Award :size="17" :stroke-width="2.4" /></span><b>{{ t('pm.cd.huyHieu') }}</b><small>{{ huyHieu ? t(`hhb.${huyHieu}`) : t('tb.amNgan.off') }}</small></button>
            </div>
            <p v-if="props.tu === 'qua'" class="pm-cd-goi">{{ t('pm.qua.goiY') }}</p>
          </section>
        </template>

        <template v-else>
          <!-- BỐN Ô QUYỀN LỢI — mỗi ô MỘT nhãn đậm (chủ dự án: chữ phụ màu nhạt "mau rít", bỏ) -->
          <ul class="pm-ql">
            <li v-for="d in QL" :key="d.id" :class="{ noi: dongNoi === d.id }"><span class="ic" :style="{ '--c': d.mau }" aria-hidden="true"><component :is="d.ic" :size="17" :stroke-width="2.4" /></span>{{ td(`pm.c.${d.id}`) }}</li>
          </ul>

          <!-- CÒN QUÀ: dòng thời gian NGANG + một nút -->
          <template v-if="conQuaTang">
            <section class="pm-moc" :aria-label="t('pm.b.moc')">
              <div><span class="ic" style="--c: #f5b324" aria-hidden="true"><Gift :size="16" :stroke-width="2.6" /></span><b>{{ t('pm.b.homNay') }}</b><small>{{ t('pm.c.moPm') }}</small></div>
              <div><span class="ic" style="--c: #2f8ff0" aria-hidden="true"><Bell :size="16" :stroke-width="2.6" /></span><b>{{ t('pm.b.ngay', { n: NGAY_TANG - 3 }) }}</b><small>{{ t('pm.c.nhacBan') }}</small></div>
              <div><span class="ic" style="--c: #1f9d6b" aria-hidden="true"><Undo2 :size="16" :stroke-width="2.6" /></span><b>{{ t('pm.b.ngay', { n: NGAY_TANG }) }}</b><small>{{ t('pm.c.tuVe') }}</small></div>
            </section>
            <button data-phang class="pm-mua cta" type="button" @click="nhanTang"><Gift :size="22" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.b.nhan') }}</button>
          </template>

          <!-- HẾT QUÀ: hai gói + nút mua + câu tự gia hạn — Apple bắt buộc có đủ cạnh nút mua -->
          <!-- Giai đoạn tặng, chưa bán thật: không nút mua (lib/premium `coMua`) -->
          <p v-else-if="!coMua" class="pm-luat">{{ t('pm.sapBan') }}</p>
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
            <button data-phang class="pm-mua cta" type="button" :disabled="buoc === 'dang'" @click="mua">
              <template v-if="buoc === 'dang'"><LoaderCircle class="pm-quay" :size="20" :stroke-width="2.8" aria-hidden="true" />{{ t('pm.dangXuLy') }}</template>
              <template v-else-if="coThu">{{ t('pm.thuNgay', { n: gia.ngayThu }) }}</template>
              <template v-else><Crown :size="20" :stroke-width="2.6" aria-hidden="true" />{{ t('pm.nangCap') }}</template>
            </button>
            <p class="pm-yen"><ShieldCheck :size="14" :stroke-width="2.6" aria-hidden="true" />{{ t(coThu ? 'pm.sauThu' : 'pm.khongThu', { gia: goi === 'nam' ? t('pm.giaNam', { gia: gia.nam }) : t('pm.giaThang', { gia: gia.thang }) }) }}</p>
            <p class="pm-luat">{{ t('pm.tuGiaHan') }}</p>
          </template>
        </template>

        <nav v-if="buoc !== 'xong'" class="pm-link">
          <span v-if="!daMuaPremium && conQuaTang" class="chan">{{ t('pm.c.chan') }}</span>
          <!-- "Quản lý gói" CHỈ khi gói mua qua cửa hàng THẬT (chủ dự án 26.11.2026: "quản lý gói chưa có thì nên tắt đi") -->
          <a v-if="cuaHangThat && daMuaPremium && goiDangCo && !goiDangCo.tang && !goiDangCo.vinhVien" :href="LINK_QUAN_LY" target="_blank" rel="noopener">{{ t('pm.quanLy') }}</a>
          <button v-if="!daMuaPremium && !conQuaTang && coMua" data-phang type="button" :disabled="buoc === 'dang'" @click="khoiPhuc">{{ t('pm.khoiPhuc') }}</button>
          <button v-if="daMuaPremium && !cuaHangThat && dangDebug" data-phang type="button" @click="huy">{{ t('pm.tat') }}</button>
          <a :href="LINK_DIEU_KHOAN" target="_blank" rel="noopener">{{ t('pm.dieuKhoan') }}</a>
          <a :href="LINK_RIENG_TU" target="_blank" rel="noopener">{{ t('pm.riengTu') }}</a>
        </nav>
        <p v-if="daMuaPremium && !cuaHangThat && dangDebug && buoc !== 'xong'" class="pm-luat">{{ t('pm.thu') }}</p>
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
/*
 * BẢN C: nền bảng có quầng màu ở trên (vàng ấm nền sáng · tím đêm nền tối); CHỮ CHÍNH MÀU ĐẶC tương phản cao — chủ dự án chê chữ
 * phụ màu nhạt "mau rít ra" ở bản trước, nên chỉ còn đúng một dòng chữ nhỏ (chân bảng).
 */
.pm {
  --chu: #1d2348; --chu2: #3c4778; --o: #f3f5fc; --o-vien: #e3e8f6; --vien-moc: #fff;
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-cot: #fff6dc; --pm-vien: #f0cf7a; --ke: #e3e8f6; --d: 14px;
  --quang: radial-gradient(120% 60% at 50% 0%, #fff1c2 0%, #ffffff 58%);
  position: relative; isolation: isolate;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; padding: 0; border-radius: 30px; color: var(--chu);
}
/* Quầng màu nằm ở lớp RIÊNG phía dưới: nền `.panel` của skin (bộ chọn mạnh hơn, có !important) đè mất nếu ghi thẳng `background` */
.pm::before { content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--quang); }
:global([data-theme='dark'] .pm) {
  --chu: #ffffff; --chu2: #d9def8; --o: rgba(255, 255, 255, .07); --o-vien: rgba(255, 255, 255, .12); --vien-moc: #1c1d52;
  --pm: #ffd36b; --pm-nen: #3a3160; --pm-cot: #2f2a5c; --pm-vien: #7a6530; --ke: rgba(255, 255, 255, .14);
  --quang: radial-gradient(120% 60% at 50% 0%, #4a3a9e 0%, #1c1d52 55%, #141640 100%);
}
.pm > * { flex-shrink: 0; }

/* ---------- slide ---------- */
.pm-anh { position: relative; height: 262px; overflow: hidden; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.truot { position: absolute; inset: 0; display: flex; transition: transform .5s cubic-bezier(.3, .8, .3, 1); }
.slide { position: relative; flex: 0 0 100%; height: 100%; }
.sao { position: absolute; inset: 0; background:
  radial-gradient(circle 2px at 18% 30%, #ffd34d 95%, transparent), radial-gradient(circle 1.5px at 84% 22%, #ffd34d 95%, transparent),
  radial-gradient(circle 2.5px at 80% 70%, #fff 95%, transparent), radial-gradient(circle 1.5px at 12% 76%, #fff 95%, transparent); }
/* khung chứa slide rộng bằng bảng; các phần tử đặt theo bề rộng 378 (bảng trên iPhone 15) rồi căn giữa */
.slide > :not(.sao) { position: absolute; }
/* Bốn điện thoại xoè: Hoa anh đào sáng · tối, Thiên hà sáng · tối — hai cái giữa cao hơn, đè lên hai cái ngoài */
.dt { top: 40px; width: 82px; height: 158px; border-radius: 16px; border: 3px solid #11152f; object-fit: cover; box-shadow: 0 14px 24px rgba(20, 20, 60, .35); }
.dt.d0 { left: calc(50% - 168px); top: 52px; transform: rotate(-12deg); }
.dt.d1 { left: calc(50% - 88px); top: 36px; transform: rotate(-4deg); z-index: 1; }
.dt.d2 { left: calc(50% + 6px); top: 36px; transform: rotate(4deg); z-index: 1; }
.dt.d3 { left: calc(50% + 86px); top: 52px; transform: rotate(12deg); }
.la { margin-left: calc(50% - 189px); width: 76px; height: 102px; border-radius: 13px; border: 3px solid var(--vien-la); box-shadow: 0 10px 18px rgba(20, 20, 60, .3);
  background: var(--lung-hinh) center / var(--lung-co) auto no-repeat, var(--nen-la); }
.la.th { --nen-la: linear-gradient(155deg, #2a4fd0, #0a1650 70%); --vien-la: #cfe6ff; }
.la.ad { --nen-la: linear-gradient(155deg, #ff8fb6, #e0508a); --vien-la: #fff; }
:global([data-theme='dark'] .pm .la.ad) { --nen-la: linear-gradient(155deg, #d8478a, #7a1f5c); --vien-la: #ffd3e3; }
.e-pm { left: 50%; top: 66px; transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 52px); gap: 10px; }
.e-pm span { position: relative; width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; font-size: 30px; background: var(--o); border: 1px solid var(--o-vien); box-shadow: 0 4px 10px rgba(20, 20, 60, .12); }
.e-pm span i { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(#ffe08a, #f5b324); color: #5b3d00; }
.hh { left: 50%; top: 76px; transform: translateX(-50%); display: flex; gap: 22px; }
.hh span { position: relative; width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; font-size: 44px; background: var(--m); box-shadow: 0 6px 0 rgba(0, 0, 0, .15); }
.fx { left: 50%; top: 48px; transform: translateX(-50%); width: 260px; height: 170px; }
.fx .cap { position: absolute; top: 30px; width: 74px; height: 100px; border-radius: 12px; border: 4px solid #f5b324; background: linear-gradient(#fffdf2, #fff1c9); display: grid; place-items: center; font-size: 40px; box-shadow: 0 0 0 6px rgba(245, 179, 36, .25), 0 0 28px rgba(255, 200, 60, .9); }
.fx .tia { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #ffd34d; box-shadow: 0 0 8px #ffd34d; }
/* Slide Nhạc: 6 bài Premium, bấm để nghe thử — bài đang phát sáng lên, có ba vạch sóng nhún */
.nghe { left: 50%; top: 54px; transform: translateX(-50%); width: 236px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.nghe button { position: relative; height: 50px; border: 0; border-radius: 18px; display: grid; place-items: center; cursor: pointer; color: #fff;
  background: linear-gradient(155deg, #f08a5d, #c8553d); box-shadow: 0 4px 0 #9c3d2a, 0 8px 14px rgba(20, 20, 60, .2); }
.nghe button:nth-child(2n) { background: linear-gradient(155deg, #8e7cf0, #5b47c8); box-shadow: 0 4px 0 #3f2f9a, 0 8px 14px rgba(20, 20, 60, .2); }
.nghe button.on { outline: 3px solid #f5b324; outline-offset: 2px; }
.nghe .song { position: absolute; right: 8px; bottom: 7px; display: none; gap: 2px; align-items: flex-end; height: 12px; }
.nghe button.on .song { display: flex; }
.nghe .song u { width: 3px; border-radius: 2px; background: #fff; animation: song .8s ease-in-out infinite alternate; }
.nghe .song u:nth-child(2) { animation-delay: -.3s; } .nghe .song u:nth-child(3) { animation-delay: -.55s; }
@keyframes song { from { height: 3px; } to { height: 12px; } }
.nghe p { grid-column: 1 / -1; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; font: 800 13px/1.2 var(--font-body); color: var(--chu); }
.nam { left: 50%; top: 58px; transform: translateX(-50%); width: 270px; height: 130px; display: flex; align-items: flex-end; gap: 6px; padding: 26px 12px 10px; box-sizing: border-box; border-radius: 18px; background: var(--o); border: 1px solid var(--o-vien); }
.nam i { flex: 1; border-radius: 5px 5px 2px 2px; background: #0f8a7a; }
.nam i.nay { background: #2ed3b7; }
.nam b { position: absolute; left: 12px; top: 8px; font: 900 13px/1 var(--font-body); color: var(--chu2); }
.ten-slide { position: absolute; z-index: 3; left: 14px; top: 14px; padding: 5px 11px; border-radius: 999px; background: rgba(29, 35, 72, .08); color: var(--chu); font: 800 12.5px/1.2 var(--font-body); }
:global([data-theme='dark'] .pm .ten-slide) { background: rgba(255, 255, 255, .12); }
.dong { position: absolute; z-index: 3; top: 10px; right: 10px; width: 40px; height: 40px; border: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(29, 35, 72, .08); color: var(--chu); cursor: pointer; }
:global([data-theme='dark'] .pm .dong) { background: rgba(255, 255, 255, .12); }
.cham { position: absolute; z-index: 3; left: 0; right: 0; bottom: 42px; display: flex; justify-content: center; gap: 0; }
.cham button { width: 20px; height: 22px; border: 0; padding: 0; background: none; cursor: pointer; display: grid; place-items: center; }
.cham button::before { content: ''; width: 7px; height: 7px; border-radius: 4px; background: rgba(29, 35, 72, .25); transition: width .3s, background .3s; }
:global([data-theme='dark'] .pm .cham button::before) { background: rgba(255, 255, 255, .35); }
.cham button.on::before { width: 18px; background: #f5b324; }
.nhan { position: absolute; z-index: 3; left: 50%; bottom: 0; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px;
  background: linear-gradient(#ffe08a, #f5b324); color: #4a3300; font: 900 13px/1 var(--font-body); letter-spacing: .08em; box-shadow: 0 3px 0 #c98f12;
  margin-bottom: 8px; /* chừa chỗ cho đế 3px: khung slide `overflow: hidden` cắt mất đáy nhãn (chủ dự án chụp 26.11.2026) */ }

/* ---------- thân ---------- */
.pm-than { display: flex; flex-direction: column; gap: var(--d); padding: 14px 18px 14px; }
.pm-than > * { flex-shrink: 0; }
.pm-than h2 { margin: 2px 0 0; text-align: center; font: 900 27px/1.1 var(--font-display); color: var(--chu); }
.pm-than h2 b { background: linear-gradient(90deg, #e8930c, #f5b324); -webkit-background-clip: text; background-clip: text; color: transparent; }
:global([data-theme='dark'] .pm-than h2 b) { background: linear-gradient(90deg, #ffd36b, #ffb238); -webkit-background-clip: text; background-clip: text; }
.pm-ql { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pm-ql li { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px; border-radius: 16px; background: var(--o); border: 1px solid var(--o-vien); font: 800 14px/1.2 var(--font-body); color: var(--chu); }
.pm-ql li.noi { border-color: #f5b324; box-shadow: 0 0 0 2px rgba(245, 179, 36, .35); }
.pm-ql .ic, .pm-cd .ic, .pm-moc .ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--c); color: #fff; }
/* Dòng thời gian NGANG một hàng: ba mốc nối bằng vạch màu */
.pm-moc { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pm-moc::before { content: ''; position: absolute; top: 16px; left: 16.6%; right: 16.6%; height: 3px; border-radius: 3px; background: linear-gradient(90deg, #f5b324, #2f8ff0, #1f9d6b); }
.pm-moc div { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; min-width: 0; }
.pm-moc .ic { width: 34px; height: 34px; border-radius: 50%; box-shadow: 0 0 0 4px var(--vien-moc); }
.pm-moc b { font: 900 13.5px/1.1 var(--font-body); color: var(--chu); }
.pm-moc small { font: 700 12px/1.25 var(--font-body); color: var(--chu2); }
.cta { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 58px; border: 0; border-radius: 19px; cursor: pointer; font: 900 19px/1 var(--font-body); color: #3d2a00;
  background: linear-gradient(#ffe590, #ffc83a); box-shadow: 0 5px 0 #d69a12, 0 12px 22px rgba(214, 154, 18, .35); }
.cta:active { transform: translateY(3px); box-shadow: 0 2px 0 #d69a12; }
.cta:disabled { opacity: .7; }

.pm-qua { display: flex; align-items: center; gap: 11px; padding: 12px 14px; border-radius: 18px; text-align: left; background: color-mix(in srgb, #2fb57a 16%, var(--pm-nen)); border: 2px solid color-mix(in srgb, #2fb57a 60%, transparent); color: var(--fg); }
.pm-qua .ic { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: #5b3d00; background: radial-gradient(circle at 35% 30%, #fff1b8, #f5b324 70%); box-shadow: 0 0 14px 2px rgba(255, 196, 40, .55); }
.pm-qua b { display: block; font: 800 17px/1.2 var(--font-display); }
.pm-qua small { display: block; margin-top: 2px; font: 700 12.5px/1.4 var(--font-body); color: var(--muted); }
.pm-cd-goi { margin: 8px 2px 0; font: 700 12px/1.4 var(--font-body); color: var(--pm); opacity: .85; text-align: center; }
.pm-con { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 18px; background: var(--pm-nen); border: 2px solid var(--pm-vien); color: var(--pm); }
.pm-con b { display: flex; align-items: center; gap: 7px; font: 900 16px/1.2 var(--font-body); }
.pm-con small { font: 700 12.5px/1.3 var(--font-body); }
.pm-con .thanh { height: 8px; border-radius: 99px; background: rgba(0, 0, 0, .1); overflow: hidden; }
.pm-con .thanh i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #f5b324, #ffd96a); }
.pm-cd { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 20px; background: linear-gradient(160deg, #ffe7a0, #ffc94a); box-shadow: 0 4px 0 #d69a12, 0 10px 20px rgba(214, 154, 18, .28); }
:global([data-theme='dark'] .pm-cd) { background: linear-gradient(160deg, #6b5418, #4a3a10); box-shadow: 0 4px 0 #2e2408, 0 10px 20px rgba(0, 0, 0, .35); }
.pm-cd-dau { margin: 0; display: flex; align-items: center; gap: 9px; font: 900 17px/1.2 var(--font-display); color: #4a3300; }
:global([data-theme='dark'] .pm-cd-dau) { color: #ffe39a; }
.pm-cd-dau .ic { width: 32px; height: 32px; border-radius: 11px; display: grid; place-items: center; background: #fff; color: #b07800; }
:global([data-theme='dark'] .pm-cd-dau .ic) { background: #ffd36b; color: #4a3300; }
.pm-cd-o { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pm-cd-o .thach { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 9px; border-radius: 15px; cursor: pointer; }
.pm-cd-o b { font: 900 14px/1.2 var(--font-body); }
/* BA NÚT ĐA MÀU (26.11.2026, chủ dự án: "các nút cài đặt premium hơi mờ nhạt, sợ người dùng không thấy — làm đa màu sắc"): mỗi nút
   một màu thạch đậm, chữ trắng, icon trắng nền đặc — nổi trên khối vàng ở cả nền sáng lẫn tối. Màu qua biến hệ thạch
   (--b1 sáng · --b2 thân · --b3 đế · --bc chữ). */
.pm-cd-o .thach { color: #fff; }
/* Nền tối: skin làm mờ mọi nút thạch (`brightness(.86) saturate(.9)`) — ba nút này phải giữ màu tươi */
:global([data-theme='dark'] .pm-cd-o .thach) { filter: none !important; }
.pm-cd-o .mau-tim { --b1: #9d8bff; --b2: #6c5ce7; --b3: #4636b8; --bc: #fff; }
.pm-cd-o .mau-cam { --b1: #ffa27a; --b2: #e8663f; --b3: #b2401f; --bc: #fff; }
.pm-cd-o .mau-xanh { --b1: #4fd1c5; --b2: #12a594; --b3: #0a7468; --bc: #fff; }
.pm-cd-o .ic { background: rgba(255, 255, 255, .95) !important; color: var(--c); box-shadow: 0 2px 0 rgba(0, 0, 0, .15); }
.pm-cd-o small { color: inherit !important; opacity: .9; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 11.5px/1.2 var(--font-body); color: var(--muted); }
/* Máy rất hẹp (320px): chữ phụ ("Ngẫu nhiên", "Vương miện") xuống dòng thay vì bị cắt "Ngẫu nh…" */
@media (max-width: 359px) { .pm-cd-o small { white-space: normal; text-align: center; } }

.pm-goi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 8px; }
.pm-g { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 12px 6px 8px; border: 2px solid var(--ke); border-radius: 18px; background: none; color: inherit; cursor: pointer; line-height: 1.2; }
.pm-g[aria-checked='true'] { border-color: #f0b429; background: var(--pm-cot); box-shadow: 0 3px 0 var(--pm-vien); }
.pm-g b { font: 800 13px/1.2 var(--font-body); }
.pm-g strong { font: 900 20px/1.15 var(--font-display); }
.pm-g small { font: 700 11.5px/1.2 var(--font-body); color: var(--chu2); }
.pm-g em { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); padding: 2px 9px; border-radius: 999px; background: #1f9d6b; color: #fff; font: 900 11px/1.3 var(--font-body); font-style: normal; white-space: nowrap; }
.pm-yen { display: flex; align-items: center; justify-content: center; gap: 5px; margin: calc(var(--d) * -.5) 0 0; color: var(--chu2); font: 700 12.5px/1.3 var(--font-body); text-align: center; }
.pm-yen svg { flex: none; color: #1f9d6b; }
.pm-quay { animation: pm-quay .9s linear infinite; }
@keyframes pm-quay { to { transform: rotate(360deg); } }
.pm-bao { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--pm-nen); color: var(--pm); font: 700 13px/1.35 var(--font-body); text-align: center; }
.pm-luat { margin: 0; text-align: center; color: var(--chu2); font: 600 11px/1.35 var(--font-body); }
.pm-ma { margin: 0; text-align: center; color: var(--chu2); font: 600 10.5px/1.3 ui-monospace, monospace; user-select: all; -webkit-user-select: all; overflow-wrap: anywhere; }
.pm-link { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 12px; margin-top: calc(var(--d) * -.5); }
.pm-link .chan { flex-basis: 100%; text-align: center; font: 700 12.5px/1.3 var(--font-body); color: var(--chu2); }
.pm-link button, .pm-link a {
  border: 0; background: none; padding: 0; min-height: 28px; display: inline-flex; align-items: center; cursor: pointer;
  color: var(--chu2); font: 700 12.5px/1.2 var(--font-body); text-decoration: underline;
}
.pm-xong { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0 6px 2px; text-align: center; }
.pm-xong-ic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; animation: pm-no .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pm-no { from { transform: scale(.4); opacity: 0; } }
.pm-xong h3 { margin: 4px 0 0; font-size: var(--text-xl); }
.pm-xong p { margin: 0 0 8px; color: var(--chu2); font-size: var(--text-md); line-height: 1.45; }
.pm-xong .pm-mua { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .pm-quay, .pm-xong-ic, .nghe .song u { animation: none; } .truot { transition: none; } }
/* Máy thấp (iPhone SE 667): slide thấp lại và thu nhỏ, khoảng cách gọn — vừa một màn */
@media (max-height: 700px) {
  .pm { --d: 10px; }
  .pm-anh { height: 206px; }
  .slide > :not(.sao) { zoom: .8; }
  .pm-than h2 { font-size: 24px; }
  .pm-ql li { padding: 8px; }
  .cta { min-height: 52px; }
}
</style>
