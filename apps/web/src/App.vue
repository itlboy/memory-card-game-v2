<script setup lang="ts">
import { levelConfig, levelSpec, presetConfig, CAMPAIGN_LEVELS, GRIDS } from '@mm/engine';
import type { GameConfig, Mode, PlayerInit } from '@mm/engine';
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import GameScreen from './components/GameScreen.vue';
import MenuScreen from './components/MenuScreen.vue';
import OnlineScreen from './components/OnlineScreen.vue';
import ResultDialog from './components/ResultDialog.vue';
import TopBar from './components/TopBar.vue';
import { useGameSession } from './composables/useGameSession';
import { earned } from './lib/achievements';
import { sfx } from './lib/audio';
import { store } from './lib/storage';
import { loadThemes, type CardTheme } from './lib/themes';

const prefs = store.prefs();
const dark = ref(prefs.dark);
const sound = ref(prefs.sound);
const mode = ref<Mode>(prefs.mode);
const grid = ref(prefs.grid in GRIDS ? prefs.grid : '4x4');
const themeId = ref(prefs.theme);
const playerCount = ref(prefs.playerCount);
const totalScore = ref(store.totalScore());

const themes = ref<CardTheme[]>([]);
const screen = ref<'menu' | 'game' | 'online'>('menu');
/** Mã phòng từ link mời (?room=ABC123). */
const joinCode = ref('');
const levelId = ref<number | null>(null);
const isRecord = ref(false);
const freshAchievements = ref<string[]>([]);

const session = useGameSession();

void loadThemes().then((list) => {
  themes.value = list;
  if (!list.some((t) => t.id === themeId.value)) themeId.value = list[0]?.id ?? 'animals';
});

onMounted(() => {
  // iOS/Android chỉ cho phát âm sau cử chỉ người dùng — mở khoá ở tương tác đầu tiên
  const unlock = (): void => sfx.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
    document.addEventListener(ev, unlock, { once: true, passive: true });
  }
  // Link mời: ?room=ABC123 → vào thẳng màn online với mã đã điền sẵn (ON-01)
  const code = new URLSearchParams(location.search).get('room');
  if (code && /^[A-Za-z0-9]{6}$/.test(code)) {
    joinCode.value = code.toUpperCase();
    screen.value = 'online';
    history.replaceState(null, '', location.pathname);
  }
});

/* ---------- tuỳ chọn hiển thị ---------- */
watchEffect(() => { document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'; });
watchEffect(() => { sfx.enabled = sound.value; });
watch([dark, sound, mode, grid, themeId, playerCount], () => {
  store.savePrefs({
    dark: dark.value, sound: sound.value, mode: mode.value,
    grid: grid.value, theme: themeId.value, playerCount: playerCount.value
  });
});

const symbols = computed(() => themes.value.find((t) => t.id === themeId.value)?.symbols ?? []);

function playerList(): PlayerInit[] | undefined {
  if (playerCount.value < 2) return undefined;
  const saved = store.playerNames();
  return Array.from({ length: playerCount.value }, (_, i) => ({
    id: `p${i + 1}`,
    name: saved[i] ?? `Người ${i + 1}`
  }));
}

/** Seed lấy từ ngoài engine để engine giữ tính tất định (dùng chung với server sau này). */
const newSeed = (): number => Math.floor(Math.random() * 0xffffffff) || 1;

function launch(config: GameConfig): void {
  isRecord.value = false;
  freshAchievements.value = [];
  session.start(config);
  screen.value = 'game';
}

function startQuick(): void {
  levelId.value = null;
  launch(presetConfig({
    mode: mode.value, grid: grid.value, symbols: symbols.value,
    seed: newSeed(), players: playerList()
  }));
}

function startLevel(id: number): void {
  levelId.value = id;
  launch(levelConfig(levelSpec(id), symbols.value, newSeed()));
}

function nextLevel(): void {
  if (levelId.value && levelId.value < CAMPAIGN_LEVELS) startLevel(levelId.value + 1);
  else backToMenu();
}

function replay(): void {
  levelId.value ? startLevel(levelId.value) : startQuick();
}

function backToMenu(): void {
  session.stop();
  session.summary.value = null;   // đóng dialog kết quả nếu đang mở
  screen.value = 'menu';
  totalScore.value = store.totalScore();
}

/* ---------- ghi kết quả khi ván kết thúc ---------- */
watch(session.summary, (s) => {
  const game = session.game.value;
  if (!s || !game) return;

  const player = game.players[0]!;
  if (!game.isMultiplayer) {
    if (levelId.value) {
      if (s.status === 'won') store.saveLevel(levelId.value, s.stars, s.score);
    } else {
      isRecord.value = s.status === 'won'
        && store.saveResult(game.config.mode, grid.value, {
          score: s.score, moves: s.moves, seconds: s.seconds
        });
    }
    freshAchievements.value = store.unlockAchievements(earned({
      summary: s,
      mode: game.config.mode,
      cells: game.cards.length,
      misses: player.misses,
      livesLeft: player.lives,
      levelId: levelId.value ?? undefined
    }));
  }
  totalScore.value = store.totalScore();
});

const hasNext = computed(() => !!levelId.value && levelId.value < CAMPAIGN_LEVELS);
</script>

<template>
  <TopBar
    :dark="dark" :sound="sound" :total-score="totalScore"
    @toggle-dark="dark = !dark"
    @toggle-sound="sound = !sound"
  />

  <main>
    <Transition name="screen" mode="out-in">
    <MenuScreen
      v-if="screen === 'menu'"
      :themes="themes"
      :mode="mode"
      :grid="grid"
      :theme-id="themeId"
      :player-count="playerCount"
      :total-score="totalScore"
      @update:mode="mode = $event"
      @update:grid="grid = $event"
      @update:theme-id="themeId = $event"
      @update:player-count="playerCount = $event"
      @start="startQuick"
      @start-level="startLevel"
      @online="screen = 'online'"
    />

    <OnlineScreen
      v-else-if="screen === 'online'"
      :join-code="joinCode"
      @back="screen = 'menu'"
    />

    <GameScreen
      v-else-if="session.game.value"
      :session="session"
      :game="session.game.value"
      :level-id="levelId ?? undefined"
      @quit="backToMenu"
    />
    </Transition>
  </main>

  <ResultDialog
    v-if="session.summary.value"
    :summary="session.summary.value"
    :is-record="isRecord"
    :show-stars="!!levelId"
    :multiplayer="!!session.game.value?.isMultiplayer"
    :fresh-achievements="freshAchievements"
    :has-next="hasNext"
    @replay="replay"
    @next="nextLevel"
    @menu="backToMenu"
  />
</template>

<style scoped>
main {
  flex: 1; min-height: 0; display: flex; justify-content: center;
  padding: 12px; overflow-y: auto;
}
main > * { width: 100%; max-width: 760px; }
</style>
