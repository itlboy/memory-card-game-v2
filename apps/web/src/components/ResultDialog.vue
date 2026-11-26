<script setup lang="ts">
import IconVong from './IconVong.vue';
import { moChucNang } from '@/lib/phan-tich';
import { tenNguoi } from '@/lib/ten';
import { hoSo, tenToi } from '@/lib/ho-so';
import { tySoLoat } from '@/lib/ty-so-loat';
import MatNguoi from './MatNguoi.vue';
import { t, td, bcp } from '@/lib/i18n';
import { MOC_CO_DIEM_VAN, isDraw, laBotId } from '@mm/engine';
import type { PlayerInit, Summary } from '@mm/engine';
import { computed, nextTick, onMounted, ref } from 'vue';
import { byId, type Achievement } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { clock, num } from '@/lib/format';
import DongXu from './DongXu.vue';
import Sao3D from './Sao3D.vue';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';
import { ChartColumn, ChevronDown, Flame, Hand, LogOut, Pointer, Settings2, Share, Timer, Zap } from 'lucide-vue-next';
import { hienTriNho, vuaDoi } from '@/lib/tri-nho';
import LuuChiaSe from './LuuChiaSe.vue';
import { coChiaSeAnh, type NoiDungAnh } from '@/lib/anh-ket-qua';
import { SITE_URL } from '@/lib/native';

const props = defineProps<{
  summary: Summary;
  /** Số lần sai tối đa cho 2★/3★ (Chiến dịch) — có thì hiện mốc 3★ dưới hàng sao. */
  starMisses?: readonly [number, number];
  /** Số cặp của bàn — có thì (và debug bật) hiện dòng ĐIỂM TRÍ NHỚ của người cầm máy. */
  soCap?: number;
  isRecord: boolean;
  showStars: boolean;
  multiplayer: boolean;
  freshAchievements: string[];
  /** Danh hiệu nên đi chinh phục tiếp (ván offline). */
  goiY?: Achievement | null;
  /** Số ván thắng của từng người trong loạt đang chơi (theo tên). */
  seriesWins?: Record<string, number>;
  /** Người chơi theo THỨ TỰ CHỖ NGỒI — bảng tỷ số loạt xếp theo đây để cột không nhảy chỗ giữa
   *  các ván. Không truyền thì dùng thứ tự xếp hạng ván. */
  nguoiChoi?: readonly PlayerInit[];
  /** Ảnh Google của người chơi online (theo id), để mặt trong bảng tỷ số giống trong bàn. */
  anhCua?: (id: string) => string | undefined;
  /** Màu hồ sơ của một người (25.11.2026) — online: từ người trong phòng; trên máy: `mauTaiMay`. Không có = không tô ô. */
  mauCua?: (id: string) => string | undefined;
  /** Ván thứ mấy của loạt (kể cả hoà) — dòng nhỏ "Ván N" trên tiêu đề. */
  soVan?: number;
  /** Ván ĐỘI online: mặt + tên một thành viên theo mã — cột đội xếp chồng mặt từng người. */
  thanhVienCua?: (id: string) => { mat?: string; anh?: string; ten: string } | undefined;
  /** Phòng online: mã những người ĐÃ bấm "Chơi lại" — dấu ✓ trên mặt từng thành viên đội. */
  phieuChoiLai?: readonly string[];
  /** Có màn kế tiếp trong Chiến dịch không. */
  hasNext: boolean;
  /** Cấp đang chơi; không có nghĩa là ván lẻ, không thuộc thang cấp. */
  levelId?: number;
  /** Ván online: không có thang cấp nên không có "cấp tiếp theo". */
  multiplayerOnline?: boolean;
  /** Ván ĐỘI online: tên từng thành viên theo mã — để ghi "ai tự ghép mấy cặp" dưới dòng đội. */
  tenThanhVien?: Record<string, string>;
  /** Phòng online: mình là chủ phòng → bấm được "Chỉnh bàn" (người khác thấy nút mờ). */
  laChuPhong?: boolean;
  /** Phòng THI ĐẤU (không chủ phòng, không phòng chờ): giấu hàng "Về phòng chờ · Chỉnh bàn". */
  thiDau?: boolean;
  /** Ván online: mình đã bấm chơi lại chưa. Nút đổi thành trạng thái chờ —
   *  trước đây bấm xong nút y nguyên nên người chơi tưởng nút không ăn. */
  rematchSent?: boolean;
  /** Không còn đủ người kết nối để chơi lại — ẩn nút thay vì để bấm vô nghĩa. */
  rematchBlocked?: boolean;
  /** Online: thật sự HẾT người để chơi lại (khác `rematchBlocked` — người XEM cũng bị chặn nút nhưng
   *  không được báo "mọi người đã rời", lỗi 20.11.2026). */
  khongDu?: boolean;
  /**
   * Trạng thái chơi lại của TỪNG người, tra theo id: 'in' = đã bấm chơi tiếp,
   * 'out' = đã rời phòng. Không có tên trong map = chưa bấm, không gắn nhãn.
   *
   * Tra theo ID chứ không theo tên: hai người trùng tên là chuyện có thật, mà
   * dòng thông báo cũ đã bỏ chỉ có TÊN nên không phân biệt được ai với ai.
   */
  rematchState?: Record<string, 'in' | 'out'>;
  /** Id của MÌNH trong phòng online — để chip dưới cột mình ghi "Bạn chưa bấm" và nút biết mình là người cuối. */
  toiId?: string;
  /**
   * Kết cục của CHÍNH người cầm máy — chỉ truyền khi có một "mình" rõ ràng (đấu
   * máy, online). Có nó thì tiêu đề nói "Bạn thắng/thua", không nói tên người
   * thắng: người chơi muốn biết MÌNH ra sao (chủ dự án báo 13.10.2026, ảnh "Bot
   * gà cứng thắng! 🏆" kèm ba sao khi chính họ thua). Nhiều người chung một máy
   * thì KHÔNG truyền — ai cũng là người thật, nêu tên người thắng mới đúng.
   * `summary.status === 'won'` chỉ nói BÀN ĐÃ SẠCH, không nói ai thắng (CLAUDE.md).
   */
  minhKetCuc?: LoaiKetCuc;
  /**
   * VÁN TÌM THẺ (27.11.2026, chủ dự án: hết ván Tìm Thẻ dùng ĐÚNG bảng kết quả này): số lượt của ván. Có thì `moves` /
   * `pairs` là SỐ LƯỢT ĐÚNG (không phải lượt lật / cặp) — nhãn đổi thành "Đúng x/N", dòng lý do thành "Xong N lượt".
   */
  timThe?: number;
}>();

const emit = defineEmits<{ replay: []; next: []; menu: []; 'doi-ban': []; lobby: []; chinh: []; 'chinh-phuc': [Achievement] }>();
const primary = ref<HTMLButtonElement | null>(null);
const shownStars = ref(0);
/** Mốc của ngôi sao KẾ TIẾP — nói cho người chơi biết lần sau cần gì. */
const saoKe = computed(() => {
  const [max2, max3] = props.starMisses ?? [0, 0];
  const sao = Math.min(props.summary.stars + 1, 4);
  if (sao === 2) return { sao, txt: t('kq.canDuoi', { n: max2 + 1 }) };
  if (sao === 3 && max3 > 0) return { sao, txt: t('kq.canDuoi', { n: max3 + 1 }) };
  return { sao: sao === 3 ? 3 : 4, txt: t('kq.canKhong') };
});
/** Điểm chạy dần từ 0 lên tổng — con số nhảy sẵn thì không ai cảm nhận được
 *  là mình vừa ghi được bao nhiêu. */
const shownScore = ref(0);

/**
 * TÊN DÀI THÌ CHẠY (19.11.2026, chủ dự án: "tên nhỏ hơn chút, dài quá thì làm tên chạy"): đo sau khi vẽ
 * (và khi font tải xong — font hiển thị rộng hơn font dự phòng), tên tràn cột thì gắn `chay` + độ lệch
 * `--lech` để chữ trượt qua lại. Tên vừa cột thì giữ nguyên, đứng yên.
 */
const bangTySo = ref<HTMLElement | null>(null);
function doTenChay(): void {
  for (const b of bangTySo.value?.querySelectorAll<HTMLElement>('.ten-kq') ?? []) {
    b.classList.remove('chay');
    // Đo trên chính ô tên (overflow hidden): span inline có scrollWidth = 0
    const lech = b.scrollWidth - b.clientWidth;
    if (lech > 2) {
      b.style.setProperty('--lech', `${-lech - 4}px`);
      b.style.setProperty('--tg', `${Math.min(9, 3 + lech / 18).toFixed(1)}s`);
      b.classList.add('chay');
    }
  }
}
onMounted(() => {
  void nextTick(doTenChay);
  document.fonts?.ready.then(doTenChay).catch(() => { /* không có Font Loading API */ });
});

onMounted(() => {
  primary.value?.focus();
  if (hienSao.value) {
    // Sao hiện lần lượt, mỗi ngôi kèm một nốt cao dần
    const n = props.summary.stars + (props.summary.hoanHao ? 1 : 0);
    for (let i = 1; i <= n; i++) {
      setTimeout(() => { shownStars.value = i; sfx.star(i); }, 350 * i);
    }
  }
  countScoreUp();
  // Tỷ số loạt: số người thắng ván CUỘN lên đúng lúc này (khớp animation .cuon, trễ 1s) — kèm tiếng
  if (loat.value?.some((r) => r.thang)) {
    setTimeout(() => sfx.star(3), MOC_CUON);
    setTimeout(() => sfx.star(5), MOC_CUON + 160);
  }
});

/** Lúc số tỷ số của người thắng ván bắt đầu cuộn (ms) — PHẢI khớp `animation-delay` của `.cuon` trong CSS. */
const MOC_CUON = 1000;

/** Chạy một con số từ `from` tới `to`, gọi onDone khi xong. */
function runCount(
  from: number, to: number, dur: number,
  set: (v: number) => void, tick: boolean, onDone?: () => void
): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    set(to); onDone?.(); return;
  }
  const t0 = performance.now();
  let lastTick = 0;
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    set(Math.round(from + (to - from) * eased));
    // Tick theo mốc thời gian, không theo frame — 60fps sẽ thành tiếng rè
    if (tick && now - lastTick > 90 && p < 1) { lastTick = now; sfx.tick(); }
    if (p < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

/** Điểm ván đếm lên. Tổng tích luỹ KHÔNG nhắc lại ở bảng này (18.11.2026, chủ dự án: "thừa,
 *  bên trên có rồi") — ô xu trên TopBar tự nảy số khi tổng đổi. */
function countScoreUp(): void {
  const target = props.summary.score;
  if (target <= 0) { shownScore.value = target; return; }
  runCount(0, target, Math.min(1400, 500 + target * 1.2), (v) => { shownScore.value = v; }, true);
}


const draw = computed(() => props.multiplayer && isDraw(props.summary.ranking));
/** Sao chỉ cho ván MÌNH không thua — thua máy mà hiện ba sao là nói ngược. */
/** Nhiều người CHUNG MỘT MÁY (không có "mình"): sao là của riêng một người, lạc giữa
 *  ván nhiều người (mockup duyệt 17.11.2026) — bỏ. Đấu máy vẫn giữ (ván của một người). */
const chungMay = computed(() => props.multiplayer && !props.multiplayerOnline && !props.minhKetCuc);
const hienSao = computed(() => props.showStars && props.summary.status === 'won' && props.minhKetCuc !== 'thua' && !chungMay.value);

/**
 * CHỈ SỐ TRÍ NHỚ (mở cho mọi người từ 1.9.66) — MỘT dòng: chỉ số CỦA RIÊNG VÁN NÀY (`chiSoVan`, 0–1000), không còn
 * chỉ số 7 ngày + mức tăng giảm (chủ dự án 25.11.2026: "bỏ cái tổng sau mỗi ván, hiện của ván đó thôi"). Chỉ số 7 ngày
 * vẫn được cộng dồn và xem ở nút trang chủ / màn Chỉ số trí nhớ. Ai gọi `ghiVanTriNho` trước khi bảng mở (App.vue /
 * OnlineGame.vue) quyết định ván có được chấm không: nhiều người chung máy, ván đội online, người xem → `vuaDoi` = null
 * → không có dòng này. `van` = null (ván quá ít cơ hội nhớ) → "Chưa đủ để chấm".
 */
/** Dấu "?" cạnh tên chỉ số (chủ dự án 25.11.2026: "như thế nào mới đủ để chấm? cho dấu hỏi vào đó và giải thích, bấm vào") — bấm là mở/đóng đoạn giải thích NGAY DƯỚI hàng, không mở thêm popup chồng popup. */
const moGiaiThich = ref(false);
const vFocus = { mounted: (el: HTMLElement) => el.focus() };
const triNho = computed(() => {
  const v = vuaDoi.value;
  if (!hienTriNho.value || !props.soCap || chungMay.value || !v) return null;
  return { van: v.van };
});

/**
 * Có chỗ cho nút "Cấp tiếp theo" hay không, và có bấm được hay không — hai
 * chuyện khác nhau. Ván lẻ (không thuộc thang cấp) thì không hiện; còn khi thuộc
 * thang cấp mà cấp sau chưa mở thì HIỆN NHƯNG TẮT, để bố cục đứng yên giữa các
 * ván. Ván online không có thang cấp nên cũng không hiện.
 */
const showNext = computed(() => props.levelId !== undefined && !props.multiplayerOnline);
// KHÔNG chặn theo `minhKetCuc`: đấu máy mở sẵn mọi cấp, thua vẫn đi tiếp được
// (test flows "THUA bot thì KHÔNG mở cấp" canh cả nửa này).
const canNext = computed(() => props.hasNext && props.summary.status === 'won');
/** Ván thuộc thang cấp thì nói rõ "cấp này", không thì chỉ "Chơi lại". */
const replayLabel = computed(() => (props.levelId === undefined ? t('kq.choiLai') : t('kq.choiLaiCap')));

/*
 * CHƠI LẠI RÕ RÀNG (19.11.2026, mockup duyệt https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH): dưới mỗi
 * cột một chip (✓ Chơi lại / ⏳ Đang chờ / Đã rời), thanh "Chơi lại 2/3" ghi tên người còn chờ, nút đổi
 * theo trạng thái — đã bấm: "✓ Đã bấm — chờ Minh"; mình là người CUỐI: nút sáng "Linh đang chờ bạn!".
 */
const laCotToi = (r: { id: string; tv: { id: string }[] }): boolean =>
  !!props.toiId && (r.id === props.toiId || r.tv.some((m) => m.id === props.toiId));
const choiLai = computed(() => {
  if (!props.multiplayerOnline || !loat.value) return null;
  const con = loat.value.filter((r) => !r.ra);
  const ok = con.filter((r) => r.ok);
  const cho = con.filter((r) => !r.ok && !laCotToi(r)).map((r) => r.ten);
  const toiDaBam = !!props.rematchSent;
  return {
    ok: ok.length, tong: con.length, cho,
    /** Người khác đã bấm hết, chỉ còn mình. */
    cuoi: !toiDaBam && cho.length === 0 && ok.length > 0,
    // Tên NGƯỜI (không kể máy) đang chờ mình — chỉ máy thì không nói gì thêm
    tenCho: ok.filter((r) => !laCotToi(r) && !laBotId(r.id) && !(r.tv.length && r.tv.every((m) => laBotId(m.id)))).map((r) => r.ten).join(', '),
  };
});

/**
 * "Bạn đã mở hết các cặp!" chỉ đúng khi chơi MỘT MÌNH. Ván thi đấu mà bàn do đối
 * thủ dọn thì câu đó thành sai sự thật — đã thấy thật: dòng trên ghi "Bot siêu
 * đẳng thắng!", dòng dưới lại khen người chơi mở hết cặp.
 */
const reasonText = computed(() =>
  props.timThe ? t('tt.xongVan', { n: props.timThe }) : props.multiplayer && props.summary.reason === 'cleared'
    ? t('kq.banSach')
    : td(`kq.ly.${props.summary.reason}`));

/*
 * BẢNG KẾT QUẢ NHIỀU NGƯỜI = TỶ SỐ LOẠT (17.11.2026, mockup duyệt
 * https://claude.ai/artifact/NTXzpWotaUaPTG96MQxNLi — thay bảng tím 16.11.2026).
 * Mỗi người/đội một cột theo CHỖ NGỒI (cột không nhảy chỗ giữa các ván): mặt, tên, MỘT con số to
 * = số ván thắng cả loạt, điểm ván là chữ nhỏ. Số của người vừa thắng ván CUỘN lên rồi vàng cam
 * (19.11.2026, bỏ viên "+1"). Số mọi người cùng màu đen, không làm mờ người kém (chủ dự án: "nhạt quá")
 * — KHÔNG ô màu (chủ dự án: "nhiều màu sắc quá"). Bỏ chữ "Tỷ số" ("ai cũng biết"). Số cặp/chuỗi ẩn sau nút "Chi tiết ván".
 * Hiện NGAY TỪ VÁN ĐẦU (1 – 0), cùng luật `tySoLoat` với viên số trong bàn chơi.
 */
const loat = computed(() => {
  if (!props.multiplayer || !props.seriesWins) return null;
  const ds = props.nguoiChoi?.length ? props.nguoiChoi : props.summary.ranking;
  const ty = tySoLoat(ds, props.seriesWins);
  if (!ty) return null;
  const nhat = isDraw(props.summary.ranking) ? undefined : props.summary.ranking[0]?.id;
  const phieu = new Set(props.phieuChoiLai ?? []);
  return ds.map((p) => {
    const hang = props.summary.ranking.find((r) => r.id === p.id);
    const tvIds = (hang?.thanhVien ?? (p as { thanhVien?: string[] }).thanhVien) ?? [];
    // Đội: mã `doi-1`…`doi-4` (ván cũ `doi-A`/`doi-B`) → số màu như thanh đội trong ván
    const doi = tvIds.length ? (({ A: '1', B: '2' } as Record<string, string>)[p.id.slice(-1)] ?? p.id.slice(-1)) : '';
    return {
      id: p.id, ten: tenNguoi(p), mat: p.avatar, anh: props.anhCua?.(p.id), mau: props.mauCua?.(p.id),
      n: ty[p.name]?.n ?? 0,
      diem: hang?.score ?? 0, thang: p.id === nhat, doi,
      // MÁY mặc định muốn chơi lại (không bỏ phiếu) — chủ dự án 19.11.2026: "bot thì mặc định sẵn sàng"
      ok: props.rematchState?.[p.id] === 'in' || (laBotId(p.id) && props.rematchState?.[p.id] !== 'out')
        || (tvIds.length > 0 && tvIds.every((m) => laBotId(m))),
      ra: props.rematchState?.[p.id] === 'out',
      tv: tvIds.map((id) => {
        const m = props.thanhVienCua?.(id);
        return { id, mat: m?.mat, anh: m?.anh ?? props.anhCua?.(id), mau: props.mauCua?.(id), ten: m?.ten ?? '?', ok: phieu.has(id) };
      }),
    };
  });
});
/** Đang lật sang bảng chi tiết (điểm · cặp · chuỗi). Không nhớ: ván sau lại mở ở tỷ số. */
const moChiTiet = ref(false);
/** Mặt của một dòng trong bảng chi tiết — lấy từ cột tỷ số (đã có mặt từng thành viên đội). */
const cotCua = (id: string) => loat.value?.find((r) => r.id === id);
const loatAria = computed(() => loat.value?.map((r) => `${r.ten} ${r.n}`).join(', ') ?? '');

const title = computed(() => {
  // Nhiều người: LUÔN xếp hạng, kể cả khi ván dừng vì hết giờ hay hết mạng —
  // lúc đó engine trả status 'lost' nhưng vẫn có người dẫn điểm, mà báo
  // "Chưa xong" thì cả phòng không biết ai thắng.
  // Bằng điểm thì phải nói HOÀ: lấy người đầu danh sách rồi tuyên bố thắng là
  // sai, thứ tự đó chỉ do sort quyết định.
  if (draw.value || props.minhKetCuc === 'hoa') return t('kq.hoa');
  if (props.minhKetCuc) return props.minhKetCuc === 'thang' ? t('kq.banThang') : t('kq.banThua');
  if (props.multiplayer) return t('kq.thang', { ten: tenNguoi(props.summary.ranking[0]) });
  if (props.summary.status !== 'won') return t('kq.chuaXong');
  return props.isRecord ? t('kq.kyLuc') : t('kq.hoanThanh');
});

/*
 * NÚT LƯU / CHIA SẺ ẢNH KẾT QUẢ (11.11.2026, mockup duyệt https://claude.ai/artifact/MkD66nuGdEmYrYf9wmniWy).
 * Mọi chế độ. Ảnh kể ĐÚNG ván: nhiều người → bảng xếp hạng ("X thắng!" — người thua lưu để phục
 * thù cũng được); một mình → điểm, lượt, thời gian, chuỗi.
 */
const hienLcs = coChiaSeAnh();
const moLcs = ref(false);
const boEmoji = (s: string): string => s.replace(/\s*\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*\s*$/u, '').trim();
const noiDungAnh = computed<NoiDungAnh>(() => {
  const s = props.summary;
  const ngay = new Date().toLocaleDateString(bcp());
  const tieuDe = props.multiplayer
    ? boEmoji(draw.value ? t('kq.hoa') : t('kq.thang', { ten: tenNguoi(s.ranking[0]) }))
    : boEmoji(title.value);
  // site = link TẢI APP `/tai` (tự chuyển tới đúng cửa hàng) — in ở chân ảnh kèm mã QR (bản ảnh mới 26.11.2026)
  const chung = { cau: t('kq.thachDau'), choiNgay: t('kq.choiNgay'), site: `${SITE_URL}/tai`, tenApp: t('tb.thuongHieu') };
  if (props.multiplayer) {
    return {
      ...chung, tieuDe, phu: props.multiplayerOnline ? `Online · ${ngay}` : ngay,
      ...(loat.value?.length
        ? { tySo: {
          nhan: props.soVan ? t('kq.tySoSau', { n: props.soVan }) : t('kq.tySo'),
          ds: loat.value.map((r) => ({
            ten: r.ten, n: r.n, diem: t('kq.diemAria', { n: num(r.diem) }),
            mat: r.tv.length ? r.tv.map((m) => ({ mat: m.mat, anh: m.anh })) : [{ mat: r.mat, anh: r.anh, mau: r.mau }],
          })),
        } }
        : {}),
      hang: s.ranking.map((p, i) => ({
        hang: draw.value && i < 2 ? 1 : i + 1, ten: tenNguoi(p), diem: num(p.score),
        nhat: draw.value ? i < 2 : i === 0, mat: p.avatar, mau: props.mauCua?.(p.id),
      })),
    };
  }
  return {
    ...chung, tieuDe, phu: `${reasonText.value} · ${ngay}`,
    nguoi: { ten: tenToi.value || tenNguoi(s.ranking[0]), mat: hoSo.value.xong ? hoSo.value.mat : s.ranking[0]?.avatar, mau: hoSo.value.xong ? hoSo.value.mau : undefined },
    so: [
      { nhan: t('chung.diem'), gt: num(s.score) },
      props.timThe ? { nhan: t('tt.dungNhan'), gt: `${s.moves}/${props.timThe}` } : { nhan: t('kq.soLuot'), gt: String(s.moves) },
      { nhan: t('kq.thoiGian'), gt: clock(s.seconds) },
      { nhan: t('kq.chuoiDai'), gt: String(s.bestStreak) },
    ],
  };
});
</script>

<template>
  <div class="overlay" :class="{ 'co-dock': multiplayerOnline }" role="dialog" aria-modal="true" aria-labelledby="resTitle" @keydown.esc="emit('menu')">
    <div class="panel" :class="{ 'kq-online': multiplayerOnline, 'nhieu-nguoi': loat }">
      <!-- Nhiều người: "Ván N" trên tiêu đề. Nút chia sẻ nay là nút vàng "Khoe tỷ số" cạnh "Chi tiết ván". -->
      <div v-if="loat" class="dau-kq">
        <small v-if="soVan">{{ t('kq.van', { n: soVan }) }}</small>
      </div>
      <h2 id="resTitle">{{ title }}</h2>
      <!-- Nhiều người: "Bàn đã dọn sạch" là chuyện thường, bỏ cho gọn; chỉ nói khi ván dừng vì lý do khác -->
      <p v-if="!loat || summary.reason !== 'cleared'" class="reason">{{ reasonText }}</p>

      <!-- Tỷ số cả loạt: chơi với nhau nhiều ván thì đây mới là con số người ta thực sự quan tâm.
           `data-kq-for`: bong bóng emoji (EmojiBlast.vue) neo vào CỘT người gửi (đội: vào MẶT
           từng thành viên) — bảng này phủ kín màn chơi nên chip trong ván không còn thấy được. -->
      <!-- Hai bảng CHỒNG lên cùng một ô lưới, khung cao bằng bảng cao hơn: bấm "Chi tiết ván" chỉ
           đổi phần bên trong, khung không co giật (chủ dự án 17.11.2026). Bảng đang ẩn dùng
           visibility chứ không display:none — display:none là mất chỗ, khung nhảy. -->
      <div v-if="multiplayer" class="lat" :class="{ chong: loat }">
        <div
          v-if="loat" ref="bangTySo" class="loat khay-nho khay-noi" :class="{ an: moChiTiet, chat: loat.length >= 3, 'rat-chat': loat.length >= 5 }" role="group"
          :aria-label="`${t('kq.tySo')}: ${loatAria}`" :style="{ '--n': loat.length }"
        >
          <div
            v-for="r in loat" :key="r.id" class="cot" :class="[{ ra: r.ra }, r.doi && `doi d${r.doi}`]"
            :data-kq-for="r.tv.length ? undefined : r.id"
          >
            <span class="xep" aria-hidden="true">
              <template v-if="r.tv.length">
                <span v-for="m in r.tv" :key="m.id" class="mat" :class="{ 'vong-mau': !!m.mau }" :style="m.mau ? { '--m': m.mau } : undefined" :data-kq-for="m.id"><MatNguoi :mat="m.mat" :anh="m.anh" /></span>
              </template>
              <span v-else class="mat" :class="{ 'vong-mau': !!r.mau }" :style="r.mau ? { '--m': r.mau } : undefined"><MatNguoi :mat="r.mat" :anh="r.anh" /></span>
            </span>
            <b class="ten ten-kq"><span class="chu-ten">{{ r.ten }}</span></b>
            <small v-if="r.tv.length > 1" class="tv">{{ r.tv.map((m) => m.ten).join(' · ') }}</small>
            <!-- Hàng số CAO CỐ ĐỊNH: viên +1 nổi bên trên, không đẩy dòng điểm của cột thắng
                 xuống thấp hơn cột bên cạnh (chủ dự án: "nó phải cân đối nhau") -->
            <span class="so"><span class="o-so"><span class="khung-so" :class="{ nay: r.thang }"><b :class="{ cuon: r.thang }" :data-cu="r.thang ? r.n - 1 : undefined">{{ r.n }}</b></span></span></span>
            <small class="dm">{{ t('kq.diemAria', { n: num(r.diem) }) }}</small>
            <!-- HÀNG CHƠI LẠI bằng BIỂU TƯỢNG ngay dưới tỷ số (19.11.2026, chủ dự án: "có biểu tượng, đỡ phải viết
                 nhiều chữ"): mũi tên vòng xanh = đã bấm (máy luôn coi là đã bấm) · ba chấm nhảy cam = đang chờ · 🚪 xám = đã rời. Chữ ở aria/title. -->
            <span
              v-if="multiplayerOnline" class="cl-ic" :class="r.ra ? 'roi' : r.ok ? 'ok' : 'cho'" role="img"
              :aria-label="r.ra ? t('kq.tag.daRoi') : r.ok ? t('kq.tag.choiLai') : laCotToi(r) ? t('kq.tag.banChuaBam') : t('kq.tag.dangCho')"
              :title="r.ra ? t('kq.tag.daRoi') : r.ok ? t('kq.tag.choiLai') : laCotToi(r) ? t('kq.tag.banChuaBam') : t('kq.tag.dangCho')"
            ><svg v-if="r.ok && !r.ra" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg><LogOut v-else-if="r.ra" :size="15" :stroke-width="2.6" /><span v-else class="cham" aria-hidden="true"><i /><i /><i /></span></span>
          </div>
        </div>

        <!-- CHI TIẾT VÁN: điểm · cặp · chuỗi từng người, xếp theo hạng ván. Có bảng tỷ số thì ẩn sau
             nút "Chi tiết ván" (lật chỗ với bảng tỷ số); không có (thiếu dữ liệu loạt) thì hiện thẳng. -->
        <ol v-if="multiplayer" id="kqChiTiet" class="ranking" :class="{ 'khay-nho khay-noi': loat, an: loat && !moChiTiet }">
          <li v-for="(p, i) in summary.ranking" :key="p.id" :data-kq-for="loat ? undefined : p.id">
            <span v-if="cotCua(p.id)" class="mat-ct" aria-hidden="true">
              <template v-if="cotCua(p.id)!.tv.length"><span v-for="m in cotCua(p.id)!.tv" :key="m.id" :class="{ 'vong-mau': !!m.mau }" :style="m.mau ? { '--m': m.mau } : undefined"><MatNguoi :mat="m.mat" :anh="m.anh" /></span></template>
              <span v-else :class="{ 'vong-mau': !!cotCua(p.id)!.mau }" :style="cotCua(p.id)!.mau ? { '--m': cotCua(p.id)!.mau } : undefined"><MatNguoi :mat="cotCua(p.id)!.mat" :anh="cotCua(p.id)!.anh" /></span>
            </span>
            <!-- Hoà thì hai người đầu cùng hạng 1, không phải 1 và 2 -->
            <span class="ten-dong">
              <span class="ten-kq">{{ draw && i < 2 ? 1 : i + 1 }}. {{ tenNguoi(p) }}</span>
            </span>
            <b>{{ num(p.score) }}</b>
            <!--
              Ai muốn chơi tiếp, ai đã đi: nhãn nằm trên DÒNG SỐ CẶP của chính người đó (11.11.2026).
              Trước đặt cạnh tên → tên + nhãn + điểm chen một hàng, "Nguyễn Hoàng Anh" bị ngắt dòng.
            -->
            <small>
              {{ timThe ? t('tt.ketQua', { n: p.pairs, tong: timThe, c: p.bestStreak }) : t('kq.capChuoi', { cap: p.pairs, chuoi: p.bestStreak }) }}
              <i v-if="rematchState?.[p.id] === 'in'" class="tag in">{{ t('kq.tag.choiLai') }}</i>
              <i v-else-if="rematchState?.[p.id] === 'out'" class="tag out">{{ t('kq.tag.daRoi') }}</i>
            </small>
            <!-- ĐỘI: điểm ở trên là của CẢ ĐỘI; dòng này là số cặp từng người tự ghép -->
            <small v-if="tenThanhVien && (p.thanhVien?.length ?? 0) > 1" class="cap-tv">
              {{ p.thanhVien!.map((m) => `${tenThanhVien![m] ?? '?'} ${p.capTV?.[m] ?? 0}`).join(' · ') }}
            </small>
          </li>
        </ol>
      </div>

      <p v-if="hienSao" class="stars" :aria-label="t('kq.saoAria', { n: summary.stars })">
        <Sao3D
          v-for="i in 3" :key="i"
          class="star" :loai="i <= shownStars ? 'sang' : 'tat'"
          :class="{ lit: i <= shownStars }"
        /><span
          v-if="summary.hoanHao" class="thu4" :class="{ hien: shownStars >= 4 }"
        ><i class="tia" aria-hidden="true" /><Sao3D class="star" loai="sao4" song /><i
          v-for="d in 5" :key="d" :class="`dom d${d}`" aria-hidden="true"
        >✦</i></span>
      </p>
      <!-- Mốc 3★ nói thẳng ra: 3★ cố ý khó (chủ dự án 14.10.2026), người chơi phải
           biết thiếu bao nhiêu mới có cái để phấn đấu -->
      <p v-if="hienSao && starMisses" class="sai-sao">
        <template v-if="summary.hoanHao">{{ t('kq.hoanHao') }}</template>
        <template v-else>
          {{ t('kq.quenN', { n: summary.ranking[0]?.quen ?? 0 }) }} ·
          <span class="nhom"><Sao3D v-for="k in Math.min(saoKe.sao, 3)" :key="k" /><Sao3D v-if="saoKe.sao === 4" loai="sao4" song /> {{ saoKe.txt }}</span>
        </template>
      </p>

      <!-- KHOE TỶ SỐ (19.11.2026, mockup duyệt https://claude.ai/artifact/11swqn2QDAce9P5GTBxAbz): trước là ô biểu
           tượng nhỏ ở góc trên, nhiều người không nhận ra là nút chia sẻ → nút vàng có chữ, cạnh "Chi tiết ván". -->
      <div v-if="loat" class="hang-ct" :class="{ doi: hienLcs }">
        <button
          class="nut-ct thach th-nho" type="button" aria-controls="kqChiTiet" :aria-expanded="moChiTiet"
          @click="moChiTiet = !moChiTiet"
        >{{ moChiTiet ? t('kq.thuGon') : t('kq.chiTiet') }}<ChevronDown :size="16" aria-hidden="true" /></button>
        <button v-if="hienLcs" class="nut-khoe thach th-vang th-nho" type="button" @click="moLcs = true; moChucNang('luu_chia_se_anh')">
          <Share :size="16" aria-hidden="true" />{{ t('kq.khoeTySo') }}
        </button>
      </div>

      <!-- Điểm là phần thưởng của cả ván: cho nó cỡ chữ xứng đáng và đếm dần lên -->
      <p v-if="!multiplayer" class="score-big" :aria-label="t('kq.diemAria', { n: summary.score })">
        <DongXu :size="26" />
        <b>{{ num(shownScore) }}</b>
        <small>{{ t('chung.diem') }}</small>
      </p>

      <dl v-if="!multiplayer && !triNho" class="stats">
        <div v-if="summary.timeBonus"><dt>{{ t('kq.thuongGio') }}</dt><dd>+{{ summary.timeBonus }}</dd></div>
        <div><dt>{{ timThe ? t('tt.dungNhan') : t('kq.soLuot') }}</dt><dd>{{ timThe ? `${summary.moves}/${timThe}` : summary.moves }}</dd></div>
        <div><dt>{{ t('kq.thoiGian') }}</dt><dd>{{ clock(summary.seconds) }}</dd></div>
        <div><dt>{{ t('kq.chuoiDai') }}</dt><dd>{{ summary.bestStreak }}</dd></div>
      </dl>
      <!-- CÓ ĐIỂM TRÍ NHỚ (thử nghiệm, debug): các chỉ số là MỘT BẢNG HÀNG — cột biểu tượng thẳng hàng bên trái,
           đường chấm dẫn mắt sang con số canh phải (chủ dự án 23.11.2026: "hiện thành hàng, có gì để dóng
           thẳng dễ nhìn"; bản thêm một ô rời bị chê "xấu và loạn"). Trí nhớ là hàng ĐẦU, tô xanh ngọc. -->
      <dl v-else-if="triNho" class="stats bang">
        <div class="h-tn">
          <ChartColumn :size="18" :stroke-width="2.4" aria-hidden="true" />
          <dt>{{ t('tn.ten') }}</dt>
          <i aria-hidden="true" />
          <dd v-if="triNho.van !== null">{{ num(triNho.van) }}</dd>
          <!-- "?" đứng SAU chữ "Chưa đủ để chấm", bấm mở POPUP giải thích (chủ dự án 25.11.2026) -->
          <dd v-else class="chua"><span>{{ t('tn.chuaDu') }}</span><button class="thach th-nho tn-hoi" type="button" :aria-label="t('tn.hoi')" aria-haspopup="dialog" @click="moGiaiThich = true; moChucNang('tri_nho_giai_thich', {}, true)">?</button></dd>
        </div>
        <template v-if="!multiplayer">
          <div v-if="summary.timeBonus"><Zap :size="18" :stroke-width="2.4" aria-hidden="true" /><dt>{{ t('kq.thuongGio') }}</dt><i aria-hidden="true" /><dd>+{{ summary.timeBonus }}</dd></div>
          <div><Pointer :size="18" :stroke-width="2.4" aria-hidden="true" /><dt>{{ timThe ? t('tt.dungNhan') : t('kq.soLuot') }}</dt><i aria-hidden="true" /><dd>{{ timThe ? `${summary.moves}/${timThe}` : summary.moves }}</dd></div>
          <div><Timer :size="18" :stroke-width="2.4" aria-hidden="true" /><dt>{{ t('kq.thoiGian') }}</dt><i aria-hidden="true" /><dd>{{ clock(summary.seconds) }}</dd></div>
          <div><Flame :size="18" :stroke-width="2.4" aria-hidden="true" /><dt>{{ t('kq.chuoiDai') }}</dt><i aria-hidden="true" /><dd>{{ summary.bestStreak }}</dd></div>
        </template>
      </dl>

      <!--
        MỘT HÀNG CHIP, chỉ tên, tối đa hai rồi "+N". Bản cũ in tên + mô tả từng
        dòng: một ván mở 4 danh hiệu là bảng cao quá iPhone SE và đẩy ba nút ra
        ngoài màn hình (đo bằng tools/do-menu-tren.mjs). Mô tả đã có ở dải khoe
        (MoKhoaToast) và màn Danh hiệu.
      -->
      <ul v-if="freshAchievements.length" class="achievements">
        <li v-for="id in freshAchievements.slice(0, 2)" :key="id"><IconVong ic="danhHieu" :size="24" /> {{ byId(id)?.name }}</li>
        <li v-if="freshAchievements.length > 2" class="them">{{ t('kq.themDanhHieu', { n: freshAchievements.length - 2 }) }}</li>
      </ul>
      <!-- Lời mời đi tiếp, ngay lúc người chơi còn hứng: một cú bấm là vào ván -->
      <div v-if="goiY" class="goi-y" :title="goiY.hint">
        <span class="txt"><IconVong ic="goiY" :size="24" class="gy-ic" /> <b>{{ goiY.name }}</b><small>{{ goiY.hint }}</small></span>
        <button class="di thach th-xanh th-nho" type="button" :aria-label="t('kq.chinhPhucAria', { ten: goiY.name })" @click="emit('chinh-phuc', goiY)">{{ t('kq.chinhPhuc') }}</button>
      </div>

      <!--
        Hàng trên: hai lối đi TIẾP, cạnh nhau, cùng nổi bật — chơi lại bên trái,
        cấp sau bên phải. "Về menu" xuống hàng dưới vì nó là lối RA, không phải
        lối tiếp; để chung một hàng thì ba nút ngang nhau, mắt không biết chọn gì.
      -->
      <button v-if="hienLcs && !loat" class="nut-lcs btn thach th-vang th-nho" type="button" @click="moLcs = true; moChucNang('luu_chia_se_anh')">
        <Share :size="18" aria-hidden="true" />{{ t('kq.luuChiaSe') }}
      </button>

      <!-- Hết người để chơi lại: nói thẳng (nút Chơi lại biến mất). Tiến độ chơi lại nay là HÀNG BIỂU TƯỢNG trong khung tỷ số. -->
      <p v-if="multiplayerOnline && khongDu" class="cl-dai roi" role="status"><LogOut :size="16" :stroke-width="2.5" class="ic-n" aria-hidden="true" /> {{ t('kq.cl.khongDu') }}</p>

      <div class="row">
        <button
          v-if="!rematchBlocked" ref="primary" class="btn btn-primary" :class="{ 'cl-sang': choiLai?.cuoi, 'cl-da': rematchSent && choiLai }" type="button"
          :disabled="rematchSent"
          @click="emit('replay')"
        >
          <template v-if="rematchSent">{{ t('kq.daBamChoiLai') }}</template>
          <!-- Mọi người khác đã bấm, chỉ còn mình: CHỈ thêm bàn tay nhỏ trước chữ. KHÔNG thêm dòng phụ / viền sáng — nút đổi chiều
               cao làm cả hàng nhảy, mà dải báo ở đầu màn đã nói "X đang chờ bạn" rồi (chủ dự án 23.11.2026). -->
          <template v-else><Hand v-if="choiLai?.cuoi" class="cl-ic" :size="18" :stroke-width="2.6" aria-hidden="true" />{{ replayLabel }}</template>
        </button>
        <!--
          Cấp sau CHƯA MỞ (thua, hoặc thua bot) thì nút vẫn ở đúng chỗ nhưng tắt
          màu và không bấm được — biến mất thì hai nút còn lại nhảy chỗ mỗi ván,
          mà người chơi cần cái nhìn ổn định để bấm theo phản xạ.
        -->
        <button
          v-if="showNext && !chungMay"
          class="btn btn-primary next-level" type="button"
          :disabled="!canNext"
          :title="canNext ? '' : t('kq.capChuaMo')"
          @click="canNext && emit('next')"
        >
          {{ t('kq.capTiep') }}
        </button>
      </div>
      <!--
        Phòng ONLINE: "Về phòng chờ" là lối ra MẶC ĐỊNH, không phải "Về menu".
        "Chơi lại" cần MỌI người còn kết nối cùng bấm, nên khi đối phương thoát
        giữa chừng thì nó không bao giờ đủ phiếu — trước đây người ở lại chỉ còn
        đường về menu, và thế là mất phòng, phải tạo mã mới mời lại từ đầu.
      -->
      <!--
        HẾT VÁN ONLINE (07.11.2026, chủ dự án duyệt mockup https://claude.ai/artifact/6Yh26Beir4CtZj6ddSbRW9):
        "Về phòng chờ" + "Chỉnh bàn" chung một hàng; "Chỉnh bàn" mở đúng ba bước của nút
        "Chỉnh" ở phòng chờ (cùng icon). Chỉ chủ phòng bấm được — server cũng chặn.
      -->
      <div v-if="multiplayerOnline && !thiDau" class="row hang-phu">
        <button class="btn to-lobby" type="button" @click="emit('lobby')">
          {{ t('kq.vePhongCho') }}
        </button>
        <button
          class="btn chinh-ban" type="button" :disabled="!laChuPhong"
          :title="laChuPhong ? '' : t('kq.chiChuPhongChinh')"
          @click="laChuPhong && emit('chinh')"
        ><Settings2 :size="17" /> {{ t('kq.chinhBan') }}</button>
      </div>
      <!--
        Ván offline: "Đổi bàn" về thẳng bước chọn cỡ bàn — người vừa chơi xong
        thường muốn đổi cỡ, ít khi muốn về tận màn đầu (chủ dự án duyệt
        11.10.2026). Online giữ "Về menu": ở đó không có bước chọn bàn.
      -->
      <button v-if="multiplayerOnline" class="btn link thoat" type="button" @click="emit('menu')">{{ t('kq.thoatPhong') }}</button>
      <!-- Chung máy (mockup 17.11.2026): MỘT nút xanh "Chơi lại"; "Cấp tiếp theo" và "Đổi bàn" là
           hai nút thạch trắng ngang nhau — hai nút xanh cạnh nhau là "nhiều màu", mắt không biết chọn gì -->
      <div v-else-if="chungMay" class="row hang-phu">
        <button
          v-if="showNext" class="btn next-level" type="button" :disabled="!canNext"
          :title="canNext ? '' : t('kq.capChuaMo')" @click="canNext && emit('next')"
        >{{ t('kq.capTiep') }}</button>
        <button class="btn" type="button" @click="emit('doi-ban')">{{ t('kq.doiBan') }}</button>
      </div>
      <button v-else class="btn link" type="button" @click="emit('doi-ban')">{{ t('kq.doiBan') }}</button>
      <!--
        Chỉ còn MỘT dòng ở đây: "đang chờ ai" và "ai muốn chơi lại" đã chuyển
        thành nhãn cạnh tên trong bảng xếp hạng (đọc ở đúng chỗ mắt đang nhìn).
        Dòng này giữ lại vì nó giải thích chuyện KHÔNG thấy được ở bảng: vì sao
        nút "Chơi lại" biến mất.
      -->
      <p v-if="rematchBlocked && !multiplayerOnline" class="waiting" role="status">
        <LogOut :size="16" :stroke-width="2.5" class="ic-n" aria-hidden="true" /> {{ t('kq.doiThuRoi') }}
      </p>

    </div>
    <!-- Teleport ra body: nằm trong lớp phủ kết quả (z 17) thì z-index 40 của nó chỉ tính TRONG lớp đó, thanh emoji (z 18 ở
         #app) đè lên hai nút Lưu ảnh / Chia sẻ (chủ dự án gửi ảnh 25.11.2026). -->
    <Teleport to="body"><LuuChiaSe v-if="moLcs" :noi-dung="noiDungAnh" @close="moLcs = false" /></Teleport>
    <Teleport to="body">
      <div v-if="moGiaiThich" class="tn-phu" role="dialog" aria-modal="true" :aria-label="t('tn.ten')" @click.self="moGiaiThich = false" @keydown.esc="moGiaiThich = false">
        <div class="panel tn-hop">
          <h2><ChartColumn :size="20" :stroke-width="2.4" aria-hidden="true" />{{ t('tn.ten') }}</h2>
          <p>{{ t('tn.giaiThich', { n: MOC_CO_DIEM_VAN }) }}</p>
          <button v-focus class="btn btn-primary" type="button" @click="moGiaiThich = false">{{ t('cai.daHieu') }}</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.waiting {
  margin: 10px 0 0; text-align: center; color: var(--muted);
  font-size: var(--text-sm);
}
/* Lời mời chơi lại: nổi hơn dòng "đang chờ", vì đây là việc CẦN người đọc làm gì */
.waiting.want { color: var(--accent); font-weight: 700; }
/* CHƠI LẠI (online, 19.11.2026) — chip dưới cột, thanh tiến độ, nút theo trạng thái */
.cl-ic {
  margin-top: 8px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  font-size: 15px; line-height: 1; border: 2px solid; box-sizing: border-box;
}
.cl-ic.ok { background: linear-gradient(#78d35a, #4bb033); border-color: #3c9a26; color: #fff; box-shadow: 0 2px 0 #348a20; }
.cl-ic.cho { background: #fff3e2; border-color: #f0b46a; color: #d27a12; }
/* Đang chờ: ba chấm nhảy như "đang gõ…" (chủ dự án chọn 19.11.2026) */
.cham { display: flex; gap: 2.5px; }
.cham i { width: 4.5px; height: 4.5px; border-radius: 50%; background: currentColor; animation: cham-nay 1.2s infinite ease-in-out; }
.cham i:nth-child(2) { animation-delay: .15s; }
.cham i:nth-child(3) { animation-delay: .3s; }
@keyframes cham-nay { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .cham i { animation: none; opacity: .8; } }
.cl-ic.roi { background: #f1f3f8; border-color: #c3cadb; }
.cl-dai {
  margin: 12px 0 0; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 16px;
  background: var(--panel-soft); border: 2px solid var(--line);
}
.cl-dai.roi { display: block; text-align: center; font-weight: 800; font-size: var(--text-sm); color: #33405f; background: #f1f3f8; border-color: #b9c2d6; }
.btn-primary .cl-ic { vertical-align: -3px; margin-right: 7px; }
.btn-primary.cl-da:disabled { opacity: 1; --nhan-nen: #e9f8e3; --nhan-chu: #185c2a; border: 2px solid #7cc65f; }
:root[data-skin='keo'] .btn-primary.cl-da:disabled { --b1: #f1fbec; --b2: #e3f7da; --b3: #9fd487; --b4: #f1fbec; --bc: #185c2a; --th-chu: none; }
.overlay {
  /* 17: TRÊN thanh trên cùng (15) và cảnh kết ván (16) — xem chuỗi lớp ở styles/ketcuc-fx.css */
  position: fixed; inset: 0; z-index: 17; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .3);   /* nền nhạt để thấy pháo hoa phía sau */
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
/* Online: thanh emoji cố định ở đáy (EmojiDock, z 18) — chừa chỗ để hộp không chui dưới thanh */
.overlay.co-dock { padding-bottom: calc(20px + var(--eb-dock-h, 42px) + env(safe-area-inset-bottom, 0px) - var(--eb-lun, 0px)); }
.panel {
  width: 100%; max-width: 400px; position: relative;
  /* Bán trong suốt + blur: nhìn xuyên được màn ăn mừng phía sau */
  background: color-mix(in srgb, var(--panel-solid) 78%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: dialog-in .3s cubic-bezier(.3, 1.4, .5, 1);
}
@keyframes dialog-in { from { transform: translateY(18px) scale(.94); opacity: 0; } }
h2 { margin: 0 0 4px; }
.reason { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
.stars { margin: 0 0 12px; font-size: 32px; line-height: 1.15; }
.stars .star { margin: 0 3px; }
.stars:has(+ .sai-sao) { margin-bottom: 2px; }
.sai-sao { margin: 0 0 12px; font-size: 13px; color: var(--muted); }
.sai-sao .nhom { white-space: nowrap; }
/* Ngôi thứ 4: nở to hơn, xoay một vòng nhẹ, rồi lấp lánh mãi */
/*
 * NGÔI THỨ 4 TOẢ SÁNG (chủ dự án 14.10.2026: "thật nổi bật… lấp lánh"): to hơn
 * ba ngôi kia, tia sáng xoay sau lưng, vệt sáng lướt mặt (.song ở global.css)
 * và năm đốm ✦ nhấp nháy lệch nhịp quanh nó.
 */
/* To hơn bằng `scale` (thuộc tính riêng, không đụng `transform` của animation vào)
   chứ KHÔNG bằng font-size: font-size làm hàng sao cao lên, mà bảng trên iPhone
   SE chỉ còn dư 2px (đo 14.10.2026). scale chỉ phóng phần vẽ, không chiếm chỗ. */
.thu4 { position: relative; display: inline-block; isolation: isolate; line-height: 1;
  scale: 1.6; margin: 0 .2em 0 .35em; opacity: 0; transform: scale(.3); }
.thu4.hien { opacity: 1; transform: none; animation: sao4-in .8s cubic-bezier(.3, 1.8, .5, 1); }
.thu4 .tia {
  position: absolute; inset: -62%; z-index: -1; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(rgba(255, 214, 120, .55) 0deg 9deg, transparent 9deg 30deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%);
  animation: tia-xoay 7s linear infinite;
}
.thu4 .dom {
  position: absolute; font-style: normal; font-size: .38em; color: #fff; pointer-events: none;
  text-shadow: 0 0 4px #ff8ad8, 0 0 8px #a259ff; opacity: 0; animation: dom-lap 1.6s ease-in-out infinite;
}
.thu4 .d1 { top: -18%; left: -22%; animation-delay: .1s; }
.thu4 .d2 { top: -30%; right: -18%; animation-delay: .6s; font-size: .3em; }
.thu4 .d3 { bottom: -10%; right: -30%; animation-delay: 1.1s; }
.thu4 .d4 { bottom: -22%; left: -10%; animation-delay: .85s; font-size: .28em; }
.thu4 .d5 { top: 30%; left: -42%; animation-delay: 1.35s; font-size: .25em; }
@keyframes sao4-in { 0% { transform: scale(.3) rotate(-120deg); } 60% { transform: scale(1.6) rotate(12deg); } 100% { transform: none; } }
@keyframes tia-xoay { to { transform: rotate(360deg); } }
@keyframes dom-lap { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .thu4.hien, .thu4 .tia, .thu4 .dom { animation: none; } .thu4 .dom { opacity: .8; } }
.star.lit {
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--gold) 60%, transparent));
  animation: star-in .45s cubic-bezier(.3, 1.8, .5, 1);
}
@keyframes star-in {
  0% { transform: scale(.2) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.35) rotate(8deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/*
 * BẢNG TỶ SỐ LOẠT (mockup duyệt 17.11.2026). MỘT màu nhấn duy nhất là viên "+1" vàng, hiện một
 * nhịp rồi tắt; mọi số màu --fg (không làm mờ người kém, 19.11.2026). Khay theo token skin
 * nên bản tối tự tối theo — bảng tím cũ giữ màu sáng ở bản tối, chói (chủ dự án báo).
 * Cỡ mặt/số theo số cột (--n): 2 cột to nhất. `min-height` chung với bảng chi tiết để lật qua
 * lại bảng không co giật.
 */
.nhieu-nguoi h2 { text-align: center; }
.dau-kq { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin: -4px 0 2px; }
.dau-kq small {
  font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
}
/* Chi tiết ván | Khoe tỷ số: hai nút cùng cỡ cạnh nhau; không chia sẻ được ảnh thì chỉ còn nút giữa */
.hang-ct { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
.hang-ct.doi { display: grid; grid-template-columns: 1fr 1fr; }
/* Bảng chỉ số đứng NGAY SAU hàng nút (ván nhiều người): phải có khe — nút thạch có gờ nổi 4–5px phía dưới, sát nhau là
   gờ đè lên viền bảng (chủ dự án gửi ảnh 25.11.2026). */
.hang-ct ~ .stats.bang { margin-top: 14px; }
.hang-ct .nut-ct { margin: 0; }
.hang-ct.doi .nut-ct { justify-content: center; padding: 0 10px; }
.nut-khoe {
  display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 10px;
  border-radius: 999px; font: 700 15px/1.1 var(--font-display); cursor: pointer; text-align: center; /* tiếng Nga/Đức dài: xuống dòng, không tràn */
}
.lat.chong { display: grid; margin: 10px 0 0; }
.lat.chong > * { grid-area: 1 / 1; min-height: 196px; box-sizing: border-box; margin: 0; }
.lat.chong > .an { visibility: hidden; }
.loat {
  --mat: calc(88px / var(--n) + 12px); --so: calc(128px / var(--n) + 22px);
  display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); align-content: center;
  gap: 4px; padding: 16px 8px 14px; border-radius: 18px;
}
.cot { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
.cot.ra { opacity: .45; }
/* Hàng mặt CAO CỐ ĐỊNH (19.11.2026, chủ dự án gửi ảnh 4 người "giao diện bị vỡ"): mặt SVG (báo đen,
   rồng vàng) cao hơn emoji vài px → cả cột đó tụt xuống, số và biểu tượng chơi lại lệch hàng. */
.xep { display: flex; justify-content: center; align-items: center; height: calc(var(--mat) * 1.2); overflow: visible; }
.xep .mat { position: relative; font-size: var(--mat); line-height: 1; }
.xep .mat + .mat { margin-left: calc(var(--mat) * -.35); }
/* Có Ô MÀU hồ sơ (`.vong-mau`, global.css — ô = 1,7em): thu chữ lại để cả ô vừa đúng chiều cao hàng (1,2 × --mat), không
   thì ô tràn xuống che TÊN người chơi (soát ảnh 25.11.2026). Hai thành viên đội đứng cạnh nhau, không chồng ô lên nhau. */
.xep .mat.vong-mau { font-size: calc(var(--mat) * .68); }
/* Ô màu cao gần kín hàng → tên dính sát đáy ô (chủ dự án gửi ảnh 25.11.2026: "chữ sát avatar quá"): chừa khoảng thở. */
.cot:has(.vong-mau) .xep { margin-bottom: 7px; }
.xep .mat.vong-mau + .mat.vong-mau { margin-left: calc(var(--mat) * .56); }
/* Dấu ✓ trên mặt đã BỎ (19.11.2026, chủ dự án: "thừa") — hàng biểu tượng chơi lại dưới tỷ số nói thay */
.cot .ten {
  max-width: 100%; font-family: var(--font-display); font-weight: 700; font-size: 15px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  /* KHỐI thường, không flex: flex căn giữa làm tên dài bị cắt CẢ HAI ĐẦU ("ot báo đe") và không ra "…" */
  display: block; text-align: center;
}
.loat.chat .ten { font-size: 13.5px; }
.loat.chat .dm { font-size: 12px; }
.loat.rat-chat .ten { font-size: 12.5px; }
.loat.rat-chat .dm { font-size: 11px; letter-spacing: -.2px; }
.ten.chay {
  text-overflow: clip; text-align: left;
  /* hai mép mờ dần: thấy rõ là chữ đang chạy, không phải bị cắt */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 6px, #000 calc(100% - 6px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 6px, #000 calc(100% - 6px), transparent);
}
.ten.chay .chu-ten { display: inline-block; padding: 0 2px; animation: chay-ten var(--tg, 5s) ease-in-out 1.2s infinite alternate; }
@keyframes chay-ten { 0%, 18% { transform: none; } 82%, 100% { transform: translateX(var(--lech)); } }
@media (prefers-reduced-motion: reduce) {
  .ten.chay { text-overflow: ellipsis; -webkit-mask-image: none; mask-image: none; }
  .ten.chay .chu-ten { display: inline; animation: none; }
}
.cot .tv, .cot .dm {
  max-width: 100%; font-size: 12.5px; font-weight: 700; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cot .dm { font-size: 13.5px; }
/* Đội: chấm màu như thanh đội trong ván (TeamStrip) */
.d1 { --mau: #ff8a3d; } .d2 { --mau: #3d9bff; } .d3 { --mau: #3fbf6b; } .d4 { --mau: #a66bff; }
.doi .ten::before { content: ''; display: inline-block; vertical-align: middle; width: 9px; height: 9px; margin: -2px 5px 0 0; border-radius: 50%; background: var(--mau); }
.so {
  height: var(--so); margin-top: 4px; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 800; font-size: var(--so); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.o-so { position: relative; display: inline-block; line-height: 1; }
.o-so b { display: inline-block; font: inherit; color: var(--fg); }
/*
 * NGƯỜI THẮNG VÁN (19.11.2026, chủ dự án: "+1 mờ nhạt quá… cho con số xoay 0→1, 1→2, có âm thanh, màu
 * nổi bật"): số CUỘN như đồng hồ lật — số cũ (`data-cu`, vẽ bằng ::before ngay trên) trượt lên khỏi
 * khung, số mới từ dưới lên — rồi chuyển vàng cam có quầng sáng và GIỮ màu đó. Bỏ viên "+1" (chủ dự án: số cuộn
 * lên là đủ nói rồi).
 * Tiếng: `MOC_CUON` trong script phải khớp delay 1s ở đây. Text của <b> vẫn chỉ là số MỚI (đọc màn hình, test).
 */
.khung-so { display: inline-block; overflow: hidden; padding: .08em .12em; margin: -.08em -.12em; }
.khung-so.nay { animation: nay .45s 1.45s both; }
.o-so b.cuon { position: relative; animation: cuon .55s 1s cubic-bezier(.3, 1.45, .5, 1) both, vang .4s 1.2s both; }
.o-so b.cuon::before { content: attr(data-cu); position: absolute; left: 0; right: 0; top: -1.16em; color: var(--muted); }
@keyframes cuon { from { transform: translateY(1.16em); } to { transform: none; } }
@keyframes vang { to { color: #f29b00; text-shadow: 0 0 14px rgba(255, 183, 3, .55), 0 2px 0 #c77700; } }
@keyframes nay { 40% { transform: scale(1.3); } }
@media (prefers-reduced-motion: reduce) {
  .khung-so.nay { animation: none; }
  .o-so b.cuon { animation: vang 0s both; }
  .o-so b.cuon::before { content: none; }
}
.nut-ct {
  /* position: relative BẮT BUỘC (18.11.2026): thiếu nó thì ::after nới vùng chạm bên dưới bám vào CẢ
     bảng kết quả và trùm lên mọi nút — người chơi online bấm "Chơi lại" lại thành bấm "Chi tiết ván". */
  position: relative;
  display: flex; align-items: center; gap: 6px; margin: 10px auto 0; min-height: 40px; padding: 0 16px;
  border-radius: 999px; font: 700 15px var(--font-display); color: var(--fg); cursor: pointer;
}
.nut-ct svg { transition: transform .2s; }
.nut-ct[aria-expanded='true'] svg { transform: rotate(180deg); }
.nut-ct::after { content: ''; position: absolute; inset: -4px 0; }

/* Điểm tổng: con số lớn nhất trong dialog, có nền sáng và ngôi sao dẫn */
.score-big {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 4px 0 12px; padding: 10px 16px;
  border-radius: var(--r-md);
  background: linear-gradient(150deg,
    color-mix(in srgb, var(--gold) 16%, transparent),
    color-mix(in srgb, var(--accent) 12%, transparent));
  animation: score-in .45s cubic-bezier(.3, 1.5, .5, 1);
}
.score-big .dong-xu {
  filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--gold) 55%, transparent));
}
.score-big b {
  font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-2xl); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.score-big small { color: var(--muted); font-size: var(--text-sm); font-weight: 700; }
@keyframes score-in { from { opacity: 0; transform: scale(.86); } }

/* BẢNG HÀNG chỉ số: [biểu tượng 18px] [nhãn] [đường chấm] [số canh phải] — mọi hàng cùng lưới nên thẳng cột */
.stats.bang {
  gap: 0; padding: 2px 12px; border-radius: 14px;
  background: color-mix(in srgb, var(--fg) 4%, transparent); border: 1px solid var(--line);
}
.stats.bang div {
  display: grid; grid-template-columns: 18px auto minmax(12px, 1fr) auto; align-items: center; gap: 8px;
  min-height: 34px; border-top: 1px solid var(--line);
}
.stats.bang div:first-child { border-top: 0; }
.stats.bang svg { color: var(--muted); }
.stats.bang i { align-self: end; margin-bottom: 11px; border-bottom: 2px dotted color-mix(in srgb, var(--muted) 45%, transparent); }
.stats.bang dt { font-size: 14px; white-space: nowrap; }
.stats.bang dd { font-size: 16px; font-weight: 800; text-align: right; white-space: nowrap; }
.stats.bang dd small { margin-right: 8px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.stats.bang dd.chua { font-size: 13px; font-weight: 700; color: var(--muted); }
.stats.bang .h-tn svg, .stats.bang .h-tn dt, .stats.bang .h-tn dd { color: #0b7468; }
.stats.bang .h-tn dt { font-weight: 800; }
/* Nút THẠCH nhỏ tròn (luật dự án: không nút phẳng mới) */
.tn-hoi.thach {
  display: inline-grid; place-items: center; width: 24px; min-width: 24px; height: 24px; min-height: 0; margin-left: 7px; padding: 0; border-radius: 50%;
  font: 900 13px/1 var(--font-body); position: relative;
}
.tn-hoi::after { content: ""; position: absolute; inset: -10px; }   /* vùng chạm ≥ 40px */
.stats.bang .h-tn dd.chua { display: flex; align-items: center; justify-content: flex-end; white-space: normal; line-height: 1.2; padding-block: 4px; }
.tn-hoi { flex: none; }
/* TÊN không bao giờ bị cắt khi chưa đủ chấm (ảnh soát 25.11.2026: "Chỉ số trí n…"): chữ "Chưa đủ để chấm" bên phải mới là
   thứ nhường chỗ — xuống hai dòng ở máy hẹp / ngôn ngữ dài. Đặt :has() để thắng luật co nhãn bên dưới. */
.stats.bang .h-tn:has(dd.chua) { grid-template-columns: 18px auto minmax(0, 1fr) minmax(0, auto); }
.stats.bang .h-tn:has(dd.chua) dt { overflow: visible; }
.stats.bang .h-tn dd.chua span { min-width: 0; }
/* Popup giải thích — Teleport ra body, cùng lý do với LuuChiaSe (lớp phủ kết quả chỉ z 17) */
.tn-phu {
  position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  padding: calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px)); background: rgba(6, 9, 18, .62);
}
.tn-hop { width: 100%; max-width: 360px; }
.tn-hop h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: var(--text-xl); }
.tn-hop p { margin: 0 0 18px; color: var(--muted); font-size: var(--text-md); line-height: 1.5; }
.tn-hop .btn { width: 100%; min-height: 48px; margin: 0; }
/* Dòng trí nhớ có thể DÀI ("Lên bậc Bạch kim!" + "740 ▲ 347"): nhãn phải CO được (ellipsis) — không thì cả bảng nở quá
   khung và mọi con số bên phải dính/tràn mép (soát ảnh 25.11.2026). Đường chấm nhường chỗ trước. */
.stats.bang .h-tn { grid-template-columns: 18px minmax(0, auto) minmax(0, 1fr) auto; }
.stats.bang .h-tn dt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ky-luc { margin-left: 6px; padding: 2px 7px; border-radius: 999px; background: #ffd36b; color: #6b4a00; font: 900 10.5px/1.3 var(--font-body); font-style: normal; vertical-align: 1px; }
:global([data-theme='dark'] .stats.bang .h-tn svg), :global([data-theme='dark'] .stats.bang .h-tn dt),
:global([data-theme='dark'] .stats.bang .h-tn dd) { color: #6fe0d0; }
.stats { margin: 0; display: grid; gap: 6px; }
.stats div { display: flex; justify-content: space-between; gap: 12px; }
.stats dt { color: var(--muted); font-size: 14px; }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }

/* Bảng xếp hạng ván. Có bảng tỷ số thì đây là mặt "Chi tiết ván" (khay chung, mỗi người một
   dòng kẻ ngăn, không khay vàng/xanh — một màu nhấn thôi); không có thì hiện thẳng như cũ. */
.ranking { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.ranking.khay-nho { gap: 0; align-content: center; padding: 6px 14px; border-radius: 18px; }
.nut-lcs {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 12px auto 0; padding: 8px 20px; min-height: 44px; width: auto; font-size: var(--text-md, 16px);
}
.ranking li {
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 2px 10px;
  padding: 8px 12px; border-radius: var(--r-md);
  background: var(--panel-soft);
}
.ranking.khay-nho li {
  grid-template-columns: auto minmax(0, 1fr) auto; align-items: center;
  padding: 9px 0; border-radius: 0; background: none; border-bottom: 1px solid var(--line);
}
.ranking.khay-nho li:last-child { border-bottom: 0; }
.mat-ct { grid-row: span 2; display: flex; font-size: 28px; line-height: 1; }
.mat-ct span + span { margin-left: -10px; }
.mat-ct span.vong-mau { font-size: 19px; margin: 0 7px; align-self: center; }
.mat-ct span.vong-mau + span.vong-mau { margin-left: 12px; }
.ranking li > .ten-dong {
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg);
  /* Một dòng, dài quá thì "…" — tên đầy đủ đã thấy ở phòng chờ */
  min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ranking.khay-nho li > .ten-dong { font-size: 16px; }
.ranking li b {
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}
.ranking.khay-nho li b { font-size: 20px; grid-row: span 2; }
.ranking.khay-nho li:not(:first-child) b { color: var(--muted); }
.ranking small {
  grid-column: 1 / -1; color: var(--muted); font-size: var(--text-sm);
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px;
}
.ranking.khay-nho small { grid-column: 2; font-size: 12.5px; font-weight: 700; }
/* Nhãn "Chơi tiếp" / "Đã thoát": nhỏ, không in nghiêng (dùng <i> cho gọn thẻ). */
.ranking .tag {
  font-style: normal; white-space: nowrap;
  font-family: var(--font-body); font-weight: 700; font-size: var(--text-xs);
  padding: 2px 8px; border-radius: var(--r-full);
}
/* Xanh --ok-solid chứ không phải --ok: chữ nhỏ 700 trên nền mờ, --ok chỉ đạt ~3,2:1. */
.ranking .tag.in { color: var(--ok-solid); background: color-mix(in srgb, var(--ok) 16%, transparent); }
.ranking .tag.out { color: var(--muted); background: color-mix(in srgb, var(--muted) 14%, transparent); }
/*
 * BẢNG KẾT QUẢ ONLINE THOÁNG HƠN (09.11.2026): khối điểm · nhóm nút · thanh emoji cách nhau rõ.
 * Chỉ khi màn đủ cao — màn thấp (≤700px, iPhone SE/14) vẫn dùng bản gọn ở cuối file, không
 * thì nút cuối lòi khỏi màn (`tools/do-menu-tren.mjs` canh).
 */
@media (min-height: 701px) {
  .kq-online .ranking:not(.khay-nho) { gap: 12px; }
  .kq-online .ranking:not(.khay-nho) li { padding: 12px 14px; }
  .kq-online .row { margin-top: 22px; gap: 12px; }
  .kq-online .row.hang-phu { margin-top: 12px; }
  .kq-online .link.thoat { margin-top: 12px; }
}

.achievements { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.achievements li {
  padding: 4px 10px; border-radius: 999px; font-weight: 800; white-space: nowrap;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis;
  background: linear-gradient(135deg, #ffd76a, #f0a500); color: #4a2f00;
}
.achievements li.them { background: color-mix(in srgb, var(--warn) 18%, transparent); color: inherit; }

/* MỘT DÒNG (chủ dự án 23.11.2026: ô hai-ba dòng "tốn diện tích quá"): chỉ tên danh hiệu + nút. Lời mô tả
   bỏ khỏi bảng này — nó có ở tooltip, màn Danh hiệu và ngay trong ván khi bấm Chinh phục. */
.goi-y {
  display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 4px 5px 4px 10px;
  border-radius: 10px; background: color-mix(in srgb, var(--accent) 12%, transparent); font-size: 13px;
}
.goi-y .txt { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.goi-y .txt b { overflow: hidden; text-overflow: ellipsis; }
.goi-y small { display: none; }
.goi-y .di {
  position: relative; flex: 0 0 auto; min-height: 34px; padding: 0 12px; border-radius: 999px; border: 0;
  background: var(--nhan-nen); color: var(--nhan-chu);
  font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
}
.goi-y .di::after { content: ''; position: absolute; inset: -6px -4px; }
.row { display: flex; gap: 8px; margin-top: 18px; }
.row .btn { flex: 1; }
.row .btn-primary { margin: 0; }
/* Cấp sau chưa mở: xám hẳn, không gradient — nhìn là biết chưa bấm được */
.row .btn-primary:disabled {
  background: var(--line); color: var(--muted);
  box-shadow: none; cursor: not-allowed; opacity: 1;
}
/* Nút này đứng MỘT MÌNH ngoài `.row`, nên không hưởng `flex: 1` của hàng trên:
   thiếu bề rộng riêng là nó co vào vừa chữ và nằm lệch trái, trong khi "Chơi
   lại" và "Về menu" trên dưới nó đều kéo hết bề ngang. */
.to-lobby { display: block; width: 100%; margin-top: 8px; }
/* Hàng phụ online: hai nút chia đôi, sát hàng "Chơi lại" như nút Về phòng chờ cũ */
.row.hang-phu { margin-top: 8px; }
.row.hang-phu .btn { margin: 0; }
.chinh-ban { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.chinh-ban:disabled { opacity: .45; cursor: not-allowed; }
/* Thoát phòng: lối RA, chữ đỏ để không bấm nhầm thay cho "Về phòng chờ" — vẫn hỏi lại */
/* Skin Kẹo tô chữ nút bằng `--bc` (!important) — đặt biến, không đặt `color` trần */
.link.thoat { --bc: var(--bad); color: var(--bad); font-weight: 800; }
.link { width: 100%; margin-top: 8px; border: 0; background: transparent; color: var(--muted); font-size: 13px; }

/*
 * MÀN THẤP (iPhone SE: vùng web 553px). Đo thật: bảng cao 633px — kể cả trước
 * khi có dòng gợi ý danh hiệu đã là ~537px > 513px chỗ trống, tiêu đề bị cắt
 * mất. Gọn MỌI phần thay vì bỏ một phần: sao, khối điểm, bảng số liệu xếp hai
 * cột, gợi ý chỉ giữ tên. Khối này PHẢI đứng cuối file để thắng các rule trên.
 * tools/do-menu-tren.mjs canh mọi nút nằm trong màn hình ở ba cỡ máy.
 * Ngưỡng 700 chứ không 640: bảng Chiến dịch (nút hai dòng + gợi ý) trên iPhone 14
 * (664px) đo được đáy 682px — nút "Đổi bàn" lòi khỏi màn (14.10.2026).
 */
@media (max-height: 700px) {
  .overlay { padding: calc(10px + env(safe-area-inset-top, 0px)) 10px calc(10px + env(safe-area-inset-bottom, 0px)); }
  .overlay.co-dock { padding-bottom: calc(14px + var(--eb-dock-h, 42px) + env(safe-area-inset-bottom, 0px) - var(--eb-lun, 0px)); }
  .panel { padding: 14px 16px; }
  h2 { font-size: var(--text-lg); }
  .reason { margin-bottom: 6px; font-size: 13px; }
  .stars { margin-bottom: 4px; font-size: 24px; }
  .stars:has(+ .sai-sao) { margin-bottom: 0; }
  .stars { line-height: 1.1; }
  .sai-sao { margin-bottom: 4px; font-size: 12px; }
  .score-big { margin: 2px 0 6px; padding: 6px 12px; }
  .score-big b { font-size: var(--text-xl); }
  .stats { grid-template-columns: 1fr 1fr; gap: 4px 14px; }
  .stats dt, .stats dd { font-size: 13px; }
  .achievements { margin-top: 8px; }
  .goi-y { margin-top: 6px; }
  .row { margin-top: 10px; }
  .row .btn, .row .btn-primary { min-height: 46px; }
  /* Bảng tỷ số loạt: thấp hơn, vẫn là con số to nhất sau tiêu đề */
  .lat.chong { margin-top: 6px; }
  .lat.chong > * { min-height: 0; }
  .loat { --mat: calc(64px / var(--n) + 10px); --so: calc(96px / var(--n) + 18px); padding: 10px 6px; }
  .dau-kq { min-height: 40px; }
  .hang-ct { margin-top: 6px; }
  .nut-ct, .nut-khoe { min-height: 36px; }
}
.ic-n { vertical-align: -3px; }
</style>
