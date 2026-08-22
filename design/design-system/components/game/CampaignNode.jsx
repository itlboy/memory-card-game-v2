import React from 'react';

const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** One node on the 20-level campaign map. */
export function CampaignNode({ id, cols, rows, stars = 0, locked = false, onPlay, style }) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onPlay}
      aria-label={`Màn ${id}, lưới ${cols}×${rows}${locked ? ', chưa mở khoá' : ''}`}
      style={{
        width: '100%', maxHeight: 96, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 0, padding: '4px 2px', overflow: 'hidden',
        border: `2px solid ${stars > 0 ? 'var(--ok)' : 'var(--line)'}`, borderRadius: 12,
        background: 'transparent', color: 'var(--fg)', opacity: locked ? .45 : 1, ...style
      }}
    >
      <b style={{ fontSize: 18 }}>{id}</b>
      <small style={{ color: 'var(--muted)', fontSize: 11 }}>{cols}×{rows}</small>
      <span style={{ fontSize: 11, color: 'var(--warn)', letterSpacing: 1 }}>{locked ? '🔒' : starText(stars)}</span>
    </button>
  );
}
