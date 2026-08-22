import React from 'react';
import { Icon } from '../core/Icon.jsx';

const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/** One player's chip in the turn strip. */
export function PlayerChip({
  name, avatar, score = 0, index = 0, active = false, lives = null,
  turnLeft = null, frozen = false, doubleNext = false, offline = false, bonus, emoji, style
}) {
  return (
    <div className="panel" style={{
      position: 'relative', flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 9px', borderWidth: 2, borderRadius: 12,
      borderColor: active ? 'var(--accent)' : 'var(--line)',
      boxShadow: active ? '0 0 0 1px var(--accent), 0 4px 18px var(--card-back-glow)' : 'var(--shadow-soft)',
      animation: active ? 'mm-breathe 1.8s ease-in-out infinite' : undefined,
      opacity: frozen || offline ? .6 : 1, ...style
    }}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>{avatar ?? AVATARS[index % AVATARS.length]}</span>
      <b style={{ fontSize: 13, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</b>
      {active && turnLeft !== null && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-display)', fontSize: 13,
          fontVariantNumeric: 'tabular-nums', padding: '1px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap',
          background: turnLeft <= 10 ? 'color-mix(in srgb, var(--bad) 16%, transparent)' : 'var(--accent-soft)',
          color: turnLeft <= 10 ? 'var(--bad)' : 'var(--accent)',
          animation: turnLeft <= 10 ? 'mm-clock-pulse .5s steps(2) infinite' : undefined
        }}>
          <Icon name="timer" size={12} />{Math.ceil(turnLeft)}
        </span>
      )}
      {bonus && (
        <span style={{ position: 'absolute', top: -18, right: 8, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--ok)', textShadow: '0 1px 6px rgba(0,0,0,.2)' }}>{bonus}</span>
      )}
      {emoji && (
        <span style={{ position: 'absolute', top: -26, left: 8, fontSize: 22, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))' }}>{emoji}</span>
      )}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: active ? 'var(--accent)' : 'inherit' }}>{score}</span>
      {lives !== null && (
        <small style={{ fontSize: 10, letterSpacing: -2, whiteSpace: 'nowrap' }}>{'❤️'.repeat(Math.max(0, lives)) || '💔'}</small>
      )}
      {frozen ? <span title="Bị đóng băng" style={{ fontSize: 11 }}>❄️</span>
        : doubleNext ? <span title="Cặp tới nhân đôi điểm" style={{ fontSize: 11 }}>✖️2</span> : null}
    </div>
  );
}
