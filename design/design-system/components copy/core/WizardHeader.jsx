import React from 'react';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';
import { StepDots } from './StepDots.jsx';

/** Panel header: back chevron · question · progress dots (or a trailing slot). */
export function WizardHeader({ title, onBack, steps, current, trailing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {onBack && (
        <Button aria-label="Quay lại" onClick={onBack} style={{ minWidth: 44, padding: '4px 12px', lineHeight: 1 }}>
          <Icon name="chevron-left" size={22} />
        </Button>
      )}
      <h2 style={{ flex: 1, margin: 0, fontSize: 19 }}>{title}</h2>
      {trailing}
      {steps ? <StepDots count={steps} current={current ?? 0} /> : null}
    </div>
  );
}
