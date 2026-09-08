<script setup lang="ts">
/**
 * ĐỒNG HỒ ĐO HIỆN TRÊN MÁY NGƯỜI CHƠI — bật ở dưới cùng bảng hướng dẫn, hoặc
 * `?debug=1`. Mặc định KHÔNG mount.
 *
 * Vì sao phải có: lag "lật thẻ nghe tiếng trước, thấy hình sau" chỉ xảy ra trên
 * iPhone. Chrome trên máy tính, kể cả hãm CPU 6×, ra 8–10ms — không tái hiện
 * được, nên đoán tiếp cũng chỉ là đoán.
 *
 * Số đo lấy từ `lib/do-nhip.ts` — ghi ngay tại chỗ nhận gói tin trong
 * `useOnlineRoom`, KHÔNG bọc `window.WebSocket` ở đây: bật bảng lúc đang ở
 * trong phòng thì socket đã mở từ trước và cái bọc không thấy gói nào (đo được
 * thật: bảng hiện "0 gói" giữa lúc chơi).
 *
 * Đọc bảng:
 *  · `tin→dom` lớn → nghẽn ở JS/Vue phía mình.
 *  · `khung tệ nhất` lớn mà `tin→dom` nhỏ → nghẽn ở phần VẼ của trình duyệt.
 *  · `im` lớn hoặc `nối lại` tăng dần → socket rớt, tin về dồn cục; cái "lag"
 *    thấy được thật ra là chờ mạng. `đứt(1006)` là mạng rớt, `đứt(4000)` là
 *    socket này bị một socket mới của CHÍNH MÌNH thay (vòng nối lại tự đá nhau).
 *  · `lá trống` > 0 → có lá ngửa mà không có biểu tượng: đường symbol hỏng
 *    (predeal/giuMo), đúng ô trắng trơn đã thấy trong ảnh người chơi gửi.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { doNhip } from '@/lib/do-nhip';

const fps = ref(0);
const khungTeNhat = ref(0);
const im = ref(0);
const so = ref({ goi: 0, noiLai: 0, socket: '—', tinToiDom: 0, laTrong: 0, sauTrong: 0 });
const soLa = ref(0);

let raf = 0;
const nhip: number[] = [];

onMounted(() => {
  let truoc = performance.now();
  const vong = (t: number): void => {
    nhip.push(t - truoc);
    truoc = t;
    if (nhip.length >= 30) {
      const tong = nhip.reduce((a, b) => a + b, 0);
      fps.value = Math.round(1000 / (tong / nhip.length));
      khungTeNhat.value = Math.round(Math.max(...nhip));
      nhip.length = 0;
      // Lá ngửa mà rỗng: đọc từ DOM vì đây là cái MẮT thấy, không phải cái state nói.
      const la = [...document.querySelectorAll('.card')];
      soLa.value = la.length;
      doNhip.laTrong = la.filter((e) => {
        const c = e.className;
        if (!c.includes('up') && !c.includes('done')) return false;
        return !(e.querySelector('.front')?.textContent ?? '').trim();
      }).length;
      /* Ô trắng có HAI nguyên nhân khác nhau, và phải phân biệt được:
         · `lá trống` = lá NGỬA mà không có biểu tượng (đường symbol hỏng);
         · `sau trống` = lá ÚP mà mặt sau không có hoạ tiết (thiếu khối CSS
           card-backs, đúng cảnh "Ô TRẮNG TRƠN" đã ghi trong CLAUDE.md). */
      doNhip.sauTrong = la.filter((e) => {
        if (/\bup\b|\bdone\b/.test(e.className)) return false;
        const b = e.querySelector('.back');
        if (!b) return true;
        const bg = getComputedStyle(b, '::before').backgroundImage;
        return !bg || bg === 'none';
      }).length;
      so.value = { goi: doNhip.goi, noiLai: doNhip.noiLai, socket: doNhip.socket,
        tinToiDom: doNhip.tinToiDom, laTrong: doNhip.laTrong, sauTrong: doNhip.sauTrong };
      im.value = doNhip.tinCuoi ? Math.round((t - doNhip.tinCuoi) / 100) / 10 : 0;
    }
    raf = requestAnimationFrame(vong);
  };
  raf = requestAnimationFrame(vong);
});

onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <div class="do-nhip" role="status" aria-label="Bảng đo nhịp">
    <b>{{ fps }} fps</b>
    <span :class="{ te: khungTeNhat > 50 }">khung {{ khungTeNhat }}ms</span>
    <span :class="{ te: so.tinToiDom > 50 }">tin→dom {{ so.tinToiDom }}ms</span>
    <span :class="{ te: so.socket.startsWith('đứt') }">sk {{ so.socket }}</span>
    <span :class="{ te: so.noiLai > 1 }">nối lại {{ so.noiLai }}</span>
    <span :class="{ te: im > 8 }">im {{ im }}s</span>
    <span :class="{ te: so.laTrong > 0 }">lá trống {{ so.laTrong }}</span>
    <span :class="{ te: so.sauTrong > 0 }">sau trống {{ so.sauTrong }}</span>
    <span>{{ soLa }} lá · {{ so.goi }} gói</span>
  </div>
</template>

<style scoped>
/* Nổi trên mọi thứ, không ăn cú chạm, không chiếm chỗ của bàn thẻ (fixed) —
   bảng đo không được làm sai chính cái nó đang đo. */
.do-nhip {
  position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 4px; z-index: 99;
  display: flex; flex-wrap: wrap; gap: 1px 7px; max-width: calc(100vw - 8px);
  padding: 3px 6px; border-radius: 8px;
  background: rgba(0, 0, 0, .78); color: #fff;
  font: 700 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; pointer-events: none;
}
.do-nhip b { color: #7dd3fc; }
.do-nhip .te { color: #fca5a5; }
</style>
