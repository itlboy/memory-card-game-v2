import React from 'react';

const BASE = 'https://unpkg.com/lucide-static@0.454.0/icons/';
const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name + '.svg')
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => t.replace(/<\/?svg[^>]*>/g, ''))
      .catch(() => ''));
  }
  return cache.get(name);
}

/** Lucide glyph, inlined so it inherits currentColor. The app uses lucide-vue-next. */
export function Icon({ name, size = 20, style, ...rest }) {
  const [inner, setInner] = React.useState('');
  React.useEffect(() => {
    let live = true;
    load(name).then((t) => { if (live) setInner(t); });
    return () => { live = false; };
  }, [name]);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      style={{ display: 'block', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
