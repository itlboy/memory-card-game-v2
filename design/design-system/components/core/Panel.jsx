import React from 'react';

/** Glass surface: every screen and dialog sits on one. */
export function Panel({ as: Tag = 'section', children, style, className = '', ...rest }) {
  return (
    <Tag {...rest} className={`panel ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
