// Âm thanh tổng hợp bằng WebAudio — không cần tải file, có thể tắt.
const Sfx = (() => {
  let ctx = null, enabled = true;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  function tone(freq, dur = 0.12, type = 'sine', gain = 0.06) {
    if (!enabled) return;
    try {
      const a = ac(), osc = a.createOscillator(), g = a.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      osc.connect(g).connect(a.destination);
      osc.start(); osc.stop(a.currentTime + dur);
    } catch {}
  }

  return {
    set enabled(v) { enabled = v; },
    get enabled() { return enabled; },
    flip() { tone(520, 0.08, 'triangle'); },
    match() { tone(660, 0.1); setTimeout(() => tone(880, 0.14), 90); },
    miss() { tone(200, 0.16, 'sawtooth', 0.04); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18), i * 110)); },
    lose() { [400, 330, 260].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.05), i * 140)); }
  };
})();
