<script setup lang="ts">
import { CAMPAIGN_LEVELS } from '@mm/engine';
import { X } from 'lucide-vue-next';
import { onMounted, onUnmounted, ref } from 'vue';
import { buildAgeText } from '@/lib/format';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';

const emit = defineEmits<{ close: [] }>();

/* ---------- phiên bản & tuổi bản build ---------- */

const version = __APP_VERSION__;
/** Ngày giờ build, ĐÃ định dạng theo giờ Việt Nam lúc build (xem vite.config). */
const builtAt = __BUILD_AT__;

const ago = ref(buildAgeText(Date.now() - Date.parse(__BUILD_ISO__)));
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  // Đếm từng giây: người chơi mở bảng này ra đúng lúc vừa deploy thì thấy con số
  // chạy, biết ngay là bản mới.
  tick = setInterval(() => {
    ago.value = buildAgeText(Date.now() - Date.parse(__BUILD_ISO__));
  }, 1000);
});
onUnmounted(() => clearInterval(tick));
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

/*
 * Luật viết theo giọng của game: nói với "bạn", mỗi dòng một điều, không sáo.
 *
 * KHÔNG CÒN MỤC "CÁC CHẾ ĐỘ". Bốn chế độ cũ đã tan thành năm tuỳ chọn bàn chơi,
 * nên mục này phải kể đúng thứ người chơi thấy trong màn cài đặt — icon dùng
 * CHUNG một bộ với màn đó, để đọc luật xong nhận ra ngay hàng nào là hàng nào
 * (quy tắc ở CLAUDE.md: đổi thể thức chơi thì phải cập nhật hướng dẫn).
 */
const OPTIONS: readonly { icon: IconName; name: string; text: string }[] = [
  { icon: 'time', name: 'Thời gian', text: 'Đồng hồ đếm ngược cho cả ván. Ghép đúng được cộng 2 giây, xong sớm thì thưởng thêm điểm. Tắt thì chơi thong thả bao lâu cũng được.' },
  { icon: 'lives', name: 'Số mạng', text: 'Chỉ mất mạng khi thẻ LẬT ĐẦU đã có lá trùng lộ ra từ trước — tức bạn biết lá kia nằm đâu mà vẫn bấm sai. Lá lật đầu còn mới thì bạn đang dò bài, bốc trúng lá nào cũng không bị trừ. Sắp hết mạng mà ghép đúng hai lần liền thì hồi 1 mạng. Bàn càng lớn càng cho nhiều mạng.' },
  { icon: 'peek', name: 'Xem trước', text: 'Đầu ván cả bàn hé mở cho bạn nhìn, có đồng hồ đếm ngược. Bàn càng nhiều thẻ càng được nhìn lâu.' },
  { icon: 'shuffle', name: 'Xáo thẻ', text: 'Thỉnh thoảng hai thẻ chưa ghép đổi chỗ cho nhau — có hiệu ứng chỉ rõ hai thẻ nào, nhớ lại cho kịp.' },
  { icon: 'special', name: 'Thẻ đặc biệt', text: 'Rải thêm thẻ có phép vào bàn (xem ngay bên dưới).' }
];

const POWERS: readonly { icon: IconName; name: string; text: string }[] = [
  { icon: 'swap', name: 'Tráo đổi', text: 'Hai thẻ chưa ghép được đổi chỗ cho nhau — có hiệu ứng chỉ rõ hai thẻ nào, nhớ lại cho kịp.' },
  { icon: 'bomb', name: 'Bom', text: 'Hai cặp đã mở bị úp trở lại. Điểm giữ nguyên, nhưng phải tìm lại chúng.' },
  { icon: 'x2', name: 'Nhân đôi', text: 'Cặp tiếp theo được nhân đôi điểm.' },
  { icon: 'freeze', name: 'Đóng băng', text: 'Đối thủ mất một lượt (chỉ khi chơi nhiều người).' }
];
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" @keydown.esc="emit('close')">
    <div class="panel rules">
      <header class="rules-head">
        <h2 id="rulesTitle">Luật chơi</h2>
        <button ref="closeBtn" class="btn" aria-label="Đóng" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <!-- Chỉ khối này cuộn, để tiêu đề và nút đóng luôn nhìn thấy -->
      <div class="rules-body">
        <h3>Cách chơi</h3>
        <p class="lead">
          Mỗi lượt bạn lật hai thẻ. Giống nhau thì cặp đó mở luôn và bạn được lật tiếp;
          khác nhau thì hai thẻ úp lại. Mở hết các cặp là xong ván.
        </p>

        <h3>Điểm</h3>
        <ul class="plain">
          <li><b>100 điểm</b> mỗi cặp đúng.</li>
          <li>Ghép đúng liên tiếp được nhân thêm: <b>x1,2 · x1,5 · x2</b>.</li>
          <li>Lật sai <b>không bị trừ điểm</b> — nhưng mất chuỗi nhân điểm đang có.</li>
          <li>Điểm mọi ván cộng vào <b>tổng tích luỹ</b> — đủ điểm thì mở thêm theme.</li>
        </ul>

        <h3>Tuỳ chọn bàn chơi</h3>
        <ul class="items">
          <li v-for="o in OPTIONS" :key="o.name">
            <OptionIcon :name="o.icon" :size="22" />
            <span><b>{{ o.name }}</b> — {{ o.text }}</span>
          </li>
        </ul>

        <h3>Thẻ đặc biệt</h3>
        <ul class="items">
          <li v-for="p in POWERS" :key="p.name">
            <OptionIcon :name="p.icon" :size="22" />
            <span><b>{{ p.name }}</b> — {{ p.text }}</span>
          </li>
        </ul>

        <h3>Chiến dịch</h3>
        <ul class="items">
          <li>
            <OptionIcon name="campaign" :size="22" />
            <span>
              <b>{{ CAMPAIGN_LEVELS }} màn</b> từ dễ đến khó, luật cố định sẵn từng màn nên
              không có bảng tuỳ chọn. Qua màn mới mở màn sau, xếp 1–3 sao theo điểm.
            </span>
          </li>
        </ul>

        <h3>Chơi nhiều người</h3>
        <ul class="plain">
          <li>Thay lượt nhau trên cùng máy, hoặc mở phòng online — tới <b>10 người</b>.</li>
          <li>
            Phòng online mặc định <b>công khai</b>: ai vào mục Chơi online cũng thấy và
            vào chơi được. Chủ phòng tắt công tắc thì phòng thành <b>riêng tư</b> —
            không hiện trong danh sách, chỉ ai có <b>mã 6 số</b> mới vào được.
          </li>
          <li>Lật sai thì chuyển lượt. Ghép đúng được lật tiếp.</li>
          <li>Mỗi lượt có <b>15 giây</b>; ghép đúng được thêm 5 giây (tối đa 15).</li>
          <li>Hết ván ai nhiều điểm hơn thì thắng; bằng điểm là <b>hoà</b>.</li>
          <li>Chơi nhiều ván thì có <b>tỷ số cả loạt</b> — số ván mỗi người đã thắng.</li>
        </ul>
      </div>

      <button class="btn btn-primary" type="button" @click="emit('close')">Đã hiểu</button>

      <!-- Phiên bản + ngày build. Để ở đây vì đây là chỗ người chơi tìm khi cần
           trả lời "máy tôi đang chạy bản nào" — không cần một màn hình riêng. -->
      <p class="build">
        <b>v{{ version }}</b> · build {{ builtAt }}
        <span class="ago">({{ ago }})</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Chân trang phiên bản: mờ, nhỏ, không giành sự chú ý với nội dung luật chơi */
.build {
  margin: 12px 0 0; text-align: center;
  font-size: 12px; color: var(--muted); line-height: 1.5;
}
.build b { color: var(--fg); font-variant-numeric: tabular-nums; }
.build .ago { opacity: .85; font-variant-numeric: tabular-nums; }

.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
}
/* Panel cao tối đa theo viewport; RIÊNG phần nội dung được cuộn — luật dài hơn
   một màn hình là chuyện bình thường, còn tiêu đề và nút đóng phải luôn thấy. */
.rules {
  /* Rộng ĐÚNG BẰNG cột nội dung của game (--col-w ở global.css), không phải một
     con số riêng: 460px cố định nằm trong cột 600px trên máy tính đọc ra thành
     một cột chữ hẹp lọt giữa màn hình, mà luật chơi là trang chữ dài — nó cần
     mọi pixel bề rộng đang có. */
  width: 100%; max-width: var(--col-w); max-height: calc(100dvh - 24px);
  display: flex; flex-direction: column; min-height: 0;
}
.rules-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.rules-head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.rules-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.rules-body h3 {
  margin: 14px 0 6px; font-size: var(--text-sm);
  text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
}
.rules-body h3:first-child { margin-top: 0; }
.lead { margin: 0; font-size: var(--text-md); line-height: 1.5; }
.plain, .items { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.plain li { font-size: var(--text-md); line-height: 1.45; padding-left: 14px; position: relative; }
.plain li::before { content: '·'; position: absolute; left: 3px; color: var(--accent); font-weight: 800; }
/* align-items: flex-start + nhích 2px: icon là ô vuông 22px, canh giữa theo
   dòng đầu thì nó trôi xuống giữa đoạn khi chữ dài hai ba dòng. */
.items li { display: flex; gap: 9px; align-items: flex-start; font-size: var(--text-md); line-height: 1.45; }
.items :deep(.opt-ico) { margin-top: 2px; }
</style>
