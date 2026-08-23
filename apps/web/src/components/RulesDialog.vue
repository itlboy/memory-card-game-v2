<script setup lang="ts">
import { CAMPAIGN_LEVELS } from '@mm/engine';
import { X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';

const emit = defineEmits<{ close: [] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(() => closeBtn.value?.focus());

/** Luật viết theo giọng của game: nói với "bạn", mỗi dòng một điều, không sáo. */
const MODES = [
  { icon: '🗺️', name: 'Chiến dịch', text: `${CAMPAIGN_LEVELS} màn từ dễ đến khó. Qua màn mới mở màn sau, điểm cộng dồn vào tổng.` },
  { icon: '🧠', name: 'Cổ điển', text: 'Không giới hạn thời gian. Lật sai bị trừ 10 điểm.' },
  { icon: '⏱️', name: 'Đua thời gian', text: 'Có đồng hồ đếm ngược. Mỗi lần ghép đúng được cộng 2 giây, xong sớm thì thưởng thêm điểm.' },
  { icon: '❤️', name: 'Sinh tồn', text: '5 mạng. Chỉ mất mạng khi thẻ vừa mở đã từng lộ ra — lật hai thẻ mới toanh là dò bài, không bị trừ. Dưới 2 mạng mà ghép đúng hai lần liền thì hồi 1 mạng.' },
  { icon: '👁️', name: 'Chớp nhoáng', text: 'Đếm ngược 5 giây rồi cả bàn hé mở — bàn càng nhiều thẻ càng được nhìn lâu (bàn lớn nhất 42 thẻ được 13 giây). Nhớ được bao nhiêu thì ghép bấy nhiêu.' }
];

const POWERS = [
  { icon: '💥', name: 'Bom', text: 'Hai cặp đã mở bị úp lại.' },
  { icon: '✖️', name: 'Nhân đôi', text: 'Cặp tiếp theo được nhân đôi điểm.' },
  { icon: '👁️', name: 'Mắt thần', text: 'Hé mở cả bàn trong 2 giây.' },
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
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
}
/* Panel cao tối đa theo viewport; RIÊNG phần nội dung được cuộn — luật dài hơn
   một màn hình là chuyện bình thường, còn tiêu đề và nút đóng phải luôn thấy. */
.rules {
  width: 100%; max-width: 460px; max-height: calc(100dvh - 24px);
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
