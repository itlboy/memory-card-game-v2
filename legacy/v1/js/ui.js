(async function () {
  const $ = (id) => document.getElementById(id);
  const themes = await loadThemes();
  const prefs = Storage.prefs;
  let sel = { mode: prefs.mode, grid: prefs.grid, theme: prefs.theme };
  let game = null, timer = null;

  /* ---------- giao diện chung ---------- */
  function applyDark(on) {
    document.documentElement.dataset.theme = on ? 'dark' : 'light';
    $('btnTheme').textContent = on ? '☀️' : '🌙';
  }
  function applySound(on) {
    Sfx.enabled = on;
    $('btnSound').textContent = on ? '🔊' : '🔇';
    $('btnSound').setAttribute('aria-pressed', String(on));
  }
  applyDark(prefs.dark);
  applySound(prefs.sound);

  $('btnTheme').onclick = () => {
    const on = document.documentElement.dataset.theme !== 'dark';
    applyDark(on); Storage.savePrefs({ dark: on });
  };
  $('btnSound').onclick = () => {
    applySound(!Sfx.enabled); Storage.savePrefs({ sound: Sfx.enabled });
  };

  /* ---------- menu ---------- */
  $('themeList').innerHTML = themes.map((t) =>
    `<button class="choice" data-theme="${t.id}" role="radio" aria-checked="false">${t.name}</button>`
  ).join('');

  function pick(group, value) {
    document.querySelectorAll(`[data-${group}]`).forEach((el) => {
      const on = el.dataset[group] === value;
      el.classList.toggle('selected', on);
      el.setAttribute('aria-checked', String(on));
    });
    sel[group] = value;
    Storage.savePrefs({ [group]: value });
    renderBest();
  }
  ['mode', 'grid', 'theme'].forEach((g) => {
    document.querySelectorAll(`[data-${g}]`).forEach((el) => {
      el.onclick = () => pick(g, el.dataset[g]);
    });
  });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function renderBest() {
    const b = Storage.best(sel.mode, sel.grid);
    $('bestBoard').textContent = b
      ? `Kỷ lục ${sel.grid}: ${b.score} điểm · ${b.moves} lượt · ${fmt(b.seconds)}\nTổng điểm tích lũy: ${Storage.totalScore}`
      : `Chưa có kỷ lục cho ${sel.grid}.\nTổng điểm tích lũy: ${Storage.totalScore}`;
  }

  ['mode', 'grid', 'theme'].forEach((g) => pick(g, sel[g]));

  function show(screen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === screen));
  }

  /* ---------- vòng chơi ---------- */
  function start() {
    const theme = themes.find((t) => t.id === sel.theme) || themes[0];
    game = new Game({ mode: sel.mode, grid: sel.grid, symbols: theme.symbols });
    renderBoard();
    $('timeLabel').textContent = game.timeLimit === null ? 'Thời gian' : 'Còn lại';
    updateHud();
    show('screenGame');
    clearInterval(timer);
    timer = setInterval(tick, 200);
    $('board').querySelector('.card')?.focus();
  }

  function renderBoard() {
    const { cols } = GRIDS[game.grid];
    const board = $('board');
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.innerHTML = game.cards.map((c, i) =>
      `<button class="card" data-i="${i}" role="gridcell"
               aria-label="Thẻ ${i + 1}, chưa mở"><span class="inner">
         <span class="face back"></span><span class="face front">${c.symbol}</span>
       </span></button>`
    ).join('');
    board.querySelectorAll('.card').forEach((el) => {
      el.onclick = () => onFlip(Number(el.dataset.i));
    });
  }

  const cardEl = (i) => $('board').querySelector(`[data-i="${i}"]`);

  function onFlip(i) {
    const res = game.flip(i);
    if (!res) return;
    const el = cardEl(i);
    el.classList.add('up');
    el.setAttribute('aria-label', `Thẻ ${i + 1}, ${game.cards[i].symbol}`);
    Sfx.flip();

    if (res.type === 'match') {
      Sfx.match();
      res.cleared.forEach((k) => {
        const c = cardEl(k);
        c.classList.remove('up'); c.classList.add('done');
        c.setAttribute('aria-disabled', 'true');
      });
    } else if (res.type === 'miss') {
      Sfx.miss();
      res.hide.forEach((k) => cardEl(k).classList.add('wrong'));
      setTimeout(() => {
        res.hide.forEach((k) => {
          const c = cardEl(k);
          c.classList.remove('up', 'wrong');
          c.setAttribute('aria-label', `Thẻ ${k + 1}, chưa mở`);
        });
        game.resolveMiss();
      }, res.delay);
    }
    updateHud();
    if (game.finished) end();
  }

  function updateHud() {
    $('hudScore').textContent = game.score;
    $('hudMoves').textContent = game.moves;
    $('hudPairs').textContent = `${game.matched.size}/${game.totalPairs}`;
    $('hudCombo').textContent = `x${game.combo}`;
    $('hudTime').textContent = fmt(game.timeLimit === null ? game.elapsed : game.timeLeft);
  }

  function tick() {
    if (!game || game.finished) return;
    updateHud();
    if (game.timeLimit !== null && game.timeLeft <= 0) { game.timeout(); end(); }
  }

  function end() {
    clearInterval(timer);
    const s = game.summary();
    const isRecord = s.won && Storage.saveResult(game.mode, game.grid, s);
    s.won ? Sfx.win() : Sfx.lose();

    $('resTitle').textContent = s.won ? (isRecord ? 'Kỷ lục mới! 🏆' : 'Hoàn thành! 🎉') : 'Hết thời gian ⏰';
    $('resBody').textContent = [
      `Điểm: ${s.score}`,
      s.timeBonus ? `(gồm ${s.timeBonus} điểm thưởng thời gian)` : null,
      `Số lượt: ${s.moves}`,
      `Thời gian: ${fmt(s.seconds)}`,
      `Chuỗi đúng dài nhất: ${s.bestStreak}`
    ].filter(Boolean).join(' · ');
    $('overlay').hidden = false;
    $('btnReplay').focus();
    renderBest();
  }

  function closeOverlay() { $('overlay').hidden = true; }

  $('btnStart').onclick = start;
  $('btnReplay').onclick = () => { closeOverlay(); start(); };
  $('btnMenu').onclick = () => { closeOverlay(); show('screenMenu'); };
  $('btnQuit').onclick = () => { clearInterval(timer); show('screenMenu'); };

  // Điều hướng bàn phím trên lưới thẻ
  $('board').addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const cols = GRIDS[game.grid].cols;
    const cur = Number(document.activeElement?.dataset.i ?? 0);
    const step = e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : keys[e.key];
    const next = Math.min(game.cards.length - 1, Math.max(0, cur + step));
    cardEl(next)?.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('overlay').hidden) $('btnMenu').click();
  });
})();
