import React from 'react';
import { Button } from '../core/Button.jsx';
import { Icon } from '../core/Icon.jsx';

/** App header: brand (home), accumulated score, dark + sound toggles. */
export function TopBar({ totalScore = 0, dark = false, sound = true, onHome, onToggleDark, onToggleSound }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-4)',
      borderBottom: '1px solid var(--line)', background: 'var(--panel)',
      backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))'
    }}>
      <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800, lineHeight: 1.35 }}>
        <button type="button" aria-label="Về trang chủ" onClick={onHome} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', border: 0,
          background: 'none', padding: 0, font: 'inherit', cursor: 'pointer'
        }}>
          <span aria-hidden="true" style={{ fontSize: 24, filter: 'drop-shadow(0 2px 6px var(--card-back-glow))' }}>🃏</span>
          <span style={{
            background: 'linear-gradient(100deg, var(--accent), var(--accent-2))',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            whiteSpace: 'nowrap', fontSize: 'clamp(17px, 5.2vw, 22px)'
          }}>Memory Match</span>
        </button>
      </h1>
      <span title={`Tổng điểm tích lũy: ${totalScore}`} style={{
        fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums',
        padding: '4px 10px', borderRadius: 'var(--r-full)', background: 'var(--accent-soft)', whiteSpace: 'nowrap', flexShrink: 0
      }}>⭐ {totalScore}</span>
      <Button aria-label={dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'} onClick={onToggleDark}>
        <Icon name={dark ? 'sun' : 'moon'} size={20} />
      </Button>
      <Button aria-pressed={sound} aria-label="Bật/tắt âm thanh" onClick={onToggleSound}>
        <Icon name={sound ? 'volume-2' : 'volume-x'} size={20} />
      </Button>
    </header>
  );
}
