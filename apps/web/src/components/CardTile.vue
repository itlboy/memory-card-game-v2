<script setup lang="ts">
import type { Card } from '@mm/engine';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { DEAL_ANIM_MS, DEAL_SETTLE_MS, dealDelay } from '@/lib/timing';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';

const props = defineProps<{
  card: Card;
  faceUp: boolean;
  matched: boolean;
  wrong: boolean;
  /** Đang được thẻ mắt thần / Peek hé mở, không phải do người chơi lật. */
  peeking: boolean;
  disabled: boolean;
  /** Hàng thứ mấy trên bàn (0 = trên cùng) — quyết định thứ tự chia bài: cả
   *  một hàng bay vào cùng lúc, hàng trên trước hàng dưới. */
  row?: number;
  /** Bàn có bao nhiêu hàng, để dồn nhịp lại khi bàn nhiều hàng (xem
   *  `DEAL_TOTAL_CAP_MS`): 11 hàng × 500ms là 5 giây ngồi chờ mỗi ván. */
  rows?: number;
  /** Chỗ CŨ của lá bài này so với chỗ mới, khi vừa bị thẻ tráo đổi hoán chỗ.
   *  Animation chạy từ đó về 0 nên mắt thấy nó bay sang chỗ mới. */
  swapFrom?: { dx: number; dy: number; sign: number };
  /** Đã bấm, đang chờ server xác nhận (ván online). */
  pending?: boolean;
  /**
   * Lá này VỪA ĐƯỢC MỞ (bởi bất kỳ ai), kèm số đếm để lặp lại hiệu ứng.
   *
   * Trên bàn lớn (56–88 thẻ) người chơi thường KHÔNG thấy đối thủ vừa mở lá
   * nào — đúng điều đã bị phản ánh. Nên lá vừa mở phát một quầng sáng cho cả
   * phòng thấy, không riêng người bấm.
   */
  vuaMo?: { key: number } | null;
  /** Mặt sau của ván này, dạng `<hoạ tiết>.<bảng màu>` (ví dụ `xoay.cham`).
   *  Nhận cả sáu tên CŨ (`stars`…) vì server có thể gửi dạng đó cho client chưa
   *  khai `?bv=2`, và ván offline khôi phục từ sessionStorage của bản cũ cũng
   *  mang tên cũ — xem `lopMatSau`. */
  back: string;
}>();

const emit = defineEmits<{ flip: [index: number] }>();

/**
 * Hai class của mặt sau, tách từ một id.
 *
 * Hoạ tiết và bảng màu là hai class riêng (`bk-ht-*` + `bk-mau-*`) nên 10 + 7
 * khối CSS phủ được 70 mặt sau — xem `styles/card-backs.css`.
 *
 * Ba đường vào phải chịu được, thiếu đường nào là mặt sau ra Ô TRẮNG TRƠN:
 *  - id mới `xoay.cham`;
 *  - sáu tên CŨ (`stars`…): server hạ về dạng đó cho client chưa khai `?bv=2`,
 *    và ván offline khôi phục từ sessionStorage của một bản cũ cũng mang tên cũ;
 *  - id LẠ hoặc rỗng (bản dựng lệch, dữ liệu hỏng) — rơi về `sao.tim`.
 */
const CU_SANG_MOI: Record<string, string> = {
  stars: 'sao.tim',
  diamond: 'thoi.cham',
  aurora: 'cuc-quang.cham',
  leaf: 'la.luc',
  ember: 'lua.cam',
  ocean: 'song.lam'
};

const lopMatSau = computed<string[]>(() => {
  const id = CU_SANG_MOI[props.back] ?? props.back ?? '';
  const [ht, mau] = id.split('.');
  return [`bk-ht-${ht || 'sao'}`, `bk-mau-${mau || 'tim'}`];
});

/**
 * Huy hiệu thẻ đặc biệt trên MẶT TRƯỚC lá bài. Dùng CÙNG bộ icon với bảng Luật
 * chơi và màn tuỳ chọn — emoji mỗi hệ điều hành vẽ một kiểu, và người chơi đọc
 * luật xong phải nhận ra ngay đúng cái vừa đọc khi nó hiện trên bàn.
 * Đủ cả năm loại đang phát. Nhánh emoji bên dưới chỉ còn là đường lui cho loại
 * lạ (ván cũ khôi phục từ sessionStorage của một bản khác).
 */
const POWER_ICON: Record<string, IconName> = { bomb: 'bomb', swap: 'swap', x2: 'x2', eye: 'eye', freeze: 'freeze' };

/** Nhịp lấy từ lib/timing để TIẾNG chia bài dứt đúng lúc thẻ cuối bay vào. */
/* Trễ theo HÀNG: cả hàng bay vào cùng lúc, hàng trên trước hàng dưới. */
const dealStagger = computed(() => dealDelay(props.row ?? 0, props.rows ?? 1));

/**
 * Hướng lật vừa xảy ra, để chạy đúng một lần nhịp lắc — `null` là không lắc.
 *
 * Vì sao phải theo dõi bằng JS chứ không viết thẳng `.card:not(.up) .inner`:
 * quy tắc CSS đó đúng với MỌI lá đang úp, kể cả lá chưa bao giờ được lật. Mà
 * keyframe `flip-down` bắt đầu ở `rotateY(180deg)` — tức mặt TRƯỚC đang hướng
 * ra ngoài — nên mỗi lá úp đều loé nội dung ra rồi mới quay về úp. Lộ bài.
 * (Thấy rõ nhất khi F5 giữa ván: cả bàn loé một nhịp.)
 */
const flipAnim = ref<'up' | 'down' | 'tail' | null>(null);
let flipTimer: ReturnType<typeof setTimeout> | undefined;
const FLIP_WOBBLE_MS = 2200;
/** Đúng bằng transition-duration của .inner — mốc lá bài lật xong. */
const FLIP_MS = 340;
/** Phần lắc tắt dần, tính từ lúc lá đã nằm ở 180 độ (xem @keyframes wob-tail). */
const TAIL_MS = 1700;

/**
 * ĐANG CHỜ SERVER (chỉ có ở phòng online): lá đã lật tới 90 độ và sẽ lật nốt khi
 * câu trả lời về. Phải nhớ việc đó, vì lúc câu trả lời về thì `pending` và
 * `faceUp` đổi TRONG CÙNG MỘT NHỊP — đọc `props.pending` trong watcher thì nó đã
 * là false rồi.
 *
 * Đây là gốc của cảnh "giật giật khi mở lá bài" ở online, đo được với trễ
 * 87ms/chiều (ping 175ms): lá đang ở 80,2° thì nhảy thẳng lên 180° trong MỘT
 * frame. Vì cả `flip-up` (0% = rotateY(0)) và `shake` (mọi keyframe = 180deg)
 * đều là animation với góc TUYỆT ĐỐI, nên khi chúng chiếm quyền giữa lúc
 * transition đang chạy, lá bài nhảy phắt về góc mở đầu của keyframe.
 */
const daCho = ref(false);
/** Thời điểm lá lật xong sau khi chờ server; 0 = không phải đường đó. */
let choXongLuc = 0;
watch(() => props.pending, (p) => { if (p) daCho.value = true; });

watch(() => props.faceUp, (up, was) => {
  if (up === was) return;
  // Hé mở cả bàn (peek/mắt thần) thì không lắc: cả bàn lắc một lượt thành rung
  // màn hình.
  if (props.peeking) return;
  // Vừa chờ server xong: lá đang ở 90 độ, để TRANSITION đi nốt 90→180 cho liền
  // mạch, rồi mới chạy phần lắc (wob-tail bắt đầu ĐÚNG ở 180 nên không nhảy).
  if (up && daCho.value) {
    daCho.value = false;
    choXongLuc = Date.now() + FLIP_MS;
    clearTimeout(flipTimer);
    flipTimer = setTimeout(() => {
      flipAnim.value = 'tail';
      flipTimer = setTimeout(() => { flipAnim.value = null; }, TAIL_MS);
    }, FLIP_MS);
    return;
  }
  if (props.pending) return;
  flipAnim.value = up ? 'up' : 'down';
  clearTimeout(flipTimer);
  flipTimer = setTimeout(() => { flipAnim.value = null; }, FLIP_WOBBLE_MS);
});

/**
 * Lắc "ghép sai" phải đợi lá lật xong.
 *
 * Ở online, tin `miss` về CÙNG LÚC với trạng thái mở, nên gắn `wrong` ngay là
 * `shake` (keyframe nào cũng rotateY(180deg)) chiếm quyền lúc lá còn ở 90 độ —
 * lá nhảy phắt lên 180 và cú lật biến mất. Mà lắc một lá người chơi chưa kịp
 * thấy mặt thì cũng chẳng nói lên điều gì.
 */
const lacSai = ref(false);
let lacTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.wrong, (w) => {
  clearTimeout(lacTimer);
  if (!w) { lacSai.value = false; return; }
  const conLai = choXongLuc - Date.now();
  if (conLai > 0) lacTimer = setTimeout(() => { lacSai.value = true; }, conLai);
  else lacSai.value = true;
});

/**
 * Đã đáp xuống bàn xong chưa. Lắc lúc lật chỉ bật SAU khi chia xong: hai
 * animation cùng chạy trên một lá thì cái sau ghi đè cái trước, thành ra lúc
 * chia bài không thấy lắc gì cả (đúng hiện tượng đã gặp).
 */
const dealt = ref(false);
/**
 * Animation `deal` đã chạy XONG hẳn (kể cả phần lắc tắt dần) chưa.
 *
 * Cần một cờ riêng vì `.card` khai báo `animation: deal` cố định: hết nhịp hover
 * là animation-name quay về `deal` và nó CHẠY LẠI TỪ ĐẦU — đo được cú nhảy 29°,
 * quét chuột qua bàn thành nháy loạn. Có cờ này thì đặt `animation: none`, khe
 * animation của .card trống, hover mượn xong trả lại cũng không có gì để chạy.
 */
const settled = ref(false);
let dealTimer: ReturnType<typeof setTimeout> | undefined;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  dealTimer = setTimeout(() => { dealt.value = true; }, dealStagger.value + DEAL_SETTLE_MS);
  settleTimer = setTimeout(() => { settled.value = true; }, dealStagger.value + DEAL_ANIM_MS);
});
onUnmounted(() => {
  clearTimeout(dealTimer); clearTimeout(settleTimer);
  clearTimeout(flipTimer);
});

/**
 * TRỎ CHUỘT VÀO THÌ LÁ PHÓNG TO; RỜI CHUỘT LÀ NHỎ LẠI NGAY.
 *
 * Bản trước là một animation 1,4 giây chạy cho hết (phóng to + lắc tắt dần), bật
 * bằng class rồi hẹn giờ tắt. Hệ quả: rời chuột rồi lá vẫn to thêm hơn một giây
 * — người chơi báo đúng chuyện đó. Nay dùng TRANSITION thay animation:
 *   vào 0,28s · ra 1s, và rời chuột là bắt đầu nhỏ lại NGAY từ cỡ đang có.
 *
 * Vì sao vẫn không dùng selector `:hover`: nó cũng chạy được với transition,
 * nhưng ta phải chặn hover ở lá đã ngửa / đã ghép / đang chờ server, mà những
 * điều kiện đó chỉ JS biết. Giữ một cửa `onEnter`/`onLeave` cho gọn.
 *
 * Nhịp LẮC bị bỏ: nó là animation, mà animation thì không cắt giữa nhịp cho êm
 * được — đúng lý do bản cũ phải chạy hết 1,4 giây.
 */
const hoverWob = ref(false);
/** Chỉ thiết bị có con trỏ thật; máy cảm ứng thì `pointerenter` bắn cả khi chạm. */
const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;

/** Lá này có được phép phóng to không — lá đã ngửa/đã ghép/đang chờ thì không. */
function hoverDuoc(): boolean {
  if (!canHover || !settled.value) return false;
  return !(props.faceUp || props.matched || props.disabled || props.peeking || props.pending);
}

function onEnter(): void {
  if (hoverDuoc()) hoverWob.value = true;
}

/* ---------- ngón tay đặt xuống (điện thoại) ----------
 *
 * Người chơi chủ yếu ở trên điện thoại, mà ở đó KHÔNG CÓ hover: ngón tay còn
 * che mất lá. Nên phản hồi phải nằm ở khoảnh khắc ĐẶT XUỐNG — và ở ván online,
 * đó đúng là quãng chờ server trả lời.
 *
 * Hai lớp cùng lúc: lá lún 6% (90ms) và một quầng sáng ở ĐÚNG chỗ vừa chạm.
 * Quầng sáng nói được điều cú lún không nói: máy nhận đúng lá, đúng điểm.
 */
const nhan = ref(false);
/** Toạ độ điểm chạm trong lá, dạng phần trăm — CSS đọc để đặt quầng sáng. */
const diemCham = ref<{ x: string; y: string }>({ x: '50%', y: '50%' });

function onDown(e: PointerEvent): void {
  if (props.disabled || props.matched || props.faceUp || props.peeking) return;
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  diemCham.value = {
    x: `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`,
    y: `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`
  };
  nhan.value = true;
  // Giữ mọi sự kiện con trỏ về đúng lá này: kéo ngón ra ngoài rồi nhấc lên mà
  // không có capture thì `pointerup` bắn ở phần tử khác và lá dính trạng thái nhấn.
  el.setPointerCapture?.(e.pointerId);
}

function onUp(): void {
  nhan.value = false;
}

/* ---------- loé viền một nhịp khi lá đổi mặt ----------
 * Đặt riêng khỏi cú lật: cú lật là chuyển động của lá, còn cái này là DẤU
 * "vừa xảy ra" — nó còn dùng lại được cho lá do người khác mở.
 */
const LOE_MS = 520;
const loe = ref(false);
let loeTimer: ReturnType<typeof setTimeout> | undefined;

function bungLoe(): void {
  loe.value = false;
  clearTimeout(loeTimer);
  // Một nhịp chờ để trình duyệt thấy class biến mất rồi mới gắn lại; không có
  // bước này thì lật hai lá liền nhau, lá thứ hai không loé.
  requestAnimationFrame(() => {
    loe.value = true;
    loeTimer = setTimeout(() => { loe.value = false; }, LOE_MS);
  });
}

// Lá ĐỔI MẶT (do mình hay do ai cũng vậy) thì loé một nhịp.
watch(() => props.faceUp, (up, truoc) => { if (up && !truoc) bungLoe(); });
// Và lá vừa được mở — tín hiệu riêng từ engine/server, để trên bàn 88 thẻ người
// chơi còn lại nhìn ra ngay lá nào vừa mở.
watch(() => props.vuaMo?.key, (k) => { if (k) bungLoe(); });

function onLeave(): void {
  hoverWob.value = false;
}

// Lá vừa được lật (hoặc vừa bị khoá) thì thu về ngay, đừng đợi chuột rời: con
// trỏ vẫn đang nằm trên nó mà lá thì không còn ở trạng thái được phóng to.
watch(
  () => [props.faceUp, props.matched, props.disabled, props.peeking, props.pending],
  () => { if (hoverWob.value && !hoverDuoc()) hoverWob.value = false; }
);

const label = computed(() => {
  const pos = `Thẻ ${props.card.index + 1}`;
  if (props.matched) return `${pos}, ${props.card.symbol}, đã ghép đúng`;
  if (props.faceUp) return `${pos}, ${props.card.symbol}`;
  return `${pos}, chưa mở`;
});
</script>

<template>
  <span v-if="card.blank" class="card blank" aria-hidden="true" />
  <button
    v-else
    class="card"
    :class="{ up: faceUp, done: matched, wrong: lacSai, peek: peeking, swapping: !!swapFrom, pending, dealt,
      'wob-up': dealt && flipAnim === 'up', 'wob-down': dealt && flipAnim === 'down',
      'wob-tail': dealt && flipAnim === 'tail',
      'wob-hover': hoverWob, nhan, loe, settled }"
    :style="{
      '--deal': `${dealStagger}ms`,
      '--cx': diemCham.x,
      '--cy': diemCham.y,
      '--wob': card.index % 2 ? 1 : -1,
      ...(swapFrom ? {
        '--sx': `${swapFrom.dx}px`,
        '--sy': `${swapFrom.dy}px`,
        '--sr': `${swapFrom.sign * 7}deg`,
        zIndex: swapFrom.sign > 0 ? 7 : 6
      } : {})
    }"
    :aria-label="label"
    :aria-disabled="disabled || matched ? 'true' : 'false'"
    :data-index="card.index"
    role="gridcell"
    type="button"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @pointerdown="onDown"
    @pointerup="onUp"
    @pointercancel="onUp"
    @click="!disabled && !matched && emit('flip', card.index)"
  >
    <span class="inner">
      <span class="face back" :class="lopMatSau" aria-hidden="true"></span>
      <span class="face front" aria-hidden="true">
        {{ card.symbol }}
        <span v-if="card.power && !card.powerUsed" class="badge">
          <OptionIcon v-if="POWER_ICON[card.power]" :name="POWER_ICON[card.power]!" :size="14" />
          <template v-else>💥</template>
        </span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.card.blank {
  pointer-events: none; animation: none; background: transparent;
}
.card {
  /* Tỉ lệ do bàn quyết định (đo chỗ còn lại): 3:4 khi đủ chỗ, cao dần tới 5:8
     để lấp chiều cao dư trên màn dọc. */
  position: relative; aspect-ratio: var(--card-ar, 3 / 4); min-width: 44px; min-height: 44px;
  padding: 0; border: 0; background: transparent; perspective: 700px;
  /* Chia bài: đáp xuống rồi lắc TẮT DẦN trong ~2,4 giây. Trước đây chỉ 0,38s
     với cubic-bezier quá đà (1.2) — nảy một cái rồi đứng khựng, nhìn giật cục. */
  /* 520ms, khớp `DEAL_ANIM_MS` — đổi một chỗ thì phải đổi chỗ kia, vì JS dùng
     con số đó để biết lúc nào lá đã nằm yên (`settled`). */
  animation: deal 0.52s linear backwards;
  animation-delay: var(--deal, 0ms);
  /* Container query: nội dung thẻ to theo kích thước THẺ, không theo viewport —
     bàn 2×2 thẻ to thì biểu tượng cũng to tương ứng */
  container-type: inline-size;
}
@keyframes deal {
  /*
   * LÚN RỒI NỞ RA — cả bàn đọc thành MỘT GỢN SÓNG chạy từ trên xuống.
   *
   * Bản trước là "bay vào": lá xuất phát ở scale 0,72 lệch dưới 16px và xoay
   * -22°, rồi lắc tắt dần suốt 2,4 giây. Ba chuyển động cùng lúc trên hàng chục
   * lá là thứ đọc ra thành GIẬT, và không có hướng nào để mắt đi theo.
   *
   * Nay chỉ còn MỘT chuyển động, một chiều: lá hiện ra ở cỡ lún (0,92 — như vừa
   * bị ấn xuống mặt bàn) rồi nở về đúng cỡ. Mỗi hàng lệch nhau 100ms
   * (`DEAL_ROW_GAP_MS`), nên cái nở đó truyền xuống như gợn sóng.
   *
   * Nở QUÁ một chút (1,015) rồi mới về 1: không có bước đó thì cái nở dừng đột
   * ngột, đọc ra như hình bị cắt chứ không phải một vật nảy lên.
   *
   * `perspective()` giữ lại dù không còn xoay: nó là chỗ neo cho những animation
   * khác cũng chạy trên `.card` (hover, lắc lúc lật) để không đứt mạch.
   */
  0% {
    opacity: 0;
    transform: perspective(700px) scale(0.92);
    animation-timing-function: cubic-bezier(.2, .9, .3, 1);
  }
  22%  { opacity: 1; transform: perspective(700px) scale(0.955); }
  62%  { transform: perspective(700px) scale(1.015); }
  100% { transform: none; }
}


.inner {
  position: absolute; inset: 0; border-radius: 12px;
  transform-style: preserve-3d;
  transition: transform .34s cubic-bezier(.3, .8, .4, 1.1);
}
/*
 * Trỏ chuột vào: lá bài khẽ lắc rồi đứng lại — cùng trục với cú lật (rotateY),
 * biên độ nhỏ hơn vì đây chỉ là "nó nhận ra bạn đang nhắm nó".
 *
 * Lắc ở lớp NGOÀI (.card), không phải .inner. Vì sao: .inner đang giữ animation
 * lật; hover ghi đè lên nó thì lúc RỜI chuột, `flip-down` chạy lại TỪ ĐẦU — mà
 * khung đầu của nó là `rotateY(180deg)`, tức mặt trước quay ra ngoài. **Lộ bài**
 * mỗi lần đưa chuột ra khỏi một lá vừa úp (đã đo được: -180°). Hai animation ở
 * hai lớp thì chồng nhau được, không cái nào phải nhường cái nào.
 *
 * Và bật bằng class `.wob-hover` do JS gắn, KHÔNG bằng selector `:hover` — xem
 * `onEnter` trong script: `:hover` thì rời chuột là cắt giữa nhịp, nháy cả bàn.
 *
 * `perspective()` viết trong transform vì thuộc tính `perspective` của .card chỉ
 * áp cho con nó.
 *
 * Chỉ khi `.dealt`: lúc chia bài, chính .card đang chạy animation `deal`.
 */
/* Xong nhịp chia bài thì BỎ khai báo animation: xem `settled` trong script. */
.card.settled { animation: none; }
/*
 * HAI NHỊP KHÁC NHAU, cố ý:
 *  · vào 0,28s — phản hồi phải gần như tức thì, chậm hơn là thấy "nặng";
 *  · ra 1,0s  — thu về từ tốn cho êm mắt, và vì `transition` nội suy từ CỠ ĐANG
 *    CÓ nên rời chuột giữa lúc đang phóng vẫn mượt, không có cú nhảy nào.
 * Đường cong `ease-out` cho cả hai: nhanh ở đầu, chậm dần về cuối.
 */
.card.settled { transition: transform 1s cubic-bezier(.22, .61, .36, 1); }
/*
 * PHÓNG TO, không nhấc lên. Bản trước nhấc `translateY(-3px)`; cùng biên độ thị
 * giác nhưng phóng to đọc ra là "lá này đang được chỉ vào" rõ hơn, và không bị
 * lẫn với cú nhấc của thẻ vừa ghép đúng.
 *
 * `z-index` phải nâng theo: lá to ra 5% là mép nó chờm sang ô bên cạnh, không
 * nâng thì lá kế bên (vẽ sau trong DOM) cắt mất phần chờm đó. Chọn 4 để vẫn
 * nằm DƯỚI hai mốc 6/7 của thẻ Tráo đổi đang bay.
 *
 * 1,05 là mức đã đo trên bàn 88 thẻ (lá 34px): dưới 1,04 thì gần như không thấy,
 * trên 1,07 thì lá chờm hẳn lên hàng trên và nhìn như bàn bị xô lệch.
 */
/*
 * NGÓN TAY ĐẶT XUỐNG: lún 6% trong 90ms.
 *
 * Đây là phản hồi DUY NHẤT người chơi trên điện thoại có được trước khi biết
 * kết quả — cảm ứng không có hover, và ở ván online thì lá còn phải chờ server.
 * 90ms vì nó phải kịp trong một cú chạm; chậm hơn là nhấc ngón rồi mới thấy.
 *
 * Đặt TRƯỚC `.wob-hover` trong file để hover (chuột) thắng khi cả hai cùng có —
 * chuột thì đã phóng to sẵn, lún thêm là giật.
 */
.card.nhan { transform: perspective(700px) scale(0.94); transition-duration: 0.09s; }

/* Quầng sáng ở ĐÚNG chỗ vừa chạm — nói được điều cú lún không nói: máy nhận
   đúng lá, đúng điểm. Nằm trên `.back` nên chỉ hiện ở lá còn úp. */
.card.nhan .back::before {
  background:
    radial-gradient(26% 20% at var(--cx, 50%) var(--cy, 50%), rgba(255, 255, 255, .55), transparent 72%),
    rgba(255, 255, 255, .92);
}

/*
 * LOÉ VIỀN MỘT NHỊP khi lá đổi mặt — và cũng khi lá do NGƯỜI KHÁC mở.
 *
 * Trên bàn 56–88 thẻ, đối thủ mở lá nào thường không ai thấy (đã bị phản ánh):
 * cú lật chỉ chiếm ~34px giữa một rừng thẻ. Vòng sáng chạy ra ngoài mép nên bắt
 * được mắt ở tầm nhìn ngoại vi, mà không đụng gì tới lá.
 *
 * `pointer-events: none` để nó không ăn mất cú chạm kế tiếp.
 */
.card.loe::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--accent), 0 0 18px 5px color-mix(in srgb, var(--accent) 55%, transparent);
  animation: card-loe 0.52s ease-out forwards;
}
@keyframes card-loe {
  0%   { opacity: 1; transform: scale(0.97); }
  100% { opacity: 0; transform: scale(1.07); }
}

.card.wob-hover {
  transform: perspective(700px) scale(1.05);
  transition-duration: 0.28s;
  /* Lá to ra 5% là mép chờm sang ô bên cạnh; không nâng thì lá kế bên (vẽ sau
     trong DOM) cắt mất phần chờm. Vẫn dưới hai mốc 6/7 của thẻ Tráo đổi. */
  z-index: 4;
}

.card.up .inner, .card.done .inner { transform: rotateY(180deg); }

/**
 * Lắc nhẹ lúc thẻ vừa lật xong: nó đi QUÁ mốc một chút rồi đảo chiều, biên độ
 * giảm dần và tắt hẳn sau ~2,2 giây — như cánh cửa bản lề đóng lại.
 *
 * Lắc trên ĐÚNG TRỤC LẬT (rotateY, trái–phải), không phải rotateZ: thẻ lật quanh
 * trục dọc mà lại lắc xoay tròn trong mặt phẳng thì hai chuyển động không cùng
 * một trục, mắt thấy sai ngay. Vì thế biên độ ở đây tính bằng độ QUÁ mốc 180°
 * (hoặc 0°), và phải lớn hơn kiểu rotateZ mới thấy — quay quanh trục dọc thì
 * mỗi độ chỉ ăn vào bề rộng nhìn thấy.
 *
 * Vì sao animation chứ không phải transition: transition chỉ đi một chiều từ giá
 * trị cũ sang mới, không diễn được chuỗi lắc tắt dần. Khung cuối trùng đúng
 * transform tĩnh của trạng thái nên hết animation không giật. `--wob` đảo dấu
 * theo ô để cả bàn không lắc cùng một phía như đồng ca.
 *
 * Bật bằng class `.wob-up` / `.wob-down` mà JS gắn ĐÚNG LÚC lá đổi mặt (xem
 * `flipAnim` trong script) — chi tiết vì sao không dùng selector trạng thái ở
 * đó. Cũng chỉ chạy khi `.dealt`: lúc chia bài, animation `deal` trên .card đã
 * lo phần lắc, chạy cả hai thì cái trên .inner đè lên.
 */
.card.wob-up .inner { animation: flip-up 2.2s linear; }
.card.wob-tail .inner { animation: wob-tail 1.7s linear; }
.card.wob-down .inner { animation: flip-down 2.2s linear; }

@keyframes flip-up {
  0%    { transform: rotateY(0); animation-timing-function: cubic-bezier(.3, .8, .4, 1); }
  24%   { transform: rotateY(180deg); }
  33.5% { transform: rotateY(calc(180deg + 7deg * var(--wob, 1))); }
  43%   { transform: rotateY(calc(180deg - 4.2deg * var(--wob, 1))); }
  52.5% { transform: rotateY(calc(180deg + 2.5deg * var(--wob, 1))); }
  62%   { transform: rotateY(calc(180deg - 1.5deg * var(--wob, 1))); }
  71.5% { transform: rotateY(calc(180deg + 0.9deg * var(--wob, 1))); }
  81%   { transform: rotateY(calc(180deg - 0.5deg * var(--wob, 1))); }
  90.5% { transform: rotateY(calc(180deg + 0.3deg * var(--wob, 1))); }
  100%  { transform: rotateY(180deg); }
}
/*
 * Chỉ PHẦN LẮC, bắt đầu ĐÚNG ở 180 độ — dùng cho đường online: lá đã lật tới
 * 180 bằng transition rồi mới lắc, nên không có cú nhảy nào. Các mốc lấy từ
 * flip-up, quy về đoạn sau 24% (528ms→2200ms của flip-up = 0→100% ở đây).
 */
@keyframes wob-tail {
  0%    { transform: rotateY(180deg); }
  12.5% { transform: rotateY(calc(180deg + 7deg * var(--wob, 1))); }
  25%   { transform: rotateY(calc(180deg - 4.2deg * var(--wob, 1))); }
  37.5% { transform: rotateY(calc(180deg + 2.5deg * var(--wob, 1))); }
  50%   { transform: rotateY(calc(180deg - 1.5deg * var(--wob, 1))); }
  62.5% { transform: rotateY(calc(180deg + 0.9deg * var(--wob, 1))); }
  75%   { transform: rotateY(calc(180deg - 0.5deg * var(--wob, 1))); }
  87.5% { transform: rotateY(calc(180deg + 0.3deg * var(--wob, 1))); }
  100%  { transform: rotateY(180deg); }
}
@keyframes flip-down {
  0%    { transform: rotateY(180deg); animation-timing-function: cubic-bezier(.3, .8, .4, 1); }
  24%   { transform: rotateY(0); }
  33.5% { transform: rotateY(calc(-7deg * var(--wob, 1))); }
  43%   { transform: rotateY(calc(4.2deg * var(--wob, 1))); }
  52.5% { transform: rotateY(calc(-2.5deg * var(--wob, 1))); }
  62%   { transform: rotateY(calc(1.5deg * var(--wob, 1))); }
  71.5% { transform: rotateY(calc(-0.9deg * var(--wob, 1))); }
  81%   { transform: rotateY(calc(0.5deg * var(--wob, 1))); }
  90.5% { transform: rotateY(calc(-0.3deg * var(--wob, 1))); }
  100%  { transform: rotateY(0); }
}
/* Người chọn "giảm chuyển động" thì bỏ hẳn nhịp lắc, giữ lại cú lật */
@media (prefers-reduced-motion: reduce) {
  .card .inner { animation: none !important; }
  /* Giữ cú LÚN và quầng sáng (chúng là phản hồi, không phải trang trí), bỏ vòng
     sáng chạy ra ngoài. */
  .card.loe::after { animation: none; }
  .card { transition-duration: 0.01ms !important; }
}
/**
 * Đã bấm, đang chờ server: lật tới ĐÚNG 90 độ — cạnh thẻ, chưa thấy mặt nào.
 * Vì sao dừng ở 90: server chưa gửi biểu tượng (thẻ úp không bao giờ có symbol
 * trong payload — NF-04), nên lật quá 90 là phải bịa ra một mặt. Dừng ở cạnh
 * thì bấm là thấy thẻ động ngay, và khi view về thì nó lật nốt liền mạch.
 */
.card.pending:not(.up):not(.done) .inner { transform: rotateY(90deg); }
.card.peek .inner { transition-duration: .2s; }

.face {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; backface-visibility: hidden;
  box-shadow: var(--shadow-soft);
  /* Biểu tượng ~58% bề rộng thẻ — thẻ to là chữ to theo */
  font-size: max(20px, 55cqw);
}
.back {
  overflow: hidden;
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, .3),
    inset 0 0 0 2px rgba(255, 255, 255, .12);
}
/* Hoạ tiết và gradient của từng mặt sau nằm ở `styles/card-backs.css` (mặt nạ +
   bảng màu, 10 × 7). Ở đây chỉ còn phần chung của mọi mặt sau.
   Cả bàn dùng CHUNG một mặt sau — khác nhau giữa các lá là "đánh dấu bài". */
/* Vệt sáng lướt ngang khi hover. Dùng `::after` nên hoạ tiết phải ở `::before`. */
.back::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 38%, rgba(255, 255, 255, .28) 50%, transparent 62%);
  transform: translateX(-110%);
}
@media (hover: hover) {
.card:not(.up):not(.done):hover .back::after { animation: shine .6s ease; }
}
@keyframes shine { to { transform: translateX(110%); } }
.front {
  background:
    radial-gradient(circle at 50% 58%, var(--accent-soft), transparent 62%),
    var(--card-face);
  border: 1px solid var(--line);
  transform: rotateY(180deg);
  box-shadow: var(--shadow-soft), var(--inner-light);
}
.card.done { cursor: default; }
.card.done .front {
  border-color: var(--ok);
  box-shadow: inset 0 0 0 2px var(--ok), 0 0 14px color-mix(in srgb, var(--ok) 45%, transparent);
}
/* Pop khi vừa ghép đúng */
.card.done .inner { animation: pop .42s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes pop {
  0% { transform: rotateY(180deg) scale(1); }
  45% { transform: rotateY(180deg) scale(1.14); }
  100% { transform: rotateY(180deg) scale(1); }
}

.badge {
  position: absolute; top: 2px; right: 3px; font-size: 11px; line-height: 1;
  animation: twinkle 1.6s ease-in-out infinite;
}
/* Icon gradient thay emoji: bo góc nhỏ hơn ô icon thường (14px mà bo 8px thì
   thành gần tròn), và có viền sáng để nổi trên mọi màu mặt thẻ. */
.badge :deep(.opt-ico) {
  border-radius: 4px;
  box-shadow: 0 0 0 1.5px var(--card-face), 0 1px 3px rgba(0, 0, 0, .35);
}
@keyframes twinkle { 50% { transform: scale(1.25); opacity: .8; } }

/* Tráo đổi: lá bài bắt đầu ở CHỖ CŨ rồi bay về chỗ mới, hơi nâng lên và nghiêng
   để hai lá thấy rõ là đang đổi chỗ nhau chứ không phải trôi đi đâu. z-index để
   nó bay TRÊN các thẻ khác thay vì bị che. */
.card.swapping { animation: swap-move .58s cubic-bezier(.35, .85, .3, 1); }
@keyframes swap-move {
  from { transform: translate(var(--sx, 0), var(--sy, 0)) scale(1); }
  45%  { transform: translate(calc(var(--sx, 0) * .5), calc(var(--sy, 0) * .5)) scale(1.1) rotate(var(--sr, 7deg)); }
  to   { transform: translate(0, 0) scale(1) rotate(0); }
}

.card.wrong .inner { animation: shake .32s; }
@keyframes shake {
  20% { transform: rotateY(180deg) translateX(-6px); }
  45% { transform: rotateY(180deg) translateX(5px); }
  70% { transform: rotateY(180deg) translateX(-3px); }
}
</style>
