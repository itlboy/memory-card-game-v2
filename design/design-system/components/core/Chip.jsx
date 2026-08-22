import React from 'react';

/** Small labelled chip; `compact` shrinks it for config rows. */
export function Chip({ label, hint, selected = false, disabled = false, compact = false, onClick, style, ...rest }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
      className="chip"
      {...rest}
      style={{ ...(compact ? { flex: '0 1 auto', minWidth: 96 } : null), ...style }}
    >
      <b style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{label}</b>
      {hint && <small>{hint}</small>}
    </button>
  );
}
