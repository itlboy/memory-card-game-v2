<script setup lang="ts">
/**
 * BONG BÓNG EMOJI — emoji người chơi gửi (09.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/XLV7MArxK818WLkYLXMMKp). Thay cho "emoji bay" cũ: 20px, tan sau
 * 1,15 giây, một emoji chung cho cả phòng (người sau đè người trước) — dễ lỡ, khó biết ai gửi.
 *
 * Mỗi người một bong bóng trắng có ĐUÔI chỉ vào người gửi, emoji 36px, đứng ~2,5 giây
 * (useOnlineRoom: BONG_MS). Gửi tiếp khi bong bóng còn đó: emoji mới BAY LÊN từ bong bóng
 * (chủ dự án thích hiệu ứng bay cũ; không đếm ×2, ×3). Emoji của MÌNH cũng hiện
 * (ở chip mình) — biết là đã gửi đi.
 *
 * NEO THEO MÀN, tìm theo thứ tự:
 *  1. BẢNG KẾT QUẢ đang mở (`[data-kq-for]`): bảng phủ kín màn chơi, neo vào chip trong ván là
 *     mọc từ chỗ bị che.
 *  2. PHÒNG CHỜ (`.lobby-list [data-chip-for]`) và TRONG VÁN (`.pchip`, `.turn-chip`, `.mini`,
 *     dải đội `.m`). Trong ván: TRÊN chip — chủ dự án: "không đè lên bàn chơi". Chạm nút ← /
 *     đồng hồ thì vẫn bấm xuyên (pointer-events: none).
 *  Chỗ nào cũng vậy: bong bóng nằm TRÊN, đuôi chỉ xuống MẶT người gửi (xem timNeo).
 *  3. Không thấy ai (khán giả, người vừa rời): giữa mép trên, kèm tên người gửi.
 *
 * TELEPORT ra <body> + fixed: `main` cuộn được và chip có `overflow: hidden`, để trong đó là
 * bị cắt. CHỈ MOUNT MỘT LẦN trong cây (OnlineGame trong ván, OnlineScreen ngoài ván).
 */
import type { QuickEmoji } from '@mm/engine';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import KhungBong from './KhungBong.vue';

type Bong = { from: string; name: string; emoji: QuickEmoji; key: number };
const props = defineProps<{ o: { emojiBong: { value: Bong[] } } }>();

type Neo = { x: number; y: number; nho?: boolean; vt: number } | null;
const neo = ref<Record<string, Neo>>({});

const thay = (el: Element | null | undefined): DOMRect | null => {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
};

/** Mặt người gửi trong ô neo: `.avatar` (chip trong ván, phòng chờ), `.mat` / `.mat-ct` (bảng kết quả).
 *  Ô CHÍNH LÀ cái mặt (thành viên đội ở bảng kết quả `.mat`, dải đội `.m`) thì lấy chính nó. */
function matCua(o: Element): DOMRect | null {
  if (o.matches('.avatar, .mat, .m')) return thay(o);
  return thay(o.querySelector('.avatar, .mat, .mat-ct'));
}

/**
 * MỌI CHỖ ĐỀU TRỎ VÀO AVATAR (19.11.2026, chủ dự án: "bong bóng chat trỏ vào avatar thay vì tên" — rồi
 * "ở một số chỗ vẫn chưa trỏ bên trên avatar"): trong ván, phòng chờ, bảng kết quả — bong bóng nằm TRÊN,
 * đuôi chỉ xuống tâm mặt. Trước đó phòng chờ / bảng kết quả đặt bong bóng sau tên, đuôi chỉ sang trái.
 * Kẹp bong bóng vào màn hình rồi dời CHÂN ĐUÔI (`vt`) cho nó vẫn đúng tâm mặt.
 * Bảng kết quả đang mở thì neo vào đó trước: nó phủ kín màn chơi, chip trong ván bị che.
 */
function timNeo(id: string): Neo {
  const k = CSS.escape(id);
  const kq = document.querySelector(`[data-kq-for="${k}"]`);
  const o = thay(kq) ? kq! : document.querySelector(`[data-chip-for="${k}"]`);
  const ro = thay(o);
  if (!ro) return null;
  const trongVan = o !== kq && !o!.closest('.lobby-list');
  const av = matCua(o!);
  const ten = thay(o!.querySelector('.ten-kq, b'));
  const tam = av ? av.left + av.width / 2 : ten ? ten.left + 18 : ro.left + ro.width / 2;
  // Dòng kết quả / phòng chờ: bong bóng nhỏ (~64px), nằm giữa chữ chứ không giữa khoảng trời trống
  const x = Math.min(Math.max(tam - 24, 8), window.innerWidth - (trongVan ? 118 : 72));
  const y = trongVan ? ro.top - 10 : (av ?? ten ?? ro).top - 6;
  return { x, y, nho: !trongVan, vt: Math.max(16, tam - x) };
}

function doLai(): void {
  const m: Record<string, Neo> = {};
  for (const b of props.o.emojiBong.value) m[b.from] = timNeo(b.from);
  neo.value = m;
}

/*
 * EMOJI BAY LÊN khi gửi tiếp lúc bong bóng của người đó còn đang hiện: mọc từ đỉnh bong bóng,
 * trôi lên rồi tan (1,15 giây — y nhịp "emoji bay" cũ chủ dự án thích). Bong bóng đổi sang
 * emoji mới, đứng thêm BONG_MS.
 */
const bay = ref<{ id: number; emoji: string; x: number; y: number }[]>([]);
let bayId = 0;
const daCo = new Map<string, number>();   // người gửi → key lần gửi trước còn trên màn
watch(() => props.o.emojiBong.value.map((b) => `${b.from}:${b.key}`).join(','), () => {
  doLai();
  const conHien = new Set(props.o.emojiBong.value.map((b) => b.from));
  for (const id of [...daCo.keys()]) if (!conHien.has(id)) daCo.delete(id);
  for (const b of props.o.emojiBong.value) {
    const truoc = daCo.get(b.from);
    daCo.set(b.from, b.key);
    if (truoc === undefined || truoc === b.key) continue;   // lần đầu: bong bóng tự nảy, không bay
    const el = document.querySelector(`.bong[data-from="${CSS.escape(b.from)}"]`);
    const r = thay(el);
    if (!r) continue;
    const id = ++bayId;
    bay.value = [...bay.value, { id, emoji: b.emoji, x: r.left + r.width / 2, y: r.top }];
    setTimeout(() => { bay.value = bay.value.filter((x) => x.id !== id); }, 1150);
  }
}, { flush: 'post' });
onMounted(() => window.addEventListener('resize', doLai));
onBeforeUnmount(() => window.removeEventListener('resize', doLai));

function kieuCua(b: Bong): Record<string, string> | undefined {
  const n = neo.value[b.from];
  return n ? { left: `${n.x}px`, top: `${n.y}px`, transformOrigin: `${n.vt}px 100%` } : undefined;
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="bong" tag="div" class="bong-emoji" aria-hidden="true">
      <div
        v-for="(b, i) in props.o.emojiBong.value" :key="b.from"
        class="bong" :class="[neo[b.from] ? 'tren' : 'giua', { nho: neo[b.from]?.nho }]" :data-from="b.from"
        :style="kieuCua(b) ?? { top: `calc(${12 + i * 64}px + env(safe-area-inset-top, 0px))` }"
      >
        <KhungBong
          :canh="neo[b.from] ? 'duoi' : undefined"
          :day="2.5" :r="neo[b.from]?.nho ? 16 : 18" :vt="neo[b.from]?.vt"
        />
        <!-- :key theo lượt gửi → mỗi lần gửi lại là một nhịp nảy, bong bóng thì đứng yên -->
        <span :key="b.key" class="e">{{ b.emoji }}</span>
        <span v-if="!neo[b.from]" class="ai">{{ b.name }}</span>
        
      </div>
    </TransitionGroup>
    <span v-for="f in bay" :key="f.id" class="bay" :style="{ left: `${f.x}px`, top: `${f.y}px` }" aria-hidden="true">{{ f.emoji }}</span>
  </Teleport>
</template>

<style scoped>
.bong {
  /* Nổi trên MỌI thứ kể cả bảng kết quả (10) và hộp xác nhận (20) */
  position: fixed; z-index: 60; pointer-events: none;
  display: flex; align-items: center; gap: 4px; width: max-content;
  /* Nền + viền: KhungBong (một nét liền cả đuôi) — không border/background ở đây. Đệm = đệm cũ + 2.5px viền. */
  padding: 8.5px 14px;
  --nen: var(--panel-solid, #fff);
  --vien: color-mix(in srgb, var(--accent) 55%, var(--line));
  /* drop-shadow chứ không box-shadow: bóng ăn theo cả đuôi */
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, .26));
}
/* TRÊN chip: `top` = mép trên chip − 10 → tự kéo lên trọn chiều cao mình */
.bong.tren { transform: translateY(-100%); transform-origin: 24px 100%; }
/* Không có chỗ neo: giữa mép trên, kèm tên */
.bong.giua { left: 50%; transform: translateX(-50%); transform-origin: 50% 0; }

.e { font-size: 36px; line-height: 1; animation: nay .45s cubic-bezier(.2, 1.4, .4, 1); }
/* Dòng kết quả / phòng chờ: nhỏ hơn — nó nằm giữa chữ, không phải giữa khoảng trời trống */
.nho { padding: 7px 11px; }
.nho .e { font-size: 28px; }
.ai { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--fg); max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes nay {
  0% { transform: scale(.3) rotate(-12deg); }
  60% { transform: scale(1.18) rotate(4deg); }
  100% { transform: scale(1) rotate(0); }
}

/* Emoji bay: mọc từ đỉnh bong bóng, trôi lên ~70px rồi tan */
.bay {
  position: fixed; z-index: 61; pointer-events: none; font-size: 30px; line-height: 1;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, .3));
  animation: bay-len 1.15s ease-out forwards;
}
@keyframes bay-len {
  0% { opacity: 0; transform: translate(-50%, -60%) scale(.5); }
  15% { opacity: 1; transform: translate(-50%, -100%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, calc(-100% - 70px)) scale(1); }
}

/* ĐUÔI: vẽ chung một nét với thân trong KhungBong.vue (lib/duong-bong.ts), mọc ra ngoài khung. */

/* Vào: nảy từ chỗ đuôi; ra: mờ + trôi nhẹ lên. Giữ nguyên translate của từng kiểu. */
.bong-enter-active { transition: opacity .15s ease, scale .3s cubic-bezier(.2, 1.4, .4, 1); }
.bong-enter-from { opacity: 0; scale: .5; }
.bong-leave-active { transition: opacity .3s ease, translate .3s ease; }
.bong-leave-to { opacity: 0; translate: 0 -12px; }
@media (prefers-reduced-motion: reduce) {
  .e, .bay { animation: none; }
  .bong-enter-active, .bong-leave-active { transition: opacity .15s; }
}
</style>
