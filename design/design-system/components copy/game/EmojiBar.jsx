import React from 'react';

export const QUICK_EMOJIS = ['👍', '😂', '😡', '😮', '😭', '🔥', '🎉', '🤔', '💩'];

/** Closed-list emoji chat for online games. */
export function EmojiBar({ emojis = QUICK_EMOJIS, onSend, style }) {
  return (
    <div aria-label="Gửi emoji" style={{ display: 'flex', gap: 4, justifyContent: 'center', ...style }}>
      {emojis.map((e) => (
        <button key={e} type="button" onClick={() => onSend && onSend(e)} style={{
          minWidth: 40, minHeight: 40, fontSize: 20, border: '1px solid var(--line)',
          borderRadius: 'var(--r-full)', background: 'var(--panel)', transition: 'transform .12s ease'
        }}>{e}</button>
      ))}
    </div>
  );
}
