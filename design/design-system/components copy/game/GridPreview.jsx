import React from 'react';

/** Miniature of a board, used on the grid-size tiles. Blank centre for odd grids. */
export function GridPreview({ cols, rows, selected = false }) {
  const total = cols * rows;
  const blankAt = total % 2 === 1 ? Math.floor(total / 2) : -1;
  return (
    <span aria-hidden="true" style={{
      display: 'grid', gap: 1.5, alignContent: 'center', maxWidth: '72%', minHeight: 0,
      gridTemplateColumns: `repeat(${cols}, 1fr)`, width: cols * 8
    }}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} style={{
          aspectRatio: '3 / 4', borderRadius: 2, minHeight: 0,
          background: i === blankAt ? 'transparent' : selected ? 'rgba(255,255,255,.9)' : 'var(--grad-selected)',
          opacity: i === blankAt ? 1 : .75
        }} />
      ))}
    </span>
  );
}
