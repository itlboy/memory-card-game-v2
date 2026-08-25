<script setup lang="ts">
import { CAMPAIGN_LEVELS } from '@mm/engine';
import { X } from 'lucide-vue-next';
import { onMounted, onUnmounted, ref } from 'vue';

const emit = defineEmits<{ close: [] }>();

/* ---------- phiên bản & tuổi bản build ---------- */

const version = __APP_VERSION__;
/** Ngày giờ build, ĐÃ định dạng theo giờ Việt Nam lúc build (xem vite.config). */
const builtAt = __BUILD_AT__;

/** "3 ngày 4 giờ 12 phút 5 giây trước" — cắt bỏ các đơn vị đầu bằng 0. */
function doiThanhChu(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'vừa xong';
  const giay = Math.floor(ms / 1000);
  const phan = [
    { n: Math.floor(giay / 86400), ten: 'ngày' },
    { n: Math.floor((giay % 86400) / 3600), ten: 'giờ' },
    { n: Math.floor((giay % 3600) / 60), ten: 'phút' },
    { n: giay % 60, ten: 'giây' }
  ];
  while (phan.length && phan[0]!.n === 0) phan.shift();
  if (!phan.length) return 'vừa xong';
  return `${phan.map((p) => `${p.n} ${p.ten}`).join(' ')} trước`;
}

const ago = ref(doiThanhChu(Date.now() - Date.parse(__BUILD_ISO__)));
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  // Đếm từng giây: người chơi mở bảng này ra đúng lúc vừa deploy thì thấy con số
  // chạy, biết ngay là bản mới.
  tick = setInterval(() => {
    ago.value = doiThanhChu(Date.now() - Date.parse(__BUILD_ISO__));
  }, 1000);
});
onUnmounted(() => clearInterval(tick));
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

/** Luật viết theo giọng của game: nói với "bạn", mỗi dòng một điều, không sáo. */
const MODES = [
  { icon: '🗺️', name: 'Chiến dịch', text: `${CAMPAIGN_LEVELS} màn từ dễ đến khó. Qua màn mới mở màn sau, điểm cộng dồn vào tổng.` },
  { icon: '🧠', name: 'Cổ điển', text: 'Không giới hạn thời gian. Lật sai bị trừ 10 điểm.' },
  { icon: '⏱️', name: 'Đua thời gian', text: 'Có đồng hồ đếm ngược. Mỗi lần ghép đúng được cộng 2 giây, xong sớm thì thưởng thêm điểm.' },
  { icon: '❤️', name: 'Sinh tồn', text: '5 mạng. Chỉ mất mạng khi thẻ vừa mở đã từng lộ ra — lật hai thẻ mới toanh là dò bài, không bị trừ. Dưới 2 mạng mà ghép đúng hai lần liền thì hồi 1 mạng.' },
  { icon: '👁️', name: 'Chớp nhoáng', text: 'Đếm ngược 3 giây rồi cả bàn hé mở — bàn càng nhiều thẻ càng được nhìn lâu (bàn lớn nhất 42 thẻ được 13 giây). Nhớ được bao nhiêu thì ghép bấy nhiêu.' }
];

const POWERS = [
  { icon: '🔀', name: 'Tráo đổi', text: 'Hai thẻ BẠN ĐÃ TỪNG MỞ mà chưa ghép được sẽ đổi chỗ nhau — có hiệu ứng chỉ rõ hai thẻ nào, nhớ lại cho kịp.' },
  { icon: '✖️', name: 'Nhân đôi', text: 'Cặp tiếp theo được nhân đôi điểm.' },
  { icon: '👁️', name: 'Mắt thần', text: 'Hé mở cả bàn trong 5 giây.' },
  { icon: '❄️', name: 'Đóng băng', text: 'Đối thủ mất một lượt (chỉ khi chơi nhiều người).' }
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
          <li>Chiến dịch xếp <b>1–3 sao</b> theo điểm đạt được.</li>
          <li>Điểm mọi ván cộng vào <b>tổng tích luỹ</b> — đủ điểm thì mở thêm theme.</li>
        </ul>

        <h3>Các chế độ</h3>
        <ul class="items">
          <li v-for="m in MODES" :key="m.name">
            <span class="ico" aria-hidden="true">{{ m.icon }}</span>
            <span><b>{{ m.name }}</b> — {{ m.text }}</span>
          </li>
        </ul>

        <h3>Thẻ đặc biệt</h3>
        <ul class="items">
          <li v-for="p in POWERS" :key="p.name">
            <span class="ico" aria-hidden="true">{{ p.icon }}</span>
            <span><b>{{ p.name }}</b> — {{ p.text }}</span>
          </li>
        </ul>

        <h3>Chơi nhiều người</h3>
        <ul class="plain">
          <li>Thay lượt nhau trên cùng máy, hoặc mở phòng online bằng mã 6 số.</li>
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
.items li { display: flex; gap: 9px; font-size: var(--text-md); line-height: 1.45; }
.ico { flex-shrink: 0; font-size: 19px; line-height: 1.3; }
</style>
