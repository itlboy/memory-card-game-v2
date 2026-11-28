<script setup lang="ts">
/**
 * TÌM THẺ ONLINE — MÀN CHƠI (27.11.2026, mockup duyệt https://claude.ai/artifact/5rwkt1SVgamVqoED4nEWz6 màn ③–⑥).
 * Server dẫn nhịp (`PhongTimThe`, gửi `t:'tim'` mỗi lần đổi pha / có người chọn); màn này CHỈ VẼ và gửi lựa chọn.
 *
 * Giữ đúng các nguyên tắc của Tìm Thẻ chơi đơn (CLAUDE.md mục TÌM THẺ): màn chơi chỉ có bàn thẻ (+ hàng người chơi — cần để
 * biết ai đã chọn), KHÔNG bảng thông báo, KHÔNG thanh giờ, KHÔNG số giây nhảy; thẻ cần tìm hiện to giữa bàn trên lớp mờ;
 * chọn đúng thì số giây nằm trên lá, "+điểm" bay về ô Điểm. Đang chọn chỉ lộ AI đã chọn; tới đáp án mới hiện mặt người
 * dưới lá họ chọn.
 *
 * Giờ chọn đo TẠI MÁY NÀY (từ lúc nhận câu hỏi, trừ phần server đã trôi trước khi gửi) — đường truyền không ăn vào điểm;
 * server kẹp lại (`PhongTimThe.chon`).
 */
import { TIM_THE_ONLINE_SO_THE, TIM_THE_SO_LUOT, type TimView } from '@mm/engine';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMeoTimThe } from '@/lib/meo-tim-the';
import { Check, Ellipsis, TimerOff, X, Zap } from 'lucide-vue-next';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';
import { chonCoAnh, taiTruocAnh } from '@/lib/emoji';
import { sfx } from '@/lib/audio';
import { rung } from '@/lib/rung';
import { bcp, t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { taiKhoan } from '@/lib/taikhoan';
import { tenNguoi } from '@/lib/ten';
import { ghiVuaThang } from '@/lib/xin-danh-gia';
import { earnedTim, moKhoa, thongKeHienTai } from '@/lib/achievements';
import { moChucNang, suKien } from '@/lib/phan-tich';
import { dangTimOnline, tomTatTimThe } from '@/lib/tim-the';
import BanVongTim from './BanVongTim.vue';
import DemNguocPhu from './DemNguocPhu.vue';
import KhungOnline from './KhungOnline.vue';
import DaiNguoiChoi, { type NguoiDai } from './DaiNguoiChoi.vue';
import HudBar from './HudBar.vue';
import ChipXem from './ChipXem.vue';
import DongXu from './DongXu.vue';
import KetCucFx from './KetCucFx.vue';
import ResultDialog from './ResultDialog.vue';
import { HIEN_BANG_MS, chonCanh, type LoaiKetCuc } from '@/lib/ketcuc-fx';
import MatNguoi from './MatNguoi.vue';

const props = defineProps<{ o: ReturnType<typeof useOnlineRoom> }>();
const emit = defineEmits<{ quit: []; chinh: [] }>();
const o = props.o;

const v = computed<TimView | null>(() => o.tim.value);
const pha = computed(() => v.value?.pha ?? 'xem');
const toiId = computed(() => o.myId.value);
const xem = computed(() => o.spectator.value);

/* ---------- người chơi: dữ liệu ván + mặt/màu từ phòng ---------- */
const nguoiPhong = (id: string) => o.room.value?.players.find((p) => p.id === id);
const ICON = { da: Ellipsis, dung: Check, nhanh: Zap, sai: X, het: TimerOff } as const;
/**
 * ĐẾM NGƯỢC chưa có `tim` (server chỉ gửi khi vào ván): vẫn bày hàng người chơi + bàn ÚP đúng cỡ, không để màn trống trơn
 * như lỗi (chủ dự án 27.11.2026).
 */
const nguoiVan = computed(() => v.value?.nguoi ?? (o.room.value?.players ?? []).map((p) => ({
  id: p.id, ten: p.name, diem: 0, da: false, dung: 0, chuoiDai: 0, ...(p.may ? { may: p.may } : {})
} as TimView['nguoi'][number])));
/*
 * HIỆU ỨNG CHO CẢ NGƯỜI CHƠI LẪN NGƯỜI XEM (27.11.2026, chủ dự án: người xem "thấy rất buồn… không có âm thanh khi người khác
 * chọn, khi điểm được chốt ở mỗi vòng"):
 *   - người khác chọn thẻ → "tinh" + khung người đó nảy, viền sáng;
 *   - đáp án → tiếng lật + thẻ đúng toả sáng; rồi CHỐT TỪNG NGƯỜI một (đúng trước, nhanh trước): tiếng cao dần, khung loé xanh,
 *     số điểm chạy lên; sai thì "bụp" + khung lắc.
 */
const vuaChon = ref<Record<string, number>>({});
const daLo = ref<Set<string>>(new Set());
const diemChay = ref<Record<string, number>>({});
const loLan = ref<Record<string, 'dung' | 'sai'>>({});
let daBaoChon = new Set<string>();
let henLo: ReturnType<typeof setTimeout>[] = [];
function chayDiem(id: string, tu: number, den: number): void {
  const t0 = performance.now(), dai = 550;
  const buoc = (): void => {
    const k = Math.min(1, (performance.now() - t0) / dai);
    diemChay.value = { ...diemChay.value, [id]: Math.round(tu + (den - tu) * (1 - (1 - k) ** 3)) };
    if (k < 1) requestAnimationFrame(buoc);
  };
  requestAnimationFrame(buoc);
}
function loTungNguoi(moi: TimView): void {
  henLo.forEach(clearTimeout); henLo = [];
  daLo.value = new Set(); loLan.value = {};
  const thu = [...moi.nguoi].sort((a, b) => {
    const da = a.kq?.ketCuc === 'dung' ? 0 : 1, db = b.kq?.ketCuc === 'dung' ? 0 : 1;
    return da - db || (a.kq?.ms ?? 1e9) - (b.kq?.ms ?? 1e9);
  });
  let soDung = 0;
  thu.forEach((n, i) => {
    const dung = n.kq?.ketCuc === 'dung';
    const thuTu = dung ? soDung++ : 0;
    henLo.push(setTimeout(() => {
      daLo.value = new Set([...daLo.value, n.id]);
      loLan.value = { ...loLan.value, [n.id]: dung ? 'dung' : 'sai' };
      const truoc = n.diem - (n.kq?.diem ?? 0);
      if (dung) chayDiem(n.id, truoc, n.diem);
      // Tiếng của CHÍNH MÌNH đã phát lúc lật (match/miss) — ở đây chỉ phát cho người khác, và cho mọi người khi đang xem
      if (n.id !== toiId.value || xem.value) { if (dung) sfx.timChotDung(thuTu); else sfx.timChotSai(); }
    }, 380 + i * 240));
  });
}
const nguoi = computed(() => nguoiVan.value.map((n) => {
  const p = nguoiPhong(n.id);
  const loRa = pha.value === 'xong' || (pha.value === 'dap-an' && daLo.value.has(n.id));
  const lo = loRa;
  const tt: keyof typeof ICON | '' = lo && n.kq
    ? (n.kq.ketCuc === 'dung' ? (n.kq.nhanhNhat ? 'nhanh' : 'dung') : n.kq.ketCuc === 'sai' ? 'sai' : 'het')
    : pha.value === 'hoi' && (n.da || (n.id === toiId.value && chonCuaToi.value !== null)) ? 'da' : '';
  return {
    ...n, tt, mat: p?.avatar ?? '🙂', mau: p?.mau, anh: p?.anh,
    // Mất mạng / đã rời — CÙNG cách báo của chip ghép cặp (OnlineGame `.pchip.off` + `.netbad`). Dải báo chung chỉ hiện lúc
    // chuyện xảy ra; người VÀO XEM SAU phải nhìn được ngay ai đang mất mạng (27.11.2026, chủ dự án xem thấy người chơi "im").
    mang: o.room.value && !p ? 'roi' as const : p && p.connected === false ? 'mat' as const : '' as const,
    ten: n.id === toiId.value ? t('tt.ban') : (p ? tenNguoi(p) : n.ten), cong: pha.value === 'dap-an' && loRa ? (n.kq?.diem ?? 0) : 0,
    // Điểm hiện: đang đáp án mà chưa tới lượt chốt thì giữ điểm cũ; đã chốt thì số chạy lên
    diemHien: pha.value === 'dap-an' ? (loRa ? (diemChay.value[n.id] ?? n.diem) : n.diem - (n.kq?.diem ?? 0)) : n.diem,
    vuaChon: vuaChon.value[n.id] ?? 0, lan: pha.value === 'dap-an' ? loLan.value[n.id] : undefined,
    giay: lo && n.kq && n.kq.ms !== null ? giayChon(n.kq.ms) : ''
  };
}));
const toi = computed(() => v.value?.nguoi.find((n) => n.id === toiId.value) ?? null);
/** Người chơi ở dạng chung của hàng người chơi online (DaiNguoiChoi — dùng chung với ghép cặp, 28.11.2026). */
const nguoiDai = computed((): NguoiDai[] => nguoi.value.map((n) => ({
  id: n.id, ten: n.ten, tenGoc: nguoiPhong(n.id)?.name ?? n.ten, avatar: n.mat, anh: n.anh, mau: n.mau, hh: nguoiPhong(n.id)?.hh,
  diem: n.diemHien, connected: n.mang !== 'mat', roi: n.mang === 'roi', lives: null
})));
const theoId = computed(() => new Map(nguoi.value.map((n) => [n.id, n])));
/** Phần riêng Tìm Thẻ của một người (dấu trạng thái, +điểm, số giây) — cắm vào khe của DaiNguoiChoi. */
const phu = (id: string) => theoId.value.get(id);
const lopChip = (p: NguoiDai): Record<string, boolean> => {
  const n = theoId.value.get(p.id);
  return { 'vua-chon': !!n && n.vuaChon > 0 && pha.value === 'hoi', 'lo-dung': n?.lan === 'dung', 'lo-sai': n?.lan === 'sai' };
};

/* ---------- bàn: hình đang hiện (giữ hình cũ trong lúc lá úp xuống để không loé ô trắng) ---------- */
const hinhCu = ref<string[]>([]);
const hinh = computed(() => v.value?.the ?? hinhCu.value);
const soThe = computed(() => v.value?.soThe ?? o.room.value?.config.timSoThe ?? TIM_THE_ONLINE_SO_THE);
/** Nhịp cho bàn vòng: đang đếm ngược (chưa có ván) thì bàn nằm úp. */
const nhipBan = computed(() => (v.value ? pha.value : 'cho'));
/** Mẹo lần đầu (lib/meo-tim-the) — không cho người xem. */
const meoTim = useMeoTimThe(nhipBan, computed(() => !xem.value));
/** Ai chọn lá nào — chỉ ở đáp án (server mới gửi `kq`). */
const aiChon = (i: number) => (pha.value === 'dap-an' || pha.value === 'xong') ? nguoi.value.filter((n) => n.kq?.viTri === i) : [];

/* ---------- nhịp: giờ chọn đo tại máy ---------- */
const chonCuaToi = ref<number | null>(null);
let hoiTu = 0;       // performance.now() lúc câu hỏi bắt đầu (đã trừ phần server trôi trước khi gửi)
let hoiDai = 0;
let raf = 0;
let giayCu = -1;
const banVong = ref<InstanceType<typeof BanVongTim> | null>(null);
/** Cỡ ảnh emoji tải trước — lá vòng tròn rộng ~60–110px. */
const coAnh = computed(() => chonCoAnh(56));

/* ---------- điểm bay (cùng `gain-suck` của bàn chính) ---------- */
const gain = ref<{ key: number; i: number; diem: number; s: string } | null>(null);
let gainEl: HTMLElement | null = null;
function datGain(el: unknown): void { gainEl = el instanceof HTMLElement ? el : null; }
const diemHien = ref(0);
const nay = ref(0);
let henBay: ReturnType<typeof setTimeout> | undefined;
const giayChon = (ms: number): string => (Math.max(10, ms) / 1000).toLocaleString(bcp(), { maximumFractionDigits: ms < 1000 ? 2 : 1, minimumFractionDigits: ms < 1000 ? 2 : 0 });
async function bayDiem(i: number, diem: number, ms: number): Promise<void> {
  clearTimeout(henBay);
  gain.value = { key: (gain.value?.key ?? 0) + 1, i, diem, s: giayChon(ms) };
  await nextTick();
  const dich = document.querySelector('.ott .vien.diem b');
  if (gainEl && dich) {
    const a = gainEl.getBoundingClientRect(), b = dich.getBoundingClientRect();
    gainEl.style.setProperty('--to-x', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
    gainEl.style.setProperty('--to-y', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
  }
  henBay = setTimeout(() => { diemHien.value = toi.value?.diem ?? 0; nay.value++; }, 850);
}

/* ---------- nhận trạng thái ---------- */
/*
 * ĂN MỪNG HẾT VÁN (27.11.2026, chủ dự án: "thắng không có hiệu ứng ăn mừng như trước"): CÙNG màn KetCucFx của ván ghép cặp —
 * cảnh thắng / kỷ lục / thua / hoà, bảng kết quả hiện SAU nhịp `HIEN_BANG_MS` như ghép cặp. Teleport ra #app để phủ kín màn.
 */
const fx = ref<{ loai: LoaiKetCuc; seed: number } | null>(null);
const hienKq = ref(false);
let henKq: ReturnType<typeof setTimeout> | undefined;
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');

/** Kết quả đáp án chờ bàn lật xong (khai báo TRƯỚC watch immediate — TDZ). */
let choLat: TimView | null = null;
/** 3-2-1 ở nhịp `cho` giữa các lượt (đo theo giờ server gửi kèm). Khai báo TRƯỚC watch immediate (TDZ). */
const demSo = ref(0);
/** Số 3-2-1 đặt đúng tâm thẻ giữa (đo lại mỗi số — xoay máy / đổi cỡ giữa chừng vẫn đúng). */
const tamDem = ref<[number, number] | null>(null);
watch(demSo, (n) => { if (n > 0) tamDem.value = banVong.value?.tamGiua() ?? null; });
let choTu = 0, choDai = 0;
/** Mốc + độ dài nhịp NHÌN — vạch đếm ngược quanh thẻ giữa lúc nhìn (y hệt lúc tìm, 27.11.2026). */
let xemTu = 0, xemDai = 0;
let truocPha = '';
let batDauLuc = performance.now();
let truocLuot = -1;
let daGhiVan = -1;
watch(v, (moi) => {
  if (!moi) return;
  if (moi.the) hinhCu.value = moi.the;
  const doiLuot = moi.luot !== truocLuot;
  const doiPha = moi.pha !== truocPha || doiLuot;
  if (moi.pha === 'hoi') {
    if (doiPha) daBaoChon = new Set();
    for (const n of moi.nguoi) {
      if (!n.da || daBaoChon.has(n.id)) continue;
      daBaoChon.add(n.id);
      if (n.id === toiId.value && !xem.value) continue;   // mình chọn thì đã có tiếng `select`
      sfx.timKhacChon();
      vuaChon.value = { ...vuaChon.value, [n.id]: (vuaChon.value[n.id] ?? 0) + 1 };
    }
  }
  if (moi.pha === 'hoi' && doiPha) {
    hoiDai = moi.daiMs;
    hoiTu = o.timNhanLuc.value - (moi.daiMs - moi.conMs);
    giayCu = -1;
  }
  if (doiPha) {
    // Đầu lượt: bàn ÚP (`cho`, 2 giây) rồi mới lật cho xem — giữa các lượt lá úp xuống ngay tại chỗ
    if (moi.pha === 'cho') {
      choTu = o.timNhanLuc.value - (moi.daiMs - moi.conMs); choDai = moi.daiMs; demSo.value = 0;
      chonCuaToi.value = null; gain.value = null;
      if (moi.luot === 0) { fx.value = null; hienKq.value = false; batDauLuc = performance.now(); }
      if (moi.luot > 0) sfx.swap();
    } else if (moi.pha === 'xem') {
      demSo.value = 0;
      xemTu = o.timNhanLuc.value - (moi.daiMs - moi.conMs); xemDai = moi.daiMs;
      // Lượt đầu server lật NGAY sau đếm ngược vào ván (không qua `cho`) — dọn ván cũ ở đây
      if (moi.luot === 0) { fx.value = null; hienKq.value = false; batDauLuc = performance.now(); }
      chonCuaToi.value = null; gain.value = null;
      if (moi.the) taiTruocAnh(moi.the, coAnh.value);
      sfx.flip();
      if (moi.luot === 0) diemHien.value = 0;
    } else if (moi.pha === 'up') sfx.swap();
    else if (moi.pha === 'noi') sfx.timGiua();
    else if (moi.pha === 'dap-an') {
      // Mình đã chọn: lật ngay. Chưa chọn / đang xem: vòng sáng quay về đáp án rồi mới lật (`@lat` → `latBan`)
      choLat = moi;
      if (chonCuaToi.value !== null && !xem.value) latBan();
    } else if (moi.pha === 'xong') ketThuc(moi);
  }
  truocPha = moi.pha; truocLuot = moi.luot;
}, { immediate: true });

/** Bàn đã lật ở đáp án: chốt từng người + tiếng/điểm của mình. */
function latBan(): void {
  const moi = choLat;
  if (!moi) return;
  choLat = null;
  sfx.timLatDapAn();
  loTungNguoi(moi);
  const k = moi.nguoi.find((n) => n.id === toiId.value)?.kq;
  if (k?.ketCuc === 'dung' && k.viTri !== null) { sfx.match(k.chuoi); rung.ghep(k.chuoi); void bayDiem(k.viTri, k.diem, k.ms ?? 0); }
  else if (!xem.value && k?.ketCuc === 'sai') { sfx.miss(); rung.sai(); }
  else if (!xem.value) { sfx.timHet(); rung.sai(); }
}

function cham(i: number): void {
  meoTim.daCham();
  if (xem.value || pha.value !== 'hoi' || chonCuaToi.value !== null) return;
  const ms = performance.now() - hoiTu;
  if (ms > hoiDai) return;   // hết giờ ở máy này — server cũng sẽ từ chối
  chonCuaToi.value = i;
  sfx.timChon();
  rung.tach();
  o.timChon(i, Math.max(0, ms));
}

/** Tiếng tích 3 giây cuối (thay cho thanh giờ — màn chơi không có gì kéo mắt khỏi bàn). */
function khung(): void {
  if (pha.value === 'cho' && choDai > 0) {
    const n = Math.max(0, Math.ceil((choDai - (performance.now() - choTu)) / 1000));
    if (n !== demSo.value) { demSo.value = n; if (n > 0) sfx.countdown(n); }
  }
  // Người xem cũng nghe tích 3 giây cuối, tới khi mọi người đã chọn
  const conCho = xem.value ? (v.value?.nguoi ?? []).some((n) => !n.da) : chonCuaToi.value === null;
  // Vạch giờ quanh thẻ giữa + nhạc trống (chỉ người CHƠI chưa chọn mới nghe trống)
  if (pha.value === 'xem' && xemDai > 0) banVong.value?.veGio(1 - (performance.now() - xemTu) / xemDai, false);
  else banVong.value?.veGio(pha.value === 'hoi' && hoiDai ? 1 - (performance.now() - hoiTu) / hoiDai : null, !xem.value && chonCuaToi.value === null);
  if (pha.value === 'hoi' && conCho) {
    const s = Math.ceil((hoiDai - (performance.now() - hoiTu)) / 1000);
    if (s !== giayCu) { if (giayCu !== -1 && s <= 3 && s > 0) sfx.tick(); giayCu = s; }
  }
  raf = requestAnimationFrame(khung);
}

/* ---------- hết ván ---------- */
const coMay = computed(() => (v.value?.nguoi ?? []).some((n) => !!n.may));
/** Kết quả ván cho ResultDialog (mặt + tên lấy theo người trong phòng). Giờ ván ≈ số lượt × nhịp — server không gửi. */
const tomTat = computed(() => {
  const x = v.value;
  if (!x || x.pha !== 'xong') return null;
  return tomTatTimThe(nguoi.value.map((n) => ({ id: n.id, ten: n.ten, mat: n.mat, diem: n.diem, dung: n.dung, chuoiDai: n.chuoiDai })), toiId.value, x.soLuot, Math.round((performance.now() - batDauLuc) / 1000));
});
/** Còn ≥ 2 người (gồm máy) trong phòng để chơi lại. */
const duNguoiChoiLai = computed(() => (o.room.value?.players ?? []).filter((p) => p.connected !== false).length >= 2);
/** Ai đã bấm chơi lại ('in') / đã rời phòng ('out') — như OnlineGame. */
const rematchState = computed<Record<string, 'in' | 'out'>>(() => {
  const r = o.room.value;
  if (!r) return {};
  const phieu = new Set(r.againVotes ?? []);
  const out: Record<string, 'in' | 'out'> = {};
  for (const n of v.value?.nguoi ?? []) {
    if (phieu.has(n.id)) out[n.id] = 'in';
    else if (!r.players.some((q) => q.id === n.id)) out[n.id] = 'out';
  }
  return out;
});
function ketThuc(moi: TimView): void {
  diemHien.value = moi.nguoi.find((n) => n.id === toiId.value)?.diem ?? diemHien.value;
  if (xem.value || daGhiVan === moi.van) return;
  daGhiVan = moi.van;
  const ds = [...moi.nguoi].sort((a, b) => b.diem - a.diem);
  const minh = moi.nguoi.find((n) => n.id === toiId.value);
  if (!minh) return;
  const caoNhat = ds[0]?.diem ?? 0;
  const dongNhat = ds.filter((n) => n.diem === caoNhat).length;
  const ketQua = minh.diem === caoNhat ? (dongNhat > 1 ? 'hoa' : 'thang') : 'thua';
  if (ketQua === 'thua') sfx.defeat(); else sfx.win();
  fx.value = { loai: ketQua, seed: moi.van * 7919 + moi.soThe };
  hienKq.value = false; clearTimeout(henKq);
  henKq = setTimeout(() => { hienKq.value = true; }, HIEN_BANG_MS[chonCanh(ketQua)]);
  suKien('van_ket_thuc', { che_do: 'tim_the_online', ket_qua: ketQua, so_the: moi.soThe, tuy_chon: moi.doKho, so_nguoi: moi.nguoi.length, diem: minh.diem });
  // Phòng có MÁY: không xu, không lên sổ (cùng luật ván ghép cặp online — chống cày bằng máy dễ)
  if (coMay.value) return;
  store.addScore(minh.diem);   // giờ vàng ×2: nhân ở store.addScore
  store.ghiVanBoDem({ thang: ketQua === 'thang', online: true, tim: { dung: minh.dung } });
  if (ketQua === 'thang') ghiVuaThang();
  // Danh hiệu nhóm Tìm Thẻ (29.11.2026) — online không có số "lượt nhanh nhất" của mình nên không xét Phản xạ
  moKhoa(earnedTim({
    soThe: moi.soThe, doKho: moi.doKho, dung: minh.dung, soLuot: moi.soLuot, ketQua, online: true,
    thongKe: thongKeHienTai()
  }), { treMs: HIEN_BANG_MS[chonCanh(ketQua)] + 400 });
  void taiKhoan.ghiVan({ ketQua, score: minh.diem, achievements: [] });
}

onMounted(() => {
  raf = requestAnimationFrame(khung);
  dangTimOnline.value = true;
});
onBeforeUnmount(() => { clearTimeout(henKq); henLo.forEach(clearTimeout); dangTimOnline.value = false; cancelAnimationFrame(raf); clearTimeout(henBay); });
</script>

<template>
  <!-- KHUNG ONLINE DÙNG CHUNG (28.11.2026): thanh trên, hàng người chơi, dòng báo mạng, bong bóng chat, đếm ngược vào ván,
       thanh emoji — y hệt ván ghép cặp. Màn này chỉ còn phần riêng: viên điểm/lượt, dấu trạng thái + số giây trên ô người
       chơi, bàn vòng tròn, đếm 3-2-1 trước mỗi lần lật, bảng kết quả. -->
  <KhungOnline :o="o" class="ott">
    <template #hud>
      <HudBar
        :score="0" :moves="0" :matched="Math.min(v?.luot ?? 0, v?.soLuot ?? TIM_THE_SO_LUOT)" :total-pairs="v?.soLuot ?? TIM_THE_SO_LUOT"
        :combo="1" :elapsed="0" :time-left="null" :moves-left="null" :lives="null" :multiplayer="true"
        @quit="moChucNang('tim_online_thoat'); emit('quit')"
      >
        <template #giua>
          <span :key="nay" class="vien diem" :class="{ nay: nay > 0 }" :aria-label="t('hud.diem')"><DongXu :size="18" /><b>{{ num(diemHien) }}</b></span>
          <span class="vien luot"><b>{{ t('tt.luot', { n: Math.min((v?.luot ?? 0) + 1, v?.soLuot ?? TIM_THE_SO_LUOT), tong: v?.soLuot ?? TIM_THE_SO_LUOT }) }}</b></span>
        </template>
        <template v-if="o.room.value?.xem?.length" #phai>
          <ChipXem :xem="o.room.value.xem" :toi="o.spectator.value ? o.tenCuaToi() : undefined" />
        </template>
      </HudBar>
    </template>

    <template #nguoi>
      <DaiNguoiChoi
        :nguoi="nguoiDai" :co-luot="false" :trao-ra="true" :toi-id="toiId" :net-hien="o.netHien.value" :ping-hien="o.pingHien.value"
        :lop-chip="lopChip"
      >
        <template #mat="{ p }">
          <span v-if="phu(p.id)?.tt" :key="phu(p.id)!.tt" class="huy" :class="phu(p.id)!.tt"><component :is="ICON[phu(p.id)!.tt as keyof typeof ICON]" :size="11" :stroke-width="3.2" aria-hidden="true" /></span>
        </template>
        <template #sau="{ p }">
          <span v-if="phu(p.id)?.cong" :key="`c${v?.luot}`" class="cong">+{{ num(phu(p.id)!.cong) }}</span>
          <span v-if="phu(p.id)?.giay && pha === 'dap-an'" :key="`g${v?.luot}`" class="giay-chip" :class="{ sai: phu(p.id)!.kq?.ketCuc !== 'dung' }">{{ phu(p.id)!.giay }}s</span>
        </template>
      </DaiNguoiChoi>
    </template>

    <div class="ott-ban">
      <!-- 3-2-1 trước MỖI lần lật cho nhớ — cùng lớp phủ tối của đếm ngược vào ván (khung lo đếm ngược vào ván) -->
      <DemNguocPhu v-if="o.countdownLeft.value === null && demSo > 0 && pha === 'cho'" :n="demSo" :tam="tamDem" />
      <BanVongTim
        ref="banVong" :so-the="soThe" :hinh="hinh" :hinh-dich="v?.hinhDich ?? null" :dich="v?.dich ?? null"
        :nhip="nhipBan" :chon="chonCuaToi" :cho-cham="!xem" :meo="meoTim.meo.value" @cham="cham" @lat="latBan"
      >
        <template #the="{ i, lat }">
          <span v-if="lat && aiChon(i).length" class="ai-chon" aria-hidden="true">
            <span v-for="n in aiChon(i)" :key="n.id" class="mat-nho vong-mau" :style="n.mau ? { '--m': n.mau } : undefined"><MatNguoi :mat="n.mat" :anh="n.anh" /></span>
          </span>
          <template v-if="gain && gain.i === i && pha === 'dap-an'">
            <span :key="`s${gain.key}`" class="tt-giay" aria-hidden="true">{{ gain.s }}s</span>
            <span :key="`g${gain.key}`" :ref="datGain" class="tt-gain" aria-hidden="true">+{{ num(gain.diem) }}</span>
          </template>
        </template>
      </BanVongTim>
      <p class="an-di" aria-live="polite">{{ pha === 'hoi' && v?.hinhDich ? `${t('tt.hoi')} ${v.hinhDich}` : '' }}</p>
    </div>

    <template #ket>
      <Teleport to="#app" :disabled="!coApp">
        <KetCucFx v-if="pha === 'xong' && fx" :loai="fx.loai" :seed="fx.seed" />
      </Teleport>
      <!-- HẾT VÁN = ĐÚNG bảng kết quả online của ghép cặp (ResultDialog chế độ `tim-the`, chủ dự án 27.11.2026) -->
      <!-- `nguoiChoi.name` = TÊN THẬT trong phòng: tỷ số loạt (`seriesWins`) tra theo tên đó. Đưa "Bạn" thì tra hụt → số thắng
           của mình thành 0, người thắng cuộn "-1 → 0" (chủ dự án báo 28.11.2026). -->
      <ResultDialog
        v-if="pha === 'xong' && tomTat && (hienKq || xem || !fx)"
        :summary="tomTat" :is-record="false" :show-stars="false" :multiplayer="true" :multiplayer-online="true"
        :la-chu-phong="o.isHost.value && !xem" :minh-ket-cuc="toiId && !xem ? fx?.loai : undefined"
        :fresh-achievements="[]" :has-next="false" :tim-the="v?.soLuot"
        :series-wins="o.seriesWins.value" :so-van="o.soVanLoat.value"
        :nguoi-choi="tomTat.ranking.map((p) => ({ id: p.id, name: nguoiPhong(p.id)?.name ?? p.name, avatar: p.avatar }))"
        :anh-cua="(id) => nguoiPhong(id)?.anh" :mau-cua="(id) => nguoiPhong(id)?.mau"
        :phieu-choi-lai="o.room.value?.againVotes"
        :rematch-sent="o.iWantAgain.value" :toi-id="toiId || undefined"
        :rematch-blocked="!duNguoiChoiLai || xem" :khong-du="!duNguoiChoiLai" :rematch-state="rematchState"
        @replay="moChucNang('tim_online_choi_lai'); o.again()" @next="o.again()"
        @lobby="moChucNang('tim_online_ve_phong'); o.veLobby()" @chinh="emit('chinh')" @menu="emit('quit')"
      />
    </template>
  </KhungOnline>
</template>

<style scoped>
/* Cao bằng khung như OnlineGame (`.game { height: 100% }`) — thiếu thì bàn co về cỡ nội dung, thẻ tí hon */
.ott { position: relative; display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; box-sizing: border-box; }

/* Viên điểm của mình nảy khi điểm cập bến (viên dùng chung kiểu HudBar qua khe `giua`) */
.vien.diem.nay { animation: nay .3s; }
@keyframes nay { 40% { transform: scale(1.25); } }
/* HIỆU ỨNG TRÊN CHIP CHUNG (DaiNguoiChoi, lớp do `lopChip` gắn): người khác vừa chọn → nảy + viền sáng; chốt đúng → loé
   xanh; chốt sai → lắc. Chip thuộc component con nên phải `:deep()`. */
.ott :deep(.pchip .avatar) { position: relative; }
.ott :deep(.pchip.vua-chon) { animation: ng-nay .4s cubic-bezier(.3, 1.6, .5, 1); box-shadow: 0 0 0 2px #7d88a8, 0 0 12px rgba(125, 136, 168, .55); }
.ott :deep(.pchip.lo-dung) { animation: ng-nay .45s cubic-bezier(.3, 1.6, .5, 1); box-shadow: 0 0 0 2.5px #2f9e57, 0 0 16px rgba(47, 158, 87, .6); }
.ott :deep(.pchip.lo-dung .pts) { color: #2f9e57; }
.ott :deep(.pchip.lo-sai) { animation: ng-lac .4s; }
@keyframes ng-nay { 40% { transform: scale(1.08); } }
@keyframes ng-lac { 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
.huy {
  position: absolute; right: -6px; bottom: -5px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
  color: #fff; border: 2px solid var(--k-nen, #fff); box-sizing: border-box; animation: no .25s both;
}
.huy.da { background: #7d88a8; } .huy.dung { background: #2f9e57; } .huy.nhanh { background: #f0a816; color: #5a3d00; }
.huy.sai, .huy.het { background: #e0533a; }
/* GIÂY CHỌN trên khung điểm (27.11.2026, chủ dự án: "hiện cả thời gian chọn… cho người xem cũng thấy"): mỗi người đã chọn
   có viên số giây ở góc dưới khung tới hết đáp án — xanh nếu đúng, xám nếu sai */
.giay-chip {
  position: absolute; right: 6px; bottom: -9px; z-index: 2; pointer-events: none; white-space: nowrap;
  padding: 1px 7px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 11.5px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}
.giay-chip.sai { background: #7d88a8; box-shadow: 0 2px 0 #5b6688; }
.cong {
  position: absolute; right: 6px; top: -9px; font-family: var(--font-display); font-weight: 800; font-size: 14px; color: #fff;
  -webkit-text-stroke: 3px #2f9e57; paint-order: stroke; pointer-events: none; animation: bay 1s both;
}
@keyframes bay { from { transform: translateY(8px); opacity: 0; } 25% { opacity: 1; } to { transform: translateY(-6px); opacity: 1; } }
@keyframes no { from { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.12); } to { transform: none; opacity: 1; } }

.ott-ban { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; }
/* Mặt người chọn lá này — chỉ ở đáp án */
.ai-chon { position: absolute; left: 0; right: 0; bottom: -9px; z-index: 4; display: flex; justify-content: center; gap: 2px; pointer-events: none; }
.mat-nho { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font-size: 13px; box-shadow: 0 0 0 2px #fff; animation: no .25s both; }


.an-di { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); margin: 0; }

.tt-gain {
  --to-x: 0px; --to-y: -120px;
  position: absolute; left: 50%; top: 50%; z-index: 9; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap;
  font-family: var(--font-display); font-weight: 800; font-size: clamp(22px, 6vw, 30px); color: #ffd23a;
  -webkit-text-stroke: 4px #8a5a00; paint-order: stroke; text-shadow: 0 3px 10px rgba(217, 158, 0, .5);
  animation: gain-suck 1.05s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes gain-suck {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); }
  45% { opacity: 1; transform: translate(calc(-50% + var(--to-x) * .18), calc(-50% + var(--to-y) * .18)) scale(1.2); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--to-x)), calc(-50% + var(--to-y))) scale(.45); }
}
.tt-giay {
  position: absolute; left: 0; right: 0; top: -10px; z-index: 9; width: fit-content; margin: 0 auto; pointer-events: none; white-space: nowrap;
  padding: 2px 10px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 15px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}

@media (prefers-reduced-motion: reduce) {
  .ott :deep(.pchip.vua-chon), .ott :deep(.pchip.lo-dung), .ott :deep(.pchip.lo-sai), .huy, .cong, .tt-giay, .vien.diem.nay, .mat-nho { animation: none; }
}
</style>
