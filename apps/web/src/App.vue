<script setup lang="ts">
import { MemoryGame, levelConfig, levelSpec, presetConfig, CAMPAIGN_LEVELS, GRIDS } from '@mm/engine';
import type { GameConfig, Mode, PlayerInit } from '@mm/engine';
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import CelebrationFx from './components/CelebrationFx.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import GameScreen from './components/GameScreen.vue';
import MenuScreen from './components/MenuScreen.vue';
import OnlineScreen from './components/OnlineScreen.vue';
import ResultDialog from './components/ResultDialog.vue';
import TopBar from './components/TopBar.vue';
import { useGameSession } from './composables/useGameSession';
import { earned } from './lib/achievements';
import { sfx } from './lib/audio';
import { store, type SoundLevel } from './lib/storage';
import { loadThemes, type CardTheme } from './lib/themes';

const prefs = store.prefs();
const dark = ref(prefs.dark);
const soundLevel = ref<SoundLevel>(prefs.soundLevel);
/** Độ to của từng mức. "nhỏ" phải nghe rõ trong phòng yên tĩnh mà không ồn. */
const SOUND_GAIN: Record<SoundLevel, number> = { off: 0, low: 1.2, high: 3.5 };
/** Nút chạy con thoi tắt → nhỏ → to rồi to → nhỏ → tắt: không bao giờ nhảy
 *  thẳng từ to sang tắt, nên bấm quá tay vẫn còn nghe được. */
const soundUp = ref(true);
function cycleSound(): void {
  const cur = soundLevel.value;
  if (cur === 'low') soundLevel.value = soundUp.value ? 'high' : 'off';
  else {
    soundLevel.value = 'low';
    soundUp.value = cur === 'off';   // vừa ở tắt thì đi lên, vừa ở to thì đi xuống
  }
  // Áp mức MỚI trước khi phát, không thì tiếng xác nhận vẫn ở mức cũ
  applySound();
  sfx.select();   // mức tắt thì im — chính nó cũng là phản hồi
}

function applySound(): void {
  sfx.enabled = soundLevel.value !== 'off';
  if (soundLevel.value !== 'off') sfx.volume = SOUND_GAIN[soundLevel.value];
}
const mode = ref<Mode>(prefs.mode);
const grid = ref(prefs.grid in GRIDS ? prefs.grid : '4x4');
const themeIds = ref<string[]>(prefs.themes);
const playerCount = ref(prefs.playerCount);
const totalScore = ref(store.totalScore());

const themes = ref<CardTheme[]>([]);
const screen = ref<'menu' | 'game' | 'online'>('menu');
/** Mã phòng từ link mời (?room=ABC123). */
const joinCode = ref('');
const levelId = ref<number | null>(null);
const isRecord = ref(false);
/** Tổng điểm TRƯỚC ván — để màn kết quả chạy số từ đây lên tổng mới. */
const totalBefore = ref(0);
const freshAchievements = ref<string[]>([]);
/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
let resultTimer: ReturnType<typeof setTimeout> | undefined;

const session = useGameSession();
const onlineRef = ref<InstanceType<typeof OnlineScreen> | null>(null);
const confirmQuit = ref(false);
/** Đổi key để ép MenuScreen dựng lại — logo "về trang chủ" là về bước 1 của wizard. */
const menuKey = ref(0);

/** Bấm logo: về trang chủ — đang dở việc thì hỏi trước. */
function goHome(): void {
  if (screen.value === 'online') {
    onlineRef.value?.requestHome();   // OnlineScreen tự hỏi đầu hàng / huỷ phòng
    return;
  }
  if (screen.value === 'game' && session.game.value && !session.game.value.finished) {
    confirmQuit.value = true;         // ván offline đang chơi
    return;
  }
  menuKey.value++;
  backToMenu();
}

/* ---------- state trên URL + khôi phục ván dở khi F5 ---------- */

const RESUME_KEY = 'mm.resume';

/** Ghi query state vào URL (không đẩy history mới). */
function setUrl(query: string | null): void {
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''));
}

/** Lưu snapshot ván đang chơi — gọi sau mỗi biến động và trước khi rời trang. */
function persistGame(): void {
  const g = session.game.value;
  if (!g || g.finished) return;
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ snap: g.snapshot(), levelId: levelId.value }));
  } catch { /* chế độ riêng tư */ }
}

function clearResume(): void {
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* bỏ qua */ }
  if (location.search) setUrl(null);
}

/** F5 giữa ván: dựng lại đúng ván từ snapshot. Trả về true nếu khôi phục được. */
function restoreGame(): boolean {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return false;
    const blob = JSON.parse(raw) as { snap: string; levelId: number | null };
    const g = MemoryGame.restore(blob.snap);
    if (g.finished) return false;
    levelId.value = blob.levelId;
    session.adopt(g);
    screen.value = 'game';
    return true;
  } catch { return false; }
}

watch(
  () => [session.moves.value, session.faceUp.value.size, session.matchedCount.value],
  persistGame
);

void loadThemes().then((list) => {
  themes.value = list;
  const valid = themeIds.value.filter((id) => list.some((t) => t.id === id));
  themeIds.value = valid.length ? valid : [list[0]?.id ?? 'animals'];
});

onMounted(() => {
  // iOS/Android chỉ cho phát âm sau CỬ CHỈ người dùng. Quan trọng: sau khi thoát
  // ra home rồi vào lại, iOS đòi cử chỉ mới — nên phải gắn LẠI bộ mở khoá mỗi
  // lần trang hiện lại, không chỉ một lần lúc mở app (đó là lý do trước đây vào
  // lại vẫn mất tiếng: resume() gọi ngoài cử chỉ bị iOS từ chối).
  const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;
  const unlock = (): void => {
    sfx.unlock();
    armUnlock();   // tự gắn lại cho lần sau
  };
  function armUnlock(): void {
    for (const ev of GESTURES) {
      document.removeEventListener(ev, unlock);
      document.addEventListener(ev, unlock, { once: true, passive: true });
    }
  }
  armUnlock();

  // Quay lại app: thử chạy lại ngay (có khi được), đồng thời vũ trang cử chỉ để
  // lần chạm kế tiếp chắc chắn mở khoá được.
  const wake = (): void => { sfx.resume(); armUnlock(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', wake);
  // Khôi phục vị trí từ URL sau F5 / mở link mời
  const q = new URLSearchParams(location.search);
  const code = q.get('room');
  if (code && /^\d{6}$/.test(code)) {
    // Online: giữ ?room=CODE trên URL suốt phiên — F5 quay lại đúng phòng
    joinCode.value = code;
    screen.value = 'online';
  } else if (q.get('playing') === '1') {
    // Ván offline dở: URL chỉ là con trỏ, ruột ván nằm trong snapshot
    if (!restoreGame()) setUrl(null);
  } else if (q.get('online') === '1') {
    screen.value = 'online';           // F5 ở màn vào online
  } else if (q.get('w')) {
    /* bước wizard — MenuScreen tự khôi phục từ ?w= */
  } else if (location.search) {
    setUrl(null);
  }

  // Chốt snapshot lần cuối + hỏi confirm nếu đang dở việc (F5/đóng tab nhầm)
  window.addEventListener('beforeunload', (e) => {
    persistGame();
    const inGame = screen.value === 'game' && !!session.game.value && !session.game.value.finished;
    const inOnline = screen.value === 'online' && (onlineRef.value?.isBusy() ?? false);
    if (inGame || inOnline) {
      e.preventDefault();
      e.returnValue = '';   // trình duyệt hiện hộp thoại xác nhận chuẩn
    }
  });
});

// Màn online (chưa vào phòng) cũng đánh dấu lên URL để F5 quay lại đúng chỗ
watch(screen, (sc) => {
  if (sc === 'online' && !location.search.includes('room=')) setUrl('online=1');
});

/* ---------- tuỳ chọn hiển thị ---------- */
watchEffect(() => { document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'; });
watchEffect(applySound);
watch([dark, soundLevel, mode, grid, themeIds, playerCount], () => {
  store.savePrefs({
    dark: dark.value, sound: soundLevel.value !== 'off', soundLevel: soundLevel.value, mode: mode.value,
    grid: grid.value, themes: themeIds.value, playerCount: playerCount.value
  });
});

/** Trộn biểu tượng của mọi theme đã chọn, loại trùng. */
const symbols = computed(() => [...new Set(
  themes.value.filter((t) => themeIds.value.includes(t.id)).flatMap((t) => t.symbols)
)]);

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
  setUrl('playing=1');
  persistGame();
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
  clearResume();
}

/* ---------- ghi kết quả khi ván kết thúc ---------- */
watch(session.summary, (s) => {
  clearTimeout(resultTimer);
  showResult.value = false;
  const game = session.game.value;
  if (!s || !game) return;
  // Thắng: để pháo hoa + vỗ tay chiếm sóng 5 giây rồi popup mới vào
  resultTimer = setTimeout(() => { showResult.value = true; }, s.status === 'won' ? 5000 : 1000);

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
  totalBefore.value = totalScore.value;
  totalScore.value = store.totalScore();
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* bỏ qua */ }
});

const hasNext = computed(() => !!levelId.value && levelId.value < CAMPAIGN_LEVELS);
</script>

<template>
  <TopBar
    :dark="dark" :sound-level="soundLevel" :total-score="totalScore"
    @toggle-dark="dark = !dark"
    @cycle-sound="cycleSound"
    @home="goHome"
  />

  <main>
    <Transition name="screen" mode="out-in">
    <MenuScreen
      v-if="screen === 'menu'"
      :key="menuKey"
      :themes="themes"
      :mode="mode"
      :grid="grid"
      :theme-ids="themeIds"
      :player-count="playerCount"
      :total-score="totalScore"
      @update:mode="mode = $event"
      @update:grid="grid = $event"
      @update:theme-ids="themeIds = $event"
      @update:player-count="playerCount = $event"
      @start="startQuick"
      @start-level="startLevel"
      @online="screen = 'online'"
    />

    <OnlineScreen
      v-else-if="screen === 'online'"
      ref="onlineRef"
      :join-code="joinCode"
      @back="screen = 'menu'"
    />

    <GameScreen
      v-else-if="session.game.value"
      :session="session"
      :game="session.game.value"
      :level-id="levelId ?? undefined"
      @quit="goHome"
    />
    </Transition>
  </main>

  <ConfirmDialog
    v-if="confirmQuit"
    title="Thoát ván đang chơi?"
    body="Ván này sẽ không được lưu kết quả."
    confirm-label="Thoát ván"
    @confirm="confirmQuit = false; menuKey++; backToMenu()"
    @cancel="confirmQuit = false"
  />

  <CelebrationFx v-if="session.summary.value?.status === 'won' && screen === 'game'" />

  <ResultDialog
    v-if="session.summary.value && showResult"
    :summary="session.summary.value"
    :is-record="isRecord"
    :show-stars="!!levelId"
    :multiplayer="!!session.game.value?.isMultiplayer"
    :fresh-achievements="freshAchievements"
    :total-before="totalBefore"
    :total-after="totalScore"
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
/* Cột app đã cố định bề rộng (440px trên desktop, full trên mobile) nên panel
   chỉ cần chiếm trọn chỗ — không còn chặn 760px hay ghim 820px theo viewport. */
main > * { width: 100%; }
</style>
