import React from 'react';

const optBase = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: '16px 12px', minHeight: 'var(--tap-min)',
  border: '2px solid var(--line)', borderRadius: 14, background: 'var(--panel-soft)',
  transition: 'transform .15s ease, box-shadow .15s ease', textAlign: 'center',
  color: 'var(--fg)', overflow: 'hidden', justifyContent: 'center'
};
const wide = { flexDirection: 'row', textAlign: 'left', gap: 14, padding: '13px 16px', justifyContent: 'flex-start', alignItems: 'center' };
const selectedPlain = {
  borderColor: 'transparent', background: 'var(--grad-selected)', color: '#fff',
  boxShadow: '0 8px 26px rgba(106,92,255,.5), inset 0 1px 0 rgba(255,255,255,.3)'
};

/**
 * Wizard choice tile. `tone` paints a permanent identity gradient (mode / player-count
 * tiles); without a tone the tile is dark and the SELECTED state bursts violet.
 */
export function OptionTile({
  tone, selected = false, layout = 'stack', icon, title, description,
  numeral, style, onClick, disabled = false, role = 'button', ...rest
}) {
  const neon = !!tone;
  const isWide = layout === 'wide';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={neon ? `neon ${tone}` : undefined}
      aria-pressed={role === 'button' ? selected : undefined}
      aria-checked={role === 'checkbox' ? selected : undefined}
      role={role === 'checkbox' ? 'checkbox' : undefined}
      {...rest}
      style={{
        ...optBase,
        containerType: 'inline-size',
        ...(isWide ? wide : null),
        ...(selected && !neon ? selectedPlain : null),
        ...(selected && neon ? { outline: '3px solid rgba(255,255,255,.85)', outlineOffset: -3 } : null),
        ...(disabled ? { opacity: .5, cursor: 'not-allowed' } : null),
        ...style
      }}
    >
      {numeral !== undefined && (
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, lineHeight: 1, color: neon || selected ? '#fff' : 'var(--accent)' }}>{numeral}</span>
      )}
      {icon}
      <span style={isWide
        ? { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }
        : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, maxWidth: '100%' }}>
        <strong style={{ fontSize: 'clamp(11px, 10.5cqw, 16px)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{title}</strong>
        {description && (
          <small style={{ fontSize: 12.5, lineHeight: 1.25, maxWidth: '100%', color: neon || selected ? 'rgba(255,255,255,.85)' : 'var(--muted)' }}>{description}</small>
        )}
      </span>
    </button>
  );
}
