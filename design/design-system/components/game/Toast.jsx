import React from 'react';

const TONE = {
  info: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  peek: 'color-mix(in srgb, var(--warn) 18%, transparent)',
  alert: 'color-mix(in srgb, var(--bad) 14%, transparent)',
  soft: 'var(--accent-soft)'
};

/** Inline status line above the board (power-ups, peek, reshuffle, reconnect). */
export function Toast({ tone = 'info', children, style }) {
  return (
    <p role="status" style={{
      margin: 0, padding: '8px 12px', borderRadius: 10, fontSize: 14, textAlign: 'center',
      background: TONE[tone] || TONE.info, ...style
    }}>{children}</p>
  );
}
