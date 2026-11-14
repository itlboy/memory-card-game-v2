<script setup lang="ts">
/**
 * BẢNG CHỌN MỨC CỦA MỘT MÁY (máy chơi cùng, 14.11.2026 — mockup
 * https://claude.ai/artifact/DY6HdqawWBH9uD7ew2gcEB). Dùng chung cho bước "Tên từng người"
 * (offline) và phòng chờ online. Đúng 5 ô màu của bước mức Đấu máy (`BOT_CHOICES` ở MenuScreen
 * — giữ THỨ TỰ MÀU đó, nó chống mặt máy chìm vào nền ô). Chạm nền / Back là đóng.
 */
import { BOT_SPECS } from '@mm/engine';
import type { BotLevel } from '@mm/engine';
import { td } from '@/lib/i18n';
import { tenBot } from '@/lib/ten';
import { sfx } from '@/lib/audio';
import { useBackCloser } from '@/composables/useBackGuard';
import MatBot from './MatBot.vue';

defineProps<{ tieuDe: string; muc: BotLevel | null }>();
const emit = defineEmits<{ chon: [BotLevel]; dong: [] }>();

const MUC: readonly { id: BotLevel; g: string }[] = [
  { id: 'easy', g: 'g-teal' }, { id: 'normal', g: 'g-amber' }, { id: 'hard', g: 'g-blue' },
  { id: 'insane', g: 'g-violet' }, { id: 'divine', g: 'g-pink' }
];
useBackCloser(40, () => true, () => emit('dong'));
function chon(l: BotLevel): void { sfx.select(); emit('chon', l); }
</script>

<template>
  <div class="muc-phu" @click.self="emit('dong')">
    <div class="muc-bang khay" role="dialog" :aria-label="tieuDe">
      <p class="muc-tieu">{{ tieuDe }}</p>
      <button
        v-for="b in MUC" :key="b.id" class="option wide neon" :class="b.g" type="button"
        :aria-pressed="muc === b.id" @click="chon(b.id)"
      >
        <span class="bot-face" aria-hidden="true"><MatBot :mat="BOT_SPECS[b.id].avatar" /></span>
        <span class="text"><strong>{{ tenBot(b.id) }}</strong><small>{{ td(`menu.bot.${b.id}`) }}</small></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.muc-phu {
  position: fixed; inset: 0; z-index: 40; background: rgba(10, 18, 45, .45);
  display: flex; align-items: flex-end; justify-content: center;
}
.muc-bang {
  width: min(100%, 520px); display: grid; gap: 8px;
  padding: 14px 12px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px 24px 0 0; max-height: 92dvh; overflow-y: auto;
}
.muc-tieu { margin: 0 4px 2px; font-family: var(--font-display); font-weight: 900; font-size: var(--text-lg); }
.muc-bang .option {
  min-height: 56px; display: flex; align-items: center; gap: 12px; text-align: left; padding: 8px 14px;
}
.muc-bang .option .text { display: flex; flex-direction: column; min-width: 0; }
.muc-bang .bot-face { font-size: 36px; line-height: 1; flex: none; }
</style>
