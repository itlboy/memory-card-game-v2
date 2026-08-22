import React from 'react';

/** btn / btn-primary / danger / link — the app's full button set. */
export function Button({ variant = 'default', children, className = '', style, ...rest }) {
  const cls = variant === 'primary'
    ? 'btn-primary'
    : `btn${variant === 'danger' ? ' danger' : variant === 'link' ? ' link' : ''}`;
  return (
    <button type="button" {...rest} className={`${cls} ${className}`.trim()} style={style}>
      {children}
    </button>
  );
}
