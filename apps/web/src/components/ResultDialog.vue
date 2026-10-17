<script setup lang="ts">
import { tenNguoi } from '@/lib/ten';
import { t, td } from '@/lib/i18n';
import { isDraw } from '@mm/engine';
import type { Summary } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { byId, type Achievement } from '@/lib/achievements';
import { sfx } from '@/lib/audio';
import { clock, num } from '@/lib/format';
import DongXu from './DongXu.vue';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';

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
  /** Tổng điểm tích luỹ trước và sau ván — dùng cho hiệu ứng cộng vào tổng. */
  totalBefore: number;
  totalAfter: number;
  /** Số ván thắng của từng người trong loạt đang chơi (theo tên). */
  seriesWins?: Record<string, number>;
  /** Có màn kế tiếp trong Chiến dịch không. */
  hasNext: boolean;
  /** Cấp đang chơi; không có nghĩa là ván lẻ, không thuộc thang cấp. */
  levelId?: number;
  /** Ván online: không có thang cấp nên không có "cấp tiếp theo". */
  multiplayerOnline?: boolean;
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

const emit = defineEmits<{ replay: []; next: []; menu: []; 'doi-ban': []; lobby: []; 'chinh-phuc': [Achievement] }>();
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
});

/** Tổng tích luỹ đang hiển thị + trạng thái hiệu ứng cộng vào tổng. */
const shownTotal = ref(props.totalBefore);
const totalGain = computed(() => Math.max(0, props.totalAfter - props.totalBefore));
const totalPhase = ref<'idle' | 'flying' | 'landed'>('idle');

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

/** Điểm ván đếm lên, rồi BAY vào tổng tích luỹ — hai con số phải nối được với
 *  nhau, không thì người chơi không thấy ván này đóng góp gì vào tổng. */
function countScoreUp(): void {
  const target = props.summary.score;
  if (target <= 0) { shownScore.value = target; shownTotal.value = props.totalAfter; return; }
  runCount(0, target, Math.min(1400, 500 + target * 1.2), (v) => { shownScore.value = v; }, true, () => {
    if (!totalGain.value) return;
    totalPhase.value = 'flying';
    setTimeout(() => {
      totalPhase.value = 'landed';
      sfx.star(2);
      runCount(props.totalBefore, props.totalAfter, 700, (v) => { shownTotal.value = v; }, false);
    }, 480);
  });
}


const draw = computed(() => props.multiplayer && isDraw(props.summary.ranking));
/** Sao chỉ cho ván MÌNH không thua — thua máy mà hiện ba sao là nói ngược. */
const hienSao = computed(() => props.showStars && props.summary.status === 'won' && props.minhKetCuc !== 'thua');

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

/** "Kiên 2 - 1 An" — tỷ số cả loạt, xếp theo số ván thắng. Chỉ hiện khi đã
 *  chơi từ ván thứ hai: ván đầu thì tỷ số 1-0 chẳng nói lên điều gì. */
const series = computed(() => {
  const wins = props.seriesWins;
  if (!props.multiplayer || !wins) return null;
  const rows = props.summary.ranking
    .map((p) => ({ name: tenNguoi(p), w: wins[p.name] ?? 0 }))
    .sort((a, b) => b.w - a.w);
  const total = rows.reduce((n, r) => n + r.w, 0);
  if (total < 2) return null;
  return rows.length === 2
    ? `${rows[0]!.name} ${rows[0]!.w} - ${rows[1]!.w} ${rows[1]!.name}`
    : rows.map((r) => `${r.name} ${r.w}`).join(' · ');
});

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
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="resTitle" @keydown.esc="emit('menu')">
    <div class="panel">
      <h2 id="resTitle">{{ title }}</h2>
      <p class="reason">{{ reasonText }}</p>

      <!-- Tỷ số cả loạt: chơi với nhau nhiều ván thì đây mới là con số người ta
           thực sự quan tâm, chứ không phải điểm của riêng ván vừa xong -->
      <p v-if="series" class="series">🏅 {{ series }}</p>

      <p v-if="hienSao" class="stars" :aria-label="t('kq.saoAria', { n: summary.stars })">
        <span
          v-for="i in 3" :key="i"
          class="star"
          :class="{ lit: i <= shownStars, dim: i > summary.stars }"
        >★</span><span
          v-if="summary.hoanHao" class="thu4" :class="{ hien: shownStars >= 4 }"
        ><i class="tia" aria-hidden="true" /><span class="star sao4 song">★</span><i
          v-for="d in 5" :key="d" :class="`dom d${d}`" aria-hidden="true"
        >✦</i></span>
      </p>
      <!-- Mốc 3★ nói thẳng ra: 3★ cố ý khó (chủ dự án 14.10.2026), người chơi phải
           biết thiếu bao nhiêu mới có cái để phấn đấu -->
      <p v-if="hienSao && starMisses" class="sai-sao">
        <template v-if="summary.hoanHao">{{ t('kq.hoanHao') }}</template>
        <template v-else>
          {{ t('kq.quenN', { n: summary.ranking[0]?.quen ?? 0 }) }} ·
          <span class="nhom"><span class="vang">{{ '★'.repeat(Math.min(saoKe.sao, 3)) }}</span><span v-if="saoKe.sao === 4" class="sao4 song">★</span> {{ saoKe.txt }}</span>
        </template>
      </p>

      <ol v-if="multiplayer" class="ranking">
        <li v-for="(p, i) in summary.ranking" :key="p.id">
          <!-- Hoà thì hai người đầu cùng hạng 1, không phải 1 và 2 -->
          <span>
            {{ draw && i < 2 ? 1 : i + 1 }}. {{ tenNguoi(p) }}
            <!--
              Ai muốn chơi tiếp, ai đã đi: nhãn nằm NGAY CẠNH TÊN, không phải ở
              dòng thông báo dưới nút. Bảng xếp hạng vốn đã là chỗ mắt đang đọc
              tên từng người, nên gắn vào đây là đọc một lần biết cả hai chuyện.
            -->
            <i v-if="rematchState?.[p.id] === 'in'" class="tag in">{{ t('kq.choiTiep') }}</i>
            <i v-else-if="rematchState?.[p.id] === 'out'" class="tag out">{{ t('kq.daThoat') }}</i>
          </span>
          <b>{{ num(p.score) }}</b>
          <small>{{ t('kq.capChuoi', { cap: p.pairs, chuoi: p.bestStreak }) }}</small>
        </li>
      </ol>

      <!-- Điểm là phần thưởng của cả ván: cho nó cỡ chữ xứng đáng và đếm dần lên -->
      <p v-if="!multiplayer" class="score-big" :aria-label="t('kq.diemAria', { n: summary.score })">
        <DongXu :size="26" />
        <b>{{ num(shownScore) }}</b>
        <small>{{ t('chung.diem') }}</small>
        <!-- Điểm ván bay xuống nhập vào tổng tích luỹ -->
        <i v-if="totalPhase === 'flying'" class="fly" aria-hidden="true">+{{ num(totalGain) }}</i>
      </p>

      <!-- Tổng tích luỹ: đích của điểm ván, sáng lên đúng lúc nhận -->
      <p v-if="totalGain" class="total-row khay-nho khay-noi" :class="{ landed: totalPhase === 'landed' }">
        <span>{{ t('kq.tongDiem') }}</span>
        <b>{{ num(shownTotal) }}</b>
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
          v-if="showNext"
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
      <button v-if="multiplayerOnline" class="btn to-lobby" type="button" @click="emit('lobby')">
        {{ t('kq.vePhongCho') }}
      </button>
      <!--
        Ván offline: "Đổi bàn" về thẳng bước chọn cỡ bàn — người vừa chơi xong
        thường muốn đổi cỡ, ít khi muốn về tận màn đầu (chủ dự án duyệt
        11.10.2026). Online giữ "Về menu": ở đó không có bước chọn bàn.
      -->
      <button v-if="multiplayerOnline" class="btn link" type="button" @click="emit('menu')">{{ t('kq.veMenu') }}</button>
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
  position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
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
.stars { margin: 0 0 12px; font-size: 32px; letter-spacing: 6px; }
.stars:has(+ .sai-sao) { margin-bottom: 2px; }
.sai-sao { margin: 0 0 12px; font-size: 13px; color: var(--muted); }
.sai-sao .nhom { white-space: nowrap; }
.sai-sao .vang { color: var(--gold); }
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
.thu4 .star.sao4 { color: transparent; }
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
.star { color: var(--line); display: inline-block; transition: color .2s; }
.star.lit {
  color: var(--gold);
  text-shadow: 0 0 14px color-mix(in srgb, var(--gold) 70%, transparent);
  animation: star-in .45s cubic-bezier(.3, 1.8, .5, 1);
}
.star.dim { color: var(--line); }
@keyframes star-in {
  0% { transform: scale(.2) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.35) rotate(8deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

.series {
  margin: 0 0 10px; padding: 8px 14px; border-radius: var(--r-full);
  font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-lg); text-align: center;
  font-variant-numeric: tabular-nums;
  background: var(--accent-soft); color: var(--fg);
}

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

/* Con số "+N" rời khối điểm ván, bay xuống dòng Tổng điểm */
.score-big { position: relative; }
.fly {
  position: absolute; left: 50%; top: 50%;
  font-style: normal; font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-lg); color: #f0a500;
  text-shadow: 0 2px 10px rgba(240, 165, 0, .55);
  pointer-events: none;
  animation: total-fly .5s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes total-fly {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.7); }
  25% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
  100% { opacity: 0; transform: translate(-50%, 190%) scale(.6); }
}

/* Dòng tổng tích luỹ */
.total-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  /* Lề TRÊN: ván nhiều người thì dòng này đứng ngay dưới bảng xếp hạng, thiếu
     lề là dính sát như lỗi (chủ dự án báo). Ván một mình thì lề dưới của khối
     điểm phía trên gộp với lề này, không bị hở gấp đôi. */
  margin: 10px 0 12px; padding: 8px 14px;
  border: 1px solid var(--line); border-radius: var(--r-md);
  font-size: var(--text-sm); color: var(--muted);
  transition: border-color .25s ease, background .25s ease;
}
.total-row b {
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg);
  font-variant-numeric: tabular-nums; color: var(--fg);
}
/* Lúc điểm cập bến: viền vàng thắp lên rồi số bắt đầu chạy */
.total-row.landed {
  border-color: color-mix(in srgb, var(--gold) 65%, transparent);
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  animation: total-land .45s cubic-bezier(.3, 1.6, .5, 1);
}
@keyframes total-land { 40% { transform: scale(1.03); } }

.stats { margin: 0; display: grid; gap: 6px; }
.stats div { display: flex; justify-content: space-between; gap: 12px; }
.stats dt { color: var(--muted); font-size: 14px; }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }

/* Bảng xếp hạng là NỘI DUNG CHÍNH của bảng kết quả nhiều người, không phải chú
   thích: tên và điểm cỡ chữ lớn, dòng "7 cặp · chuỗi 4" cũng nâng từ 12px lên
   var(--text-sm) cho đọc được mà không phải nhíu mắt. Mỗi hàng có nền riêng để
   tách người này với người kia. */
.ranking { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.ranking li {
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 2px 10px;
  padding: 8px 12px; border-radius: var(--r-md);
  background: var(--panel-soft);
}
.ranking li > span {
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg);
  min-width: 0; overflow-wrap: anywhere;
}
.ranking li b {
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}
.ranking li:first-child { background: color-mix(in srgb, var(--ok) 12%, var(--panel-soft)); }
.ranking li:first-child b { color: var(--ok); }
.ranking small { grid-column: 1 / -1; color: var(--muted); font-size: var(--text-sm); }
/* Nhãn "Chơi tiếp" / "Đã thoát": nhỏ và không in nghiêng (dùng <i> cho gọn thẻ,
   không phải để nghiêng), nằm cùng dòng với tên nhưng KHÔNG chiếm chỗ của điểm.
   white-space: nowrap để nó không bị ngắt giữa biểu tượng và chữ. */
.ranking .tag {
  font-style: normal; white-space: nowrap;
  font-family: var(--font-body); font-weight: 700; font-size: var(--text-xs);
  padding: 2px 8px; border-radius: var(--r-full); vertical-align: middle;
  margin-left: 6px;
}
/* Xanh --ok-solid chứ không phải --ok: chữ nhỏ 700 trên nền mờ, --ok chỉ đạt
   ~3,2:1 nên đọc mờ. Nền mờ cùng màu để nhãn là một chip, không phải chữ trôi. */
.ranking .tag.in {
  color: var(--ok-solid);
  background: color-mix(in srgb, var(--ok) 16%, transparent);
}
.ranking .tag.out {
  color: var(--muted);
  background: color-mix(in srgb, var(--muted) 14%, transparent);
}
/* Hàng nhất có nền xanh nhạt sẵn — nhãn xanh trên đó thành chìm, nên đổi nền
   nhãn sang trắng mờ để vẫn tách ra khỏi hàng. */
.ranking li:first-child .tag.in { background: color-mix(in srgb, var(--ok) 26%, transparent); }

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
  .stars { margin-bottom: 4px; font-size: 24px; letter-spacing: 4px; }
  .stars:has(+ .sai-sao) { margin-bottom: 0; }
  .stars { line-height: 1.1; }
  .sai-sao { margin-bottom: 4px; font-size: 12px; }
  .score-big { margin: 2px 0 6px; padding: 6px 12px; }
  .score-big b { font-size: var(--text-xl); }
  .total-row { margin-bottom: 6px; padding: 5px 12px; }
  .stats { grid-template-columns: 1fr 1fr; gap: 4px 14px; }
  .stats dt, .stats dd { font-size: 13px; }
  .achievements { margin-top: 8px; }
  .goi-y { margin-top: 6px; padding: 5px 6px 5px 10px; }
  .goi-y small { display: none; }
  .row { margin-top: 10px; }
  .row .btn, .row .btn-primary { min-height: 46px; }
}
</style>
