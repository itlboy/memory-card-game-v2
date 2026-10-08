<script setup lang="ts">
import { HelpCircle, Menu, Moon, Sun, UserRound, Volume1, Volume2, VolumeX } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { num, numShort } from '@/lib/format';
import type { SoundLevel } from '@/lib/storage';

/** `account`: server có tài khoản không — không có (bản Cloudflare) thì giấu nút.
 *  `avatar`: ảnh Google của người đang đăng nhập, null là chưa đăng nhập. */
const props = defineProps<{
  dark: boolean; soundLevel: SoundLevel; totalScore: number;
  account?: boolean; avatar?: string | null; signedIn?: boolean;
}>();
defineEmits<{ 'toggle-dark': []; 'cycle-sound': []; home: []; rules: []; account: [] }>();

const SOUND_LABEL: Record<SoundLevel, string> = {
  off: 'Âm thanh: đang tắt',
  low: 'Âm thanh: nhỏ',
  high: 'Âm thanh: to'
};
/*
 * MỘT NÚT MENU thay cho bốn nút rời. Bốn nút × 44px + khoảng cách là 208px —
 * trên iPhone 15 Pro Max (430px) viên điểm đã chờm lên chữ "Lật Thẻ" (ảnh người
 * chơi gửi 08.10.2026). Hàng trên giờ chỉ còn logo · điểm · menu; thứ hiếm bấm
 * (luật, nền, âm thanh, tài khoản) nằm trong menu thả xuống. Nút menu mang
 * AVATAR khi đã đăng nhập để nhìn là biết mình đang là ai.
 */
const open = ref(false);
const menuEl = ref<HTMLElement | null>(null);
function dong(): void { open.value = false; }
function ngoai(e: PointerEvent): void {
  if (open.value && menuEl.value && !menuEl.value.contains(e.target as Node)) dong();
}
onMounted(() => document.addEventListener('pointerdown', ngoai, true));
onUnmounted(() => document.removeEventListener('pointerdown', ngoai, true));
// Nút Back của máy đóng menu trước mọi thứ khác (cùng mức với hộp thoại)
useBackCloser(30, () => open.value, dong);

const soundIcon = computed(() =>
  props.soundLevel === 'off' ? VolumeX : props.soundLevel === 'low' ? Volume1 : Volume2);

/** Số đang hiển thị — chạy dần lên số thật để người chơi THẤY điểm được cộng. */
const shown = ref(props.totalScore);
/** Bong bóng "+N" bay lên mỗi lần điểm tăng. */
const gain = ref<{ amount: number; key: number } | null>(null);
const bump = ref(0);
let raf = 0;
let gainTimer: ReturnType<typeof setTimeout> | undefined;

watch(() => props.totalScore, (to, from) => {
  const delta = to - from;
  if (delta > 0) {
    gain.value = { amount: delta, key: (gain.value?.key ?? 0) + 1 };
    bump.value++;
    clearTimeout(gainTimer);
    gainTimer = setTimeout(() => { gain.value = null; }, 1500);
  }
  // Điểm nhảy thẳng sang số mới thì không ai kịp nhận ra là mình vừa được cộng
  cancelAnimationFrame(raf);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || delta <= 0) { shown.value = to; return; }
  const dur = Math.min(1200, 380 + Math.abs(delta) * 1.6);
  const t0 = performance.now();
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);            // chậm dần về cuối
    shown.value = Math.round(from + delta * eased);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
});
</script>

<template>
  <header class="topbar">
    <h1>
      <button class="brand" type="button" aria-label="Về trang chủ" @click="$emit('home')">
        <!-- Hai lá bài chồng nghiêng — emoji 🃏 mỗi máy vẽ một kiểu, không dùng
             được làm dấu hiệu thương hiệu. Khung CỐ ĐỊNH 30×30 để không giãn
             kín header khi nằm trong flex. -->
        <span class="logo" aria-hidden="true">
          <i class="card-l" /><i class="card-r" />
        </span><span class="name">Lật Thẻ</span>
      </button>
    </h1>

    <span class="total" :class="{ pop: bump }" :key="bump" :title="`Tổng điểm tích lũy: ${num(totalScore)}`">
      <!-- Sao vẽ bằng SVG, fill currentColor: emoji ⭐ mỗi máy một kiểu và bị
           tính là chữ nên ngắt dòng ở máy hẹp -->
      <svg class="star-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.6l2.83 6.05 6.62.72-4.95 4.45 1.4 6.5L12 16.9l-5.9 3.42 1.4-6.5L2.55 9.37l6.62-.72z"
          fill="currentColor"
        />
      </svg>
      <b>{{ numShort(shown) }}</b>
      <Transition name="gain">
        <i v-if="gain" :key="gain.key" class="gain" aria-hidden="true">+{{ num(gain.amount) }}</i>
      </Transition>
    </span>
    <div ref="menuEl" class="menu-wrap">
      <button
        class="btn menu-btn" :class="{ in: signedIn }"
        aria-label="Menu" aria-haspopup="menu" :aria-expanded="open"
        type="button" @click="open = !open"
      >
        <img v-if="avatar" :src="avatar" alt="" referrerpolicy="no-referrer">
        <Menu v-else :size="22" />
      </button>
      <div v-if="open" class="menu" role="menu" @keydown.esc="dong">
        <button
          v-if="account" class="item" role="menuitem" type="button"
          :aria-label="signedIn ? 'Tài khoản của bạn' : 'Đăng nhập'"
          @click="dong(); $emit('account')"
        >
          <img v-if="avatar" :src="avatar" alt="" referrerpolicy="no-referrer">
          <UserRound v-else :size="20" />
          <span>{{ signedIn ? 'Tài khoản' : 'Đăng nhập' }}</span>
        </button>
        <button class="item" role="menuitem" aria-label="Luật chơi" type="button" @click="dong(); $emit('rules')">
          <HelpCircle :size="20" /><span>Luật chơi</span>
        </button>
        <button
          class="item" role="menuitem" type="button"
          :aria-label="dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'"
          @click="$emit('toggle-dark')"
        >
          <Sun v-if="dark" :size="20" /><Moon v-else :size="20" />
          <span>{{ dark ? 'Nền sáng' : 'Nền tối' }}</span>
        </button>
        <!-- Xoay vòng tắt → nhỏ → to, menu Ở LẠI để thấy mức vừa đổi -->
        <button
          class="item snd" :class="`lv-${soundLevel}`" role="menuitem" type="button"
          :aria-label="`${SOUND_LABEL[soundLevel]} — bấm để đổi`"
          @click="$emit('cycle-sound')"
        >
          <component :is="soundIcon" :size="20" /><span>{{ SOUND_LABEL[soundLevel] }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  /* backdrop-filter biến header thành stacking context riêng; không có z-index
     thì <main> đứng sau trong DOM vẽ ĐÈ lên menu thả xuống dù menu đặt z-index
     bao nhiêu (đã xảy ra thật trên iPhone). 15: trên bàn thẻ, dưới hộp thoại 20.
     tools/do-menu-tren.mjs đo elementFromPoint để canh. */
  position: relative; z-index: 15;
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
/* Wordmark co cỡ chữ theo bề rộng máy: máy hẹp (320px) không xuống 2 dòng
   làm TopBar cao gấp đôi, cũng không bị cắt chữ */
h1 { flex: 1; min-width: 0; margin: 0; font-size: clamp(17px, 5.2vw, var(--text-xl)); font-weight: 800; }
.brand {
  position: relative;
  display: flex; align-items: center; gap: var(--sp-2);
  border: 0; background: none; padding: 0;
  font: inherit; cursor: pointer;
  min-width: 0; max-width: 100%;
}
/* Logo cao 30px nhưng là nút VỀ TRANG CHỦ, nên vùng chạm phải đủ 44px (NF-07).
   Nới bằng ::after chứ đừng phình cái logo lên — header cao thêm là bàn thẻ hụt
   đi đúng chừng ấy. 30 + 7×2 = 44. */
.brand::after { content: ''; position: absolute; inset: -7px -4px; }
/* Khung cố định — bắt buộc tường minh, để tự do trong flex là nó giãn kín header */
.logo {
  position: relative; flex-shrink: 0;
  width: 30px; height: 30px;
  display: inline-block;
}
.logo i {
  position: absolute; top: 4px;
  width: 17px; height: 23px; border-radius: 5px;
  box-shadow: 0 2px 6px rgba(30, 27, 75, .25);
}
.logo .card-l {
  left: 0; transform: rotate(-14deg);
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
}
.logo .card-r {
  right: 0; transform: rotate(12deg);
  background: linear-gradient(150deg, #c44cf0, #ff5fa2);
}
/* Tên game KHÔNG được co: nó là dấu hiệu thương hiệu, cắt mất một chữ còn tệ
   hơn là huy hiệu điểm phải gọn lại (xem numShort). */
.name {
  flex-shrink: 0;
  background: linear-gradient(100deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  white-space: nowrap;
}
/* Huy hiệu điểm không bao giờ bị flex nén hay ngắt dòng */
/* Viên điểm vàng: đủ tương phản để đọc trên cả nền sáng và nền tối */
.total {
  position: relative;
  flex-shrink: 0; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px 4px 8px; border-radius: var(--r-full);
  color: #4a2f00;
  background: linear-gradient(135deg, #ffd76a, #f0a500);
  box-shadow: 0 4px 12px rgba(240, 165, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .5);
}
.total b {
  font-family: var(--font-display); font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: var(--text-md); color: inherit;
}
.star-ico { width: 14px; height: 14px; flex-shrink: 0; }
/* Mức âm lượng phải nhìn ra ngay, không chỉ dựa vào hình cái loa */
.snd.lv-off { color: var(--muted); }
.snd.lv-low { color: var(--accent); }
.snd.lv-high { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
/* Điểm vừa tăng: viên nảy một nhịp */
.total.pop { animation: total-pop .3s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes total-pop { 45% { transform: scale(1.12); } }
/* Bong bóng "+N" trôi XUỐNG dưới huy hiệu — bay lên thì tràn khỏi đỉnh
   viewport (và bị cột desktop overflow:hidden cắt mất) */
.gain {
  position: absolute; left: 50%; top: calc(100% + 2px);
  transform: translateX(-50%);
  font-style: normal; font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-md); color: #f0a500;
  text-shadow: 0 2px 8px rgba(240, 165, 0, .55);
  pointer-events: none;
}
.gain-enter-active { animation: gain-fly 1.5s ease-out forwards; }
.gain-leave-active { display: none; }
@keyframes gain-fly {
  0% { opacity: 0; transform: translate(-50%, -8px) scale(.7); }
  18% { opacity: 1; transform: translate(-50%, 0) scale(1.15); }
  70% { opacity: 1; transform: translate(-50%, 8px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, 20px) scale(.95); }
}
/* Máy rất hẹp (320px): nới chỗ cho wordmark bằng cách thu padding/gap,
   không thu chữ thêm nữa — dưới 17px là khó đọc */
@media (max-width: 359px) {
  .topbar { gap: 6px; padding: var(--sp-2); }
  .total { padding: 4px 8px; }
}
.menu-wrap { position: relative; flex-shrink: 0; }
.menu-btn img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
.menu-btn.in { border-color: var(--accent); }
/* Thả xuống dưới nút, canh phải; z trên bàn thẻ và dưới hộp thoại (20) */
.menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 15;
  min-width: 200px; padding: 6px; border-radius: 14px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .28);
  display: grid; gap: 2px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px;
  background: none; color: var(--fg); font: inherit; font-weight: 700; text-align: left;
  cursor: pointer; white-space: nowrap;
}
.item img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
@media (hover: hover) { .item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); } }
.item:active { background: color-mix(in srgb, var(--accent) 18%, transparent); }
</style>
