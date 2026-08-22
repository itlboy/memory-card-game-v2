import React from 'react';
import { Button } from '../core/Button.jsx';

/** Destructive confirm: quit a game, cancel a room, surrender. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Ở lại', onConfirm, onCancel }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-label={title} style={{
      position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, background: 'rgba(6,9,18,.62)'
    }}>
      <div className="panel" style={{ width: '100%', maxWidth: 360 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-xl)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-md)' }}>{body}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Button variant="danger" onClick={onConfirm} style={{ flex: 1, minHeight: 48 }}>{confirmLabel}</Button>
          <Button onClick={onCancel} style={{ flex: 1, minHeight: 48 }}>{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}
