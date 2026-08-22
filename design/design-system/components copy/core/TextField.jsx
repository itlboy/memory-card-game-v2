import React from 'react';

/** Labelled input. `code` is the 6-digit room-code field. */
export function TextField({ label, value, onChange, placeholder, code = false, maxLength, style, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, ...style }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength ?? (code ? 6 : 16)}
        onChange={(e) => onChange && onChange(code ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
        {...rest}
        style={{
          minHeight: 48, padding: '0 14px', font: 'inherit', color: 'var(--fg)',
          border: '2px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--panel-soft)',
          ...(code ? { letterSpacing: 'var(--tracking-code)', fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center', fontSize: 22 } : null)
        }}
      />
    </label>
  );
}
