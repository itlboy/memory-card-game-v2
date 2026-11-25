<script setup lang="ts">
import { Check, Flag, ListFilter, Swords, X } from 'lucide-vue-next';
import { sfx } from '@/lib/audio';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { anKhach, bangXepHang, bxhLanTruoc, bxhOnline, datTenKhach, me, trangBxh, type BangXh, type DongBxh, type DongHang, type LoaiBxh } from '@/lib/taikhoan';
import MatBot from './MatBot.vue';
import VachCho from './VachCho.vue';
import { CACH_MOI_LAI_MS, daThach, trongPhongOnline, type ThachDau } from '@/lib/sanh';
import { ghiHang } from '@/lib/hang-xu';

/**
 * BẢNG XẾP HẠNG (19.11.2026, mockup duyệt https://claude.ai/artifact/CYPTEG9edvmDEgEGFuEnzy):
 * mở từ viên đồng xu trên thanh trên cùng (và từ màn Tài khoản). Cả người CHƯA đăng nhập cũng
 * lên bảng chung (tên trong game + mặt thú) và luôn biết hạng mình: thẻ vàng đầu bảng "#137
 * trong 2.431 người chơi" + còn bao nhiêu điểm để vượt người ngay trên. Ngoài top 20 thì dòng
 * của mình ghim ở đáy kèm người ngay trên/dưới.
 *
 * Khách: ô đặt tên (chưa có tên thì mở sẵn), lời mời đăng nhập để giữ điểm, và "Ẩn tôi khỏi
 * bảng" — chính sách quyền riêng tư hứa nút này (pv.s2d).
 */
const emit = defineEmits<{ close: []; 'dang-nhap': []; thach: [ThachDau] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
/*
 * HAI TAB (20.11.2026, mockup duyệt https://claude.ai/artifact/WqxQ9L7SgMRzERfoqkCgxP — chủ dự án: "bảng xếp hạng tuần
 * để người chơi mới có động lực"): "Tuần" (mở mặc định) và "Mọi lúc". Tuần = thứ Hai 00:00 UTC; ‹ › xem các tuần cũ
 * (server giữ lịch sử). Hạng trên viên xu là HẠNG TUẦN NÀY (20.11.2026) — chỉ bảng Tuần, tuần này mới gọi ghiHang.
 */
const loai = ref<LoaiBxh>('tuan');
/** Thứ Hai của tuần cũ đang xem; undefined = tuần này. */
const tuanXem = ref<string | undefined>(undefined);
/** Hiện NGAY bảng lần trước (bxhLanTruoc) rồi thay bằng số mới — xem taikhoan.ts. */
const bang = ref<BangXh | null>(bxhLanTruoc('tuan'));
const loi = ref(false);
/** Đang hỏi số mới: bảng lần trước vẫn hiện BÌNH THƯỜNG (23.11.2026 bỏ làm mờ); số mới về thì dòng trượt về chỗ mới. */
const dangTai = ref(false);

const laKhach = computed(() => !me.value);
const khachAn = ref(!!store.khach(false)?.an);
const tenMay = ref(store.playerNames()[0] ?? '');
const dangSuaTen = ref(false);
const tenNhap = ref(tenMay.value);
const dangLuu = ref(false);

/*
 * DÒNG TRƯỢT VỀ VỊ TRÍ MỚI khi số mới về (23.11.2026, chủ dự án: "khi kết quả mới có thay đổi thì mình di chuyển vị trí").
 * Kỹ thuật FLIP: chụp vị trí từng người (`data-k`) TRƯỚC khi Vue vẽ lại, vẽ xong thì cho phần tử trượt từ chỗ cũ về chỗ mới.
 * Chỉ khi vẫn ở cùng tab + cùng tuần (đổi tab là bảng khác, trượt qua lại chỉ gây rối). Bảng công khai không mang id nên
 * khoá = tên + mặt + số khách; hai người trùng khoá thì bỏ qua cả hai (không đoán ai là ai).
 */
const gocEl = ref<HTMLElement | null>(null);
const khoa = (d: DongBxh): string => `${d.name}|${d.mat ?? ''}|${d.khach ?? ''}`;
function chupViTri(): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>(), trung = new Set<string>();
  for (const el of gocEl.value?.querySelectorAll<HTMLElement>('[data-k]') ?? []) {
    const k = el.dataset.k!;
    if (m.has(k)) trung.add(k); else m.set(k, el.getBoundingClientRect());
  }
  for (const k of trung) m.delete(k);
  return m;
}
async function truotDong(truoc: Map<string, DOMRect>): Promise<void> {
  if (!truoc.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  await nextTick();
  const sau = chupViTri();
  for (const el of gocEl.value?.querySelectorAll<HTMLElement>('[data-k]') ?? []) {
    const a = truoc.get(el.dataset.k!), b = sau.get(el.dataset.k!);
    if (!a || !b) continue;
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 2 }, { transform: 'none', zIndex: 2 }], { duration: 520, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }
}

let luot = 0;
/** Tab + tuần của bảng đang hiện — chỉ trượt dòng khi số mới thuộc CÙNG bảng. */
let cungBang = 'tuan|';
async function tai(): Promise<void> {
  loi.value = false;
  // Đang có bảng cũ mà mất mạng: giữ bảng cũ, không báo lỗi đè lên
  dangTai.value = true;
  const l = loai.value, w = tuanXem.value, so = ++luot;
  them.value = []; hetThem.value = false;
  void bxhOnline(l, w).then((ds) => { if (so === luot) dsOl.value = ds; }).catch(() => { if (so === luot) dsOl.value = []; });
  try {
    const b = await bangXepHang(l, w);
    if (so !== luot) return;   // đã bấm sang tab / tuần khác — bỏ kết quả cũ
    const truoc = bang.value && cungBang === `${l}|${w ?? ''}` ? chupViTri() : new Map<string, DOMRect>();
    cungBang = `${l}|${w ?? ''}`;
    bang.value = b;
    void truotDong(truoc);
    if (l === 'tuan' && !w) ghiHang(b);
    void keoToiMinh();
  } catch { if (so === luot && !bang.value) loi.value = true; } finally { if (so === luot) dangTai.value = false; }
}
function doiLoai(l: LoaiBxh): void {
  if (l === loai.value) return;
  loai.value = l; tuanXem.value = undefined; chiOnline.value = false;
  bang.value = bxhLanTruoc(l);
  void tai();
}
const NGAY = 86_400_000;
const congNgay = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * NGAY).toISOString().slice(0, 10);
/** Sang tuần trước (-1) / sau (+1). Về đúng tuần hiện tại thì xin "tuần này" (undefined) để được lưu làm bảng lần trước. */
function doiTuan(buoc: -1 | 1): void {
  const tw = bang.value?.tuan;
  if (!tw) return;
  const moi = congNgay(tw.batDau, 7 * buoc);
  tuanXem.value = buoc === 1 && Date.parse(`${moi}T00:00:00Z`) + 7 * NGAY > Date.now() ? undefined : moi;
  void tai();
}
const tuan = computed(() => (loai.value === 'tuan' ? bang.value?.tuan ?? null : null));
const ngayNgan = (d: string): string => new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
/** "Tuần này" / "Tuần trước" / "3 – 9/11". */
const tenTuan = computed(() => {
  const tw = tuan.value;
  if (!tw) return '';
  if (tw.nay) return t('bxh.tuanNay');
  if (tw.het + 7 * NGAY > Date.now()) return t('bxh.tuanTruoc');
  return `${ngayNgan(tw.batDau)} – ${ngayNgan(congNgay(tw.batDau, 6))}`;
});
/** Dòng nhỏ: tuần này "còn 3 ngày" (ngày cuối: "còn 5 giờ"); tuần trước: ngày tháng. Chủ dự án: "hiển thị đơn giản hơn". */
const phuTuan = computed(() => {
  const tw = tuan.value;
  if (!tw) return '';
  if (tw.nay) {
    const con = tw.het - Date.now();
    return con >= NGAY ? t('bxh.conNgay', { n: Math.floor(con / NGAY) }) : t('bxh.conGio', { n: Math.max(1, Math.ceil(con / 3_600_000)) });
  }
  return tenTuan.value === t('bxh.tuanTruoc') ? `${ngayNgan(tw.batDau)} – ${ngayNgan(congNgay(tw.batDau, 6))}` : '';
});
/** Đầu tuần chưa ai có điểm → mời chơi thay vì bảng trống. */
const tuanTrong = computed(() => !!tuan.value?.nay && !bang.value?.top.length);
/*
 * MỞ LÀ KÉO TỚI DÒNG MÌNH (20.11.2026, mockup duyệt https://claude.ai/artifact/4GKeTS7QbeoLB2XV3phdne): dòng mình nằm
 * trong danh sách mà khuất dưới thì cuộn cho nó ra GIỮA vùng cuộn + loé một nhịp. Đang thấy sẵn thì thôi (không giật).
 * Dòng mình ngoài top (ghim ở đáy) thì đã luôn thấy — không cuộn.
 */
const vungCuon = ref<HTMLElement | null>(null);
async function keoToiMinh(): Promise<void> {
  await nextTick();
  const v = vungCuon.value, d = v?.querySelector<HTMLElement>('.bxh li.toi');
  if (!v || !d) return;
  const tren = d.offsetTop - v.offsetTop, duoi = tren + d.offsetHeight;
  if (tren >= v.scrollTop && duoi <= v.scrollTop + v.clientHeight) return;
  v.scrollTo({ top: Math.max(0, tren - v.clientHeight / 2 + d.offsetHeight / 2), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  d.classList.remove('nhay'); void d.offsetWidth; d.classList.add('nhay');
}
onMounted(() => { closeBtn.value?.focus(); void tai(); });

/** Hạt vàng bốc lên từ bục: cố định (không random mỗi lần vẽ), dày ở giữa chỗ hạng 1. */
const HAT = Array.from({ length: 22 }, (_, k) => {
  const r = (n: number): number => { const x = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const sao = k % 4 === 0;
  const c = sao ? 9 + r(1) * 6 : 3 + r(1) * 4;
  const trai = 50 + (r(2) - 0.5) * (k % 3 ? 60 : 96);
  return {
    sao,
    st: `left:${trai.toFixed(1)}%;width:${c.toFixed(1)}px;height:${c.toFixed(1)}px;--c:${c.toFixed(1)}px;--x:${((r(3) - 0.5) * 30).toFixed(0)}px;animation-duration:${(2.4 + r(4) * 2.2).toFixed(2)}s;animation-delay:-${(r(5) * 4).toFixed(2)}s`
  };
});

const ten = (d: DongBxh): string => d.name || (d.khach ? t('bxh.khach', { so: d.khach }) : '?');

/*
 * ONLINE + THÁCH ĐẤU (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1): chấm xanh nhỏ
 * trên mặt thú = đang mở app; chấm cam + "Đang chơi" cạnh tên = đang ở phòng/ván online. Nút "Thách" chỉ ở người rảnh
 * (server gửi `ol.sid`), không ở dòng mình, và ẩn khi chính mình đang ở phòng online (mời ngay trong phòng). Thách
 * rồi thì nút thành vạch chờ (cùng khoảng như nút Mời — nhớ theo tên vì `sid` đổi mỗi lần nối lại).
 */
const nhip = ref(0);
const thachDuoc = (d: DongBxh): boolean => !!d.ol?.sid && !d.toi && !trongPhongOnline.value;
const choThach = (d: DongBxh): number => { void nhip.value; const h = daThach.value[ten(d)] ?? 0; return h > Date.now() ? h : 0; };
function thach(d: DongBxh): void {
  if (!d.ol?.sid) return;
  emit('thach', { sid: d.ol.sid, ten: ten(d), mat: d.mat ?? '🙂' });
}
/** Số người đang online trong các dòng đang hiện (trừ mình). */
/**
 * LỌC NGƯỜI ONLINE (22.11.2026, chủ dự án: "báo 1 người online mà không filter được… filter đi để mời thách đấu cho dễ").
 * Dòng "N người đang online" là NÚT bật/tắt: bật thì chỉ còn những người đang online (cả top 3 trên bục lẫn 3 người
 * chót), mỗi dòng giữ hạng thật + nút Thách. Đổi tab / đổi tuần / hết người online thì tự tắt.
 */
const chiOnline = ref(false);
/** 23.11.2026: danh sách người online lấy THẲNG từ server (`bxhOnline`) — cả người ngoài top 20; nút lọc luôn hiện. */
const dsOl = ref<DongHang[]>([]);
// TÍNH CẢ MÌNH (23.11.2026, chủ dự án: "bảng xếp hạng đang bỏ tôi, cho thêm vào đi") — đang mở bảng thì mình đang online,
// kể cả khi app không nối sảnh (tắt nhận lời mời nên server không gắn `ol`). Dòng của mình có nhãn "Bạn", không nút Thách.
const dsOnline = computed(() => dsOl.value.filter((d) => d.ol || d.toi).map((d) => ({ d, hang: d.hang })));
// Hết người online (họ thoát app) thì bỏ lọc — không để bảng trống mà nút lọc đã biến mất
watch(() => dsOnline.value.length, (n) => { if (!n) chiOnline.value = false; });
const soOnline = computed(() => dsOnline.value.length);

/*
 * TẢI THÊM KHI CUỘN (23.11.2026, chủ dự án: "bảng xếp hạng có thể lazyload để load thêm những người đang ẩn"). Giữa top
 * và 3 người chót là một vùng xương xám; IntersectionObserver thấy nó là xin 20 dòng kế (`trangBxh`), nối dần tới khi
 * giáp 3 người chót thì vùng đó biến mất. KHÔNG có nút bấm. Đổi tab / tuần / tải lại là xoá các trang đã nối.
 */
const them = ref<DongHang[]>([]);
const hetThem = ref(false);
let dangThem = false;
const dongGiua = computed(() => [
  ...(bang.value?.top ?? []).slice(3).map((d, i) => ({ d, hang: i + 4 })),
  ...them.value.map((d) => ({ d, hang: d.hang }))
]);
const hangCuoiDaCo = computed(() => (bang.value?.top.length ?? 0) + them.value.length);
/** Còn khoảng trống giữa dòng cuối đã có và 3 người chót. */
const conKhoang = computed(() => { const c = bang.value?.cuoi?.[0]; return !!c && c.hang > hangCuoiDaCo.value + 1; });
const conGiua = computed(() => conKhoang.value && !hetThem.value);
async function taiThem(): Promise<void> {
  if (dangThem || !conGiua.value || !bang.value) return;
  dangThem = true;
  const l = loai.value, w = tuanXem.value, so = luot, mocCuoi = bang.value.cuoi?.[0]?.hang ?? Infinity;
  try {
    const r = await trangBxh(l, w, hangCuoiDaCo.value);
    if (so !== luot) return;
    const moi = r.ds.filter((d) => d.hang > hangCuoiDaCo.value && d.hang < mocCuoi);
    them.value = [...them.value, ...moi];
    if (r.het || !moi.length) hetThem.value = true;
  } catch { hetThem.value = true; } finally {
    dangThem = false;
    // Trang vừa nối chưa đẩy vùng xương ra khỏi khung nhìn → xin tiếp
    await nextTick();
    if (so === luot && mocEl.value && conGiua.value) quanSat();
  }
}
const mocEl = ref<HTMLElement | null>(null);
let io: IntersectionObserver | null = null;
function quanSat(): void {
  io?.disconnect(); io = null;
  if (!mocEl.value || typeof IntersectionObserver === 'undefined') return;
  io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) void taiThem(); }, { root: vungCuon.value, rootMargin: '120px 0px' });
  io.observe(mocEl.value);
}
watch(mocEl, quanSat, { flush: 'post' });
onBeforeUnmount(() => io?.disconnect());
const toi = computed(() => bang.value?.toi ?? null);
/** Ngoài top + 3 người chót đang hiện → ghim dòng mình ở đáy (chủ dự án: "luôn phải hiện vị trí người chơi hiện tại"). */
const ghim = computed(() => !!toi.value && !(bang.value?.top ?? []).some((d) => d.toi) && !(bang.value?.cuoi ?? []).some((d) => d.toi)
  && !them.value.some((d) => d.toi));   // đã tải tới đúng dòng mình thì thôi ghim (không hiện hai lần)

/** Mở sẵn ô đặt tên khi khách chưa có tên và đã có dòng trên bảng. */
const moTen = computed(() => laKhach.value && !khachAn.value && !!toi.value && (dangSuaTen.value || !tenMay.value));

async function luuTen(): Promise<void> {
  const tt = tenNhap.value.trim();
  if (!tt) return;
  dangLuu.value = true;
  try { await datTenKhach(tt); tenMay.value = tt; dangSuaTen.value = false; await tai(); } finally { dangLuu.value = false; }
}

async function doiAn(an: boolean): Promise<void> {
  try { await anKhach(an); khachAn.value = an; await tai(); } catch { loi.value = true; }
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('tk.xepHang')" @keydown.esc="emit('close')">
    <div ref="gocEl" class="panel">
      <header class="head">
        <h2>{{ t('tk.xepHang') }}</h2>
        <!-- LỌC NGƯỜI ONLINE — chip gọn trên hàng tiêu đề (23.11.2026, chủ dự án: "giao diện này rối quá… đơn giản hơn"):
             chấm xanh + SỐ người online, bấm để chỉ xem họ. Trước là một nút dài nằm giữa bảng và dòng của mình. -->
        <button v-if="bang && !tuanTrong" class="loc thach th-nho" :class="{ bat: chiOnline, vang: !soOnline }" type="button"
          :aria-pressed="chiOnline" :disabled="!soOnline" :aria-label="soOnline ? t('bxh.dangOnline', { n: soOnline }) : t('bxh.khongAiOnline')"
          @click="sfx.select(); chiOnline = !chiOnline">
          <i aria-hidden="true" />{{ soOnline }}<Check v-if="chiOnline" :size="14" :stroke-width="3" aria-hidden="true" /><ListFilter v-else :size="14" :stroke-width="2.6" aria-hidden="true" />
        </button>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <!-- GỌN (19.11.2026, mockup duyệt https://claude.ai/artifact/4SQdKfUtpcCdbsGvRZK7sH — chủ dự án: "nhiều chữ giải
           thích quá"): bỏ thẻ vàng "Hạng của bạn trong N người…", bỏ cột "x/y thắng" (còn ở nhãn ẩn), bỏ dòng dưới mình,
           bỏ câu mời đăng nhập + câu dặn tên. Dòng mình tô vàng là đủ biết mình ở đâu. -->
      <div class="tabs" role="tablist">
        <button class="tab thach th-nho th-chon" role="tab" type="button" :aria-selected="loai === 'tuan'" @click="doiLoai('tuan')">{{ t('bxh.tabTuan') }}</button>
        <button class="tab thach th-nho th-chon" role="tab" type="button" :aria-selected="loai === 'tat'" @click="doiLoai('tat')">{{ t('bxh.tabMoiLuc') }}</button>
      </div>
      <!-- Luôn giữ chỗ khi ở tab Tuần (chưa có dữ liệu thì ghi "Tuần này") — hàng hiện muộn là nội dung giật xuống -->
      <div v-if="loai === 'tuan'" class="tuan">
        <button class="thach th-nho" type="button" :aria-label="t('bxh.tuanTruoc')" :disabled="!tuan?.coTruoc || dangTai" @click="doiTuan(-1)">‹</button>
        <!-- MỘT DÒNG (20.11.2026, chủ dự án: "viết cùng 1 dòng cho đỡ tốn diện tích"): "Tuần này · còn 2 ngày" -->
        <div class="giua"><b>{{ tenTuan || t('bxh.tuanNay') }}</b><small v-if="phuTuan" :class="{ dem: !tuan || tuan.nay }"> · {{ phuTuan }}</small></div>
        <button class="thach th-nho" type="button" :aria-label="t('bxh.tuanSau')" :disabled="!tuan || tuan.nay || dangTai" @click="doiTuan(1)">›</button>
      </div>

      <!-- BỤC TOP 3 GỌN, ĐỨNG YÊN (20.11.2026 tối, mockup duyệt https://claude.ai/artifact/4GKeTS7QbeoLB2XV3phdne — bỏ vương miện,
           nhỏ ~1/3, NẰM NGOÀI vùng cuộn nên cuộn chỉ kéo hạng 4 trở đi). Thứ tự 2·1·3; thiếu người thì ô trống giữ chỗ. -->
      <div v-if="bang && !tuanTrong && bang.top.length && !chiOnline" class="buc" :class="{ mo: dangTai }">
      <div class="bui" aria-hidden="true"><i v-for="(h, k) in HAT" :key="k" :class="{ sao: h.sao }" :style="h.st" /></div>
      <div v-for="i in [1, 0, 2]" :key="i" class="bn" :class="`n${i + 1}`" :data-k="bang.top[i] ? khoa(bang.top[i]!) : undefined">
        <template v-if="bang.top[i]">
          <span class="av" :class="{ 'vong-mau': !!bang.top[i].mau }" :style="bang.top[i].mau ? { '--m': bang.top[i].mau } : undefined"><MatBot :mat="bang.top[i].mat ?? '🙂'" /><i v-if="bang.top[i].ol && !bang.top[i].toi" class="dot" :class="{ ban: bang.top[i].ol!.ban }" /><span v-if="bang.top[i].ol && !bang.top[i].toi" class="sr-only">{{ bang.top[i].ol!.ban ? t('bxh.dangChoi') : t('bxh.online') }}</span></span>
          <span class="tn">{{ ten(bang.top[i]) }}</span>
          <i v-if="bang.top[i].toi" class="nhan-ban">{{ t('bxh.ban') }}</i>
          <span class="so">{{ num(bang.top[i].totalScore) }}</span>
          <template v-if="thachDuoc(bang.top[i])">
            <VachCho v-if="choThach(bang.top[i])" nho :het="choThach(bang.top[i])" :tong="CACH_MOI_LAI_MS" @xong="nhip++" />
            <button v-else class="td thach th-nho th-tim" type="button" :aria-label="t('bxh.thachAria', { ten: ten(bang.top[i]) })" @click="thach(bang.top[i])"><Swords :size="11" :stroke-width="2.6" aria-hidden="true" />{{ t('bxh.thach') }}</button>
          </template>
        </template>
        <div class="bac" aria-hidden="true">{{ i + 1 }}</div>
      </div>
          </div>
      <div ref="vungCuon" class="body">
        <div v-if="bang && tuanTrong" class="trong">
          <span class="to" aria-hidden="true"><Flag :size="40" :stroke-width="2.2" /></span>
          <b>{{ t('bxh.tuanMoi') }}</b>
          <p>{{ t('bxh.tuanMoiMo') }}</p>
          <button class="choi thach th-vang" type="button" @click="emit('close')">{{ t('bxh.choiNgay') }}</button>
        </div>
        <!-- Đang lọc: chỉ người online, hạng thật, nút Thách như mọi dòng -->
        <ol v-else-if="bang && chiOnline" class="bxh" :class="{ mo: dangTai }" :aria-busy="dangTai">
          <li v-for="x in dsOnline" :key="`o${x.hang}`" :class="{ toi: x.d.toi }">
            <span class="hang">{{ num(x.hang) }}</span>
            <span class="mat" :class="{ 'vong-mau': !!x.d.mau }" :style="x.d.mau ? { '--m': x.d.mau } : undefined"><MatBot :mat="x.d.mat ?? '🙂'" /><i v-if="!x.d.toi" class="dot" :class="{ ban: x.d.ol?.ban }" /></span>
            <span class="ten"><span class="tt">{{ ten(x.d) }}</span><i v-if="x.d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i><small v-else-if="x.d.ol?.ban" class="dang-choi">{{ t('bxh.dangChoi') }}</small></span>
            <template v-if="thachDuoc(x.d)">
              <VachCho v-if="choThach(x.d)" nho :het="choThach(x.d)" :tong="CACH_MOI_LAI_MS" @xong="nhip++" />
              <button v-else class="td thach th-nho th-tim" type="button" :aria-label="t('bxh.thachAria', { ten: ten(x.d) })" @click="thach(x.d)"><Swords :size="13" :stroke-width="2.6" aria-hidden="true" />{{ t('bxh.thach') }}</button>
            </template>
            <span class="so">{{ num(x.d.totalScore) }}</span>
          </li>
        </ol>
        <template v-else-if="bang">
          <ol class="bxh" :class="{ mo: dangTai }" :aria-busy="dangTai" :start="4">
            <li v-for="{ d, hang } in dongGiua" :key="hang" :class="{ toi: d.toi }" :data-k="khoa(d)">
              <span class="hang">{{ num(hang) }}</span>
              <span class="mat" :class="{ 'vong-mau': !!d.mau }" :style="d.mau ? { '--m': d.mau } : undefined"><MatBot :mat="d.mat ?? '🙂'" /><i v-if="d.ol && !d.toi" class="dot" :class="{ ban: d.ol.ban }" /></span>
              <span class="ten"><span class="tt">{{ ten(d) }}</span><i v-if="d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i><small v-if="d.ol?.ban && !d.toi" class="dang-choi">{{ t('bxh.dangChoi') }}</small><span v-else-if="d.ol && !d.toi" class="sr-only">{{ t('bxh.online') }}</span></span>
              <span v-if="d.matches >= d.wins && d.matches" class="sr-only">{{ t('tk.thangTren', { thang: d.wins, van: d.matches }) }}</span>
              <template v-if="thachDuoc(d)">
                <VachCho v-if="choThach(d)" nho :het="choThach(d)" :tong="CACH_MOI_LAI_MS" @xong="nhip++" />
                <button v-else class="td thach th-nho th-tim" type="button" :aria-label="t('bxh.thachAria', { ten: ten(d) })" @click="thach(d)"><Swords :size="13" :stroke-width="2.6" aria-hidden="true" />{{ t('bxh.thach') }}</button>
              </template>
              <span class="so">{{ num(d.totalScore) }}</span>
            </li>
            <!-- 3 NGƯỜI CHÓT kèm số thứ tự (20.11.2026, chủ dự án: "cho người khác hiểu bao nhiêu người là đủ") -->
            <template v-if="bang.cuoi?.length">
              <!-- Vùng TỰ TẢI THÊM: xương xám như lúc mở bảng lần đầu; cuộn tới là nối 20 dòng kế, giáp 3 người chót thì biến mất -->
              <li v-if="conGiua" ref="mocEl" class="cho-them xuong" aria-hidden="true">
                <div v-for="i in 3" :key="i" class="xd"><i class="o mat-o" /><i class="o ten-o" :style="{ width: `${40 + (i * 19) % 30}%` }" /><i class="o so-o" /></div>
              </li>
              <li v-else-if="conKhoang" class="cham" aria-hidden="true">···</li>
              <li v-for="d in bang.cuoi" :key="`c${d.hang}`" :class="{ toi: d.toi }">
                <span class="hang">{{ num(d.hang) }}</span>
                <span class="mat" :class="{ 'vong-mau': !!d.mau }" :style="d.mau ? { '--m': d.mau } : undefined"><MatBot :mat="d.mat ?? '🙂'" /><i v-if="d.ol && !d.toi" class="dot" :class="{ ban: d.ol.ban }" /></span>
                <span class="ten"><span class="tt">{{ ten(d) }}</span><i v-if="d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i><small v-if="d.ol?.ban && !d.toi" class="dang-choi">{{ t('bxh.dangChoi') }}</small></span>
                <template v-if="thachDuoc(d)">
                  <VachCho v-if="choThach(d)" nho :het="choThach(d)" :tong="CACH_MOI_LAI_MS" @xong="nhip++" />
                  <button v-else class="td thach th-nho th-tim" type="button" :aria-label="t('bxh.thachAria', { ten: ten(d) })" @click="thach(d)"><Swords :size="13" :stroke-width="2.6" aria-hidden="true" />{{ t('bxh.thach') }}</button>
                </template>
                <span class="so">{{ num(d.totalScore) }}</span>
              </li>
            </template>
          </ol>
          <p v-if="!bang.top.length" class="muted">{{ t('tk.chuaAiMoi') }}</p>
        </template>
        <p v-else-if="loi" class="loi">{{ t('tk.loiBxh') }} <button class="btn-link" type="button" @click="tai">{{ t('bxh.thuLai') }}</button></p>
        <!-- Lần đầu (chưa có bảng cũ): dòng xám đúng dáng bảng thay chữ "Đang tải…" — khung không giật cao -->
        <ol v-else class="bxh xuong" :aria-label="t('tk.dangTai')" aria-busy="true">
          <li v-for="i in 6" :key="i"><span class="hang">{{ i }}</span><i class="o mat-o" /><i class="o ten-o" :style="{ width: `${42 + (i * 17) % 30}%` }" /><i class="o so-o" /></li>
        </ol>
      </div>

      <div v-if="toi && ghim && !tuanTrong && !chiOnline" class="ghim" :class="{ mo: dangTai }">
        <div class="toi-dong"><span class="hang">{{ toi.hang ? num(toi.hang) : '–' }}</span><span class="mat" :class="{ 'vong-mau': !!toi.mau }" :style="toi.mau ? { '--m': toi.mau } : undefined"><MatBot :mat="toi.mat ?? '🙂'" /></span><span class="ten">{{ ten(toi) }}<i class="nhan-ban">{{ t('bxh.ban') }}</i></span><span class="so">{{ num(toi.totalScore) }}</span></div>
      </div>

      <!-- Khách: tên trên bảng -->
      <form v-if="moTen" class="dat-ten" @submit.prevent="luuTen">
        <div class="hang-nhap">
          <input id="ten-bxh" v-model="tenNhap" :placeholder="t('bxh.tenTren')" :aria-label="t('bxh.tenTren')" maxlength="16" autocomplete="nickname" enterkeyhint="done">
          <button class="luu thach th-xanh" type="submit" :disabled="dangLuu || !tenNhap.trim()">{{ t('bxh.luu') }}</button>
        </div>
      </form>

      <div v-if="laKhach" class="khach">
        <template v-if="khachAn">
          <p>{{ t('bxh.daAn') }}</p>
          <button class="btn-link" type="button" @click="doiAn(false)">{{ t('bxh.hienLai') }}</button>
        </template>
        <template v-else>
          <button class="nut-dn thach th-vang" type="button" @click="emit('dang-nhap')">{{ t('bxh.dangNhap') }}</button>
          <div class="phu">
            <button v-if="toi && tenMay && !dangSuaTen" class="btn-link" type="button" @click="dangSuaTen = true; tenNhap = tenMay">{{ t('bxh.doiTen') }}</button>
            <button v-if="toi" class="btn-link mo" type="button" @click="doiAn(true)">{{ t('bxh.an') }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.panel {
  /* CAO CỐ ĐỊNH (20.11.2026, chủ dự án: "bấm tuần / mọi lúc độ cao bị thay đổi, nhảy nhảy") — đổi tab/tuần chỉ đổi nội dung cuộn bên trong */
  width: 100%; max-width: var(--col-w); height: 100%; max-height: 780px;
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.body { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; padding: 2px 4px 6px; margin: 0 -4px; }
.muted { color: var(--muted); font-size: var(--text-sm); margin: 6px 0 0; }
.loi { color: var(--bad); font-size: var(--text-sm); margin: 8px 0 0; }

.bxh { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.bxh li, .toi-dong {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent);
}
/* DÒNG CỦA MÌNH theo biến — màn tối có bộ màu riêng (21.11.2026, chủ dự án: "tên của mình cũng sáng quá";
   mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 2): vàng nâu sẫm, viền mảnh, tên màu kem */
.panel { --toi-nen: #ffe7b3; --toi-vien: #f0c64a; --toi-day: 2px; --toi-chu: #3d2f08; --toi-phu: #5b4510; --toi-so: #8a5a00; --ban-nen: #c2621a; --ban-chu: #fff; }
:global([data-theme='dark'] .panel) { --toi-nen: #2e2817; --toi-vien: #8f7124; --toi-day: 1.5px; --toi-chu: #f0dfae; --toi-phu: #c9b27a; --toi-so: #ffcf4d; --ban-nen: #6b5214; --ban-chu: #ffe39a; }
.bxh li.toi, .toi-dong { background: var(--toi-nen); color: var(--toi-chu); box-shadow: inset 0 0 0 var(--toi-day) var(--toi-vien); }
.bxh li.toi small { color: var(--toi-phu); }
.hang { min-width: 30px; flex: none; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.bxh li.toi .hang, .toi-dong .hang { color: var(--toi-phu); }
.mat { font-size: 19px; line-height: 1; flex: 0 0 auto; }
.ten { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bxh small { color: var(--muted); font-size: 12px; white-space: nowrap; }
/* Số điểm: Baloo 2 + chữ số đều bề ngang, cột cố định canh phải — 980 và 12.450 thẳng mép */
.so { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; text-align: right; white-space: nowrap; color: var(--diem); }
/* ĐIỂM VÀNG, TÊN MÀU CHỮ (20.11.2026, chủ dự án: "màu điểm và màu tên khác nhau") — bỏ viên xu từng dòng cho gọn */
.panel { --diem: #b97800; --ol: #22a55a; --ol-ban: #e08a12; }
:global([data-theme='dark'] .panel) { --ol: #3ccf75; --ol-ban: #f2a23a; }
/*
 * CHỮ GỌN (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1 — chủ dự án: "chữ bé hơn,
 * giống chữ trên top 3"): tên 12,5px đậm như tên trên bục, điểm 14px, dòng 34px — một màn thấy thêm ~3 người.
 */
.bxh li, .toi-dong { gap: 7px; padding: 4px 6px; min-height: 34px; box-sizing: border-box; border-radius: 9px; }
.bxh .hang, .toi-dong .hang { min-width: 22px; font-size: 12px; }
.bxh .mat, .toi-dong .mat { font-size: 17px; }
.bxh .ten, .toi-dong .ten { font-size: 12.5px; font-weight: 800; }
.ten { display: flex; align-items: center; }
.ten .tt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ten .nhan-ban, .ten .dang-choi { flex: none; }
/* "Đang chơi" ngay BÊN PHẢI tên (chủ dự án duyệt mockup) — tên dài thì tên bị cắt, chữ này giữ nguyên */
.ten .dang-choi { margin-left: 6px; font-size: 10.5px; font-weight: 700; color: var(--ol-ban); white-space: nowrap; }
/* Chấm online NHỎ (6px — chủ dự án: "biểu tượng online nên nhỏ hơn") ở góc dưới phải mặt thú */
.mat, .bn .av { position: relative; }
.dot { position: absolute; right: -1px; bottom: 1px; width: 6px; height: 6px; border-radius: 50%; background: var(--ol); box-shadow: 0 0 0 1.5px var(--panel-solid); }
.dot.ban { background: var(--ol-ban); }
.bn .dot { width: 7px; height: 7px; right: -2px; }
/* Nút Thách: viên thạch tím nhỏ (cùng màu lời mời) */
.td { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 26px; height: 26px; padding: 0 9px 0 7px; border-radius: 999px; font: 800 11.5px var(--font-body); white-space: nowrap; position: relative; }
.td::after { content: ''; position: absolute; inset: -6px -2px; }
.bn .td, .bn .vach-cho { margin-top: 3px; height: 22px; min-height: 22px; padding: 0 7px 0 5px; font-size: 10.5px; }
/* Nút lọc người online: thạch nhỏ, canh trái; bật thì nền xanh (qua biến thạch — ghi background thẳng bị luật thạch đè) */
.loc { flex: none; display: inline-flex; align-items: center; gap: 6px; margin: 0; min-height: 36px; padding: 0 11px 2px; border-radius: 999px; font: 800 12.5px var(--font-body); color: var(--fg); }
.loc.bat { --b1: #5fd27f; --b2: #2f9e57; --b3: #227a41; --bc: #fff; color: #fff; }
.loc.bat i { background: #fff; }
.loc.vang { color: var(--muted); } .loc.vang i { background: var(--muted); opacity: .6; }
.loc:disabled { opacity: 1; cursor: default; }
.bxh li.cho-them { display: grid; gap: 6px; background: none; padding: 0; box-shadow: none; }
.cho-them .xd { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px 0 34px; box-sizing: border-box; }
.loc i { width: 6px; height: 6px; border-radius: 50%; background: var(--ol); }
/* :global(x) y trong CSS scoped bỏ mất ' y' — gói CẢ selector vào :global (chỉ đặt biến --diem, vô hại với .panel khác) */
:global([data-theme='dark'] .panel) { --diem: #ffcf4d; }
.bxh li.toi .so, .toi-dong .so { color: var(--toi-so); }
.bxh .so, .ghim .so { min-width: 5ch; font-size: 14px; }
.bxh li.toi.nhay { animation: toi-nhay 1.4s ease-out 1; }
@keyframes toi-nhay { 0% { box-shadow: inset 0 0 0 var(--toi-day) var(--toi-vien), 0 0 0 0 rgba(240, 198, 74, .85); } 100% { box-shadow: inset 0 0 0 var(--toi-day) var(--toi-vien), 0 0 0 12px rgba(240, 198, 74, 0); } }
@media (prefers-reduced-motion: reduce) { .bxh li.toi.nhay { animation: none; } }
.ke .so { font-size: 13px; }
.xu {
  display: inline-block; width: 13px; height: 13px; border-radius: 50%; margin-left: 4px; vertical-align: -1px;
  background: radial-gradient(circle at 35% 30%, #ffe58a, #f2b400 60%, #c98a00); box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .2);
}

/* Bục */
.buc { position: relative; isolation: isolate; flex: none; display: grid; grid-template-columns: 1fr 1.12fr 1fr; align-items: end; gap: 6px; margin: 2px 0 0; padding-bottom: 8px; border-bottom: 2px solid var(--line); }
.bn { display: grid; justify-items: center; gap: 2px; text-align: center; min-width: 0; }
.bn .av { position: relative; display: grid; place-items: center; font-size: 26px; line-height: 1.1; }
.bn.n1 .av { font-size: 31px; }
/* Ô màu (1,7em) thò ra ngoài khung mặt ~.3em mỗi phía → đè lên tên bên dưới (chủ dự án gửi ảnh 25.11.2026): chừa lề đúng phần thò + khoảng thở. */
.bn .av.vong-mau { margin: .32em 0 .5em; }
.bn .tn { font-weight: 800; font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bn .nhan-ban { margin: 0; }
.bn .so { font-size: 14px; }
.bn.n1 .so { font-size: 16px; }
.bn .bac { width: 100%; margin-top: 2px; border-radius: 8px 8px 3px 3px; display: grid; place-items: center; font: 800 13px var(--font-display); color: #fff; }
.n1 .bac { height: 26px; background: linear-gradient(#ffd34d, #f2b400); }
.n2 .bac { height: 20px; background: linear-gradient(#c5cee2, #9aa6c4); }
.n3 .bac { height: 16px; background: linear-gradient(#e2a06a, #c27a3e); }
/* Hạt vàng bốc lên + quầng sáng thở sau hạng 1 */
.bui { position: absolute; inset: -10px 0 0; overflow: hidden; pointer-events: none; z-index: -1; border-radius: 14px; }
.bui::before {
  content: ""; position: absolute; left: 50%; bottom: 10px; width: 110px; height: 110px; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 206, 64, .45), rgba(255, 206, 64, 0) 68%); animation: tho 2.6s ease-in-out infinite alternate;
}
.bui i { position: absolute; bottom: -8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff6c8, #ffd23f 55%, rgba(242, 180, 0, 0) 72%); opacity: 0; animation: bay linear infinite; }
.bui i.sao { border-radius: 0; background: none; color: #ffcf33; font-size: var(--c); line-height: 1; text-shadow: 0 0 6px rgba(255, 200, 40, .8); }
.bui i.sao::before { content: "✦"; }
@keyframes bay { 0% { transform: translate(0, 0) scale(.6); opacity: 0; } 12% { opacity: 1; } 70% { opacity: .85; } 100% { transform: translate(var(--x), -90px) scale(1); opacity: 0; } }
@keyframes tho { from { opacity: .55; transform: translateX(-50%) scale(.92); } to { opacity: 1; transform: translateX(-50%) scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .bui i { display: none; } .bui::before { animation: none; } }
.buc { transition: opacity .2s ease; }
.nhan-ban {
  font-style: normal; font-size: 11px; font-weight: 800; color: var(--ban-chu); background: var(--ban-nen);
  border-radius: 8px; padding: 1px 6px; margin-left: 6px; vertical-align: 1px;
}

.ghim { margin-top: 8px; display: grid; gap: 4px; }
.bxh li.cham { background: none; justify-content: center; padding: 0; }

/* Tab Tuần / Mọi lúc + chọn tuần */
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.tabs .tab { min-height: 38px; font-weight: 800; font-size: var(--text-sm); }
.tuan { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.tuan button { width: 36px; height: 36px; flex: none; padding: 0; font: 800 20px var(--font-body); }
.tuan button:disabled { opacity: .3; }
.tuan .giua { flex: 1; min-width: 0; text-align: center; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tuan .giua b { font: 800 16px var(--font-display); }
.tuan .giua small { font-size: 13px; font-weight: 700; color: var(--muted); }
.tuan .giua small.dem { color: #c2621a; }
.trong { text-align: center; padding: 22px 8px 14px; display: grid; gap: 6px; justify-items: center; }
.trong .to { font-size: 44px; line-height: 1; }
.trong b { font: 800 18px var(--font-display); }
.trong p { margin: 0; color: var(--muted); font-size: var(--text-sm); line-height: 1.45; max-width: 30ch; }
.trong .choi { min-height: 44px; padding: 0 22px; font-weight: 800; margin-top: 6px; }
/* Bảng lần trước đang chờ số mới: HIỆN BÌNH THƯỜNG (23.11.2026, chủ dự án: "cứ hiện bình thường đi" — bản cũ làm mờ 45%);
   số mới về mà thứ hạng đổi thì dòng TRƯỢT về chỗ mới (script `truotDong`). */
.xuong li { min-height: 36px; box-sizing: border-box; }
.xuong .o { display: block; height: 14px; border-radius: 7px; background: color-mix(in srgb, var(--fg) 12%, transparent); animation: nhap 1.1s ease-in-out infinite alternate; }
.xuong .mat-o { width: 22px; height: 22px; border-radius: 50%; flex: none; }
.xuong .so-o { width: 58px; margin-left: auto; flex: none; }
@keyframes nhap { to { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .xuong .o { animation: none; } }
.cham { text-align: center; color: var(--muted); font-weight: 800; letter-spacing: 4px; line-height: 1; }
.ke { display: flex; align-items: center; gap: 8px; padding: 0 8px; font-size: var(--text-sm); color: var(--muted); }
.ke .ten { font-weight: 600; }

.dat-ten { margin-top: 10px; display: grid; gap: 6px; }
.hang-nhap { display: flex; gap: 8px; }
.hang-nhap input {
  flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 12px;
  border-radius: 10px; border: 2px solid #e2b13a; font: inherit; font-weight: 700; font-size: 16px;
  background: var(--panel-solid); color: var(--fg);
}
.luu { min-height: 44px; padding: 0 16px; font-weight: 800; }
.dat-ten p, .khach p { margin: 0; font-size: var(--text-sm); color: var(--muted); line-height: 1.45; }

.khach { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); display: grid; gap: 8px; text-align: center; }
.nut-dn { min-height: 44px; font-weight: 800; }
.phu { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.btn-link {
  border: 0; background: none; color: var(--accent); padding: 0;
  font: inherit; font-weight: 700; text-decoration: underline; min-height: 44px; cursor: pointer;
}
.btn-link.mo { color: var(--muted); }
</style>
