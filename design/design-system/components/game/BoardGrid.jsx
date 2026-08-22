import React from 'react';
import { CardTile } from './CardTile.jsx';

/** The board. Cards fill the width; gap 8px (6px under 420px). */
export function BoardGrid({ cards = [], cols = 4, back = 'stars', locked = false, onFlip, style }) {
  return (
    <div role="grid" aria-label="Bàn thẻ" style={{
      display: 'grid', gap: 'var(--board-gap)', width: '100%',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, touchAction: 'manipulation', ...style
    }}>
      {cards.map((c, i) => (
        <CardTile
          key={i}
          {...c}
          back={back}
          dealOrder={i}
          disabled={locked}
          onFlip={() => onFlip && onFlip(i)}
        />
      ))}
    </div>
  );
}
