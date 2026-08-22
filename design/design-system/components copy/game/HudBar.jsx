import React from 'react';
import { Button } from '../core/Button.jsx';
import { Icon } from '../core/Icon.jsx';

const clock = (s) => `${Math.floor(Math.max(0, Math.floor(s)) / 60)}:${String(Math.max(0, Math.floor(s)) % 60).padStart(2, '0')}`;

function Stat({ label, value, sub, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 52 }}>
      <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
      <b style={{
        fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-lg)', lineHeight: 1.2, color: tone || 'inherit',
        textShadow: tone === 'var(--gold)' ? '0 0 10px color-mix(in srgb, var(--gold) 60%, transparent)' : undefined
      }}>
        {value}{sub && <i style={{ fontStyle: 'normal', color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>{sub}</i>}
      </b>
    </div>
  );
}

/** In-game stat bar on a glass panel. Multiplayer hides score/moves/combo. */
export function HudBar({
  score = 0, moves = 0, matched = 0, totalPairs = 0, combo = 1,
  elapsed = 0, timeLeft = null, movesLeft = null, lives = null,
  levelId, multiplayer = false, onQuit
}) {
  const urgent = timeLeft !== null && timeLeft <= 10;
  const comboTone = combo >= 2 ? 'var(--gold)' : combo >= 1.5 ? 'var(--warn)' : undefined;
  return (
    <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px' }}>
      {levelId ? <Stat label="Màn" value={levelId} /> : null}
      {!multiplayer && <Stat label="Điểm" value={score} />}
      {!multiplayer && <Stat label="Lượt" value={moves} sub={movesLeft !== null ? `/${moves + movesLeft}` : undefined} />}
      <Stat label="Cặp" value={`${matched}/${totalPairs}`} />
      <Stat label={timeLeft === null ? 'Thời gian' : 'Còn lại'} value={clock(timeLeft ?? elapsed)} tone={urgent ? 'var(--bad)' : undefined} />
      {!multiplayer && <Stat label="Combo" value={`x${combo}`} tone={comboTone} />}
      {lives !== null && <Stat label="Mạng" value={'❤️'.repeat(Math.max(0, lives)) || '—'} />}
      <Button aria-label="Thoát về menu" onClick={onQuit} style={{ marginLeft: 'auto' }}><Icon name="x" size={20} /></Button>
    </div>
  );
}
