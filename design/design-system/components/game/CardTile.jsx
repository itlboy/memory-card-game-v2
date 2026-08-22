import React from 'react';

/* Card-back art, verbatim from apps/web/src/components/CardTile.vue (also in assets/card-backs/). */
const STARS = "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22%3E %3Cg fill=%22rgba(255,255,255,0.9)%22 transform=%22translate(38,54) scale(1.05)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.55)%22 transform=%22translate(14,14) scale(0.5)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.35)%22 transform=%22translate(72,20) scale(0.34)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.6)%22 transform=%22translate(76,96) scale(0.44)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.4)%22 transform=%22translate(16,100) scale(0.3)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.3)%22 transform=%22translate(52,16) scale(0.26)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.45)%22 transform=%22translate(10,60) scale(0.36)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3C/svg%3E\") center / 100% 100% no-repeat";
const DIAMOND = "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22%3E %3Cdefs%3E%3Cpattern id=%22dm%22 width=%2220%22 height=%2220%22 patternUnits=%22userSpaceOnUse%22 patternTransform=%22rotate(45)%22%3E %3Cpath d=%22M0 10 H20 M10 0 V20%22 stroke=%22rgba(255,255,255,0.22)%22 stroke-width=%221.4%22 fill=%22none%22/%3E %3C/pattern%3E%3C/defs%3E %3Crect width=%22100%22 height=%22133%22 fill=%22url(%23dm)%22/%3E %3Cg transform=%22translate(50,66.5)%22%3E %3Crect x=%22-17%22 y=%22-17%22 width=%2234%22 height=%2234%22 transform=%22rotate(45)%22 fill=%22rgba(255,255,255,0.14)%22 stroke=%22rgba(255,255,255,0.85)%22 stroke-width=%222%22/%3E %3Crect x=%22-10%22 y=%22-10%22 width=%2220%22 height=%2220%22 transform=%22rotate(45)%22 fill=%22rgba(255,255,255,0.9)%22/%3E %3C/g%3E%3C/svg%3E\") center / 100% 100% no-repeat";
const AURORA = "url(\"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22 preserveAspectRatio=%22none%22%3E %3Cpath d=%22M0 92 C 22 76, 40 108, 62 88 S 96 70, 100 84 L100 133 L0 133 Z%22 fill=%22rgba(56,189,248,0.5)%22/%3E %3Cpath d=%22M0 104 C 26 92, 46 120, 70 102 S 100 90, 100 100 L100 133 L0 133 Z%22 fill=%22rgba(196,76,240,0.55)%22/%3E %3Cpath d=%22M0 118 C 30 108, 52 130, 78 116 S 100 108, 100 114 L100 133 L0 133 Z%22 fill=%22rgba(255,255,255,0.2)%22/%3E %3Ccircle cx=%2226%22 cy=%2230%22 r=%221.6%22 fill=%22rgba(255,255,255,0.9)%22/%3E %3Ccircle cx=%2270%22 cy=%2218%22 r=%221.1%22 fill=%22rgba(255,255,255,0.7)%22/%3E %3Ccircle cx=%2252%22 cy=%2244%22 r=%221.3%22 fill=%22rgba(255,255,255,0.8)%22/%3E %3Ccircle cx=%2284%22 cy=%2252%22 r=%221%22 fill=%22rgba(255,255,255,0.6)%22/%3E %3C/svg%3E\") center / 100% 100% no-repeat";

const BACKS = {
  stars: {
    background: `${STARS}, radial-gradient(circle at 30% 18%, rgba(255,255,255,.22), transparent 45%), linear-gradient(160deg,#4c3fd6 0%,#7b46e6 55%,#b74cf0 100%)`,
    boxShadow: 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,.3), inset 0 0 0 2px rgba(255,255,255,.12)'
  },
  diamond: {
    background: `${DIAMOND}, linear-gradient(180deg,#5a4be0 0%,#6a5cff 100%)`,
    boxShadow: 'var(--shadow-soft), inset 0 0 0 2px rgba(255,255,255,.5), inset 0 0 0 5px rgba(255,255,255,.18)'
  },
  aurora: {
    background: `${AURORA}, radial-gradient(circle at 72% 12%, rgba(255,255,255,.16), transparent 40%), linear-gradient(185deg,#241c6e 0%,#4c3fd6 62%,#7b46e6 100%)`,
    boxShadow: 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,.3), inset 0 0 0 2px rgba(255,255,255,.12)'
  }
};

const POWER_ICON = { bomb: '💥', x2: '✖️', eye: '👁️', freeze: '❄️' };

const face = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 'var(--card-radius)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
  boxShadow: 'var(--shadow-soft)', fontSize: 'max(20px, 55cqw)'
};

/** One card. 3:4, flips on Y; every back on a board must be identical. */
export function CardTile({
  symbol, back = 'stars', faceUp = false, matched = false, wrong = false,
  power, blank = false, dealOrder = 0, disabled = false, onFlip, style
}) {
  if (blank) return <span aria-hidden="true" style={{ aspectRatio: '3 / 4', ...style }} />;
  const flipped = faceUp || matched;
  return (
    <button
      type="button"
      aria-disabled={disabled || matched ? 'true' : 'false'}
      onClick={() => !disabled && !matched && onFlip && onFlip()}
      style={{
        position: 'relative', aspectRatio: '3 / 4', minWidth: 'var(--tap-min)', minHeight: 'var(--tap-min)',
        padding: 0, border: 0, background: 'transparent', perspective: 700,
        containerType: 'inline-size', cursor: matched ? 'default' : 'pointer',
        animation: 'mm-deal .38s cubic-bezier(.2,.9,.3,1.2) backwards',
        animationDelay: `${dealOrder * 28}ms`,
        ...style
      }}
    >
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--card-radius)', transformStyle: 'preserve-3d',
        transition: 'transform .34s cubic-bezier(.3,.8,.4,1.1)',
        transform: flipped ? 'rotateY(180deg)' : 'none',
        animation: wrong ? 'mm-shake .32s' : matched ? 'mm-pop .42s cubic-bezier(.3,1.6,.5,1)' : undefined
      }}>
        <span aria-hidden="true" style={{ ...face, overflow: 'hidden', ...BACKS[back] }} />
        <span aria-hidden="true" style={{
          ...face,
          background: 'radial-gradient(circle at 50% 58%, var(--accent-soft), transparent 62%), var(--card-face)',
          border: `1px solid ${matched ? 'var(--ok)' : 'var(--line)'}`,
          transform: 'rotateY(180deg)',
          boxShadow: matched
            ? 'inset 0 0 0 2px var(--ok), 0 0 14px color-mix(in srgb, var(--ok) 45%, transparent)'
            : 'var(--shadow-soft), var(--inner-light)'
        }}>
          {symbol}
          {power && (
            <span style={{ position: 'absolute', top: 2, right: 3, fontSize: 11, lineHeight: 1, animation: 'mm-twinkle 1.6s ease-in-out infinite' }}>
              {POWER_ICON[power]}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
