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
 *  1. BẢNG KẾT QUẢ đang mở (`[data-kq-for]`): bên phải tên ở dòng của người đó, đuôi chỉ trái.
 *     Bảng phủ kín màn chơi, neo vào chip trong ván là mọc từ chỗ bị che.
 *  2. PHÒNG CHỜ (`.lobby-list [data-chip-for]`): ngay sau tên, đuôi chỉ trái — không che chữ
 *     "sẵn sàng" / nút mời ra ở mép phải.
 *  3. TRONG VÁN (`[data-chip-for]`: `.pchip`, `.turn-chip`, `.mini`): TRÊN chip, đuôi chỉ
 *     xuống tên — chủ dự án: "không đè lên bàn chơi". Chạm nút ← / đồng hồ thì vẫn bấm xuyên
 *     (pointer-events: none).
 *  4. Không thấy ai (khán giả, người vừa rời): giữa mép trên, kèm tên người gửi.
 *
 * TELEPORT ra <body> + fixed: `main` cuộn được và chip có `overflow: hidden`, để trong đó là
 * bị cắt. CHỈ MOUNT MỘT LẦN trong cây (OnlineGame trong ván, OnlineScreen ngoài ván).
 */
import type { QuickEmoji } from '@mm/engine';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Bong = { from: string; name: string; emoji: QuickEmoji; key: number };
const props = defineProps<{ o: { emojiBong: { value: Bong[] } } }>();

type Neo = { kieu: 'tren' | 'phai'; x: number; y: number; nho?: boolean } | null;
const neo = ref<Record<string, Neo>>({});

const thay = (el: Element | null | undefined): DOMRect | null => {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
};

/** Bề rộng bong bóng nhỏ (dòng bảng kết quả / phòng chờ): emoji 28px + đệm. */
const RONG_NHO = 64;

/**
 * Dòng (kết quả / phòng chờ): bong bóng ngay SAU TÊN nếu từ đó tới thứ đầu tiên ở mép phải
 * (điểm, "sẵn sàng", nút mời ra) còn đủ RONG_NHO; không đủ (tên dài) thì nằm TRÊN tên —
 * không bao giờ che chữ của dòng đó.
 */
function neoDong(dong: Element, rd: DOMRect, ten: DOMRect): Neo {
  let canPhai = rd.right - 10;
  for (const el of Array.from(dong.querySelectorAll(':scope > *'))) {
    const r = thay(el);
    if (r && r.left > ten.right + 2 && r.top < rd.top + rd.height / 2 + 4) canPhai = Math.min(canPhai, r.left - 8);
  }
  if (ten.right + 10 + RONG_NHO <= canPhai) return { kieu: 'phai', x: ten.right + 10, y: ten.top + ten.height / 2 };
  return { kieu: 'tren', x: Math.min(Math.max(ten.left - 6, 8), window.innerWidth - 118), y: ten.top - 4 };
}

function timNeo(id: string): Neo {
  const k = CSS.escape(id);
  // 1. Bảng kết quả — dòng có tên (`.ten-kq`) và điểm (`b`) ở mép phải
  const dong = document.querySelector(`[data-kq-for="${k}"]`);
  const rd = thay(dong);
  if (rd) {
    // Tên dài XUỐNG DÒNG: lấy DÒNG CUỐI (getClientRects), không lấy cả khối — khối gộp hai dòng
    // thì mép phải là mép dòng dài nhất, bong bóng đè lên chữ dòng trên.
    const dongTen = Array.from(dong!.querySelector('.ten-kq')?.getClientRects() ?? []).filter((r) => r.width > 0);
    let ten = dongTen[dongTen.length - 1] ?? rd;
    // Nhãn "Chơi tiếp" / "Đã thoát" nằm ngay sau tên: cùng dòng thì tính nó là một phần của tên
    const nhan = thay(dong!.querySelector('.tag'));
    if (nhan && nhan.top < ten.bottom - 4 && nhan.bottom > ten.bottom - ten.height / 2) {
      ten = new DOMRect(ten.left, ten.top, nhan.right - ten.left, ten.height);
    }
    const n = neoDong(dong!, rd, ten);
    return n && { ...n, nho: true };
  }
  // 2 + 3. Phòng chờ / trong ván — cùng dấu `data-chip-for`
  const chip = document.querySelector(`[data-chip-for="${k}"]`);
  const rc = thay(chip);
  if (!rc) return null;
  if (chip!.closest('.lobby-list')) {
    const sau = thay(chip!.querySelector('.nut-sua')) ?? thay(chip!.querySelector('b')) ?? rc;
    const n = neoDong(chip!, rc, sau);
    return n && { ...n, nho: true };
  }
  const ten = thay(chip!.querySelector('b'));
  const av = thay(chip!.querySelector('.avatar'));
  const x = ten ? ten.left - 6 : av ? av.left + av.width / 2 - 24 : rc.left + rc.width / 2 - 24;
  // Bong bóng rộng ~64px: kẹp để không thò ra mép phải
  return { kieu: 'tren', x: Math.min(Math.max(x, 8), window.innerWidth - 118), y: rc.top - 10 };
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
  return n ? { left: `${n.x}px`, top: `${n.y}px` } : undefined;
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="bong" tag="div" class="bong-emoji" aria-hidden="true">
      <div
        v-for="(b, i) in props.o.emojiBong.value" :key="b.from"
        class="bong" :class="[neo[b.from]?.kieu ?? 'giua', { nho: neo[b.from]?.nho }]" :data-from="b.from"
        :style="kieuCua(b) ?? { top: `calc(${12 + i * 64}px + env(safe-area-inset-top, 0px))` }"
      >
        <!-- :key theo lượt gửi → mỗi lần gửi lại là một nhịp nảy, bong bóng thì đứng yên -->
        <span :key="b.key" class="e">{{ b.emoji }}</span>
        <span v-if="!neo[b.from]" class="ai">{{ b.name }}</span>
        <i class="duoi" />
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
  padding: 6px 10px; border-radius: 20px;
  background: var(--panel-solid, #fff);
  border: 2.5px solid color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: 0 10px 26px rgba(0, 0, 0, .28);
}
/* TRÊN chip: `top` = mép trên chip − 10 → tự kéo lên trọn chiều cao mình */
.bong.tren { transform: translateY(-100%); transform-origin: 24px 100%; }
/* BÊN PHẢI một dòng: `top` = tâm dòng → kéo lên nửa chiều cao */
.bong.phai { transform: translateY(-50%); transform-origin: 0 50%; }
/* Không có chỗ neo: giữa mép trên, kèm tên */
.bong.giua { left: 50%; transform: translateX(-50%); transform-origin: 50% 0; }

.e { font-size: 36px; line-height: 1; animation: nay .45s cubic-bezier(.2, 1.4, .4, 1); }
/* Dòng kết quả / phòng chờ: nhỏ hơn — nó nằm giữa chữ, không phải giữa khoảng trời trống */
.nho { padding: 4px 8px; border-radius: 16px; }
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

/* Đuôi: ô vuông xoay 45°, chỉ hai cạnh có viền, cùng nền bong bóng */
.duoi {
  position: absolute; width: 14px; height: 14px; background: inherit;
  border: inherit; border-width: 0 0 2.5px 2.5px; border-radius: 0 0 0 3px;
}
.tren .duoi { left: 18px; bottom: -8.5px; transform: rotate(-45deg); }
.phai .duoi { left: -8.5px; top: calc(50% - 7px); transform: rotate(45deg); }
.giua .duoi { display: none; }

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
