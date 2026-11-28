<script setup lang="ts">
/**
 * HÀNG NGƯỜI CHƠI ONLINE — DÙNG CHUNG cho MỌI kiểu chơi online (ghép cặp, Tìm Thẻ, kiểu sau này).
 * 28.11.2026, chủ dự án: "tại sao chúng ta cứ có sự khác biệt giữa màn chơi này và màn thường… phải làm cơ chế để tái
 * sử dụng, vì sau này có thể làm ra các thể loại chơi khác nữa". Tách NGUYÊN VĂN từ OnlineGame (markup + CSS, mọi bài học
 * đo đạc giữ nguyên chú thích): chip cao cố định 44px, thứ tự hy sinh khi chip hẹp, nhãn MẤT MẠNG / ĐÃ RỜI, chấm mạng của
 * mình, tỷ số loạt, dải gọn từ 5 người + bảng đầy đủ, `data-chip-for` cho bong bóng chat (lib/neo-bong).
 *
 * Kiểu chơi đưa người chơi về dạng chung `NguoiDai`; phần riêng cắm qua khe:
 *   · `#mat="{ p }"` — trong ô mặt (huy hiệu trạng thái của Tìm Thẻ…);
 *   · `#sau="{ p }"` — cuối chip, sau điểm (viên số giây, "+điểm" bay…);
 *   · `lopChip(p)` — lớp thêm cho chip (nảy khi vừa chọn…), kiểu chơi tự viết CSS bằng `:deep()`.
 * Không có LƯỢT (`coLuot = false`, vd Tìm Thẻ — mọi người chơi cùng lúc): không chip nào "đang đi", mọi chip bằng nhau,
 * không lùi mờ; `traoRa` cho phần khe tràn khỏi chip (chip ghép cặp cắt phần thừa — lưới an toàn của điểm).
 */
import { TURN_LIMIT_SEC } from '@mm/engine';
import { computed, ref, watch } from 'vue';
import { HeartCrack, List, LogOut, Timer, WifiOff } from 'lucide-vue-next';
import MatNguoi from './MatNguoi.vue';
import DauPremium from './DauPremium.vue';
import OptionIcon from './OptionIcon.vue';
import { t } from '@/lib/i18n';
import { num, numGon } from '@/lib/format';
import { pingSo } from '@/lib/ping-so';

export interface NguoiDai {
  id: string;
  /** Tên hiển thị (đã qua `tenNguoi`). */
  ten: string;
  /** Tên gốc — khoá của tỷ số loạt (lib/ty-so-loat). */
  tenGoc: string;
  avatar?: string;
  anh?: string;
  mau?: string;
  hh?: string;
  diem: number;
  connected: boolean;
  /** Đã rời / bỏ cuộc giữa ván. */
  roi: boolean;
  lives: number | null;
}

const props = withDefaults(defineProps<{
  nguoi: readonly NguoiDai[];
  dangDiId?: string | null;
  toiId?: string;
  netHien?: string;
  pingHien?: number | null;
  /** Giây còn của lượt (ghép cặp); null = không có đồng hồ lượt. */
  dongHoLuot?: number | null;
  cong5s?: { playerId: string; key: number } | null;
  tySo?: Record<string, { n: number; dan: boolean }> | null;
  coLuot?: boolean;
  traoRa?: boolean;
  lopChip?: (p: NguoiDai) => unknown;
}>(), { dangDiId: null, toiId: '', netHien: '', pingHien: null, dongHoLuot: null, cong5s: null, tySo: null, coLuot: true, traoRa: false, lopChip: undefined });

/**
 * TỪ 5 NGƯỜI TRỞ LÊN ĐỔI SANG DẢI GỌN — cùng luật với PlayerStrip (chơi cùng máy), xem chú thích đầy đủ ở đó. Tóm lại:
 * chia đều một hàng cho 10 người là mỗi chip 33px, tên biến mất và điểm rơi ra ngoài; xếp hai hàng thì ăn thêm 20px
 * chiều cao của bàn — mà bàn nay tới 88 thẻ.
 */
const gonStrip = computed(() => props.nguoi.length > 4);
const soNguoi = computed(() => props.nguoi.length);
const dangDi = computed(() => props.nguoi.find((p) => p.id === props.dangDiId) ?? props.nguoi[0]);
/** Những người không đang đi, xoay vòng để người ĐI NGAY SAU đứng đầu hàng. */
const khac = computed(() => {
  const ps = props.nguoi;
  if (!ps.length) return [];
  const at = ps.findIndex((p) => p.id === props.dangDiId);
  const start = at < 0 ? 1 : at + 1;
  return Array.from({ length: ps.length - 1 }, (_, k) => ps[(start + k) % ps.length]!);
});
/** Bảng đầy đủ (tên, điểm, mạng, ai mất mạng) — chỉ mở khi người chơi bấm. */
const moBang = ref(false);
watch(() => props.nguoi.length, () => { moBang.value = false; });
</script>

<template>
  <div class="strip-wrap" :class="{ deu: !coLuot, tran: traoRa }">
    <!-- TỚI 4 NGƯỜI: dạng cũ, mỗi người một chip có tên -->
    <div v-if="!gonStrip" class="strip" :class="{ dong: coLuot && soNguoi >= 3 }">
      <div
        v-for="p in nguoi" :key="p.id"
        class="pchip" :class="[{ active: coLuot && p.id === dangDiId, off: !p.connected || p.roi, 'co-loat': !!tySo }, lopChip?.(p)]"
        :data-chip-for="p.id"
      >
        <span class="avatar" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /><DauPremium :loai="p.hh" /><slot name="mat" :p="p" /></span>
        <b>{{ p.ten }}</b>
        <!-- Mờ 55% là không đủ để biết chuyện gì: nói thẳng ra. Trước đây bên
             kia mất mạng hay thoát hẳn thì bên này không hay biết. -->
        <span v-if="p.roi" class="netbad" :title="t('og.daRoiPhong')"><LogOut :size="13" :stroke-width="2.6" class="ic-n" aria-hidden="true" /> {{ t('og.daRoi') }}</span>
        <span v-else-if="!p.connected" class="netbad" :title="t('og.matKetNoi')">
          <WifiOff :size="13" :stroke-width="2.6" class="ic-n" aria-hidden="true" /><span class="chu"> {{ t('og.offline') }}</span>
        </span>
        <!-- Mạng của MÌNH, gắn cạnh tên mình. Mặc định CHỈ CHẤM MÀU xanh · vàng · đỏ
             (chủ dự án 16.10.2026: số ms làm rối); số ms bật lại được trong chế độ
             debug (lib/ping-so.ts). Số vẫn ở title / aria-label. -->
        <span
          v-else-if="p.id === toiId"
          class="ping" :class="[netHien, { cham: !pingSo }]"
          role="img"
          :title="pingHien === null ? t('og.pingDangDo') : t('og.ping', { n: pingHien })"
          :aria-label="pingHien === null ? t('og.pingDangDo') : t('og.ping', { n: pingHien })"
        >{{ !pingSo ? '' : pingHien === null ? '···' : `${pingHien}ms` }}</span>
        <!-- Quá 5 mạng thì hiện SỐ: bàn 42 thẻ có tới 56 mạng, 56 trái tim thì
             tràn cả chip người chơi. -->
        <!-- MẠNG HIỆN BẰNG SỐ, không phải chuỗi trái tim: chuỗi phình theo số
             mạng (bàn 42 thẻ có tới 56 mạng) nên nó là thứ đẩy điểm ra khỏi
             chip. Một icon + một số thì rộng bao nhiêu mạng cũng như nhau. -->
        <small v-if="p.lives !== null" class="lives" :title="t('ps.mang', { n: p.lives })">
          <HeartCrack v-if="p.lives <= 0" :size="13" :stroke-width="2.5" class="ic-n het" aria-hidden="true" />
          <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
        </small>
        <span
          v-if="p.id === dangDiId && dongHoLuot !== null"
          class="turn-clock" :class="{ urgent: dongHoLuot <= 10 }"
          role="timer" :aria-label="t('ps.conGiay', { n: Math.ceil(dongHoLuot) })"
        >{{ Math.ceil(dongHoLuot) }}s</span>
        <!-- ĐỒNG HỒ LƯỢT CÒN LÀ MỘT THANH RÚT DẦN ở mép dưới chip. Nó nằm
             `absolute` nên tốn 0px bề rộng — đúng thứ đang thiếu — và cái
             đang cạn dần đọc nhanh hơn một con số. Số giây ở trên chỉ còn là
             phần thêm, tự ẩn khi chip hẹp. -->
        <span
          v-if="p.id === dangDiId && dongHoLuot !== null"
          class="turn-bar" :class="{ urgent: dongHoLuot <= 10 }" aria-hidden="true"
          :style="{ '--con': Math.max(0, Math.min(1, dongHoLuot / TURN_LIMIT_SEC)) }"
        ></span>
        <Transition name="plus">
          <span
            v-if="cong5s && cong5s.playerId === p.id"
            :key="cong5s.key" class="plus10"
          >+5s</span>
        </Transition>
        <span v-if="tySo" class="wins" :class="{ dan: tySo[p.tenGoc]?.dan }" :title="t('ps.daThang', { n: tySo[p.tenGoc]?.n ?? 0 })">{{ tySo[p.tenGoc]?.n ?? 0 }}</span>
        <span class="pts" :class="{ dai: p.diem >= 1000 }" :title="num(p.diem)">{{ numGon(p.diem) }}</span>
        <slot name="sau" :p="p" />
      </div>
    </div>

    <!-- TỪ 5 NGƯỜI: chip lượt + hàng avatar. `data-chip-for` phải có ở CẢ HAI
         dạng — EmojiBlast tìm chip theo id để bay lên từ đúng chỗ người gửi. -->
    <div v-else-if="dangDi" class="strip gon">
      <div class="turn-chip" :data-chip-for="dangDi.id" :class="{ off: !dangDi.connected || dangDi.roi }">
        <span class="avatar" :class="{ 'vong-mau': !!dangDi.mau }" :style="dangDi.mau ? { '--m': dangDi.mau } : undefined"><MatNguoi :mat="dangDi.avatar" :anh="dangDi.anh" /><DauPremium :loai="dangDi.hh" /><slot name="mat" :p="dangDi" /></span>
        <span class="tb">
          <b class="nm">{{ dangDi.ten }}</b>
          <span class="sub">
            <template v-if="dongHoLuot !== null">
              <Timer :size="11" /><span :class="{ urgent: dongHoLuot <= 10 }">{{ Math.ceil(dongHoLuot) }}s</span> ·
            </template>
            <template v-if="dangDi.id === toiId">{{ t('og.luotBan') }}</template>
            <template v-else>{{ t('ps.dangDi') }}</template>
          </span>
        </span>
        <Transition name="plus">
          <span
            v-if="cong5s && cong5s.playerId === dangDi.id"
            :key="cong5s.key" class="plus10"
          >+5s</span>
        </Transition>
        <span class="pts" :title="num(dangDi.diem)">{{ numGon(dangDi.diem) }}</span>
      </div>

      <ul class="rest">
        <li
          v-for="(p, k) in khac" :key="p.id"
          class="mini" :class="{ next: k === 0, off: !p.connected || p.roi }"
          :data-chip-for="p.id"
          :title="t('ps.diemCua', { ten: p.ten, n: p.diem })"
        >
          <span class="avatar" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /><DauPremium :loai="p.hh" /><slot name="mat" :p="p" /></span>
          <!-- Mất mạng / đã rời: một chấm đỏ thay cho chữ. Ở cỡ này không có
               chỗ cho "📴 mất mạng", mà bỏ hẳn thì bên kia biến mất không lý do. -->
          <span v-if="p.roi || !p.connected" class="dot" :title="p.roi ? t('og.daRoiPhong') : t('og.matKetNoi')"></span>
          <span class="mpts">{{ p.diem }}</span>
          <span class="sr-only">{{ t('ps.diemCuaSr', { ten: p.ten, n: p.diem }) }}</span>
        </li>
        <li class="more">
          <button
            type="button" class="more-btn"
            :aria-expanded="moBang" :aria-label="t('ps.bang')"
            @click="moBang = !moBang"
          ><List :size="15" /></button>
        </li>
      </ul>
    </div>

    <!-- Bảng đầy đủ: nổi ĐÈ lên bàn, không chen vào dòng — chen vào là mỗi lần
         mở lại bóp bàn thẻ rồi bung ra, thẻ nhảy chỗ giữa ván. Sắp theo ĐIỂM. -->
    <Transition name="sheet">
      <ul v-if="moBang && gonStrip" class="sheet panel" :aria-label="t('ps.bang')">
        <li
          v-for="(p, i) in [...nguoi].sort((a, b) => b.diem - a.diem)" :key="p.id"
          :class="{ active: coLuot && p.id === dangDiId, off: !p.connected || p.roi }"
        >
          <span class="rank">{{ i + 1 }}</span>
          <span class="avatar" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /><DauPremium :loai="p.hh" /><slot name="mat" :p="p" /></span>
          <b class="nm">{{ p.ten }}</b>
          <span v-if="p.roi" class="netbad"><LogOut :size="13" :stroke-width="2.6" class="ic-n" aria-hidden="true" /> {{ t('og.daRoi') }}</span>
          <span v-else-if="!p.connected" class="netbad"><WifiOff :size="13" :stroke-width="2.6" class="ic-n" aria-hidden="true" /> {{ t('og.offline') }}</span>
          <small v-if="p.lives !== null" class="lives">
            <HeartCrack v-if="p.lives <= 0" :size="13" :stroke-width="2.5" class="ic-n het" aria-hidden="true" />
            <template v-else><OptionIcon name="lives" :size="12" />{{ p.lives }}</template>
          </small>
          <span v-if="tySo" class="wins" :class="{ dan: tySo[p.tenGoc]?.dan }">{{ tySo[p.tenGoc]?.n ?? 0 }}</span>
          <span class="pts">{{ p.diem }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
/* Bọc để bảng đầy đủ neo được (absolute) mà không đụng tới dòng của bàn thẻ. */
.strip-wrap { position: relative; }
.strip { display: flex; gap: 6px; }

/* ---------- DẢI GỌN (từ 5 người) — cùng ngôn ngữ với PlayerStrip ---------- */

.strip.gon { align-items: stretch; }
/* Chip người đang đi: khối gradient đặc, KHÔNG viền nhấp nháy như .pchip.active —
   ở đây nó đã là thứ duy nhất có màu, thêm animation nữa là dải bồn chồn. */
.turn-chip {
  position: relative; flex-shrink: 0;
  display: flex; align-items: center; gap: 7px; padding: 5px 9px;
  border-radius: 12px; color: var(--chon-chu);
  background: var(--chon-nen);
  box-shadow: 0 4px 16px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .3);
}
.turn-chip.off { opacity: .55; }
.turn-chip .avatar { font-size: 18px; }
.turn-chip .tb { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.turn-chip .nm {
  font-family: var(--font-display); font-size: 12.5px; font-weight: 800;
  max-width: 92px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.turn-chip .sub {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9.5px; font-weight: 700; opacity: .92;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
/* Sắp hết giờ: nhấp nháy NGAY TRONG chip lượt — đồng hồ đã ở chỗ mắt đang nhìn */
.turn-chip .sub .urgent { animation: clock-pulse .5s steps(2) infinite; }
.turn-chip .pts {
  margin-left: 2px; font-family: var(--font-display); font-size: 17px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.turn-chip .plus10 { color: #fff; }

.rest {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px;
  padding: 0 4px; list-style: none; margin: 0;
  border: 1px solid var(--line); border-radius: 12px; background: var(--panel);
}
.mini {
  position: relative; flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center;
  border-radius: 9px; padding: 1px 0;
  /* Mỗi ô tự biết mình rộng bao nhiêu, để quyết định có đủ chỗ cho điểm không */
  container-type: inline-size;
}
/* Người ĐI NGAY SAU: nền nhạt. Chỉ một dấu hiệu, không viền — mười ô có viền
   thì hàng này thành một dãy hộp, mắt không bắt được ô nào đang được chỉ. */
.mini.next { background: var(--accent-soft); }
.mini.off { opacity: .5; }
.mini .avatar { font-size: 15px; line-height: 1.05; }
.mini .mpts {
  font-size: 10px; font-weight: 800; color: var(--muted);
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
/*
 * Ô QUÁ HẸP THÌ BỎ ĐIỂM, giữ avatar.
 *
 * Đo trên iPhone SE (vùng web 375×553) với 10 người: mỗi ô chỉ còn 17,2px, mà
 * "100" đã cần 18px — cả chín ô đều tràn, và số càng lớn càng thò sang ô bên
 * cạnh (12345 thò 6,4px). Chữ chồng lên nhau đọc còn tệ hơn không có chữ.
 *
 * 22px là mốc đủ cho ba chữ số ở cỡ 10px. Mất điểm ở đây không mất thông tin:
 * bảng đầy đủ (nút danh sách cuối dải) vẫn có điểm của mọi người, và người
 * ĐANG ĐI thì điểm nằm ngay trên chip lượt.
 */
@container (max-width: 22px) {
  .mini .mpts { display: none; }
}
.mini .dot {
  position: absolute; top: 0; right: 12%;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--bad); box-shadow: 0 0 0 1.5px var(--panel-solid);
}
.more { flex-shrink: 0; display: flex; align-items: center; }
/* Nút nhỏ mà vùng chạm vẫn phải 44px: nới bằng ::after, KHÔNG phình cái nút
   (phình là dải cao thêm — đúng thứ dải gọn đang tiết kiệm). Phải ghi đè cả
   min-width/min-height vì `.btn` toàn cục đặt 44px. */
.more-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; min-width: 0; min-height: 0; padding: 0;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
}
.more-btn::after { content: ''; position: absolute; inset: -9px; }
.more-btn[aria-expanded='true'] { background: var(--accent-soft); color: var(--accent); }

/* ---------- BẢNG ĐẦY ĐỦ ---------- */

.sheet {
  position: absolute; z-index: 12; top: calc(100% + 6px); left: 0; right: 0;
  display: flex; flex-direction: column; gap: 3px;
  max-height: 58vh; overflow: auto;
  list-style: none; margin: 0; padding: 8px;
}
.sheet li {
  display: flex; align-items: center; gap: 8px;
  min-height: 34px; padding: 3px 7px; border-radius: 9px;
}
.sheet li.active { background: var(--accent-soft); }
.sheet li.off { opacity: .6; }
.sheet .rank {
  flex-shrink: 0; width: 17px; text-align: center;
  font-family: var(--font-display); font-size: 12px; font-weight: 800; color: var(--muted);
}
.sheet .avatar { font-size: 17px; }
.sheet .nm {
  flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sheet .pts { font-family: var(--font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .14s ease, transform .14s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; transform: translateY(-6px); }
.pchip {
  /* `container-type: inline-size` để nhãn "mất mạng" tự bỏ chữ khi chip hẹp —
     truy vấn theo CHIP, không theo màn hình: cùng một màn hình, chip 2 người
     rộng gấp đôi chip 4 người. */
  container-type: inline-size;
  position: relative; flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border: 2px solid var(--line); border-radius: 12px;
  background: var(--panel); box-shadow: var(--shadow-soft);
  overflow: hidden;
  transition: flex-grow .22s ease, transform .22s ease;
}
/*
 * CHIP CAO CỐ ĐỊNH 44px — DẢI KHÔNG ĐƯỢC ĐỔI CHIỀU CAO KHI CHUYỂN LƯỢT.
 * Đo trên iPhone 15 Pro Max, bàn 3 người: chip đang đi cao 46,1px (viên điểm
 * 19px) còn chip chờ 39,8px; lúc chuyển lượt chip mới còn HẸP trong 220ms
 * transition flex-grow nên truy vấn container ≤128px hạ viên điểm xuống 17px →
 * dải 48,5 → 45,5px → ResizeObserver đo lại → bàn 356 → 358px rồi quay về.
 * Đúng cái "bàn đổi kích thước xíu khi chuyển lượt" người chơi báo. Khoá chiều
 * cao thì nội dung chip ra sao cũng không chạm tới bàn thẻ.
 */
.pchip { height: 44px; }
/* Dải người chơi phải chừa chỗ cho chip đang đi nở ra (scale 1.035) — không thì
   bóng và mép trên của nó bị cắt mất. */
/* Chừa chỗ cho chip đang đi nở ra (scale 1.035). 2px là đủ: chip cao 44px thì
   nở ra thêm 1,4px mỗi đầu. Đệm 4px cũ ăn 8px chiều cao của BÀN THẺ — mà bàn
   đang bị chặn bởi chiều cao, nên 8px đó biến thành bề rộng bỏ phí. */
.strip { align-items: center; padding: 2px 0; }
/*
 * CHIP CỦA NGƯỜI ĐANG ĐI NỞ RỘNG VÀ NỔI LÊN.
 *
 * Hai việc hoá ra là một: nó vừa là thứ bắt mắt nói "đang tới lượt ai" (trên
 * điện thoại không có hover, dải người chơi là chỗ duy nhất nói điều đó), vừa
 * chính là chip cần thêm diện tích — chip đang đi là chip đông thứ nhất: thêm
 * ping, số giây và thanh thời gian. Chỗ đó lấy từ những người đang CHỜ, nên
 * dải KHÔNG cao thêm một pixel nào và bàn thẻ không mất chỗ.
 */
.pchip.active {
  flex-grow: 2; transform: scale(1.035); z-index: 2;
  border-color: transparent; color: var(--chon-chu);
  background: var(--chon-nen);
  box-shadow: 0 6px 22px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .3);
  animation: chip-breathe 1.8s ease-in-out infinite;
}
@keyframes chip-breathe {
  50% { box-shadow: 0 8px 30px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .3); }
}
@media (prefers-reduced-motion: reduce) { .pchip.active { animation: none; } }
.pchip.active b { font-size: 12px; }
/* Chip đang đi: điểm nằm trong một viên thuốc sáng — viên thuốc chỉ dành cho
   chip này, chip chờ không đủ chỗ cho 16px đệm của nó. */
.pchip.active .pts {
  /*
   * ĐẢO MÀU: mực tím đậm trên nền TRẮNG ĐẶC.
   *
   * Bản trước để chữ trắng trên nền trắng 18% — trên nền gradient tím thì viên
   * thuốc mờ đó gần như cùng sáng với chữ, đọc rất khó (người chơi báo). Trắng
   * đặc còn làm điểm thành vật SÁNG NHẤT cả dải, đúng vai nó phải đóng.
   */
  font-size: 19px; color: #3b1e8f;
  padding: 1px 6px; border-radius: var(--r-full);
  background: #fff; box-shadow: 0 1px 6px rgba(0, 0, 0, .2);
}
.pchip.active .pts.dai { font-size: 18px; }
.pchip.active .ping { background: rgba(255, 255, 255, .18); color: #fff; }
.pchip.active .lives { color: #fff; }
/* Người đang chờ lùi lại một bước — tương phản làm chip đang đi nổi hơn hẳn
   mà không phải tô thêm màu gì. */
.pchip:not(.active) { opacity: .82; transform: scale(.97); }
.pchip.off { opacity: .55; }
/* Chip 3–4 người thì hết chỗ cho cả chữ: giữ icon, bỏ chữ (title và nhãn cho
   máy đọc vẫn còn). Bảng đầy đủ và dải gọn vẫn hiện đủ chữ. */
/*
 * CHIP HẸP (nội dung ≤ 176px — mọi chip trừ bàn 2 người màn rộng): viên MẤT MẠNG thành HUY HIỆU ở góc trên-phải avatar
 * (absolute, 0px bề ngang), kể cả chip người đang đi. Để trong hàng thì nó ăn ~30px: `pnpm do:chip --tim` (28.11.2026)
 * đo được điểm "9,9k" bị cắt còn "9,9" ở bàn 4 người, tên bị ép còn MỘT chữ cái ở bàn 2 người; `pnpm do:chip` (ghép
 * cặp) bắt đúng lỗi đó ở chip người đang đi mà rớt mạng. Góc này trống: chấm ping chỉ ở chip của MÌNH, mà chip mình
 * không bao giờ báo mất mạng. Chip mờ + icon đã đủ nói "mất mạng"; chip rộng vẫn có cả chữ trong hàng.
 */
@container (max-width: 176px) {
  .netbad .chu { display: none; }
  .netbad { position: absolute; z-index: 1; left: 22px; top: 1px; padding: 1px 2px; line-height: 0; background: var(--panel); box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--bad) 40%, transparent); }
}
/* Ô MÀU HỒ SƠ ở chip hẹp: bỏ lề .2em hai bên (global.css) — ~7px đó đúng bằng phần điểm bị lẹm ở chip chờ bàn 3–4 người
   và chip đang đi của mình ở SE 4 người (`pnpm do:chip`, avatar có màu từ 25.11.2026). Ô màu vẫn vẽ đủ (::before căn giữa, tràn sang khoảng `gap`). */
@container (max-width: 128px) { .pchip .vong-mau { margin-inline: 0; } }
/*
 * THỨ TỰ HY SINH KHI CHIP HẸP DẦN — đo trên vùng web 430px với điểm 5 chữ số.
 * Ngưỡng là CONTENT-BOX (chip trừ padding 18 và viền 4), không phải bề rộng
 * chip: chip 200px khớp `max-width: 176px`. Đã đo hụt một lần vì tưởng ngược lại.
 */
@container (max-width: 176px) { .pchip .ping:not(.cham) { display: none; } }   /* chấm 9px thì luôn vừa */
@container (max-width: 176px) { .pchip .turn-clock { display: none; } }  /* thanh dưới vẫn nói đủ */
@container (max-width: 128px) {
  .pchip .lives { display: none; }
  /* Chip đang đi ở bàn 3–4 người: viên thuốc thu lại, nhưng con số vẫn to nhất chip. */
  .pchip.active .pts { font-size: 17px; padding: 1px 5px; }
  .pchip.active .pts.dai { font-size: 16px; }
}
/* Chip CHỜ hẹp quá (bàn 4 người: nội dung còn 61px) thì bỏ TÊN, giữ avatar và
   ĐIỂM. Avatar đã là danh tính và tên đầy đủ còn đọc được ở bảng ☰ — điểm thì
   không có chỗ nào khác. Đây là lỗi thứ hai người chơi bắt được. */
/* 90 (trước 72, 28.11.2026 `pnpm do:chip --tim`): Tìm Thẻ 4 người trên Pro Max nội dung chip ~78px — qua ngưỡng 72 nên tên
   còn hiện nhưng bị ép còn "N" (5–7px). Ghép cặp ≥3 người đã ẩn tên bằng `.dong` nên không đổi gì bên đó. */
@container (max-width: 90px) {
  .pchip:not(.active) b { display: none; }
  .pchip:not(.active) { justify-content: space-between; }
}
/*
 * CHIP CHỜ CÓ 🏅 TỶ SỐ LOẠT: BỎ TÊN, GIỮ AVATAR + 🏅 + ĐIỂM (07.11.2026).
 * Lỗi người chơi báo NHIỀU LẦN trên iPhone 15 Pro Max: bàn 2 người, người BÊN PHẢI đang
 * chờ lượt, đã thắng vài ván (🏅) và điểm cao → điểm bị cắt mất. Chip chờ 2 người chỉ
 * còn 1/3 dải (Pro Max 136px, SE 119px) mà phải chứa avatar + tên (sàn 2.2em) + 🏅 + điểm:
 * WebKit đo điểm khuất 3–10px ở Pro Max, tới 28px ở SE. Các lần sửa trước đều đo KHÔNG có
 * 🏅 nên không thấy. Ba chốt:
 *   · chip chờ có 🏅 mà hẹp (≤150px nội dung) thì bỏ tên — avatar đã là danh tính, giống
 *     bàn ≥3 người (`.dong`, chủ dự án duyệt 17.10);
 *   · tên ở chip chờ co được về 0 (lưới an toàn: có gì mới chen vào thì tên đi trước điểm);
 *   · 🏅 ở chip chờ gọn hơn (ít đệm).
 * `pnpm do:chip` nay đo cả ca này (🏅12 + "9,9k" ở chip phải).
 */
@container (max-width: 150px) {
  .pchip.co-loat:not(.active) b { display: none; }
  .pchip.co-loat:not(.active) { justify-content: space-between; }
}
.pchip:not(.active) b { min-width: 0; }
/*
 * BÀN ≥3 NGƯỜI: 🏅 THÀNH HUY HIỆU SỐ Ở GÓC AVATAR (absolute, tốn 0px bề ngang).
 * Chip chờ ở đây chỉ rộng 70px = avatar + điểm; viên 🏅 chen vào là đẩy điểm ra khỏi chip
 * (`pnpm do:chip` đo: SE 4 người cả bốn chip mất điểm). Giống chấm mạng: góc avatar.
 */
/* GÓC DƯỚI-PHẢI của avatar (22.11.2026, chủ dự án gửi ảnh: "nó bị lẹm đi, không hiển thị vị trí đẹp") — trước nằm ở
   góc TRÊN-TRÁI của chip (left/top 2px): chip `overflow: hidden` + bo góc nên vòng trắng bị cắt lẹm, lại đè lên mặt.
   Chỗ mới cách xa mọi góc bo, không đụng chấm mạng (góc trên-phải avatar) và thanh giờ lượt (đáy chip). */
.strip.dong .pchip .wins {
  position: absolute; z-index: 1; left: 21px; bottom: 3px;
  min-width: 15px; padding: 0 3px; font-size: 9.5px; line-height: 15px; text-align: center;
  background: rgba(30, 22, 48, .85); color: #fff; box-shadow: 0 0 0 1.5px #fff, 0 1px 3px rgba(0, 0, 0, .3);
}
/* Chip đang đi: avatar to hơn và dịch vào trong → viên số dịch theo, nhích lên khỏi thanh giờ lượt */
.strip.dong .pchip.active .wins { left: 21px; bottom: 5px; }

.pchip:not(.active) .wins { padding: 1px 5px; font-size: 11px; min-width: 20px; }
.netbad {
  flex-shrink: 0; font-size: 10.5px; font-weight: 800; white-space: nowrap;
  padding: 1px 5px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--bad) 18%, transparent); color: var(--bad);
}
/* Ping: chip nhỏ, đủ đọc mà không tranh chỗ với tên và điểm. Màu nói chất lượng
   nên không cần thêm chữ giải thích. */
.ping {
  flex-shrink: 0; font-size: 10px; font-weight: 800; white-space: nowrap;
  padding: 1px 5px; border-radius: var(--r-full);
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok);
}
.ping.ok  { background: color-mix(in srgb, var(--muted) 16%, transparent); color: var(--muted); }
.ping.bad { background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn); }
.ping.lost { background: color-mix(in srgb, var(--bad) 20%, transparent); color: var(--bad); }
/* Chấm màu (mặc định): xanh = tốt (cả 'ok' < 250ms), vàng = chậm, đỏ = mất. */
.ping.cham { width: 9px; height: 9px; padding: 0; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ok) 25%, transparent); }
.ping.cham.bad { background: var(--warn); box-shadow: 0 0 0 2px color-mix(in srgb, var(--warn) 25%, transparent); }
.ping.cham.lost { background: var(--bad); box-shadow: 0 0 0 2px color-mix(in srgb, var(--bad) 25%, transparent); }
.pchip.active .ping.cham { background: var(--ok); }
.pchip.active .ping.cham.bad { background: var(--warn); }
.pchip.active .ping.cham.lost { background: var(--bad); }
.pchip .avatar { font-size: 18px; }
/* Chấm mạng của MÌNH là huy hiệu ở góc avatar: nằm trong hàng là nó ăn 15px bề ngang
   (chip SE 4 người chỉ có ~60px), đủ đẩy điểm ra ngoài. Ping dạng SỐ (debug) vẫn ở hàng. */
.pchip .ping.cham { position: absolute; left: 24px; top: 6px; width: 8px; height: 8px; }
/*
 * TÊN KHÔNG BAO GIỜ ĐƯỢC BIẾN MẤT HẲN.
 *
 * `netbad` (📴 mất mạng) và `ping` không co, nên trên chip hẹp chúng đẩy tên
 * xuống 0px: người chơi chỉ còn thấy avatar và một nhãn đỏ, không biết nhãn đó
 * của ai (đã bị báo, có ảnh — chip của chính mình mất tên giữa ván). Sàn 3,5em
 * đủ cho vài ký tự đầu, phần thừa vẫn cắt bằng ellipsis như cũ.
 */
.pchip b {
  flex: 1 1 auto; font-size: 12px; min-width: 2.2em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pchip .lives {
  flex: none; display: inline-flex; align-items: center; gap: 2px;
  font-size: 11px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.pchip .lives :deep(.opt-ico) { border-radius: 4px; }
/* Số ván thắng trong loạt — thấy ai đang dẫn ngay trong ván */
.pchip .wins {
  /* TỶ SỐ CẢ LOẠT (mockup duyệt 16.11.2026): chỉ con số, không 🏅 (huy chương vàng trên nền
     vàng là chìm). Viên tối chữ trắng cho mọi người — kể cả 0; người DẪN xanh lá (`.dan`,
     lib/ty-so-loat.ts). KHÔNG tô đỏ người thua: đỏ hút mắt và trùng nghĩa mạng yếu. */
  flex-shrink: 0; min-width: 22px; box-sizing: border-box; text-align: center;
  font-size: 12px; font-weight: 900; line-height: 1.35;
  padding: 1px 7px; border-radius: var(--r-full);
  background: rgba(30, 22, 48, .78); color: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.wins.dan, .strip.dong .wins.dan { background: #16a34a; }
/*
 * ĐIỂM KHÔNG BAO GIỜ BỊ ĐẨY RA NGOÀI.
 *
 * Điểm lên 4 chữ số là chip vỡ: mọi thứ trong chip đều `nowrap`, tên lại có sàn
 * `min-width`, và chip không cắt phần thừa — mà `.pts` có `margin-left: auto`
 * nên nó đứng cuối hàng và chính nó bị đẩy ra. Đo trên iPhone 15 Pro Max (vùng
 * web 430): 3 người, điểm 1280 thì điểm nằm ở x=443, tức NGOÀI màn hình; người
 * chơi đã báo. Ba chốt dưới đây, đừng gỡ cái nào:
 *   · `flex-shrink: 0` ở `.pts` — điểm là thứ cuối cùng bị hy sinh;
 *   · `overflow: hidden` ở `.pchip` — lưới an toàn, thêm huy hiệu mới vào chip
 *     thì cùng lắm nó bị cắt trong chip chứ không văng ra ngoài màn hình;
 *   · tên co được (`min-width: 2.2em`) nhưng không biến mất.
 * Trần điểm lý thuyết là 5 chữ số (bàn 88 thẻ: 44 cặp × 200 + thưởng thời gian),
 * nên mọi phép đo phải thử tới đó. Có `test/diem-trong-chip.test.ts` canh.
 */
.pchip .pts {
  margin-left: auto; flex: none;
  font-family: var(--font-display); font-size: 16px; font-weight: 800;
  letter-spacing: -.01em; font-variant-numeric: tabular-nums;
}
/*
 * ĐIỂM LÀ CON SỐ TO NHẤT TRONG CHIP, và điểm càng cao càng KHÔNG được nhỏ đi.
 * Bản đầu làm ngược: `.dai` tụt xuống 13px, hoá ra ván càng hay thì điểm càng
 * khó đọc. Nay chỉ hạ đúng một nấc mỗi khi thêm một chữ số, và chỗ để hạ lấy
 * từ những thứ khác trong chip (ping, số giây) chứ không từ chính con số.
 */
.pchip .pts.dai { font-size: 15px; }        /* ≥ 1.000 */
/* Tên lùi xuống một bậc để con SỐ là thứ mắt bắt trước. */
.pchip:not(.active) b { color: var(--muted); font-weight: 600; }
/*
 * BÀN ĐÔNG (≥3 NGƯỜI): CHIP CHỜ CHỈ CÒN AVATAR + ĐIỂM, NHƯỜNG CHỖ CHO TÊN NGƯỜI ĐANG ĐI
 * (chủ dự án duyệt mockup 17.10.2026). Avatar đã là danh tính, tên đầy đủ ở bảng ☰.
 * Đo "Nguyễn Minh Anh": Pro Max 3 người hiện đủ, 4 người "Nguyễn Mi…"; SE 4 người "Ng…".
 * Bề ngang ĐẶT TAY (70px = avatar 16 + "9,9k" 14px + đệm, `pnpm do:chip` đo), không `auto`: chip có `container-type: inline-size` nên bề
 * rộng theo nội dung tính ra 0 — đã thử, chip chờ co thành sợi chỉ.
 * Lớp `dong` gắn bằng Vue, KHÔNG `:has()` (iOS < 15.4 không có).
 */
.strip.dong .pchip:not(.active) { flex: 0 1 70px; padding-inline: 6px; gap: 3px; justify-content: space-between; }
.strip.dong .pchip:not(.active) b { display: none; }
.strip.dong .pchip:not(.active) .pts { font-size: 14px; }
.strip.dong .pchip:not(.active) .avatar { font-size: 16px; }
.turn-clock {
  flex: none;
  font-family: var(--font-display); font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--accent); white-space: nowrap;
}
.pchip.active .turn-clock { color: color-mix(in srgb, #fff 80%, transparent); }
.turn-clock.urgent {
  color: var(--bad);
  animation: clock-pulse .5s steps(2) infinite;
}
/* Thanh thời gian: `absolute` nên KHÔNG tốn bề rộng của hàng. */
.turn-bar {
  position: absolute; left: 0; bottom: 0; height: 3px;
  width: calc(var(--con, 1) * 100%);
  border-radius: 0 3px 3px 0;
  background: linear-gradient(90deg, color-mix(in srgb, #fff 55%, var(--accent)), #fff);
}
.turn-bar.urgent { background: linear-gradient(90deg, var(--bad), color-mix(in srgb, var(--bad) 40%, #fff)); }
@keyframes clock-pulse { 50% { opacity: .45; transform: scale(1.12); } }
.plus10 {
  position: absolute; top: -18px; right: 8px;
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  color: var(--ok); text-shadow: 0 1px 6px rgba(0, 0, 0, .2); pointer-events: none;
}
.plus-enter-active { transition: transform .8s ease-out, opacity .8s ease-out; }
.plus-enter-from { transform: translateY(10px); opacity: 0; }
.plus-leave-active { transition: opacity .3s; }
.plus-leave-to { opacity: 0; }
.pchip.active .pts { color: var(--accent); }

/* ---------- KHÔNG CÓ LƯỢT (Tìm Thẻ…): mọi chip ngang nhau, không lùi mờ, không "đang đi" ---------- */
.deu .pchip:not(.active) { opacity: 1; transform: none; }
.deu .pchip:not(.active) b { color: inherit; font-weight: 700; }
.deu .pchip.off { opacity: .55; }
/* Khe `#sau` được tràn khỏi chip (viên số giây, "+điểm" bay) */
.tran .pchip { overflow: visible; }

/* Icon Lucide thay emoji (21.11.2026, lib/icon-vong.ts) */
.ic-n { vertical-align: -2px; flex: none; }
.ic-n.het { color: #e0533a; }
</style>
