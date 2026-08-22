const { HudBar, PlayerChip, BoardGrid, Toast, TurnBanner, EmojiBar, ResultDialog, ConfirmDialog, Celebration } = window.MemoryMatchDesignSystem_ce0961;
const { grids, themes } = window.MM_DATA;

const BACKS = ['stars', 'diamond', 'aurora'];
const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/** Build a shuffled deck of pairs; blank centre cell for odd grids. */
function buildDeck(grid, themeIds, seed = 1) {
  const [cols, rows] = grids[grid];
  const total = cols * rows;
  const pairs = Math.floor(total / 2);
  const pool = [...new Set(themes.filter((t) => themeIds.includes(t.id)).flatMap((t) => t.symbols))];
  const picks = pool.slice(0, pairs);
  const deck = [...picks, ...picks].map((symbol, i) => ({ symbol, key: i }));
  for (let i = deck.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const cards = [];
  const blankAt = total % 2 === 1 ? Math.floor(total / 2) : -1;
  for (let i = 0; i < total; i++) cards.push(i === blankAt ? { blank: true } : deck.pop());
  return { cards, cols, rows, pairs };
}

function GameScreen({ config, onQuit, onMenu, onReplay }) {
  const { grid, themeIds, mode, playerCount, levelId } = config;
  const [{ cards, cols, rows, pairs }] = React.useState(() => buildDeck(grid, themeIds, (levelId ?? 3) * 7));
  const back = BACKS[(levelId ?? 1) % BACKS.length];
  const [faceUp, setFaceUp] = React.useState([]);
  const [matched, setMatched] = React.useState([]);
  const [wrong, setWrong] = React.useState([]);
  const [moves, setMoves] = React.useState(0);
  const [scores, setScores] = React.useState(Array.from({ length: playerCount }, () => 0));
  const [turn, setTurn] = React.useState(0);
  const [banner, setBanner] = React.useState(null);
  const [gain, setGain] = React.useState(null);
  const [toast, setToast] = React.useState(mode === 'peek' ? '👀 Ghi nhớ vị trí các thẻ…' : null);
  const [confirm, setConfirm] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const multi = playerCount > 1;
  const won = matched.length === pairs * 2;

  React.useEffect(() => {
    if (won) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [won]);

  function flip(i) {
    if (cards[i].blank || faceUp.includes(i) || matched.includes(i) || faceUp.length === 2) return;
    const next = [...faceUp, i];
    setFaceUp(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    if (cards[a].symbol === cards[b].symbol) {
      setTimeout(() => {
        setMatched((m) => [...m, a, b]);
        setFaceUp([]);
        setScores((s) => s.map((v, k) => (k === turn ? v + 100 : v)));
        setGain({ index: b, key: Date.now() });
      }, 420);
    } else {
      setWrong(next);
      setTimeout(() => {
        setFaceUp([]); setWrong([]);
        if (multi) {
          const nextTurn = (turn + 1) % playerCount;
          setTurn(nextTurn);
          setBanner({ name: `Người ${nextTurn + 1}`, avatar: AVATARS[nextTurn], key: Date.now() });
          setTimeout(() => setBanner(null), 1400);
        }
      }, 760);
    }
  }

  const view = cards.map((c, i) => ({
    ...c, faceUp: faceUp.includes(i), matched: matched.includes(i), wrong: wrong.includes(i)
  }));
  const fit = `min(100%, calc((100dvh - ${multi ? 255 : 230}px) * ${(cols * 3) / (rows * 4)}))`;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', position: 'relative' }}>
      <HudBar
        score={scores[0]} moves={moves} matched={matched.length / 2} totalPairs={pairs}
        combo={1} elapsed={elapsed} lives={mode === 'survival' && !multi ? 5 : null}
        levelId={levelId} multiplayer={multi} onQuit={() => setConfirm(true)}
      />
      {multi && (
        <div style={{ display: 'flex', gap: 6 }}>
          {scores.map((s, i) => (
            <PlayerChip key={i} name={`Người ${i + 1}`} index={i} score={s} active={i === turn}
              turnLeft={i === turn ? 15 - (elapsed % 15) : null}
              lives={mode === 'survival' ? 5 : null} />
          ))}
        </div>
      )}
      {toast && <Toast tone="peek">{toast}</Toast>}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BoardGrid cols={cols} cards={view} back={back} onFlip={flip} style={{ width: fit }} />
        {gain && (
          <span key={gain.key} aria-hidden="true" style={{
            position: 'absolute', left: `${(((gain.index % cols) + 0.5) / cols) * 100}%`,
            top: `${((Math.floor(gain.index / cols) + 0.5) / rows) * 100}%`,
            transform: 'translate(-50%,-50%)', fontWeight: 800, fontSize: 'clamp(16px,4vw,24px)',
            color: 'var(--gold)', textShadow: '0 1px 8px rgba(0,0,0,.35)', pointerEvents: 'none',
            animation: 'mm-rise 1s ease-out forwards'
          }}>+100</span>
        )}
        {banner && <TurnBanner key={banner.key} name={banner.name} avatar={banner.avatar} />}
      </div>
      {multi && <EmojiBar onSend={() => {}} />}
      {won && <Celebration />}
      {won && (
        <ResultDialog
          title={multi ? `Người ${scores.indexOf(Math.max(...scores)) + 1} thắng! 🏆` : levelId ? 'Hoàn thành! 🎉' : 'Kỷ lục mới! 🏆'}
          reason="Bạn đã mở hết các cặp!"
          stars={levelId ? 3 : null}
          ranking={multi ? scores.map((s, i) => ({ name: `Người ${i + 1}`, score: s, pairs: s / 100, bestStreak: 2 })).sort((a, b) => b.score - a.score) : null}
          stats={[{ label: 'Điểm', value: scores[0] }, { label: 'Số lượt', value: moves }, { label: 'Thời gian', value: `0:${String(elapsed).padStart(2, '0')}` }, { label: 'Chuỗi dài nhất', value: 3 }]}
          achievements={levelId ? [{ name: 'Hoàn hảo', hint: 'Đạt 3 sao ở một màn Chiến dịch' }] : []}
          primaryLabel={levelId ? 'Màn tiếp theo' : 'Chơi lại'} secondaryLabel="Về menu"
          onPrimary={onReplay} onSecondary={onMenu}
        />
      )}
      {confirm && (
        <ConfirmDialog title="Thoát ván đang chơi?" body="Ván này sẽ không được lưu kết quả."
          confirmLabel="Thoát ván" onConfirm={onQuit} onCancel={() => setConfirm(false)} />
      )}
    </section>
  );
}

Object.assign(window, { GameScreen, buildDeck });
