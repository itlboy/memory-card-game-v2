import React from 'react';

/** Wizard progress dots — filled up to and including the current step. */
export function StepDots({ count, current }) {
  return (
    <span aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: i <= current ? 'var(--accent)' : 'var(--line)',
          transform: i <= current ? 'scale(1.15)' : 'none',
          transition: 'background .2s, transform .2s'
        }} />
      ))}
    </span>
  );
}
