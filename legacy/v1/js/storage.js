// Lưu tiến trình cục bộ (chơi đơn không cần đăng nhập).
const Storage = (() => {
  const KEY = 'mm.v1';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  return {
    get prefs() {
      const { prefs } = read();
      return { dark: false, sound: true, mode: 'classic', grid: '4x4', theme: 'animals', ...prefs };
    },
    savePrefs(patch) {
      const s = read();
      s.prefs = { ...this.prefs, ...patch };
      write(s);
    },
    /** Trả về true nếu đây là kỷ lục mới. */
    saveResult(mode, grid, { score, moves, seconds }) {
      const s = read();
      s.best = s.best || {};
      const k = `${mode}:${grid}`;
      const prev = s.best[k];
      const better = !prev || score > prev.score;
      if (better) s.best[k] = { score, moves, seconds };
      s.totalScore = (s.totalScore || 0) + score;
      write(s);
      return better;
    },
    best(mode, grid) { return (read().best || {})[`${mode}:${grid}`] || null; },
    get totalScore() { return read().totalScore || 0; }
  };
})();
