import React from 'react';
import { Button } from '../core/Button.jsx';

const clock = (s) => `${Math.floor(Math.max(0, Math.floor(s)) / 60)}:${String(Math.max(0, Math.floor(s)) % 60).padStart(2, '0')}`;

/** End-of-game dialog: title, stars, stats or ranking, achievements, actions. */
export function ResultDialog({
  title, reason, stars = null, starsShown = 3, stats = [], ranking = null,
  achievements = [], primaryLabel = 'Chơi lại', secondaryLabel = 'Về menu',
  tertiaryLabel, onPrimary, onSecondary, onTertiary
}) {
  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, background: 'rgba(6,9,18,.3)'
    }}>
      <div className="panel" style={{
        width: '100%', maxWidth: 400, position: 'relative',
        background: 'color-mix(in srgb, var(--panel-solid) 78%, transparent)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        animation: 'mm-dialog-in .3s cubic-bezier(.3,1.4,.5,1)'
      }}>
        <h2 style={{ margin: '0 0 4px' }}>{title}</h2>
        {reason && <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 14 }}>{reason}</p>}

        {stars !== null && (
          <p style={{ margin: '0 0 12px', fontSize: 32, letterSpacing: 6 }} aria-label={`${stars} trên 3 sao`}>
            {[1, 2, 3].map((i) => {
              const lit = i <= Math.min(stars, starsShown);
              return (
                <span key={i} style={{
                  display: 'inline-block', color: lit ? 'var(--gold)' : 'var(--line)',
                  textShadow: lit ? '0 0 14px color-mix(in srgb, var(--gold) 70%, transparent)' : undefined,
                  animation: lit ? 'mm-star-in .45s cubic-bezier(.3,1.8,.5,1)' : undefined
                }}>★</span>
              );
            })}
          </p>
        )}

        {ranking ? (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {ranking.map((p, i) => (
              <li key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'baseline', gap: '4px 10px' }}>
                <span>{i + 1}. {p.name}</span>
                <b style={{ color: i === 0 ? 'var(--ok)' : undefined }}>{p.score}</b>
                <small style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 12 }}>{p.pairs} cặp · chuỗi {p.bestStreak}</small>
              </li>
            ))}
          </ol>
        ) : (
          <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: 'var(--muted)', fontSize: 14 }}>{s.label}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {typeof s.value === 'number' && s.label === 'Thời gian' ? clock(s.value) : s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {achievements.length > 0 && (
          <ul style={{
            margin: '14px 0 0', padding: 12, listStyle: 'none', display: 'grid', gap: 6,
            background: 'color-mix(in srgb, var(--warn) 12%, transparent)', borderRadius: 10, fontSize: 13
          }}>
            {achievements.map((a) => (
              <li key={a.name}>🏅 <b>{a.name}</b> — {a.hint}</li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Button variant="primary" onClick={onPrimary} style={{ flex: 1, marginTop: 0 }}>{primaryLabel}</Button>
          <Button onClick={onSecondary} style={{ flex: 1 }}>{secondaryLabel}</Button>
        </div>
        {tertiaryLabel && <Button variant="link" onClick={onTertiary}>{tertiaryLabel}</Button>}
      </div>
    </div>
  );
}
