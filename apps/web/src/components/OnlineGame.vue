<script setup lang="ts">
import { isDraw, laBotId } from '@mm/engine';
import MatNguoi from './MatNguoi.vue';
import DauPremium from './DauPremium.vue';
import { taiKhoan } from '@/lib/taikhoan';
import { t } from '@/lib/i18n';
import { earned, moKhoa, thongKeHienTai } from '@/lib/achievements';
import { store } from '@/lib/storage';
import { ghiVanTriNho, hienTriNho } from '@/lib/tri-nho';
import { HIEN_BANG_MS, chonCanh, type LoaiKetCuc } from '@/lib/ketcuc-fx';
import type { Card, Summary } from '@mm/engine';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { sfx } from '@/lib/audio';
import BoardGrid from './BoardGrid.vue';
import { useBoardFit } from '@/composables/useBoardFit';
import KetCucFx from './KetCucFx.vue';
import TeamStrip from './TeamStrip.vue';
import DaiNguoiChoi, { type NguoiDai } from './DaiNguoiChoi.vue';
import KhungOnline from './KhungOnline.vue';
import { rung } from '@/lib/rung';
import { tenNguoi } from '@/lib/ten';
import { tySoLoat } from '@/lib/ty-so-loat';
import HudBar from './HudBar.vue';
import ChipXem from './ChipXem.vue';
import ResultDialog from './ResultDialog.vue';
import OptionIcon from './OptionIcon.vue';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';
import { ghiVuaThang } from '@/lib/xin-danh-gia';
import { heSoXu } from '@/lib/gio-vang';
import { baoNoi } from '@/lib/dai-bao';

/**
 * Màn ĐANG CHƠI của phòng online.
 *
 * Tách khỏi OnlineScreen vì bốn màn online (vào phòng, wizard bàn chơi, phòng
 * chờ, đang chơi) trước đây nằm chung một file 1099 dòng và dùng chung 350 dòng
 * CSS — sửa một màn phải lo va chạm với ba màn kia, và đã va chạm thật vài lần.
 */
const props = defineProps<{ o: ReturnType<typeof useOnlineRoom> }>();
const emit = defineEmits<{ quit: []; chinh: [] }>();
const o = props.o;
/** Avatar người đi đầu (đếm ngược trước ván) — thay 🎲. Online có BOT (mặt là khoá `:rong-vang:`…) nên phải vẽ qua MatNguoi, đừng in chữ trơn. */
/** Dòng "X đi trước" dưới số đếm ngược vào ván (DemNguocPhu qua KhungOnline). */
const diTruoc = computed(() => (o.countdownLeft.value === null ? null : {
  mat: matDiTruoc.value, anh: anhCua(o.countdown.value?.firstId ?? ''), chu: t('game.diTruoc', { ten: o.countdown.value?.firstName ?? '' })
}));
const matDiTruoc = computed(() => {
  const id = o.countdown.value?.firstId;
  // room.players trước: ván đội thì `firstId` là THÀNH VIÊN lật đầu, chỉ có trong phòng
  const ps = [...(o.room.value?.players ?? []), ...(o.view.value?.players ?? [])];
  return ps.find((p) => p.id === id)?.avatar ?? '🎮';
});

/** Còn đủ người để chơi lại không. Trước đây đối phương thoát rồi mà nút "chơi
 *  lại" vẫn bấm được — bấm xong ngồi chờ một người đã đi hẳn. */
const enoughToRematch = computed(() =>
  (o.view.value?.players ?? []).filter((p) => p.connected && !p.forfeited).length >= 2);

/**
 * Trạng thái chơi lại của từng người, tra theo ID — nguồn sự thật là
 * `room.againVotes` (ai đã bấm) và `room.players` (ai còn trong phòng).
 *
 * Người đã thoát thì bị xoá khỏi `room.players` nhưng VẪN còn trong
 * `summary.ranking` — chính nhờ vậy mới có chỗ để gắn nhãn "Đã thoát".
 */
const rematchState = computed<Record<string, 'in' | 'out'>>(() => {
  const r = o.room.value;
  if (!r) return {};
  const votes = new Set(r.againVotes ?? []);
  const out: Record<string, 'in' | 'out'> = {};
  for (const p of o.view.value?.players ?? []) {
    // DÒNG ĐỘI: mã `doi-N` không có trong phòng — xét theo THÀNH VIÊN (máy không bỏ phiếu)
    if (p.thanhVien) {
      const con = p.thanhVien.filter((m) => r.players.some((q) => q.id === m));
      const nguoi = con.filter((m) => !laBotId(m));
      if (!con.length || p.forfeited) out[p.id] = 'out';
      else if (nguoi.length && nguoi.every((m) => votes.has(m))) out[p.id] = 'in';
      continue;
    }
    const inRoom = r.players.some((q) => q.id === p.id);
    if (votes.has(p.id)) out[p.id] = 'in';
    else if (!inRoom || p.forfeited) out[p.id] = 'out';
  }
  return out;
});

/* ---------- map view server → props của BoardGrid ---------- */

/**
 * GIỮ NGUYÊN THAM CHIẾU KHI NỘI DUNG KHÔNG ĐỔI.
 *
 * Server gửi lại cả view mỗi nhịp đồng hồ lượt, không riêng lúc có nước đi. Mỗi
 * view là một mảng 88 lá MỚI và những Set MỚI, nên Vue phải patch lại cả 88
 * component dù trên bàn chẳng có gì khác — trong khi thứ thật sự đổi chỉ là con
 * số đồng hồ trên HUD. Đo trên bàn 88 thẻ: mỗi nhịp như thế tốn 1,38ms style +
 * layout ở máy tính, mà điện thoại chậm hơn nhiều lần và nhịp thì mỗi giây một
 * lần — đó là cái lag chỉ thấy ở ván ONLINE (offline bàn chỉ đổi khi người chơi
 * bấm). Bàn 88 thẻ ăn đủ vì chi phí tính theo số lá.
 *
 * `dauVan` là chữ ký nội dung: giống chữ ký thì trả về ĐÚNG mảng/Set cũ, Vue
 * thấy tham chiếu không đổi và bỏ qua cả cây bàn thẻ. Chữ ký phải chứa MỌI thứ
 * bên trong — thiếu một mẩu là bàn đứng hình không cập nhật, nên nó được sinh
 * từ chính dữ liệu dựng ra, chứ không viết tay.
 */
function giuNeuGiong<T>(o: { ky: string; gt: T }, ky: string, dung: () => T): T {
  if (o.ky !== ky) { o.ky = ky; o.gt = dung(); }
  return o.gt;
}
const oCards = { ky: '', gt: [] as Card[] };
const oFaceUp = { ky: '', gt: new Set<number>() };
const oMatched = { ky: '', gt: new Set<number>() };

const cardsRaw = computed<Card[]>(() =>
  (o.view.value?.cards ?? []).map((c) => ({
    index: c.index,
    pairId: -1,
    // Đi qua `symbolNeuDuocPhep`, KHÔNG đọc bàn-biết-trước trực tiếp: nó chỉ
    // nhả symbol cho ô server đã báo ngửa, hoặc ô mình vừa bấm đang chờ trả
    // lời. Nhờ vậy thẻ úp vẫn nhận `''` đúng như khi chưa có tính năng này.
    // `giuMo`: hai lá vừa lật sai được GHIM ngửa đủ thời gian xem, kể cả khi
    // view mới đã báo úp — xem chú thích ở useOnlineRoom. Chỉ chứa thẻ server
    // vừa báo ngửa nên không lộ bài.
    symbol: o.symbolNeuDuocPhep(c.index, c.symbol, c.state !== 'down')
      || o.giuMo.value.get(c.index) || '',
    ...(c.power ? { power: c.power as Card['power'] } : {}),
    ...(c.blank ? { blank: true } : {})
  })));
const cards = computed<Card[]>(() => {
  const ds = cardsRaw.value;
  const ky = ds.map((c) => `${c.index}|${c.symbol}|${c.power ?? ''}|${c.blank ? 1 : 0}`).join(',');
  return giuNeuGiong(oCards, ky, () => ds);
});
/**
 * Ô nào đang ngửa. Gồm cả ô mình VỪA BẤM còn chờ server, NHƯNG chỉ khi đã biết
 * trước nội dung ô đó — đây chính là chỗ tiết kiệm ~180ms: lật hẳn luôn thay vì
 * treo 90° chờ trả lời.
 *
 * Server tắt cờ PREDEAL thì `symbolNeuDuocPhep` trả '' nên ô chờ KHÔNG vào tập
 * này, và mọi thứ về đúng hành vi treo 90° như trước — không cần cờ ở client.
 *
 * Server từ chối nước đi (bấm sai lượt chẳng hạn) thì `settlePending` bỏ ô khỏi
 * `pending`, ô rời tập này và úp lại.
 */
const faceUp = computed(() => {
  const s = new Set(
    (o.view.value?.cards ?? []).filter((c) => c.state !== 'down').map((c) => c.index));
  for (const i of o.pending.value) {
    if (o.symbolNeuDuocPhep(i, undefined, false)) s.add(i);
  }
  /*
   * Hai lá vừa lật sai: giữ ngửa cho đủ thời gian xem, dù server đã úp.
   *
   * CHỈ ghim ô CÓ biểu tượng. Ghim một ô mà không có gì để vẽ thì lá mở ra
   * TRẮNG TRƠN — người chơi thấy một ô trắng giữa bàn tím (đã bị báo, có ảnh).
   * Thà để nó úp: úp là đúng với dữ liệu đang có trong tay.
   */
  for (const [i, sym] of o.giuMo.value) if (sym) s.add(i);
  // Set mới mỗi nhịp = BoardGrid render lại cả bàn; nội dung của Set CHÍNH LÀ
  // chữ ký của nó nên phép so này không thể bỏ sót gì.
  return giuNeuGiong(oFaceUp, [...s].sort((a, b) => a - b).join(','), () => s);
});
const matchedSet = computed(() => {
  const s = new Set(
    (o.view.value?.cards ?? []).filter((c) => c.state === 'matched').map((c) => c.index));
  return giuNeuGiong(oMatched, [...s].sort((a, b) => a - b).join(','), () => s);
});
/**
 * Bàn khoá khi: không phải lượt mình, ván chưa chạy, HOẶC đang mất kết nối.
 *
 * Thêm điều kiện mạng vì đo được: lúc mất mạng, bàn vẫn bấm được mà mỗi cú bấm
 * rơi vào hư không — người chơi tưởng game hỏng. Khoá lại thì cái họ thấy khớp
 * với sự thật: đang không nói được với server.
 */
/*
 * KHOÁ CẢ BÀN KHI ĐÃ ĐỦ HAI LÁ CHO LƯỢT NÀY.
 *
 * `flip()` vốn đã chặn cú bấm thứ ba (xem chú thích ở đó), nhưng chặn ở tầng
 * GỬI thì lá vẫn nhận phản hồi chạm: lún xuống và loé một quầng sáng trắng ở
 * điểm chạm. Người chơi báo đúng chuyện đó — "bấm lá khác thấy nháy trắng dù
 * không được lật" — và họ chỉ ra lý do vì sao nó hay gặp ở bàn 88 thẻ: lá bé
 * nên ngón tay dễ chạm nhầm thêm lá nữa.
 *
 * Phản hồi cho một cú bấm KHÔNG có tác dụng là nói dối người chơi: nó hứa "máy
 * nhận rồi" trong khi nước đi bị bỏ. Khoá ở đây thì lá không lún, không loé,
 * không đổi con trỏ — cái họ thấy khớp với cái thật sự xảy ra.
 *
 * Tính theo VIEW của server chứ không theo cờ riêng: `state === 'up'` gồm cả
 * quãng 1,5 giây hai lá sai còn nằm ngửa trước khi úp lại — đúng quãng người
 * chơi hay bấm thêm nhất.
 */
const daDuHaiLa = computed(() => {
  const cards = o.view.value?.cards ?? [];
  return cards.filter((c) => c.state === 'up').length + o.pending.value.size >= 2;
});

const locked = computed(() =>
  !o.myTurn.value || o.view.value?.status !== 'playing'
  || o.reconnecting.value || !!o.netTrouble.value
  || daDuHaiLa.value);

/*
 * Emoji chat KHÔNG còn nằm trong dải thông báo (đã teleport ra body, nổi trên
 * header), nên nó không thể đè thông báo chuyển lượt nữa — bỏ luôn phần xếp tầng
 * trước đây phải làm cho hai thứ đó. Màn chơi đơn vẫn cần xếp tầng vì ở đó hai
 * thông báo cùng nằm trong dải (xem GameScreen.vue).
 */

/** Vị trí "+điểm": tâm ô thẻ vừa ghép, tính theo % của lưới. */
const gainStyle = computed(() => {
  const g = o.lastGain.value;
  const v = o.view.value;
  if (!g || !v) return {};
  return {
    left: `${(((g.index % v.cols) + 0.5) / v.cols) * 100}%`,
    top: `${((Math.floor(g.index / v.cols) + 0.5) / v.rows) * 100}%`
  };
});

/**
 * Đo chỗ trống thật, y như màn chơi đơn. Trước đây chỗ này tự tính bằng hằng số
 * `100dvh - 300px` — đoán chiều cao thanh HUD cộng bảng người chơi. Con số đoán
 * sai ngay khi bố cục đổi, và nó không biết gì về khoảng tỷ lệ lá bài, nên cùng
 * một cấp mà bàn online lệch hẳn so với bàn chơi đơn.
 */
const { wrap, fitStyle, xoay } = useBoardFit(() => {
  const v = o.view.value;
  return v ? { cols: v.cols, rows: v.rows } : null;
});

/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
/** Có #app để teleport cảnh kết ván ra không (test gắn component trần thì không có). */
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');
let resultTimer: ReturnType<typeof setTimeout> | undefined;
/** Người chơi ở dạng chung của hàng người chơi online (DaiNguoiChoi — dùng chung mọi kiểu chơi). */
const nguoiDai = computed((): NguoiDai[] => (o.view.value?.players ?? []).map((p) => ({
  id: p.id, ten: tenNguoi(p), tenGoc: p.name, avatar: p.avatar, anh: anhCua(p.id), mau: mauCua(p.id), hh: hhCua(p.id),
  diem: p.score, connected: p.connected, roi: !!p.forfeited, lives: p.lives
})));

/** CHẾ ĐỘ ĐỒNG ĐỘI (docs/che-do-dong-doi.md): view có `nguoiLat` ⇔ ván đội. Ván thường: false, mọi nhánh dưới không chạy. */
/** Tỷ số cả loạt theo tên (lib/ty-so-loat.ts) — luôn hiện, kể cả ván đầu. */
const tySo = computed(() => tySoLoat(o.view.value?.players ?? [], o.seriesWins.value));
const laDoi = computed(() => o.view.value?.nguoiLat !== undefined);
/** Số cặp của bàn (ô trống ở lưới lẻ không tính) — trần điểm trí nhớ tính theo đây. */
const soCapVan = computed(() => Math.floor((o.view.value?.cards.filter((c) => !c.blank).length ?? 0) / 2));
/** Tên từng người trong phòng theo mã — màn kết quả ván đội ghi số cặp mỗi người tự ghép. */
const tenThanhVien = computed(() => Object.fromEntries((o.room.value?.players ?? []).map((p) => [p.id, tenNguoi(p)])));
const iWon = computed(() => o.laToi(o.view.value?.summary?.ranking[0]?.id));

/*
 * CHỈ THẺ (Đồng đội): chạm GIỮ một lá úp ~0,4s → lá đó nháy trên máy đồng đội kèm "chỗ này!".
 * CHẠM ĐÚP cũng được (18.11.2026, chủ dự án) — nhưng CHỈ KHI bàn đang khoá với mình (đồng đội
 * đang lật): lúc đó chạm không lật gì nên chạm đúp không đụng cú lật. Đến lượt mình thì chạm
 * đầu đã lật lá, chờ xem có chạm thứ hai không là bắt mọi cú lật trễ ~0,3s — không đáng.
 * Server chỉ gửi cho đồng đội. Làm bằng lớp NGOÀI CardTile (bắt ở pha capture của khung bàn +
 * thuộc tính `data-chi` trên nút lá — Vue không đụng thuộc tính lạ), để ván thường không đổi gì.
 */
const GIU_MS = 400;
let henGiu: ReturnType<typeof setTimeout> | undefined;
let nuotClick = false;
let diemGiu: [number, number] | null = null;
const bongChi = ref<{ x: number; y: number; ten: string; key: number } | null>(null);
let henChi: ReturnType<typeof setTimeout> | undefined;
function hienChi(index: number, ten: string): void {
  const el = wrap.value?.querySelector<HTMLElement>(`.card[data-index="${index}"]`);
  const khung = wrap.value?.getBoundingClientRect();
  if (!el || !khung) return;
  wrap.value?.querySelectorAll('[data-chi]').forEach((e) => e.removeAttribute('data-chi'));
  el.setAttribute('data-chi', '1');
  const r = el.getBoundingClientRect();
  bongChi.value = { x: r.left + r.width / 2 - khung.left, y: r.top - khung.top, ten, key: (bongChi.value?.key ?? 0) + 1 };
  clearTimeout(henChi);
  henChi = setTimeout(() => { el.removeAttribute('data-chi'); bongChi.value = null; }, 3000);
}
function giuXuong(e: PointerEvent): void {
  if (!laDoi.value || o.spectator.value || o.view.value?.summary) return;
  const la = (e.target as HTMLElement).closest<HTMLElement>('button.card');
  if (!la || la.classList.contains('up') || la.classList.contains('done')) return;
  const index = Number(la.dataset.index);
  diemGiu = [e.clientX, e.clientY];
  clearTimeout(henGiu);
  henGiu = setTimeout(() => {
    nuotClick = true;                        // nhả tay sau khi chỉ KHÔNG được thành cú lật
    chiNay(index);
  }, GIU_MS);
}
function chiNay(index: number): void {
  o.chiLa(index);
  rung.sai();
  sfx.select();
  hienChi(index, '');
}
/** Chạm đúp: hai lần nhả tay trên CÙNG một lá úp, cách nhau ≤ DUP_MS, khi bàn khoá với mình. */
const DUP_MS = 350;
let chamTruoc: { index: number; t: number } | null = null;
function xetChamDup(e: PointerEvent): void {
  if (!laDoi.value || o.spectator.value || o.view.value?.summary || !locked.value) { chamTruoc = null; return; }
  const la = (e.target as HTMLElement).closest<HTMLElement>('button.card');
  if (!la || la.classList.contains('up') || la.classList.contains('done')) { chamTruoc = null; return; }
  const index = Number(la.dataset.index);
  if (chamTruoc && chamTruoc.index === index && e.timeStamp - chamTruoc.t <= DUP_MS) {
    chamTruoc = null;
    chiNay(index);
    return;
  }
  chamTruoc = { index, t: e.timeStamp };
}
function giuDi(e: PointerEvent): void {
  if (diemGiu && Math.hypot(e.clientX - diemGiu[0], e.clientY - diemGiu[1]) > 10) boGiu();
}
function boGiu(): void { clearTimeout(henGiu); diemGiu = null; }
/** Nhả tay: CardTile lật ở `pointerup` (không phải click) — đã chỉ thì chặn ngay ở pha capture. */
function giuNha(e: PointerEvent): void {
  // Chỉ xét chạm đúp khi đây là cú chạm thường (chưa thành chạm giữ, chưa trượt tay)
  if (e.type === 'pointerup' && diemGiu && !nuotClick) xetChamDup(e);
  boGiu();
  if (nuotClick && e.type === 'pointerup') e.stopPropagation();
}
function chanClick(e: MouseEvent): void {
  if (!nuotClick) return;
  nuotClick = false;
  e.stopPropagation(); e.preventDefault();
}
watch(() => o.chiThe.value, (c) => {
  if (!c) return;
  const ai = o.room.value?.players.find((p) => p.id === c.from);
  sfx.select();
  // Mặt dạng khoá (`:bao-den:`) không in được thành chữ — bỏ, chỉ giữ emoji
  hienChi(c.index, ai?.avatar && !/^:.+:$/.test(ai.avatar) ? `${ai.avatar} ` : '');
});
onBeforeUnmount(() => { clearTimeout(henGiu); clearTimeout(henChi); });
/** HOÀ không phải thua: tiếng đã là `sfx.win()` nhẹ, nên hình cũng không được
 *  là tro rơi. Thiếu phép kiểm này thì hoà xong nhìn y như vừa bị hạ. */
const hoa = computed(() => {
  const s = o.view.value?.summary;
  return !!s && isDraw(s.ranking);
});
/** Kết cục dưới góc nhìn CỦA TÔI — thứ quyết định hình nào chạy. */
const loaiKetCuc = computed<LoaiKetCuc>(() => (hoa.value ? 'hoa' : iWon.value ? 'thang' : 'thua'));
/** Seed để bốc hình. View online không mang seed nên lấy mã phòng — cùng phòng,
 *  cùng ván thì mọi lần dựng lại view vẫn ra đúng một hình. */
const seedVan = computed(() => Number(o.roomCode()) || 7);
/*
 * VÁN ĐÃ XEM KẾT CỤC THÌ KHÔNG DIỄN LẠI (14.11.2026, chủ dự án báo): xong ván, sang app chat,
 * quay lại → socket nối lại, server gửi lại view có `summary` (object MỚI) → watch chạy lại:
 * cảnh kết ván diễn lần hai, và tệ hơn là GHI VÁN LẦN HAI vào sổ tài khoản. Nhận ra "cùng một
 * ván" bằng mã phòng + dấu vân tay của summary, nhớ ở localStorage (app bị hệ điều hành
 * đóng hẳn khi ở nền thì mount lại từ đầu — biến trong component không đủ).
 */
const fxTat = ref(false);
let khoaDangXem = '';
let quaNull = false;
const KHOA_DA_XEM = 'mm.vanDaXem';
const khoaVan = (s: Summary): string =>
  `${o.roomCode()}|${s.moves}|${s.seconds}|${s.ranking.map((r) => `${r.id}:${r.score}`).join(',')}`;
function daXem(k: string): boolean {
  try { return (JSON.parse(localStorage.getItem(KHOA_DA_XEM) ?? '[]') as string[]).includes(k); } catch { return false; }
}
function ghiDaXem(k: string): void {
  try {
    const ds = (JSON.parse(localStorage.getItem(KHOA_DA_XEM) ?? '[]') as string[]).filter((x) => x !== k);
    localStorage.setItem(KHOA_DA_XEM, JSON.stringify([k, ...ds].slice(0, 10)));
  } catch { /* chế độ riêng tư: chấp nhận diễn lại */ }
}
watch(() => o.view.value?.summary, (s) => {
  if (!s) {
    clearTimeout(resultTimer);
    showResult.value = false;
    if (khoaDangXem) quaNull = true;
    return;
  }
  const k = khoaVan(s);
  if (k === khoaDangXem) {
    // Cùng ván, view chỉ dựng lại. Không qua null thì cảnh đang chạy dở — để yên.
    if (quaNull) { quaNull = false; fxTat.value = true; showResult.value = true; }
    return;
  }
  khoaDangXem = k;
  quaNull = false;
  clearTimeout(resultTimer);
  if (daXem(k)) { fxTat.value = true; showResult.value = true; return; }
  ghiDaXem(k);
  fxTat.value = false;
  showResult.value = false;
  /*
   * PHÒNG CÓ MÁY (1.6.0): KHÔNG lên sổ tài khoản, không xét danh hiệu online — thêm Gà mờ vào
   * phòng rồi thắng là cách cày "thắng online" không tốn công. Cùng lý do Đấu máy mức Dễ không
   * cộng điểm. Cảnh kết ván vẫn diễn bình thường.
   */
  /*
   * VÁN ĐỒNG ĐỘI (chủ dự án chốt 14.11.2026): chỉ ghi THẮNG/THUA vào tài khoản, KHÔNG điểm xếp
   * hạng, KHÔNG danh hiệu online. Đội đấu MÁY thì không ghi gì (như phòng có máy).
   */
  const coMay = s.ranking.some((r) => laBotId(r.id) || r.thanhVien?.some((m) => laBotId(m)));
  // TRÍ NHỚ: chấm trên lượt của chính mình nên phòng có máy vẫn ghi; ván ĐỘI thì không (dòng xếp
  // hạng là của cả đội). Người xem không có dòng nào mang mã mình nên tự bỏ qua.
  // Luôn gọi: ván không chấm (đội / người xem / debug tắt) thì `vuaDoi` về null — bảng kết quả không hiện số của ván trước
  ghiVanTriNho(hienTriNho.value && !laDoi.value && !o.spectator.value ? s.ranking.find((r) => r.id === o.myId.value) : undefined, soCapVan.value);
  if (laDoi.value && !coMay && !o.spectator.value) {
    store.ghiVanBoDem({ thang: loaiKetCuc.value === 'thang', online: true });
    if (loaiKetCuc.value === 'thang') ghiVuaThang();   // xin đánh giá lúc về trang chủ (lib/xin-danh-gia.ts)
    void taiKhoan.ghiVan({ ketQua: loaiKetCuc.value, score: 0, achievements: [] });
  }
  if (coMay || laDoi.value) {
    resultTimer = setTimeout(() => { showResult.value = true; }, HIEN_BANG_MS[chonCanh(loaiKetCuc.value)]);
    return;
  }
  // Lên sổ tài khoản (nếu đăng nhập): điểm CỦA TÔI và kết cục dưới góc nhìn của tôi.
  // Danh hiệu online xét với những gì view cho biết (không có số lần lật sai)
  const cfg = o.room.value?.config;
  store.ghiVanBoDem({ thang: loaiKetCuc.value === 'thang', online: true });
  if (loaiKetCuc.value === 'thang') ghiVuaThang();   // xin đánh giá lúc về trang chủ (lib/xin-danh-gia.ts)
  const dat = earned({
    summary: s, mode: 'classic', cells: o.view.value?.cards.length ?? 0,
    lives: null, peekMs: 0, options: cfg?.options ?? null, online: true, ketQua: loaiKetCuc.value,
    soNguoi: s.ranking.length, themeIds: cfg?.themeIds, gio: new Date().getHours(),
    thongKe: thongKeHienTai(taiKhoan.me.value?.wins ?? 0)
  });
  moKhoa(dat, { treMs: HIEN_BANG_MS[chonCanh(loaiKetCuc.value)] + 400 });
  // Giờ vàng (lib/gio-vang.ts): thắng ván online trong 20:00–21:00 giờ máy → ×2 xu, báo bằng dải nổi
  const heSo = heSoXu(loaiKetCuc.value === 'thang');
  const diemToi = (s.ranking.find((r) => r.id === o.myId.value)?.score ?? 0) * heSo;
  if (heSo > 1 && diemToi > 0) baoNoi({ loai: 'tot', ic: 'lua', chu: t('gv.x2') });
  /*
   * Cộng vào TỔNG MÁY như ván offline (20.11.2026, lỗi: khách chơi online không được điểm xếp hạng —
   * guiKhach gửi `store.totalScore()` mà online chưa bao giờ cộng vào đó). Đã đăng nhập thì keoVeMay
   * lấy chênh lệch server − máy nên không cộng đôi.
   */
  store.addScore(diemToi);
  void taiKhoan.ghiVan({ ketQua: loaiKetCuc.value, score: diemToi, achievements: dat });
  /*
   * BẢNG TỈ SỐ HIỆN SỚM. Mốc cũ là 5 giây cho người thắng — đủ dài để hết pháo
   * hoa, nhưng người chơi thì muốn biết NGAY tỉ số, và năm giây nhìn một bàn
   * đứng im là lâu thật. Hiệu ứng vẫn chạy tiếp phía sau bảng, nên rút xuống
   * không mất gì. Người thua sớm hơn nữa: họ không có gì để xem.
   */
  resultTimer = setTimeout(() => { showResult.value = true; }, HIEN_BANG_MS[chonCanh(loaiKetCuc.value)]);
});

/** Ảnh Google theo id người chơi — nằm ở danh sách PHÒNG (view ván không mang ảnh). */
const anhCua = (id: string): string | undefined => o.room.value?.players.find((p) => p.id === id)?.anh;
/** Màu hồ sơ (25.11.2026) — như `anhCua`: nằm ở người trong PHÒNG, view ván không mang. */
const mauCua = (id: string): string | undefined => o.room.value?.players.find((p) => p.id === id)?.mau;
/** Huy hiệu Premium của một người trong phòng (DauPremium.vue). */
const hhCua = (id: string): string | undefined => o.room.value?.players.find((p) => p.id === id)?.hh;
/** Mặt + tên một THÀNH VIÊN đội (mã người trong phòng) — bảng tỷ số đội xếp mặt từng người. */
function thanhVienCua(id: string): { mat?: string; anh?: string; ten: string } | undefined {
  const p = o.room.value?.players.find((q) => q.id === id);
  return p && { mat: p.avatar, anh: p.anh, ten: tenNguoi(p) };
}
</script>

<template>
  <KhungOnline :o="o" class="game" :style="fitStyle" :di-truoc="diTruoc">
    <template #hud>
      <HudBar
        :score="0" :moves="o.view.value?.moves ?? 0"
        :matched="o.view.value?.matchedPairs ?? 0"
        :total-pairs="o.view.value?.totalPairs ?? 0"
        :combo="1" :elapsed="o.elapsed.value"
        :time-left="o.view.value?.timeLeft ?? null"
        :moves-left="null" :lives="null" :multiplayer="true"
        @quit="emit('quit')"
      >
        <!-- Chip người xem: ô bên phải hàng trên cùng, không thêm hàng (19.11.2026) -->
        <template v-if="o.room.value?.xem?.length" #phai>
          <ChipXem :xem="o.room.value.xem" :toi="o.spectator.value ? o.tenCuaToi() : undefined" />
        </template>
      </HudBar>
    </template>
    <template #nguoi>
      <!-- ĐỒNG ĐỘI: thanh đội HIỆN THAY dải chip (không nhồi nhánh đội vào dải cũ) -->
      <TeamStrip v-if="laDoi" :o="o" />
      <DaiNguoiChoi
        v-else :nguoi="nguoiDai" :dang-di-id="o.view.value?.currentId ?? null" :toi-id="o.myId.value"
        :net-hien="o.netHien.value" :ping-hien="o.pingHien.value" :dong-ho-luot="o.turnTimeLeft.value" :cong5s="o.timeBonusFor.value" :ty-so="tySo"
      />
    </template>
    <template #bao>
      <!--
        HÉ MỞ CẢ BÀN (Chớp nhoáng đầu ván, hoặc thẻ Mắt thần): phải NÓI RA và
        đếm ngược. Trước đây phòng online không hiện gì cả — người chơi thấy cả
        bàn mở ra rồi tự úp lại, phải tự đoán còn mấy giây, đúng ở cái chế độ mà
        từng giây đều đáng giá. Dùng lại y hệt .toast.peek của GameScreen để
        chơi đơn và chơi online nhìn ra là cùng một thứ.
      -->
      <Transition name="banner">
        <p v-if="o.revealingAll.value" class="toast peek" role="status">
          <OptionIcon name="peek" :size="20" /> {{ t('game.ghiNho') }}
          <b v-if="o.peekLeft.value !== null" class="peek-clock">{{ Math.ceil(o.peekLeft.value) }}s</b>
        </p>
      </Transition>

      <Transition name="banner">
        <div v-if="o.lifeLost.value" :key="`hp-${o.lifeLost.value.key}`" class="turn-banner hurt" role="status" aria-live="polite">
          <span class="who">
            <OptionIcon name="lives" :size="19" />
            <b>{{ o.lifeLost.value.cuaToi ? t('chung.ban') : o.lifeLost.value.name }}</b>
            {{ o.lifeLost.value.left > 0 ? t('og.matMotMang', { n: o.lifeLost.value.left }) : t('og.hetMang') }}
          </span>
        </div>
        <div v-else-if="o.lifeGain.value" :key="`life-${o.lifeGain.value.key}`" class="turn-banner life" role="status" aria-live="polite">
          <span class="who"><OptionIcon name="lives" :size="19" /> <b>{{ o.lifeGain.value.name }}</b> {{ t('og.hoiMang') }}</span>
          <small>{{ t('og.hoiMangLyDo') }}</small>
        </div>
        <div v-else-if="o.turnBanner.value" :key="o.turnBanner.value.key" class="turn-banner" role="status" aria-live="polite">
          <small v-if="o.turnBanner.value.frozen" class="ico-line">
            <OptionIcon name="freeze" :size="15" /> {{ t('game.dongBang', { ten: o.turnBanner.value.frozen }) }}
          </small>
          <span class="who">
            <span class="avatar" :class="{ 'vong-mau': !!mauCua(o.turnBanner.value.id ?? '') }" :style="mauCua(o.turnBanner.value.id ?? '') ? { '--m': mauCua(o.turnBanner.value.id ?? '') } : undefined"><MatNguoi :mat="o.turnBanner.value.avatar || '🎮'" /><DauPremium :loai="hhCua(o.turnBanner.value.id ?? '')" /></span>
            {{ t('game.denLuot') }} <b>{{ o.turnBanner.value.name }}</b>
          </span>
        </div>
      </Transition>
    </template>

    <div
      ref="wrap" class="board-wrap"
      @pointerdown.capture="giuXuong" @pointermove.capture="giuDi" @pointerup.capture="giuNha" @pointercancel.capture="giuNha"
      @click.capture="chanClick"
    >
      <span v-if="bongChi" :key="bongChi.key" class="bong-chi" :style="{ left: `${bongChi.x}px`, top: `${bongChi.y}px` }">
        {{ bongChi.ten }}{{ t('dd.choNay') }}
      </span>
      <BoardGrid
        :cards="cards" :cols="o.view.value?.cols ?? 4" :xoay="xoay"
        :face-up="faceUp" :matched="matchedSet"
        :wrong-pair="o.wrongPair.value" :swap="o.swapPair.value" :pending="o.pending.value"
        :vua-mo="o.vuaMo.value"
        :revealing-all="o.revealingAll.value" :locked="locked"
        :back="o.backStyle.value"
        :hinh-cua-ban="o.hinhCuaBan.value"
        @flip="o.flip"
      />
      <span v-if="o.lastGain.value" :key="o.lastGain.value.key" class="gain" :style="gainStyle" aria-hidden="true">
        +{{ o.lastGain.value.amount }}
      </span>

    </div>

    <template #ket>
      <!-- Ba kết cục, ba hình khác nhau. Hoà KHÔNG phải thua nên không có tro
           rơi; thua phải có hình riêng, không được để trống. -->
      <!-- TELEPORT ra #app: nằm trong <main> (đệm 12px, overflow) thì lớp tối chỉ phủ khung màn
           chính — hở thanh trên cùng, hai bên và đáy (đo 14.11.2026: 12,72→363,541 trên màn 375×553).
           Bản offline vốn đứng ở cấp App nên phủ kín. -->
      <Teleport to="#app" :disabled="!coApp">
        <KetCucFx v-if="o.view.value?.summary && !fxTat" :loai="loaiKetCuc" :seed="seedVan" />
      </Teleport>
      <ResultDialog
        v-if="o.view.value?.summary && showResult"
        :summary="o.view.value.summary"
        :is-record="false" :show-stars="false" :multiplayer="true" :la-chu-phong="o.isHost.value && !o.spectator.value" :minh-ket-cuc="o.myId.value ? loaiKetCuc : undefined"
        :fresh-achievements="[]" :has-next="false" :multiplayer-online="true" :thi-dau="!!o.room.value?.thiDau" :so-cap="soCapVan"
        :ten-thanh-vien="laDoi ? tenThanhVien : undefined"
        :series-wins="o.seriesWins.value"
        :nguoi-choi="o.view.value.players"
        :anh-cua="anhCua" :mau-cua="mauCua"
        :so-van="o.soVanLoat.value"
        :thanh-vien-cua="thanhVienCua"
        :phieu-choi-lai="o.room.value?.againVotes"
        :rematch-sent="o.iWantAgain.value" :toi-id="o.myId.value || undefined"
        :rematch-blocked="!enoughToRematch || o.spectator.value"
        :khong-du="!enoughToRematch"
        :rematch-state="rematchState"
        @replay="o.again()"
        @next="o.again()"
        @lobby="o.veLobby()"
        @chinh="emit('chinh')"
        @menu="emit('quit')"
      />
    </template>
  </KhungOnline>
</template>

<style scoped>
.game { display: flex; flex-direction: column; gap: 8px; height: 100%; }
/* CHỈ THẺ (Đồng đội): lá được chỉ nháy viền vàng + bong bóng nhỏ ngay trên lá */
.board-wrap :deep(.card[data-chi]) { outline: 4px solid #ffc83d; outline-offset: 2px; border-radius: 14px; animation: chi-nhay .6s ease-in-out 5; z-index: 5; }
@keyframes chi-nhay { 50% { outline-color: transparent; } }
.bong-chi {
  position: absolute; z-index: 8; translate: -50% calc(-100% - 6px); pointer-events: none; white-space: nowrap;
  padding: 3px 9px; border-radius: 10px; background: #ffc83d; color: #5a3500;
  font-family: var(--font-display); font-weight: 900; font-size: 13px; box-shadow: 0 3px 0 #d99a12;
  animation: chi-vao .25s ease-out;
}
@keyframes chi-vao { from { opacity: 0; scale: .7; } }


.board-wrap {
  position: relative; flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}
.board-wrap :deep(.board) { width: var(--fit, 100%); }

.gain {
  position: absolute; transform: translate(-50%, -50%);
  font-weight: 800; font-size: clamp(16px, 4vw, 24px); color: var(--gold);
  text-shadow: 0 1px 8px rgba(0, 0, 0, .35); pointer-events: none;
  animation: rise 1s ease-out forwards;
}
@keyframes rise {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(.7); }
  20% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(1); }
}

/* HÉ MỞ CẢ BÀN: cùng dáng với banner chuyển lượt (đều nổi trong .notice-bar),
   chỉ đổi viền sang màu cảnh báo — giống hệt .toast.peek ở GameScreen, để chơi
   đơn và chơi online đọc ra là cùng một thứ. Một dòng, không che thêm hàng thẻ:
   đây đúng là lúc người chơi cần nhìn cả bàn. */
.toast.peek {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 16px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  border: 2px solid color-mix(in srgb, var(--warn) 65%, var(--line));
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px); pointer-events: none; z-index: 5; white-space: nowrap;
  font-size: clamp(15px, 4vw, 19px); font-weight: 700;
}
/* Số cố định bề rộng: 3s→2s không được làm dòng chữ nhảy qua nhảy lại */
.peek-clock {
  display: inline-block; min-width: 2.2em; text-align: center;
  padding: 1px 7px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn);
  font-variant-numeric: tabular-nums;
}

/* Nằm trong .notice-bar nên phải gọn MỘT DÒNG: xếp dọc là dải phải cao gấp
   đôi, mà chỗ đó lấy từ bàn thẻ. */
.turn-banner {
  display: flex; flex-direction: row; align-items: center; gap: 8px;
  padding: 7px 16px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  border: 2px solid var(--accent);
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px); pointer-events: none; z-index: 5; white-space: nowrap;
}
.ico-line { display: inline-flex; align-items: center; gap: 5px; }
.turn-banner .who { display: flex; align-items: center; gap: 8px; font-size: clamp(17px, 4.5vw, 22px); }
.turn-banner.life { border-color: color-mix(in srgb, var(--ok) 70%, var(--line)); }
/* Mất mạng: viền đỏ + lắc một nhịp — tin xấu không được trông như mọi thông báo khác */
.turn-banner.hurt {
  border-color: color-mix(in srgb, var(--bad) 75%, var(--line));
  animation: hp-shake .4s ease-out;
}
.turn-banner.hurt b { color: var(--bad); }
@keyframes hp-shake {
  0%, 100% { margin-left: 0; }
  25% { margin-left: -5px; }
  60% { margin-left: 4px; }
}
@media (prefers-reduced-motion: reduce) { .turn-banner.hurt { animation: none; } }
.turn-banner b { color: var(--accent); }
.turn-banner .avatar { font-size: clamp(24px, 6vw, 32px); }
.turn-banner small { color: var(--muted); font-size: 12.5px; }
.banner-enter-active { transition: opacity .18s ease, transform .25s cubic-bezier(.3, 1.5, .5, 1); }
.banner-enter-from { opacity: 0; transform: translateX(-50%) scale(.6); }
.banner-leave-active { transition: opacity .3s ease, transform .3s ease; }
.banner-leave-to { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.95); }






</style>
