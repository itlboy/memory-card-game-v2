<script setup lang="ts">
import { moChucNang } from '@/lib/phan-tich';
import { tenNguoi } from '@/lib/ten';
import { tySoLoat } from '@/lib/ty-so-loat';
import MatNguoi from './MatNguoi.vue';
import { t, td, bcp } from '@/lib/i18n';
import { isDraw } from '@mm/engine';
import type { PlayerInit, Summary } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { byId, type Achievement } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { clock, num } from '@/lib/format';
import DongXu from './DongXu.vue';
import Sao3D from './Sao3D.vue';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';
import { ChevronDown, Settings2, Share } from 'lucide-vue-next';
import LuuChiaSe from './LuuChiaSe.vue';
import { coChiaSeAnh, type NoiDungAnh } from '@/lib/anh-ket-qua';
import { SITE_URL } from '@/lib/native';

const props = defineProps<{
  summary: Summary;
  /** Số lần sai tối đa cho 2★/3★ (Chiến dịch) — có thì hiện mốc 3★ dưới hàng sao. */
  starMisses?: readonly [number, number];
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
  /** Ván online: mình đã bấm chơi lại chưa. Nút đổi thành trạng thái chờ —
   *  trước đây bấm xong nút y nguyên nên người chơi tưởng nút không ăn. */
  rematchSent?: boolean;
  /** Không còn đủ người kết nối để chơi lại — ẩn nút thay vì để bấm vô nghĩa. */
  rematchBlocked?: boolean;
  /**
   * Trạng thái chơi lại của TỪNG người, tra theo id: 'in' = đã bấm chơi tiếp,
   * 'out' = đã rời phòng. Không có tên trong map = chưa bấm, không gắn nhãn.
   *
   * Tra theo ID chứ không theo tên: hai người trùng tên là chuyện có thật, mà
   * dòng thông báo cũ đã bỏ chỉ có TÊN nên không phân biệt được ai với ai.
   */
  rematchState?: Record<string, 'in' | 'out'>;
  /**
   * Kết cục của CHÍNH người cầm máy — chỉ truyền khi có một "mình" rõ ràng (đấu
   * máy, online). Có nó thì tiêu đề nói "Bạn thắng/thua", không nói tên người
   * thắng: người chơi muốn biết MÌNH ra sao (chủ dự án báo 13.10.2026, ảnh "Bot
   * gà cứng thắng! 🏆" kèm ba sao khi chính họ thua). Nhiều người chung một máy
   * thì KHÔNG truyền — ai cũng là người thật, nêu tên người thắng mới đúng.
   * `summary.status === 'won'` chỉ nói BÀN ĐÃ SẠCH, không nói ai thắng (CLAUDE.md).
   */
  minhKetCuc?: LoaiKetCuc;
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

/**
 * "Bạn đã mở hết các cặp!" chỉ đúng khi chơi MỘT MÌNH. Ván thi đấu mà bàn do đối
 * thủ dọn thì câu đó thành sai sự thật — đã thấy thật: dòng trên ghi "Bot siêu
 * đẳng thắng!", dòng dưới lại khen người chơi mở hết cặp.
 */
const reasonText = computed(() =>
  props.multiplayer && props.summary.reason === 'cleared'
    ? t('kq.banSach')
    : td(`kq.ly.${props.summary.reason}`));

/*
 * BẢNG KẾT QUẢ NHIỀU NGƯỜI = TỶ SỐ LOẠT (17.11.2026, mockup duyệt
 * https://claude.ai/artifact/NTXzpWotaUaPTG96MQxNLi — thay bảng tím 16.11.2026).
 * Mỗi người/đội một cột theo CHỖ NGỒI (cột không nhảy chỗ giữa các ván): mặt, tên, MỘT con số to
 * = số ván thắng cả loạt, điểm ván là chữ nhỏ. Người vừa thắng ván có viên "+1" nảy lên. Người
 * dẫn số đậm, người kém số mờ — KHÔNG ô màu (chủ dự án: "nhiều màu sắc quá"); cả bàn bằng nhau thì
 * không ai mờ. Bỏ chữ "Tỷ số" ("ai cũng biết"). Số cặp/chuỗi ẩn sau nút "Chi tiết ván".
 * Hiện NGAY TỪ VÁN ĐẦU (1 – 0), cùng luật `tySoLoat` với viên số trong bàn chơi.
 */
const loat = computed(() => {
  if (!props.multiplayer || !props.seriesWins) return null;
  const ds = props.nguoiChoi?.length ? props.nguoiChoi : props.summary.ranking;
  const ty = tySoLoat(ds, props.seriesWins);
  if (!ty) return null;
  const coDan = ds.some((p) => ty[p.name]?.dan);
  const nhat = isDraw(props.summary.ranking) ? undefined : props.summary.ranking[0]?.id;
  const phieu = new Set(props.phieuChoiLai ?? []);
  return ds.map((p) => {
    const hang = props.summary.ranking.find((r) => r.id === p.id);
    const tvIds = (hang?.thanhVien ?? (p as { thanhVien?: string[] }).thanhVien) ?? [];
    // Đội: mã `doi-1`…`doi-4` (ván cũ `doi-A`/`doi-B`) → số màu như thanh đội trong ván
    const doi = tvIds.length ? (({ A: '1', B: '2' } as Record<string, string>)[p.id.slice(-1)] ?? p.id.slice(-1)) : '';
    return {
      id: p.id, ten: tenNguoi(p), mat: p.avatar, anh: props.anhCua?.(p.id),
      n: ty[p.name]?.n ?? 0, lui: coDan && !ty[p.name]?.dan,
      diem: hang?.score ?? 0, thang: p.id === nhat, doi,
      ok: props.rematchState?.[p.id] === 'in', ra: props.rematchState?.[p.id] === 'out',
      tv: tvIds.map((id) => {
        const m = props.thanhVienCua?.(id);
        return { id, mat: m?.mat, anh: m?.anh ?? props.anhCua?.(id), ten: m?.ten ?? '?', ok: phieu.has(id) };
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
  const chung = { cau: t('kq.thachDau'), choiNgay: t('kq.choiNgay'), site: SITE_URL.replace(/^https?:\/\//, ''), tenApp: t('tb.thuongHieu') };
  if (props.multiplayer) {
    return {
      ...chung, tieuDe, phu: props.multiplayerOnline ? `Online · ${ngay}` : ngay,
      hang: s.ranking.map((p, i) => ({
        hang: draw.value && i < 2 ? 1 : i + 1, ten: tenNguoi(p), diem: num(p.score),
        nhat: draw.value ? i < 2 : i === 0,
      })),
    };
  }
  return {
    ...chung, tieuDe, phu: `${reasonText.value} · ${ngay}`,
    so: [
      { nhan: t('chung.diem'), gt: num(s.score) },
      { nhan: t('kq.soLuot'), gt: String(s.moves) },
      { nhan: t('kq.thoiGian'), gt: clock(s.seconds) },
      { nhan: t('kq.chuoiDai'), gt: String(s.bestStreak) },
    ],
  };
});
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="resTitle" @keydown.esc="emit('menu')">
    <div class="panel" :class="{ 'kq-online': multiplayerOnline, 'nhieu-nguoi': loat }">
      <!-- Nhiều người: "Ván N" + nút Lưu/Chia sẻ (biểu tượng) trên tiêu đề, thay nút vàng to -->
      <div v-if="loat" class="dau-kq">
        <small v-if="soVan">{{ t('kq.van', { n: soVan }) }}</small>
        <button
          v-if="hienLcs" class="lcs-nho thach" type="button" :aria-label="t('kq.luuChiaSe')" :title="t('kq.luuChiaSe')"
          @click="moLcs = true; moChucNang('luu_chia_se_anh')"
        ><Share :size="19" aria-hidden="true" /></button>
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
          v-if="loat" class="loat khay-nho khay-noi" :class="{ an: moChiTiet }" role="group"
          :aria-label="`${t('kq.tySo')}: ${loatAria}`" :style="{ '--n': loat.length }"
        >
          <div
            v-for="r in loat" :key="r.id" class="cot" :class="[{ ra: r.ra }, r.doi && `doi d${r.doi}`]"
            :data-kq-for="r.tv.length ? undefined : r.id"
          >
            <span class="xep" aria-hidden="true">
              <template v-if="r.tv.length">
                <span v-for="m in r.tv" :key="m.id" class="mat" :class="{ ok: m.ok }" :data-kq-for="m.id"><MatNguoi :mat="m.mat" :anh="m.anh" /></span>
              </template>
              <span v-else class="mat" :class="{ ok: r.ok }"><MatNguoi :mat="r.mat" :anh="r.anh" /></span>
            </span>
            <b class="ten ten-kq">{{ r.ten }}</b>
            <small v-if="r.tv.length > 1" class="tv">{{ r.tv.map((m) => m.ten).join(' · ') }}</small>
            <!-- Hàng số CAO CỐ ĐỊNH: viên +1 nổi bên trên, không đẩy dòng điểm của cột thắng
                 xuống thấp hơn cột bên cạnh (chủ dự án: "nó phải cân đối nhau") -->
            <span class="so"><span class="o-so"><span class="khung-so" :class="{ nay: r.thang }"><b :class="{ lui: r.lui && !r.thang, cuon: r.thang }" :data-cu="r.thang ? r.n - 1 : undefined">{{ r.n }}</b></span><i v-if="r.thang" class="cong" aria-hidden="true">+1</i></span></span>
            <small class="dm">{{ t('kq.diemAria', { n: num(r.diem) }) }}</small>
          </div>
        </div>

        <!-- CHI TIẾT VÁN: điểm · cặp · chuỗi từng người, xếp theo hạng ván. Có bảng tỷ số thì ẩn sau
             nút "Chi tiết ván" (lật chỗ với bảng tỷ số); không có (thiếu dữ liệu loạt) thì hiện thẳng. -->
        <ol v-if="multiplayer" id="kqChiTiet" class="ranking" :class="{ 'khay-nho khay-noi': loat, an: loat && !moChiTiet }">
          <li v-for="(p, i) in summary.ranking" :key="p.id" :data-kq-for="loat ? undefined : p.id">
            <span v-if="cotCua(p.id)" class="mat-ct" aria-hidden="true">
              <template v-if="cotCua(p.id)!.tv.length"><span v-for="m in cotCua(p.id)!.tv" :key="m.id"><MatNguoi :mat="m.mat" :anh="m.anh" /></span></template>
              <span v-else><MatNguoi :mat="cotCua(p.id)!.mat" :anh="cotCua(p.id)!.anh" /></span>
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
              {{ t('kq.capChuoi', { cap: p.pairs, chuoi: p.bestStreak }) }}
              <i v-if="rematchState?.[p.id] === 'in'" class="tag in">{{ t('kq.choiTiep') }}</i>
              <i v-else-if="rematchState?.[p.id] === 'out'" class="tag out">{{ t('kq.daThoat') }}</i>
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

      <button
        v-if="loat" class="nut-ct thach th-nho" type="button" aria-controls="kqChiTiet" :aria-expanded="moChiTiet"
        @click="moChiTiet = !moChiTiet"
      >{{ moChiTiet ? t('kq.thuGon') : t('kq.chiTiet') }}<ChevronDown :size="16" aria-hidden="true" /></button>

      <!-- Điểm là phần thưởng của cả ván: cho nó cỡ chữ xứng đáng và đếm dần lên -->
      <p v-if="!multiplayer" class="score-big" :aria-label="t('kq.diemAria', { n: summary.score })">
        <DongXu :size="26" />
        <b>{{ num(shownScore) }}</b>
        <small>{{ t('chung.diem') }}</small>
      </p>

      <dl v-if="!multiplayer" class="stats">
        <div v-if="summary.timeBonus"><dt>{{ t('kq.thuongGio') }}</dt><dd>+{{ summary.timeBonus }}</dd></div>
        <div><dt>{{ t('kq.soLuot') }}</dt><dd>{{ summary.moves }}</dd></div>
        <div><dt>{{ t('kq.thoiGian') }}</dt><dd>{{ clock(summary.seconds) }}</dd></div>
        <div><dt>{{ t('kq.chuoiDai') }}</dt><dd>{{ summary.bestStreak }}</dd></div>
      </dl>

      <!--
        MỘT HÀNG CHIP, chỉ tên, tối đa hai rồi "+N". Bản cũ in tên + mô tả từng
        dòng: một ván mở 4 danh hiệu là bảng cao quá iPhone SE và đẩy ba nút ra
        ngoài màn hình (đo bằng tools/do-menu-tren.mjs). Mô tả đã có ở dải khoe
        (MoKhoaToast) và màn Danh hiệu.
      -->
      <ul v-if="freshAchievements.length" class="achievements">
        <li v-for="id in freshAchievements.slice(0, 2)" :key="id">🏅 {{ byId(id)?.name }}</li>
        <li v-if="freshAchievements.length > 2" class="them">{{ t('kq.themDanhHieu', { n: freshAchievements.length - 2 }) }}</li>
      </ul>
      <!-- Lời mời đi tiếp, ngay lúc người chơi còn hứng: một cú bấm là vào ván -->
      <div v-if="goiY" class="goi-y">
        <span class="txt">🎯 <b>{{ goiY.name }}</b><small>{{ goiY.hint }}</small></span>
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

      <div class="row">
        <button
          v-if="!rematchBlocked" ref="primary" class="btn btn-primary" type="button"
          :disabled="rematchSent"
          @click="emit('replay')"
        >
          {{ rematchSent ? t('kq.daBamChoiLai') : replayLabel }}
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
      <div v-if="multiplayerOnline" class="row hang-phu">
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
      <p v-if="rematchBlocked" class="waiting" role="status">
        {{ t('kq.doiThuRoi') }}
      </p>

      <!-- Chat vẫn phải chạy sau khi ván xong: overlay này che kín màn chơi nên
           thanh emoji của OnlineGame không bấm tới được. Chờ nhau bấm "Chơi lại"
           là đúng lúc người ta muốn nói chuyện nhất. -->
      <div class="chat-slot"><slot name="chat" /></div>
    </div>
    <LuuChiaSe v-if="moLcs" :noi-dung="noiDungAnh" @close="moLcs = false" />
  </div>
</template>

<style scoped>
/* Thanh chat trong bảng kết quả: cách nút một nhịp, viền trên để tách khỏi
   khu vực nút bấm — không thì mắt đọc emoji thành một hàng nút hành động. */
.chat-slot:not(:empty) {
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid var(--line);
}
.waiting {
  margin: 10px 0 0; text-align: center; color: var(--muted);
  font-size: var(--text-sm);
}
/* Lời mời chơi lại: nổi hơn dòng "đang chờ", vì đây là việc CẦN người đọc làm gì */
.waiting.want { color: var(--accent); font-weight: 700; }
.overlay {
  /* 17: TRÊN thanh trên cùng (15) và cảnh kết ván (16) — xem chuỗi lớp ở styles/ketcuc-fx.css */
  position: fixed; inset: 0; z-index: 17; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: rgba(6, 9, 18, .3);   /* nền nhạt để thấy pháo hoa phía sau */
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}
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
 * nhịp rồi tắt; người dẫn chỉ là số ĐẬM (--fg), người kém số MỜ (--muted). Khay theo token skin
 * nên bản tối tự tối theo — bảng tím cũ giữ màu sáng ở bản tối, chói (chủ dự án báo).
 * Cỡ mặt/số theo số cột (--n): 2 cột to nhất. `min-height` chung với bảng chi tiết để lật qua
 * lại bảng không co giật.
 */
.nhieu-nguoi h2 { text-align: center; }
.dau-kq { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin: -4px 0 2px; }
.dau-kq small {
  font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
}
.lcs-nho {
  margin-left: auto; width: 44px; height: 44px; padding: 0; display: grid; place-items: center;
  border-radius: 14px; color: var(--fg); cursor: pointer;
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
.xep { display: flex; justify-content: center; }
.xep .mat { position: relative; font-size: var(--mat); line-height: 1; }
.xep .mat + .mat { margin-left: calc(var(--mat) * -.35); }
/* Đã bấm "Chơi lại" (online): dấu ✓ xanh trên mặt — thay viền xanh nhấp nháy quanh cả dòng */
.xep .mat.ok::after {
  content: '✓'; position: absolute; z-index: 2; right: -3px; bottom: -3px;
  width: 17px; height: 17px; border-radius: 50%; display: grid; place-items: center;
  background: #46ad22; color: #fff; font: 900 11px/1 var(--font-body);
  box-shadow: 0 0 0 2px var(--panel-solid);
}
.cot .ten {
  max-width: 100%; font-family: var(--font-display); font-weight: 700; font-size: 16px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.cot .tv, .cot .dm {
  max-width: 100%; font-size: 12.5px; font-weight: 700; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cot .dm { font-size: 13.5px; }
/* Đội: chấm màu như thanh đội trong ván (TeamStrip) */
.d1 { --mau: #ff8a3d; } .d2 { --mau: #3d9bff; } .d3 { --mau: #3fbf6b; } .d4 { --mau: #a66bff; }
.doi .ten::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: var(--mau); flex: 0 0 auto; }
.so {
  height: var(--so); margin-top: 4px; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 800; font-size: var(--so); line-height: 1;
  font-variant-numeric: tabular-nums;
}
.o-so { position: relative; display: inline-block; line-height: 1; }
.o-so b { display: inline-block; font: inherit; color: var(--fg); }
.o-so b.lui { color: var(--muted); opacity: .6; }
.cong {
  position: absolute; top: -8px; right: -30px; padding: 2px 8px; border-radius: 999px;
  font: 800 17px/1.25 var(--font-display); font-style: normal; color: #4a2a00;
  background: linear-gradient(#ffe066, #ffb703); box-shadow: 0 0 0 2px #d48a00, 0 3px 0 #b87400;
  animation: cong .6s 1s both;
}
/*
 * NGƯỜI THẮNG VÁN (19.11.2026, chủ dự án: "+1 mờ nhạt quá… cho con số xoay 0→1, 1→2, có âm thanh, màu
 * nổi bật"): số CUỘN như đồng hồ lật — số cũ (`data-cu`, vẽ bằng ::before ngay trên) trượt lên khỏi
 * khung, số mới từ dưới lên — rồi chuyển vàng cam có quầng sáng và GIỮ màu đó; viên "+1" đậm, đứng yên.
 * Tiếng: `MOC_CUON` trong script phải khớp delay 1s ở đây. Text của <b> vẫn chỉ là số MỚI (đọc màn hình, test).
 */
.khung-so { display: inline-block; overflow: hidden; padding: .08em .12em; margin: -.08em -.12em; }
.khung-so.nay { animation: nay .45s 1.45s both; }
.o-so b.cuon { position: relative; animation: cuon .55s 1s cubic-bezier(.3, 1.45, .5, 1) both, vang .4s 1.2s both; }
.o-so b.cuon::before { content: attr(data-cu); position: absolute; left: 0; right: 0; top: -1.16em; color: var(--muted); }
@keyframes cuon { from { transform: translateY(1.16em); } to { transform: none; } }
@keyframes vang { to { color: #f29b00; text-shadow: 0 0 14px rgba(255, 183, 3, .55), 0 2px 0 #c77700; } }
@keyframes cong {
  0% { opacity: 0; transform: translateY(10px) scale(.5); }
  60% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: none; }
}
@keyframes nay { 40% { transform: scale(1.3); } }
@media (prefers-reduced-motion: reduce) {
  .cong, .khung-so.nay { animation: none; }
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
  .kq-online .chat-slot:not(:empty) { margin-top: 20px; padding-top: 16px; }
}

.achievements { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.achievements li {
  padding: 4px 10px; border-radius: 999px; font-weight: 800; white-space: nowrap;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis;
  background: linear-gradient(135deg, #ffd76a, #f0a500); color: #4a2f00;
}
.achievements li.them { background: color-mix(in srgb, var(--warn) 18%, transparent); color: inherit; }

.goi-y {
  display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 8px 8px 12px;
  border-radius: 10px; background: color-mix(in srgb, var(--accent) 12%, transparent); font-size: 13px;
}
.goi-y .txt { flex: 1; min-width: 0; }
.goi-y small { display: block; color: var(--muted); }
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
  .goi-y { margin-top: 6px; padding: 5px 6px 5px 10px; }
  .goi-y small { display: none; }
  .row { margin-top: 10px; }
  .row .btn, .row .btn-primary { min-height: 46px; }
  /* Bảng tỷ số loạt: thấp hơn, vẫn là con số to nhất sau tiêu đề */
  .lat.chong { margin-top: 6px; }
  .lat.chong > * { min-height: 0; }
  .loat { --mat: calc(64px / var(--n) + 10px); --so: calc(96px / var(--n) + 18px); padding: 10px 6px; }
  .dau-kq { min-height: 40px; }
  .nut-ct { margin-top: 6px; min-height: 36px; }
}
</style>
