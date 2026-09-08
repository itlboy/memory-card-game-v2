<script setup lang="ts">
/**
 * ĐỒNG HỒ ĐO HIỆN TRÊN MÁY NGƯỜI CHƠI — bật bằng `?do=1`, mặc định KHÔNG mount.
 *
 * Vì sao phải có: lag "lật thẻ nghe tiếng trước, thấy hình sau" chỉ xảy ra trên
 * iPhone. Đo ở Chrome trên máy tính (kể cả hãm CPU 6×) ra 8–10ms từ gói tin tới
 * lúc lá đổi class và ~1ms tới khung hình sau đó — tức KHÔNG tái hiện được. Máy
 * nào có lỗi thì phải đo trên chính máy đó.
 *
 * Ba mốc, đúng ba đoạn của một cú lật:
 *  · `tin→class`: gói tin WebSocket về tới lúc DOM đổi (JS + Vue).
 *  · `class→khung`: DOM đổi tới khung hình kế tiếp (chờ trình duyệt vẽ).
 *  · `fps` và `khung tệ nhất`: trình duyệt có kịp vẽ không — đây là chỗ duy
 *    nhất bắt được cảnh "class đổi rồi mà mắt chưa thấy gì".
 *
 * Nếu `tin→class` nhỏ mà `khung tệ nhất` lớn thì lỗi ở VẼ (paint/compositing),
 * không phải ở JS — và ngược lại. Đó là câu hỏi mà mọi phỏng đoán trước đây
 * không trả lời được.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

const fps = ref(0);
const khungTeNhat = ref(0);
const tinToiClass = ref<number | null>(null);
const classToiKhung = ref<number | null>(null);
const soLa = ref(0);
const soTin = ref(0);

let raf = 0;
let mo: MutationObserver | undefined;
let tinCuoi = 0;
let daGhiChoTinNay = true;
const nhipKhung: number[] = [];

/** Bọc WebSocket để biết gói tin về lúc nào. Chỉ bọc khi bảng đo được bật. */
function bocWebSocket(): void {
  const Goc = window.WebSocket;
  const Boc = function (this: unknown, ...a: [string, ...unknown[]]) {
    const s = new Goc(...(a as [string]));
    s.addEventListener('message', () => {
      tinCuoi = performance.now();
      daGhiChoTinNay = false;
      soTin.value++;
    });
    return s;
  } as unknown as typeof WebSocket;
  Boc.prototype = Goc.prototype;
  window.WebSocket = Boc;
}

onMounted(() => {
  bocWebSocket();

  mo = new MutationObserver((ms) => {
    for (const m of ms) {
      const el = m.target as HTMLElement;
      if (!el.classList?.contains('card')) continue;
      if (daGhiChoTinNay || !tinCuoi) continue;
      daGhiChoTinNay = true;
      const at = performance.now();
      tinToiClass.value = Math.round(at - tinCuoi);
      requestAnimationFrame(() => { classToiKhung.value = Math.round(performance.now() - at); });
    }
  });
  mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  let truoc = performance.now();
  const vong = (t: number): void => {
    const dt = t - truoc;
    truoc = t;
    nhipKhung.push(dt);
    if (nhipKhung.length >= 30) {
      const tong = nhipKhung.reduce((a, b) => a + b, 0);
      fps.value = Math.round(1000 / (tong / nhipKhung.length));
      khungTeNhat.value = Math.round(Math.max(...nhipKhung));
      soLa.value = document.querySelectorAll('.card').length;
      nhipKhung.length = 0;
    }
    raf = requestAnimationFrame(vong);
  };
  raf = requestAnimationFrame(vong);
});

onBeforeUnmount(() => { cancelAnimationFrame(raf); mo?.disconnect(); });
</script>

<template>
  <div class="do-nhip" role="status" aria-label="Bảng đo nhịp">
    <b>{{ fps }} fps</b>
    <span :class="{ te: khungTeNhat > 50 }">khung tệ nhất {{ khungTeNhat }}ms</span>
    <span :class="{ te: (tinToiClass ?? 0) > 50 }">tin→class {{ tinToiClass ?? '–' }}ms</span>
    <span :class="{ te: (classToiKhung ?? 0) > 50 }">class→khung {{ classToiKhung ?? '–' }}ms</span>
    <span>{{ soLa }} lá · {{ soTin }} gói</span>
  </div>
</template>

<style scoped>
/* Nổi trên mọi thứ, không ăn cú chạm, và không chiếm chỗ của bàn thẻ (position
   fixed) — bảng đo không được làm sai chính cái nó đang đo. */
.do-nhip {
  position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 4px; z-index: 99;
  display: flex; flex-wrap: wrap; gap: 2px 8px; max-width: calc(100vw - 8px);
  padding: 4px 7px; border-radius: 8px;
  background: rgba(0, 0, 0, .72); color: #fff;
  font: 700 10.5px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; pointer-events: none;
}
.do-nhip b { color: #7dd3fc; }
.do-nhip .te { color: #fca5a5; }
</style>
