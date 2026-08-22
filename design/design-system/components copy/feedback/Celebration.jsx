import React from 'react';

const CONFETTI = ['#6a5cff', '#c44cf0', '#ea8c00', '#0ea371', '#e5484d', '#38bdf8'];

/** Win celebration: 70 confetti papers falling for ~5s. Non-blocking. */
export function Celebration({ count = 70, seed = 7 }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 9 }}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{
          position: 'absolute', top: '-3vh', width: 8, height: 14, borderRadius: 2,
          left: `${(i * 37 + seed) % 100}%`,
          background: CONFETTI[i % CONFETTI.length],
          animation: 'mm-fall linear forwards',
          animationDelay: `${(i % 14) * 160}ms`,
          animationDuration: `${2400 + (i % 7) * 300}ms`,
          '--drift': `${((i * 13) % 9) - 4}rem`,
          '--spin': `${420 + (i * 47) % 400}deg`
        }} />
      ))}
    </div>
  );
}
