<script setup lang="ts">
import { MemoryGame, presetConfig, configFromOptions, isDraw, CAMPAIGN_LEVELS } from '@mm/engine';
import { BOT_SPECS } from '@mm/engine';
import type { BoardOptions, BotLevel, GameConfig, Mode, PlayerInit } from '@mm/engine';
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import CelebrationFx from './components/CelebrationFx.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import GameScreen from './components/GameScreen.vue';
import MenuScreen from './components/MenuScreen.vue';
import OnlineScreen from './components/OnlineScreen.vue';
import ResultDialog from './components/ResultDialog.vue';
import RulesDialog from './components/RulesDialog.vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiQuery } from '@/lib/appUrl';
import IconDefs from './components/IconDefs.vue';
import TopBar from './components/TopBar.vue';
import { useGameSession } from './composables/useGameSession';
import { earned } from './lib/achievements';
import { sfx } from './lib/audio';
import { store, type SoundLevel } from './lib/storage';
import { loadThemes, type CardTheme } from './lib/themes';

const prefs = store.prefs();
const dark = ref(prefs.dark);
const soundLevel = ref<SoundLevel>(prefs.soundLevel);
/** Độ to của từng mức. Loa điện thoại ở sát tai nên 3,5 (mức thử trên loa máy
 *  tính) là quá to; 2,6 nghe rõ mà không giật mình, "nhỏ" thì đủ để biết mình
 *  vừa bấm gì trong phòng yên tĩnh. */
const SOUND_GAIN: Record<SoundLevel, number> = { off: 0, low: 1, high: 2.6 };
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
/** Tuỳ chọn bàn chơi — chỉ dùng cho "chơi nhanh"; Chiến dịch có luật riêng
 *  từng màn nên KHÔNG đi qua đây. */
const options = ref<BoardOptions>(prefs.options);
const level = ref(Math.min(CAMPAIGN_LEVELS, Math.max(1, prefs.level)));
const themeIds = ref<string[]>(prefs.themes);
const playerCount = ref(prefs.playerCount);
/** Đấu với máy: mức của máy, null là không đấu máy. KHÔNG lưu vào prefs — mở
 *  app lên phải là trang chủ bình thường, không tự nhảy vào ván đấu máy. */
const botLevel = ref<BotLevel | null>(null);
/**
 * Số đếm "tiến độ vừa đổi". Cần vì store đọc localStorage — computed nào gọi
 * store.unlockedLevel() không có phụ thuộc phản ứng nào, sẽ nhớ mãi giá trị cũ.
 * KHÔNG dùng totalScore làm mốc: ván đấu Bot dễ không cộng điểm, gán lại cùng
 * một số thì Vue không coi là thay đổi.
 */
const progressRev = ref(0);
const totalScore = ref(store.totalScore());

const themes = ref<CardTheme[]>([]);
const screen = ref<'menu' | 'game' | 'online'>('menu');
/**
 * Mã phòng từ link mời (?room=ABC123).
 *
 * PHẢI XOÁ khi rời màn online (xem `@back` bên dưới). Trước đây nó chỉ được
 * đặt một lần lúc mount và giữ nguyên suốt phiên, nên: vào bằng link mời →
 * thoát ra menu → bấm "Chơi online" lại là màn online vẫn thấy `joinCode` cũ,
 * tự nối vào PHÒNG CŨ (đã chết) rồi báo lỗi — mà ô nhập mã thì bị ẩn vì đang ở
 * nhánh "được mời". Đúng lỗi đã bị phản ánh: không còn chỗ nào nhập mã mới.
 */
const joinCode = ref('');
const levelId = ref<number | null>(null);
const isRecord = ref(false);
/** Tổng điểm TRƯỚC ván — để màn kết quả chạy số từ đây lên tổng mới. */
const totalBefore = ref(0);
/** Số ván THẮNG của từng người trong loạt đang chơi (nhiều người cùng máy).
 *  Khoá theo danh sách tên: đổi người hoặc đổi số người là loạt mới, tự về 0 —
 *  không thì tỷ số của nhóm cũ dính sang nhóm mới. */
const seriesKey = ref('');
const seriesWins = ref<Record<string, number>>({});
const freshAchievements = ref<string[]>([]);
/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
let resultTimer: ReturnType<typeof setTimeout> | undefined;

const session = useGameSession();
const onlineRef = ref<InstanceType<typeof OnlineScreen> | null>(null);
const confirmQuit = ref(false);
const showRules = ref(false);
/** Đổi key để ép MenuScreen dựng lại — logo "về trang chủ" là về bước 1 của wizard. */
const menuKey = ref(0);

/* ---------- nút Back của trình duyệt ----------
 * Mục tiêu: lỡ bấm Back theo thói quen thì KHÔNG bị ném ra khỏi web. Mỗi thứ
 * đang mở chiếm một mục lịch sử; Back đóng cái trên cùng. Chỉ khi đứng ở trang
 * chủ, không còn gì mở, thì Back mới thật sự rời trang — đúng như mong đợi.
 */
// Hộp thoại đóng TRƯỚC mọi thứ bên dưới nó
useBackCloser(30, () => showRules.value, () => { showRules.value = false; });
useBackCloser(30, () => confirmQuit.value, () => { confirmQuit.value = false; });
/**
 * Đang trong ván / phòng online: Back làm đúng việc của nút logo — tức là HỎI
 * trước khi bỏ ván dở, không lặng lẽ thoát. popstate không huỷ được nên phải
 * hỏi SAU khi đã lùi; `goHome()` tự lo chuyện đó, và hộp hỏi mà nó mở ra sẽ
 * thành chốt mới cho cú Back kế tiếp.
 */
useBackCloser(20, () => screen.value !== 'menu', goHome);

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

/** Ghi query state vào URL (không đẩy history mới) — xem lib/appUrl.ts. */
const setUrl = ghiQuery;

/** Lưu snapshot ván đang chơi — gọi sau mỗi biến động và trước khi rời trang. */
function persistGame(): void {
  const g = session.game.value;
  if (!g || g.finished) return;
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ snap: g.snapshot(), levelId: levelId.value, bot: botLevel.value }));
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
    const blob = JSON.parse(raw) as { snap: string; levelId: number | null; bot?: BotLevel | null };
    const g = MemoryGame.restore(blob.snap);
    // Ván đấu máy khôi phục sau F5: phải bật lại bộ điều khiển, không thì tới
    // lượt máy là ván treo vĩnh viễn. Mức lưu kèm snapshot.
    botLevel.value = blob.bot ?? null;
    session.setBot(botLevel.value);
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
  // Chưa từng chọn (hoặc bản lưu trỏ tới theme không còn tồn tại): lấy TẤT CẢ
  // theme đang mở khoá — bàn thẻ đa dạng ngay ván đầu, và người chơi thấy luôn
  // là chọn được nhiều. Đã chọn rồi thì tôn trọng lựa chọn của họ.
  themeIds.value = valid.length
    ? valid
    : list.filter((t) => t.unlockAt <= totalScore.value).map((t) => t.id);
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
watch([dark, soundLevel, mode, level, themeIds, playerCount, options], () => {
  store.savePrefs({
    dark: dark.value, sound: soundLevel.value !== 'off', soundLevel: soundLevel.value, mode: mode.value,
    level: level.value, themes: themeIds.value, playerCount: playerCount.value,
    options: options.value
  });
});

/** Biểu tượng của MỌI theme đang mở khoá — trần trên của số cặp chơi được, để
 *  bản đồ cấp biết cấp nào không bộ theme nào gánh nổi. */
const maxSymbols = computed(() => new Set(
  themes.value.filter((t) => t.unlockAt <= totalScore.value).flatMap((t) => t.symbols)
).size);

/** Trộn biểu tượng của mọi theme đã chọn, loại trùng. */
const symbols = computed(() => [...new Set(
  themes.value.filter((t) => themeIds.value.includes(t.id)).flatMap((t) => t.symbols)
)]);

function playerList(): PlayerInit[] | undefined {
  // Đấu máy: người chơi luôn đi trước, máy là 'bot' — id này khớp với id mà
  // bộ điều khiển trong useGameSession chờ tới lượt
  if (botLevel.value) {
    const spec = BOT_SPECS[botLevel.value];
    return [
      // Đấu máy LUÔN là "Bạn", không lấy tên đã lưu: tên là chuyện của phòng
      // online (và của nhiều người cùng máy). Lôi tên sót lại từ đó sang đây thì
      // người chơi thấy một cái tên mình chưa từng đặt cho ván này, mà nhánh
      // đấu máy lại không có bước nhập tên để sửa (MenuScreen bỏ bước 'names').
      { id: 'p1', name: 'Bạn' },
      { id: 'bot', name: spec.name, avatar: spec.avatar }
    ];
  }
  if (playerCount.value < 2) return undefined;
  const saved = store.playerNames();
  const list = Array.from({ length: playerCount.value }, (_, i) => ({
    id: `p${i + 1}`,
    name: saved[i] ?? `Người ${i + 1}`
  }));
  // Nhóm khác (đổi tên hoặc đổi số người) thì bắt đầu loạt mới từ 0
  const key = list.map((p) => p.name).join('|');
  if (key !== seriesKey.value) {
    seriesKey.value = key;
    seriesWins.value = {};
  }
  return list;
}

/** Seed lấy từ ngoài engine để engine giữ tính tất định (dùng chung với server sau này). */
const newSeed = (): number => Math.floor(Math.random() * 0xffffffff) || 1;

/**
 * Trạng thái không nhất quán thì tự chữa: `screen` báo đang chơi mà không có ván
 * nào là bế tắc — vùng chính rỗng và người chơi chỉ còn cách tải lại trang. Đưa
 * về menu và lau URL.
 */
watch(
  () => [screen.value, !!session.game.value] as const,
  ([sc, hasGame]) => {
    if (sc === 'game' && !hasGame) {
      screen.value = 'menu';
      setUrl(null);
    }
  }
);

function launch(config: GameConfig): void {
  isRecord.value = false;
  freshAchievements.value = [];
  session.start(config);
  screen.value = 'game';
  setUrl('playing=1');
  persistGame();
}

/** Vào một cấp. MỌI chế độ đều qua đây, nên chế độ nào cũng có cấp tiếp theo
 *  để chơi tiếp — trước đây chỉ Chiến dịch có, các chế độ khác chơi xong chỉ
 *  còn "chơi lại" và "về trang chủ". */
function startLevel(id: number): void {
  // Engine ném lỗi nếu theme đang chọn không đủ biểu tượng cho bàn của cấp —
  // không bắt thì Vue chết giữa render và người chơi nhận màn hình trắng.
  // Bản đồ đã chặn các cấp đó, đây là lưới an toàn cuối.
  try {
    // Chiến dịch giữ nguyên presetConfig: luật của nó do TỪNG MÀN quyết định
    // (mốc sao, tỉ lệ thẻ đặc biệt tăng dần), không phải do người chơi đặt.
    const cfg = mode.value === 'campaign'
      ? presetConfig({ mode: 'campaign', level: id, symbols: symbols.value, seed: newSeed(), players: playerList() })
      : configFromOptions({ options: options.value, level: id, symbols: symbols.value, seed: newSeed(), players: playerList() });
    levelId.value = id;
    level.value = id;
    session.setBot(botLevel.value);
    launch(cfg);
  } catch { /* bản đồ hiện cảnh báo "cần thêm theme" */ }
}

function nextLevel(): void {
  if (levelId.value && levelId.value < CAMPAIGN_LEVELS) startLevel(levelId.value + 1);
  else backToMenu();
}

function replay(): void {
  startLevel(levelId.value ?? level.value);
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
    const id = levelId.value ?? level.value;
    // Cấp và kỷ lục ghi RIÊNG: saveLevel mở cấp sau (chế độ không xếp sao thì
    // 1 sao = đã qua), saveResult giữ kỷ lục và cộng điểm vào tổng.
    if (s.status === 'won') store.saveLevel(game.config.mode, id, Math.max(1, s.stars), s.score);
    isRecord.value = s.status === 'won'
      && store.saveResult(game.config.mode, id, {
        score: s.score, moves: s.moves, seconds: s.seconds
      });
    freshAchievements.value = store.unlockAchievements(earned({
      summary: s,
      mode: game.config.mode,
      cells: game.cards.length,
      misses: player.misses,
      lives: game.config.lives ?? null,
      peekMs: game.config.peekMs ?? 0,
      livesLeft: player.lives,
      levelId: levelId.value ?? undefined
    }));
  } else {
    // Ván thi đấu cũng phải được cộng vào tổng tích luỹ, nếu không chơi nhiều
    // người cả buổi mà điểm vẫn đứng yên — và theme khoá theo điểm nên người
    // hay chơi cùng bạn bè không bao giờ mở được gì. Lấy điểm người dẫn đầu:
    // đây là thành tích của MÁY này, không phân biệt được ai đang cầm.
    // Đấu bot MỞ được cấp sau, nhưng chỉ khi NGƯỜI THẮNG (hoặc hoà).
    //
    // Vì sao không phải "bàn sạch là mở": trong ván đấu bot thì phần lớn bàn do
    // BOT dọn. Chọn Bot siêu đẳng rồi ngồi xem nó phá là mở hết cấp mà không
    // chơi gì — thang cấp mất nghĩa. Ngược lại, cấm hẳn thì ai chỉ đấu bot lại
    // mắc mãi ở cấp 1. Thắng bot là bằng chứng đã chơi được cấp này; muốn dễ
    // thì hạ mức bot xuống, vẫn phải tự lật đủ cặp.
    if (botLevel.value && s.status === 'won') {
      const champ = s.ranking[0];
      const humanWon = !!champ && (champ.id !== 'bot' || isDraw(s.ranking));
      if (humanWon) store.saveLevel(game.config.mode, levelId.value ?? level.value, 1, 0);
    }
    // Đấu máy: chỉ cộng điểm CỦA NGƯỜI, và mức Dễ thì không tính — nếu tính,
    // cày máy dễ là cách nhanh nhất để mở hết theme, mọi mốc điểm mất nghĩa.
    if (botLevel.value) {
      if (botLevel.value !== 'easy') {
        store.addScore(s.ranking.find((r) => r.id !== 'bot')?.score ?? 0);
      }
    } else store.addScore(s.ranking[0]?.score ?? 0);
    // Tỷ số loạt: hoà thì không ai được cộng
    const champ = s.ranking[0];
    if (champ && !isDraw(s.ranking)) {
      seriesWins.value = { ...seriesWins.value, [champ.name]: (seriesWins.value[champ.name] ?? 0) + 1 };
    }
  }
  totalBefore.value = totalScore.value;
  totalScore.value = store.totalScore();
  progressRev.value++;
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* bỏ qua */ }
});

/**
 * Có nút "Cấp tiếp theo" bấm được hay không.
 *
 * Chơi MỘT MÌNH thì phải hỏi store: thua thì cấp sau chưa mở, nút vẫn bấm được
 * là nhảy vào cấp bị khoá — bản đồ khoá nó nhưng nút thì không biết.
 *
 * Các nhánh khác (nhiều người cùng máy, đấu máy) mở sẵn hết cấp nên luôn đi tiếp
 * được, thắng hay thua cũng vậy — cùng luật với bản đồ cấp ở MenuScreen.
 */
const hasNext = computed(() => {
  void progressRev.value;                   // đếm để computed chạy lại sau mỗi ván
  const id = levelId.value;
  if (!id || id >= CAMPAIGN_LEVELS) return false;
  const soloLadder = playerCount.value < 2 && !botLevel.value;
  return soloLadder ? store.unlockedLevel() > id : true;
});
</script>

<template>
  <TopBar
    :dark="dark" :sound-level="soundLevel" :total-score="totalScore"
    @toggle-dark="dark = !dark"
    @rules="showRules = true"
    @cycle-sound="cycleSound"
    @home="goHome"
  />

  <!-- Transition KHÔNG dùng mode="out-in": đo được là pha vào không bao giờ chạy
       sau khi màn online rời đi, để lại vùng chính TRẮNG XOÁ và chỉ F5 mới thoát
       được (screen đã là 'menu' mà Vue vẫn render một comment rỗng). Chồng hai
       màn một nhịp rồi cho màn cũ tách khỏi luồng (.screen-leave-active) là đủ
       mượt mà không có trạng thái bế tắc nào. -->
  <main>
    <Transition name="screen">
    <MenuScreen
      v-if="screen === 'menu'"
      :key="menuKey"
      :themes="themes"
      :mode="mode"
      :level="level"
      :theme-ids="themeIds"
      :player-count="playerCount"
      :bot-level="botLevel"
      :options="options"
      :total-score="totalScore"
      :symbol-count="symbols.length"
      :max-symbol-count="maxSymbols"
      @update:mode="mode = $event"
      @update:level="level = $event"
      @update:theme-ids="themeIds = $event"
      @update:player-count="playerCount = $event"
      @update:bot-level="botLevel = $event"
      @update:options="options = $event"
      @start-level="startLevel"
      @online="screen = 'online'"
    />

    <OnlineScreen
      v-else-if="screen === 'online'"
      ref="onlineRef"
      :join-code="joinCode"
      @back="screen = 'menu'; joinCode = ''"
    />

    <GameScreen
      v-else-if="screen === 'game' && session.game.value"
      :session="session"
      :game="session.game.value"
      :level-id="levelId ?? undefined"
      :series-wins="seriesWins"
      @quit="goHome"
    />

    <!-- Nhánh CUỐI bắt buộc phải có. Trước đây chuỗi kết thúc ở điều kiện
         `session.game.value`, nên trạng thái nào không khớp là vùng chính RỖNG:
         thanh trên vẫn hiện (nó ở ngoài) mà giữa trang trắng xoá, và không có
         đường nào thoát ngoài tải lại. Watcher bên dưới tự đưa về menu; khối này
         là lưới an toàn cho một frame giữa hai trạng thái. -->
    <MenuScreen
      v-else
      :key="`fallback-${menuKey}`"
      :themes="themes"
      :mode="mode"
      :level="level"
      :theme-ids="themeIds"
      :player-count="playerCount"
      :bot-level="botLevel"
      :options="options"
      :total-score="totalScore"
      :symbol-count="symbols.length"
      :max-symbol-count="maxSymbols"
      @update:mode="mode = $event"
      @update:level="level = $event"
      @update:theme-ids="themeIds = $event"
      @update:player-count="playerCount = $event"
      @update:bot-level="botLevel = $event"
      @update:options="options = $event"
      @start-level="startLevel"
      @online="screen = 'online'"
    />
    </Transition>
  </main>

  <!-- Kho hình + gradient cho <OptionIcon>. Mount ĐÚNG MỘT LẦN: id gradient là
       toàn cục, nhiều bản sao thì mọi icon lấy chung một màu. -->
  <IconDefs />

  <RulesDialog v-if="showRules" @close="showRules = false" />

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
    :series-wins="seriesWins"
    :has-next="hasNext"
    :level-id="levelId ?? level"
    @replay="replay"
    @next="nextLevel"
    @menu="backToMenu"
  />
</template>

<style scoped>
main {
  /* position: relative để màn đang rời (.screen-leave-active, inset: 0) neo
     theo đây thay vì theo viewport */
  position: relative;
  flex: 1; min-height: 0; display: flex; justify-content: center;
  padding: 12px; overflow-y: auto;
}
/* Cột app đã cố định bề rộng (440px trên desktop, full trên mobile) nên panel
   chỉ cần chiếm trọn chỗ — không còn chặn 760px hay ghim 820px theo viewport. */
main > * { width: 100%; }
</style>
