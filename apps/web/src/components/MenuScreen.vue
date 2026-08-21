<script setup lang="ts">
import { GRIDS } from '@mm/engine';
import type { Mode } from '@mm/engine';
import { computed } from 'vue';
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import CampaignMap from './CampaignMap.vue';

const props = defineProps<{
  themes: CardTheme[];
  mode: Mode;
  grid: string;
  themeId: string;
  playerCount: number;
  totalScore: number;
}>();

const emit = defineEmits<{
  'update:mode': [Mode];
  'update:grid': [string];
  'update:themeId': [string];
  'update:playerCount': [number];
  start: [];
  'start-level': [number];
}>();

const MODES: { id: Mode; name: string; desc: string }[] = [
  { id: 'classic',  name: 'Cổ điển',        desc: 'Không giới hạn thời gian · lật sai −10 điểm' },
  { id: 'time',     name: 'Đua thời gian',  desc: 'Xong càng nhanh, thưởng càng nhiều' },
  { id: 'campaign', name: 'Chiến dịch',     desc: '20 màn tăng dần độ khó · xếp 1–3 sao' },
  { id: 'survival', name: 'Sinh tồn',       desc: '5 mạng · mỗi lượt sai mất 1 mạng' },
  { id: 'peek',     name: 'Chớp nhoáng',    desc: 'Hé mở toàn bàn 4 giây rồi úp lại' }
];

const gridKeys = Object.keys(GRIDS);
const isCampaign = computed(() => props.mode === 'campaign');
/** Chơi nhiều người trên cùng thiết bị chỉ áp dụng cho chế độ luân phiên. */
const allowsMultiplayer = computed(() => props.mode === 'classic' || props.mode === 'survival');

const unlocked = (t: CardTheme): boolean => t.unlockAt <= props.totalScore;
const best = computed(() => store.best(props.mode, props.grid));
const cells = computed(() => {
  const g = GRIDS[props.grid];
  return g ? g.cols * g.rows : 0;
});
/** Theme phải đủ biểu tượng cho lưới đã chọn. */
const themeTooSmall = computed(() => {
  const t = props.themes.find((x) => x.id === props.themeId);
  return !!t && t.symbols.length < Math.floor(cells.value / 2);
});
</script>

<template>
  <section class="panel">
    <h2 class="section-title">Chế độ chơi</h2>
    <div class="chips" role="radiogroup" aria-label="Chế độ chơi">
      <button
        v-for="m in MODES" :key="m.id" class="chip" role="radio"
        :aria-checked="mode === m.id" type="button"
        @click="emit('update:mode', m.id)"
      >
        <strong>{{ m.name }}</strong><small>{{ m.desc }}</small>
      </button>
    </div>

    <template v-if="isCampaign">
      <h2 class="section-title">Chọn màn</h2>
      <CampaignMap
        :progress="store.campaign()"
        :unlocked="store.unlockedLevel()"
        @play="emit('start-level', $event)"
      />
    </template>

    <template v-else>
      <h2 class="section-title">Kích thước lưới</h2>
      <div class="chips" role="radiogroup" aria-label="Kích thước lưới">
        <button
          v-for="k in gridKeys" :key="k" class="chip compact" role="radio"
          :aria-checked="grid === k" type="button"
          @click="emit('update:grid', k)"
        >
          <strong>{{ k.replace('x', '×') }}</strong>
          <small>{{ Math.floor(GRIDS[k]!.cols * GRIDS[k]!.rows / 2) }} cặp</small>
        </button>
      </div>

      <template v-if="allowsMultiplayer">
        <h2 class="section-title">Số người chơi (cùng thiết bị)</h2>
        <div class="chips" role="radiogroup" aria-label="Số người chơi">
          <button
            v-for="n in 4" :key="n" class="chip compact" role="radio"
            :aria-checked="playerCount === n" type="button"
            @click="emit('update:playerCount', n)"
          >
            <strong>{{ n === 1 ? '1 (chơi đơn)' : `${n} người` }}</strong>
          </button>
        </div>
      </template>
    </template>

    <h2 class="section-title">Theme thẻ</h2>
    <div class="chips" role="radiogroup" aria-label="Theme thẻ">
      <button
        v-for="t in themes" :key="t.id" class="chip compact" role="radio"
        :aria-checked="themeId === t.id"
        :aria-disabled="!unlocked(t)"
        :disabled="!unlocked(t)"
        type="button"
        @click="unlocked(t) && emit('update:themeId', t.id)"
      >
        <strong>{{ t.name }}</strong>
        <small v-if="!unlocked(t)">🔒 cần {{ t.unlockAt }} điểm tích lũy</small>
        <small v-else>{{ t.symbols.length }} biểu tượng</small>
      </button>
    </div>

    <p v-if="themeTooSmall" class="warn" role="alert">
      Theme này không đủ biểu tượng cho lưới {{ grid.replace('x', '×') }}. Hãy chọn lưới nhỏ hơn hoặc theme khác.
    </p>

    <button v-if="!isCampaign" class="btn-primary" :disabled="themeTooSmall" type="button" @click="emit('start')">
      Bắt đầu
    </button>

    <p v-if="!isCampaign" class="best">
      <template v-if="best">
        Kỷ lục: <b>{{ best.score }}</b> điểm · {{ best.moves }} lượt · {{ clock(best.seconds) }}
      </template>
      <template v-else>Chưa có kỷ lục cho lưới {{ grid.replace('x', '×') }}.</template>
    </p>
  </section>
</template>

<style scoped>
.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
</style>
