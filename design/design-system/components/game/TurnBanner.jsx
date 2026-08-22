import React from 'react';

/** Centre-of-board announcement: whose turn it is. */
export function TurnBanner({ name, avatar = '🎮', frozenName, style }) {
  return (
    <div role="status" style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '14px 26px', borderRadius: 16,
      background: 'color-mix(in srgb, var(--panel) 88%, transparent)',
      border: '2px solid var(--accent)',
      boxShadow: '0 10px 40px var(--card-back-glow), var(--shadow)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      pointerEvents: 'none', zIndex: 5, whiteSpace: 'nowrap', ...style
    }}>
      {frozenName && <small style={{ color: 'var(--muted)', fontSize: 12.5 }}>❄️ {frozenName} bị đóng băng, mất lượt</small>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(17px,4.5vw,22px)' }}>
        <span style={{ fontSize: 'clamp(24px,6vw,32px)', animation: 'mm-wave .5s ease' }}>{avatar}</span>
        Đến lượt <b style={{ color: 'var(--accent)' }}>{name}</b>
      </span>
    </div>
  );
}
