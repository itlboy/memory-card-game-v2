/* @ds-bundle: {"format":4,"namespace":"MemoryMatchDesignSystem_ce0961","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"OptionTile","sourcePath":"components/core/OptionTile.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"StepDots","sourcePath":"components/core/StepDots.jsx"},{"name":"TextField","sourcePath":"components/core/TextField.jsx"},{"name":"WizardHeader","sourcePath":"components/core/WizardHeader.jsx"},{"name":"Celebration","sourcePath":"components/feedback/Celebration.jsx"},{"name":"ConfirmDialog","sourcePath":"components/feedback/ConfirmDialog.jsx"},{"name":"ResultDialog","sourcePath":"components/feedback/ResultDialog.jsx"},{"name":"BoardGrid","sourcePath":"components/game/BoardGrid.jsx"},{"name":"CampaignNode","sourcePath":"components/game/CampaignNode.jsx"},{"name":"CardTile","sourcePath":"components/game/CardTile.jsx"},{"name":"QUICK_EMOJIS","sourcePath":"components/game/EmojiBar.jsx"},{"name":"EmojiBar","sourcePath":"components/game/EmojiBar.jsx"},{"name":"GridPreview","sourcePath":"components/game/GridPreview.jsx"},{"name":"HudBar","sourcePath":"components/game/HudBar.jsx"},{"name":"PlayerChip","sourcePath":"components/game/PlayerChip.jsx"},{"name":"Toast","sourcePath":"components/game/Toast.jsx"},{"name":"TurnBanner","sourcePath":"components/game/TurnBanner.jsx"},{"name":"TopBar","sourcePath":"components/nav/TopBar.jsx"}],"sourceHashes":{"components/core/Button.jsx":"c9ed5905fc6a","components/core/Chip.jsx":"795670eaa9a1","components/core/Icon.jsx":"9450de58a3f6","components/core/OptionTile.jsx":"d9a92f363e83","components/core/Panel.jsx":"a6f812902fc2","components/core/StepDots.jsx":"5aa2ebf94853","components/core/TextField.jsx":"348eb600313e","components/core/WizardHeader.jsx":"2dff2739ff72","components/feedback/Celebration.jsx":"1a30ae52327d","components/feedback/ConfirmDialog.jsx":"f679617445e0","components/feedback/ResultDialog.jsx":"8440b44df725","components/game/BoardGrid.jsx":"4a83245e3a10","components/game/CampaignNode.jsx":"6be38af90b84","components/game/CardTile.jsx":"9cc7deba50c1","components/game/EmojiBar.jsx":"e1d0bc90dc6e","components/game/GridPreview.jsx":"909a1ea64319","components/game/HudBar.jsx":"28f550de203c","components/game/PlayerChip.jsx":"7ac3a330f42c","components/game/Toast.jsx":"dbeb7b0d727f","components/game/TurnBanner.jsx":"06d992000e07","components/nav/TopBar.jsx":"dbec0bc4b353","ui_kits/memory-match-web/App.jsx":"caf3e9306ae1","ui_kits/memory-match-web/GameScreens.jsx":"bc8aef2c04f3","ui_kits/memory-match-web/MenuScreens.jsx":"81e10dd5f26b","ui_kits/memory-match-web/OnlineScreens.jsx":"af33ede8b974","ui_kits/memory-match-web/data.js":"848af8bfad1e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MemoryMatchDesignSystem_ce0961 = window.MemoryMatchDesignSystem_ce0961 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** btn / btn-primary / danger / link — the app's full button set. */
function Button({
  variant = 'default',
  children,
  className = '',
  style,
  ...rest
}) {
  const cls = variant === 'primary' ? 'btn-primary' : `btn${variant === 'danger' ? ' danger' : variant === 'link' ? ' link' : ''}`;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button"
  }, rest, {
    className: `${cls} ${className}`.trim(),
    style: style
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small labelled chip; `compact` shrinks it for config rows. */
function Chip({
  label,
  hint,
  selected = false,
  disabled = false,
  compact = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "checkbox",
    "aria-checked": selected,
    "aria-disabled": disabled || undefined,
    disabled: disabled,
    onClick: onClick,
    className: "chip"
  }, rest, {
    style: {
      ...(compact ? {
        flex: '0 1 auto',
        minWidth: 96
      } : null),
      ...style
    }
  }), /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 700
    }
  }, label), hint && /*#__PURE__*/React.createElement("small", null, hint));
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const BASE = 'https://unpkg.com/lucide-static@0.454.0/icons/';
const cache = new Map();
function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name + '.svg').then(r => r.ok ? r.text() : '').then(t => t.replace(/<\/?svg[^>]*>/g, '')).catch(() => ''));
  }
  return cache.get(name);
}

/** Lucide glyph, inlined so it inherits currentColor. The app uses lucide-vue-next. */
function Icon({
  name,
  size = 20,
  style,
  ...rest
}) {
  const [inner, setInner] = React.useState('');
  React.useEffect(() => {
    let live = true;
    load(name).then(t => {
      if (live) setInner(t);
    });
    return () => {
      live = false;
    };
  }, [name]);
  return /*#__PURE__*/React.createElement("svg", _extends({
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, rest, {
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: inner
    }
  }));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/OptionTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const optBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '16px 12px',
  minHeight: 'var(--tap-min)',
  border: '2px solid var(--line)',
  borderRadius: 14,
  background: 'var(--panel-soft)',
  transition: 'transform .15s ease, box-shadow .15s ease',
  textAlign: 'center',
  color: 'var(--fg)',
  overflow: 'hidden',
  justifyContent: 'center'
};
const wide = {
  flexDirection: 'row',
  textAlign: 'left',
  gap: 14,
  padding: '13px 16px',
  justifyContent: 'flex-start',
  alignItems: 'center'
};
const selectedPlain = {
  borderColor: 'transparent',
  background: 'var(--grad-selected)',
  color: '#fff',
  boxShadow: '0 8px 26px rgba(106,92,255,.5), inset 0 1px 0 rgba(255,255,255,.3)'
};

/**
 * Wizard choice tile. `tone` paints a permanent identity gradient (mode / player-count
 * tiles); without a tone the tile is dark and the SELECTED state bursts violet.
 */
function OptionTile({
  tone,
  selected = false,
  layout = 'stack',
  icon,
  title,
  description,
  numeral,
  style,
  onClick,
  disabled = false,
  role = 'button',
  ...rest
}) {
  const neon = !!tone;
  const isWide = layout === 'wide';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    className: neon ? `neon ${tone}` : undefined,
    "aria-pressed": role === 'button' ? selected : undefined,
    "aria-checked": role === 'checkbox' ? selected : undefined,
    role: role === 'checkbox' ? 'checkbox' : undefined
  }, rest, {
    style: {
      ...optBase,
      containerType: 'inline-size',
      ...(isWide ? wide : null),
      ...(selected && !neon ? selectedPlain : null),
      ...(selected && neon ? {
        outline: '3px solid rgba(255,255,255,.85)',
        outlineOffset: -3
      } : null),
      ...(disabled ? {
        opacity: .5,
        cursor: 'not-allowed'
      } : null),
      ...style
    }
  }), numeral !== undefined && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 34,
      lineHeight: 1,
      color: neon || selected ? '#fff' : 'var(--accent)'
    }
  }, numeral), icon, /*#__PURE__*/React.createElement("span", {
    style: isWide ? {
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      minWidth: 0
    } : {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      minWidth: 0,
      maxWidth: '100%'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: 'clamp(11px, 10.5cqw, 16px)',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: 1.2
    }
  }, title), description && /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.25,
      maxWidth: '100%',
      color: neon || selected ? 'rgba(255,255,255,.85)' : 'var(--muted)'
    }
  }, description)));
}
Object.assign(__ds_scope, { OptionTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/OptionTile.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Glass surface: every screen and dialog sits on one. */
function Panel({
  as: Tag = 'section',
  children,
  style,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `panel ${className}`.trim(),
    style: style
  }), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/core/StepDots.jsx
try { (() => {
/** Wizard progress dots — filled up to and including the current step. */
function StepDots({
  count,
  current
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      gap: 6
    }
  }, Array.from({
    length: count
  }, (_, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: i <= current ? 'var(--accent)' : 'var(--line)',
      transform: i <= current ? 'scale(1.15)' : 'none',
      transition: 'background .2s, transform .2s'
    }
  })));
}
Object.assign(__ds_scope, { StepDots });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StepDots.jsx", error: String((e && e.message) || e) }); }

// components/core/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Labelled input. `code` is the 6-digit room-code field. */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  code = false,
  maxLength,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginBottom: 14,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--muted)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    placeholder: placeholder,
    maxLength: maxLength ?? (code ? 6 : 16),
    onChange: e => onChange && onChange(code ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)
  }, rest, {
    style: {
      minHeight: 48,
      padding: '0 14px',
      font: 'inherit',
      color: 'var(--fg)',
      border: '2px solid var(--line)',
      borderRadius: 'var(--r-md)',
      background: 'var(--panel-soft)',
      ...(code ? {
        letterSpacing: 'var(--tracking-code)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        textAlign: 'center',
        fontSize: 22
      } : null)
    }
  })));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TextField.jsx", error: String((e && e.message) || e) }); }

// components/core/WizardHeader.jsx
try { (() => {
/** Panel header: back chevron · question · progress dots (or a trailing slot). */
function WizardHeader({
  title,
  onBack,
  steps,
  current,
  trailing
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, onBack && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    "aria-label": "Quay l\u1EA1i",
    onClick: onBack,
    style: {
      minWidth: 44,
      padding: '4px 12px',
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-left",
    size: 22
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      flex: 1,
      margin: 0,
      fontSize: 19
    }
  }, title), trailing, steps ? /*#__PURE__*/React.createElement(__ds_scope.StepDots, {
    count: steps,
    current: current ?? 0
  }) : null);
}
Object.assign(__ds_scope, { WizardHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/WizardHeader.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Celebration.jsx
try { (() => {
const CONFETTI = ['#6a5cff', '#c44cf0', '#ea8c00', '#0ea371', '#e5484d', '#38bdf8'];

/** Win celebration: 70 confetti papers falling for ~5s. Non-blocking. */
function Celebration({
  count = 70,
  seed = 7
}) {
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 9
    }
  }, Array.from({
    length: count
  }, (_, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    style: {
      position: 'absolute',
      top: '-3vh',
      width: 8,
      height: 14,
      borderRadius: 2,
      left: `${(i * 37 + seed) % 100}%`,
      background: CONFETTI[i % CONFETTI.length],
      animation: 'mm-fall linear forwards',
      animationDelay: `${i % 14 * 160}ms`,
      animationDuration: `${2400 + i % 7 * 300}ms`,
      '--drift': `${i * 13 % 9 - 4}rem`,
      '--spin': `${420 + i * 47 % 400}deg`
    }
  })));
}
Object.assign(__ds_scope, { Celebration });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Celebration.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ConfirmDialog.jsx
try { (() => {
/** Destructive confirm: quit a game, cancel a room, surrender. */
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Ở lại',
  onConfirm,
  onCancel
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "alertdialog",
    "aria-modal": "true",
    "aria-label": title,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'rgba(6,9,18,.62)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      width: '100%',
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 6px',
      fontSize: 'var(--text-xl)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--muted)',
      fontSize: 'var(--text-md)'
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "danger",
    onClick: onConfirm,
    style: {
      flex: 1,
      minHeight: 48
    }
  }, confirmLabel), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: onCancel,
    style: {
      flex: 1,
      minHeight: 48
    }
  }, cancelLabel))));
}
Object.assign(__ds_scope, { ConfirmDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ConfirmDialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ResultDialog.jsx
try { (() => {
const clock = s => `${Math.floor(Math.max(0, Math.floor(s)) / 60)}:${String(Math.max(0, Math.floor(s)) % 60).padStart(2, '0')}`;

/** End-of-game dialog: title, stars, stats or ranking, achievements, actions. */
function ResultDialog({
  title,
  reason,
  stars = null,
  starsShown = 3,
  stats = [],
  ranking = null,
  achievements = [],
  primaryLabel = 'Chơi lại',
  secondaryLabel = 'Về menu',
  tertiaryLabel,
  onPrimary,
  onSecondary,
  onTertiary
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'rgba(6,9,18,.3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      width: '100%',
      maxWidth: 400,
      position: 'relative',
      background: 'color-mix(in srgb, var(--panel-solid) 78%, transparent)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      animation: 'mm-dialog-in .3s cubic-bezier(.3,1.4,.5,1)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 4px'
    }
  }, title), reason && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 12px',
      color: 'var(--muted)',
      fontSize: 14
    }
  }, reason), stars !== null && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 12px',
      fontSize: 32,
      letterSpacing: 6
    },
    "aria-label": `${stars} trên 3 sao`
  }, [1, 2, 3].map(i => {
    const lit = i <= Math.min(stars, starsShown);
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        display: 'inline-block',
        color: lit ? 'var(--gold)' : 'var(--line)',
        textShadow: lit ? '0 0 14px color-mix(in srgb, var(--gold) 70%, transparent)' : undefined,
        animation: lit ? 'mm-star-in .45s cubic-bezier(.3,1.8,.5,1)' : undefined
      }
    }, "\u2605");
  })), ranking ? /*#__PURE__*/React.createElement("ol", {
    style: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'grid',
      gap: 6
    }
  }, ranking.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: p.name,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'baseline',
      gap: '4px 10px'
    }
  }, /*#__PURE__*/React.createElement("span", null, i + 1, ". ", p.name), /*#__PURE__*/React.createElement("b", {
    style: {
      color: i === 0 ? 'var(--ok)' : undefined
    }
  }, p.score), /*#__PURE__*/React.createElement("small", {
    style: {
      gridColumn: '1 / -1',
      color: 'var(--muted)',
      fontSize: 12
    }
  }, p.pairs, " c\u1EB7p \xB7 chu\u1ED7i ", p.bestStreak)))) : /*#__PURE__*/React.createElement("dl", {
    style: {
      margin: 0,
      display: 'grid',
      gap: 6
    }
  }, stats.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      color: 'var(--muted)',
      fontSize: 14
    }
  }, s.label), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 600
    }
  }, typeof s.value === 'number' && s.label === 'Thời gian' ? clock(s.value) : s.value)))), achievements.length > 0 && /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: '14px 0 0',
      padding: 12,
      listStyle: 'none',
      display: 'grid',
      gap: 6,
      background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
      borderRadius: 10,
      fontSize: 13
    }
  }, achievements.map(a => /*#__PURE__*/React.createElement("li", {
    key: a.name
  }, "\uD83C\uDFC5 ", /*#__PURE__*/React.createElement("b", null, a.name), " \u2014 ", a.hint))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    onClick: onPrimary,
    style: {
      flex: 1,
      marginTop: 0
    }
  }, primaryLabel), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: onSecondary,
    style: {
      flex: 1
    }
  }, secondaryLabel)), tertiaryLabel && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "link",
    onClick: onTertiary
  }, tertiaryLabel)));
}
Object.assign(__ds_scope, { ResultDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ResultDialog.jsx", error: String((e && e.message) || e) }); }

// components/game/CampaignNode.jsx
try { (() => {
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

/** One node on the 20-level campaign map. */
function CampaignNode({
  id,
  cols,
  rows,
  stars = 0,
  locked = false,
  onPlay,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: locked,
    onClick: onPlay,
    "aria-label": `Màn ${id}, lưới ${cols}×${rows}${locked ? ', chưa mở khoá' : ''}`,
    style: {
      width: '100%',
      maxHeight: 96,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      padding: '4px 2px',
      overflow: 'hidden',
      border: `2px solid ${stars > 0 ? 'var(--ok)' : 'var(--line)'}`,
      borderRadius: 12,
      background: 'transparent',
      color: 'var(--fg)',
      opacity: locked ? .45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 18
    }
  }, id), /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--muted)',
      fontSize: 11
    }
  }, cols, "\xD7", rows), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--warn)',
      letterSpacing: 1
    }
  }, locked ? '🔒' : starText(stars)));
}
Object.assign(__ds_scope, { CampaignNode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/CampaignNode.jsx", error: String((e && e.message) || e) }); }

// components/game/CardTile.jsx
try { (() => {
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
const POWER_ICON = {
  bomb: '💥',
  x2: '✖️',
  eye: '👁️',
  freeze: '❄️'
};
const face = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--card-radius)',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  boxShadow: 'var(--shadow-soft)',
  fontSize: 'max(20px, 55cqw)'
};

/** One card. 3:4, flips on Y; every back on a board must be identical. */
function CardTile({
  symbol,
  back = 'stars',
  faceUp = false,
  matched = false,
  wrong = false,
  power,
  blank = false,
  dealOrder = 0,
  disabled = false,
  onFlip,
  style
}) {
  if (blank) return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      aspectRatio: '3 / 4',
      ...style
    }
  });
  const flipped = faceUp || matched;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-disabled": disabled || matched ? 'true' : 'false',
    onClick: () => !disabled && !matched && onFlip && onFlip(),
    style: {
      position: 'relative',
      aspectRatio: '3 / 4',
      minWidth: 'var(--tap-min)',
      minHeight: 'var(--tap-min)',
      padding: 0,
      border: 0,
      background: 'transparent',
      perspective: 700,
      containerType: 'inline-size',
      cursor: matched ? 'default' : 'pointer',
      animation: 'mm-deal .38s cubic-bezier(.2,.9,.3,1.2) backwards',
      animationDelay: `${dealOrder * 28}ms`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'var(--card-radius)',
      transformStyle: 'preserve-3d',
      transition: 'transform .34s cubic-bezier(.3,.8,.4,1.1)',
      transform: flipped ? 'rotateY(180deg)' : 'none',
      animation: wrong ? 'mm-shake .32s' : matched ? 'mm-pop .42s cubic-bezier(.3,1.6,.5,1)' : undefined
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      ...face,
      overflow: 'hidden',
      ...BACKS[back]
    }
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      ...face,
      background: 'radial-gradient(circle at 50% 58%, var(--accent-soft), transparent 62%), var(--card-face)',
      border: `1px solid ${matched ? 'var(--ok)' : 'var(--line)'}`,
      transform: 'rotateY(180deg)',
      boxShadow: matched ? 'inset 0 0 0 2px var(--ok), 0 0 14px color-mix(in srgb, var(--ok) 45%, transparent)' : 'var(--shadow-soft), var(--inner-light)'
    }
  }, symbol, power && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      right: 3,
      fontSize: 11,
      lineHeight: 1,
      animation: 'mm-twinkle 1.6s ease-in-out infinite'
    }
  }, POWER_ICON[power]))));
}
Object.assign(__ds_scope, { CardTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/CardTile.jsx", error: String((e && e.message) || e) }); }

// components/game/BoardGrid.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The board. Cards fill the width; gap 8px (6px under 420px). */
function BoardGrid({
  cards = [],
  cols = 4,
  back = 'stars',
  locked = false,
  onFlip,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "grid",
    "aria-label": "B\xE0n th\u1EBB",
    style: {
      display: 'grid',
      gap: 'var(--board-gap)',
      width: '100%',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      touchAction: 'manipulation',
      ...style
    }
  }, cards.map((c, i) => /*#__PURE__*/React.createElement(__ds_scope.CardTile, _extends({
    key: i
  }, c, {
    back: back,
    dealOrder: i,
    disabled: locked,
    onFlip: () => onFlip && onFlip(i)
  }))));
}
Object.assign(__ds_scope, { BoardGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/BoardGrid.jsx", error: String((e && e.message) || e) }); }

// components/game/EmojiBar.jsx
try { (() => {
const QUICK_EMOJIS = ['👍', '😂', '😡', '😮', '😭', '🔥', '🎉', '🤔', '💩'];

/** Closed-list emoji chat for online games. */
function EmojiBar({
  emojis = QUICK_EMOJIS,
  onSend,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "aria-label": "G\u1EEDi emoji",
    style: {
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      ...style
    }
  }, emojis.map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    type: "button",
    onClick: () => onSend && onSend(e),
    style: {
      minWidth: 40,
      minHeight: 40,
      fontSize: 20,
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-full)',
      background: 'var(--panel)',
      transition: 'transform .12s ease'
    }
  }, e)));
}
Object.assign(__ds_scope, { QUICK_EMOJIS, EmojiBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/EmojiBar.jsx", error: String((e && e.message) || e) }); }

// components/game/GridPreview.jsx
try { (() => {
/** Miniature of a board, used on the grid-size tiles. Blank centre for odd grids. */
function GridPreview({
  cols,
  rows,
  selected = false
}) {
  const total = cols * rows;
  const blankAt = total % 2 === 1 ? Math.floor(total / 2) : -1;
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'grid',
      gap: 1.5,
      alignContent: 'center',
      maxWidth: '72%',
      minHeight: 0,
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      width: cols * 8
    }
  }, Array.from({
    length: total
  }, (_, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    style: {
      aspectRatio: '3 / 4',
      borderRadius: 2,
      minHeight: 0,
      background: i === blankAt ? 'transparent' : selected ? 'rgba(255,255,255,.9)' : 'var(--grad-selected)',
      opacity: i === blankAt ? 1 : .75
    }
  })));
}
Object.assign(__ds_scope, { GridPreview });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/GridPreview.jsx", error: String((e && e.message) || e) }); }

// components/game/HudBar.jsx
try { (() => {
const clock = s => `${Math.floor(Math.max(0, Math.floor(s)) / 60)}:${String(Math.max(0, Math.floor(s)) % 60).padStart(2, '0')}`;
function Stat({
  label,
  value,
  sub,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 52
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      color: 'var(--muted)',
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("b", {
    style: {
      fontVariantNumeric: 'tabular-nums',
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg)',
      lineHeight: 1.2,
      color: tone || 'inherit',
      textShadow: tone === 'var(--gold)' ? '0 0 10px color-mix(in srgb, var(--gold) 60%, transparent)' : undefined
    }
  }, value, sub && /*#__PURE__*/React.createElement("i", {
    style: {
      fontStyle: 'normal',
      color: 'var(--muted)',
      fontWeight: 400,
      fontSize: 13
    }
  }, sub)));
}

/** In-game stat bar on a glass panel. Multiplayer hides score/moves/combo. */
function HudBar({
  score = 0,
  moves = 0,
  matched = 0,
  totalPairs = 0,
  combo = 1,
  elapsed = 0,
  timeLeft = null,
  movesLeft = null,
  lives = null,
  levelId,
  multiplayer = false,
  onQuit
}) {
  const urgent = timeLeft !== null && timeLeft <= 10;
  const comboTone = combo >= 2 ? 'var(--gold)' : combo >= 1.5 ? 'var(--warn)' : undefined;
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      padding: '8px 12px'
    }
  }, levelId ? /*#__PURE__*/React.createElement(Stat, {
    label: "M\xE0n",
    value: levelId
  }) : null, !multiplayer && /*#__PURE__*/React.createElement(Stat, {
    label: "\u0110i\u1EC3m",
    value: score
  }), !multiplayer && /*#__PURE__*/React.createElement(Stat, {
    label: "L\u01B0\u1EE3t",
    value: moves,
    sub: movesLeft !== null ? `/${moves + movesLeft}` : undefined
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "C\u1EB7p",
    value: `${matched}/${totalPairs}`
  }), /*#__PURE__*/React.createElement(Stat, {
    label: timeLeft === null ? 'Thời gian' : 'Còn lại',
    value: clock(timeLeft ?? elapsed),
    tone: urgent ? 'var(--bad)' : undefined
  }), !multiplayer && /*#__PURE__*/React.createElement(Stat, {
    label: "Combo",
    value: `x${combo}`,
    tone: comboTone
  }), lives !== null && /*#__PURE__*/React.createElement(Stat, {
    label: "M\u1EA1ng",
    value: '❤️'.repeat(Math.max(0, lives)) || '—'
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    "aria-label": "Tho\xE1t v\u1EC1 menu",
    onClick: onQuit,
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 20
  })));
}
Object.assign(__ds_scope, { HudBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/HudBar.jsx", error: String((e && e.message) || e) }); }

// components/game/PlayerChip.jsx
try { (() => {
const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/** One player's chip in the turn strip. */
function PlayerChip({
  name,
  avatar,
  score = 0,
  index = 0,
  active = false,
  lives = null,
  turnLeft = null,
  frozen = false,
  doubleNext = false,
  offline = false,
  bonus,
  emoji,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      position: 'relative',
      flex: '1 1 0',
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 9px',
      borderWidth: 2,
      borderRadius: 12,
      borderColor: active ? 'var(--accent)' : 'var(--line)',
      boxShadow: active ? '0 0 0 1px var(--accent), 0 4px 18px var(--card-back-glow)' : 'var(--shadow-soft)',
      animation: active ? 'mm-breathe 1.8s ease-in-out infinite' : undefined,
      opacity: frozen || offline ? .6 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 18
    }
  }, avatar ?? AVATARS[index % AVATARS.length]), /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 13,
      minWidth: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), active && turnLeft !== null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      fontFamily: 'var(--font-display)',
      fontSize: 13,
      fontVariantNumeric: 'tabular-nums',
      padding: '1px 7px',
      borderRadius: 'var(--r-full)',
      whiteSpace: 'nowrap',
      background: turnLeft <= 10 ? 'color-mix(in srgb, var(--bad) 16%, transparent)' : 'var(--accent-soft)',
      color: turnLeft <= 10 ? 'var(--bad)' : 'var(--accent)',
      animation: turnLeft <= 10 ? 'mm-clock-pulse .5s steps(2) infinite' : undefined
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "timer",
    size: 12
  }), Math.ceil(turnLeft)), bonus && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -18,
      right: 8,
      fontFamily: 'var(--font-display)',
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ok)',
      textShadow: '0 1px 6px rgba(0,0,0,.2)'
    }
  }, bonus), emoji && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -26,
      left: 8,
      fontSize: 22,
      filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))'
    }
  }, emoji), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontVariantNumeric: 'tabular-nums',
      color: active ? 'var(--accent)' : 'inherit'
    }
  }, score), lives !== null && /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 10,
      letterSpacing: -2,
      whiteSpace: 'nowrap'
    }
  }, '❤️'.repeat(Math.max(0, lives)) || '💔'), frozen ? /*#__PURE__*/React.createElement("span", {
    title: "B\u1ECB \u0111\xF3ng b\u0103ng",
    style: {
      fontSize: 11
    }
  }, "\u2744\uFE0F") : doubleNext ? /*#__PURE__*/React.createElement("span", {
    title: "C\u1EB7p t\u1EDBi nh\xE2n \u0111\xF4i \u0111i\u1EC3m",
    style: {
      fontSize: 11
    }
  }, "\u2716\uFE0F2") : null);
}
Object.assign(__ds_scope, { PlayerChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/PlayerChip.jsx", error: String((e && e.message) || e) }); }

// components/game/Toast.jsx
try { (() => {
const TONE = {
  info: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  peek: 'color-mix(in srgb, var(--warn) 18%, transparent)',
  alert: 'color-mix(in srgb, var(--bad) 14%, transparent)',
  soft: 'var(--accent-soft)'
};

/** Inline status line above the board (power-ups, peek, reshuffle, reconnect). */
function Toast({
  tone = 'info',
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("p", {
    role: "status",
    style: {
      margin: 0,
      padding: '8px 12px',
      borderRadius: 10,
      fontSize: 14,
      textAlign: 'center',
      background: TONE[tone] || TONE.info,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/Toast.jsx", error: String((e && e.message) || e) }); }

// components/game/TurnBanner.jsx
try { (() => {
/** Centre-of-board announcement: whose turn it is. */
function TurnBanner({
  name,
  avatar = '🎮',
  frozenName,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '14px 26px',
      borderRadius: 16,
      background: 'color-mix(in srgb, var(--panel) 88%, transparent)',
      border: '2px solid var(--accent)',
      boxShadow: '0 10px 40px var(--card-back-glow), var(--shadow)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      pointerEvents: 'none',
      zIndex: 5,
      whiteSpace: 'nowrap',
      ...style
    }
  }, frozenName && /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, "\u2744\uFE0F ", frozenName, " b\u1ECB \u0111\xF3ng b\u0103ng, m\u1EA5t l\u01B0\u1EE3t"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'clamp(17px,4.5vw,22px)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'clamp(24px,6vw,32px)',
      animation: 'mm-wave .5s ease'
    }
  }, avatar), "\u0110\u1EBFn l\u01B0\u1EE3t ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--accent)'
    }
  }, name)));
}
Object.assign(__ds_scope, { TurnBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/TurnBanner.jsx", error: String((e && e.message) || e) }); }

// components/nav/TopBar.jsx
try { (() => {
/** App header: brand (home), accumulated score, dark + sound toggles. */
function TopBar({
  totalScore = 0,
  dark = false,
  sound = true,
  onHome,
  onToggleDark,
  onToggleSound
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-2)',
      padding: 'var(--sp-2) var(--sp-4)',
      borderBottom: '1px solid var(--line)',
      background: 'var(--panel)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      flex: 1,
      minWidth: 0,
      margin: 0,
      fontSize: 'var(--text-xl)',
      fontWeight: 800,
      lineHeight: 1.35
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "V\u1EC1 trang ch\u1EE7",
    onClick: onHome,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-2)',
      border: 0,
      background: 'none',
      padding: 0,
      font: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 24,
      filter: 'drop-shadow(0 2px 6px var(--card-back-glow))'
    }
  }, "\uD83C\uDCCF"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'linear-gradient(100deg, var(--accent), var(--accent-2))',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      whiteSpace: 'nowrap',
      fontSize: 'clamp(17px, 5.2vw, 22px)'
    }
  }, "Memory Match"))), /*#__PURE__*/React.createElement("span", {
    title: `Tổng điểm tích lũy: ${totalScore}`,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--muted)',
      fontVariantNumeric: 'tabular-nums',
      padding: '4px 10px',
      borderRadius: 'var(--r-full)',
      background: 'var(--accent-soft)',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, "\u2B50 ", totalScore), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    "aria-label": dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối',
    onClick: onToggleDark
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: dark ? 'sun' : 'moon',
    size: 20
  })), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    "aria-pressed": sound,
    "aria-label": "B\u1EADt/t\u1EAFt \xE2m thanh",
    onClick: onToggleSound
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: sound ? 'volume-2' : 'volume-x',
    size: 20
  })));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/memory-match-web/App.jsx
try { (() => {
const {
  TopBar
} = window.MemoryMatchDesignSystem_ce0961;
function App() {
  const [dark, setDark] = React.useState(false);
  const [sound, setSound] = React.useState(true);
  const [screen, setScreen] = React.useState('menu');
  const [config, setConfig] = React.useState(null);
  const [wizard, setWizard] = React.useState({
    step: 'players',
    mode: 'classic',
    grid: '4x4',
    themeIds: ['animals'],
    playerCount: 1,
    totalScore: 1200
  });
  const set = patch => setWizard(w => ({
    ...w,
    ...patch
  }));
  React.useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const home = () => {
    setScreen('menu');
    set({
      step: 'players'
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "mm-shell"
  }, /*#__PURE__*/React.createElement(TopBar, {
    totalScore: wizard.totalScore,
    dark: dark,
    sound: sound,
    onHome: home,
    onToggleDark: () => setDark(!dark),
    onToggleSound: () => setSound(!sound)
  }), /*#__PURE__*/React.createElement("main", {
    className: "mm-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mm-col"
  }, screen === 'menu' && /*#__PURE__*/React.createElement(WizardScreen, {
    state: wizard,
    set: set,
    onOnline: () => setScreen('online'),
    onCampaign: () => {
      set({
        mode: 'campaign'
      });
      setScreen('campaign');
    },
    onStart: () => {
      setConfig({
        ...wizard,
        levelId: null
      });
      setScreen('game');
    }
  }), screen === 'campaign' && /*#__PURE__*/React.createElement(CampaignScreen, {
    progress: {
      1: 3,
      2: 3,
      3: 2,
      4: 1
    },
    onBack: () => setScreen('menu'),
    onPlay: l => {
      setConfig({
        ...wizard,
        grid: `${l.cols}x${l.rows}`,
        playerCount: 1,
        levelId: l.id
      });
      setScreen('game');
    }
  }), screen === 'online' && /*#__PURE__*/React.createElement(OnlineEntry, {
    onBack: () => setScreen('menu'),
    onLobby: (name, isHost) => {
      setConfig({
        ...wizard,
        name,
        isHost,
        playerCount: 3
      });
      setScreen('lobby');
    }
  }), screen === 'lobby' && /*#__PURE__*/React.createElement(OnlineLobby, {
    me: config.name,
    isHost: config.isHost,
    onBack: () => setScreen('online'),
    onStart: () => setScreen('game')
  }), screen === 'game' && /*#__PURE__*/React.createElement(GameScreen, {
    config: config,
    onQuit: home,
    onMenu: home,
    onReplay: () => {
      setConfig({
        ...config,
        levelId: config.levelId ? config.levelId + 1 : null
      });
      setScreen('game');
    }
  }))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/memory-match-web/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/memory-match-web/GameScreens.jsx
try { (() => {
const {
  HudBar,
  PlayerChip,
  BoardGrid,
  Toast,
  TurnBanner,
  EmojiBar,
  ResultDialog,
  ConfirmDialog,
  Celebration
} = window.MemoryMatchDesignSystem_ce0961;
const {
  grids,
  themes
} = window.MM_DATA;
const BACKS = ['stars', 'diamond', 'aurora'];
const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/** Build a shuffled deck of pairs; blank centre cell for odd grids. */
function buildDeck(grid, themeIds, seed = 1) {
  const [cols, rows] = grids[grid];
  const total = cols * rows;
  const pairs = Math.floor(total / 2);
  const pool = [...new Set(themes.filter(t => themeIds.includes(t.id)).flatMap(t => t.symbols))];
  const picks = pool.slice(0, pairs);
  const deck = [...picks, ...picks].map((symbol, i) => ({
    symbol,
    key: i
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    seed = seed * 1103515245 + 12345 & 0x7fffffff;
    const j = seed % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const cards = [];
  const blankAt = total % 2 === 1 ? Math.floor(total / 2) : -1;
  for (let i = 0; i < total; i++) cards.push(i === blankAt ? {
    blank: true
  } : deck.pop());
  return {
    cards,
    cols,
    rows,
    pairs
  };
}
function GameScreen({
  config,
  onQuit,
  onMenu,
  onReplay
}) {
  const {
    grid,
    themeIds,
    mode,
    playerCount,
    levelId
  } = config;
  const [{
    cards,
    cols,
    rows,
    pairs
  }] = React.useState(() => buildDeck(grid, themeIds, (levelId ?? 3) * 7));
  const back = BACKS[(levelId ?? 1) % BACKS.length];
  const [faceUp, setFaceUp] = React.useState([]);
  const [matched, setMatched] = React.useState([]);
  const [wrong, setWrong] = React.useState([]);
  const [moves, setMoves] = React.useState(0);
  const [scores, setScores] = React.useState(Array.from({
    length: playerCount
  }, () => 0));
  const [turn, setTurn] = React.useState(0);
  const [banner, setBanner] = React.useState(null);
  const [gain, setGain] = React.useState(null);
  const [toast, setToast] = React.useState(mode === 'peek' ? '👀 Ghi nhớ vị trí các thẻ…' : null);
  const [confirm, setConfirm] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const multi = playerCount > 1;
  const won = matched.length === pairs * 2;
  React.useEffect(() => {
    if (won) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [won]);
  function flip(i) {
    if (cards[i].blank || faceUp.includes(i) || matched.includes(i) || faceUp.length === 2) return;
    const next = [...faceUp, i];
    setFaceUp(next);
    if (next.length < 2) return;
    setMoves(m => m + 1);
    const [a, b] = next;
    if (cards[a].symbol === cards[b].symbol) {
      setTimeout(() => {
        setMatched(m => [...m, a, b]);
        setFaceUp([]);
        setScores(s => s.map((v, k) => k === turn ? v + 100 : v));
        setGain({
          index: b,
          key: Date.now()
        });
      }, 420);
    } else {
      setWrong(next);
      setTimeout(() => {
        setFaceUp([]);
        setWrong([]);
        if (multi) {
          const nextTurn = (turn + 1) % playerCount;
          setTurn(nextTurn);
          setBanner({
            name: `Người ${nextTurn + 1}`,
            avatar: AVATARS[nextTurn],
            key: Date.now()
          });
          setTimeout(() => setBanner(null), 1400);
        }
      }, 760);
    }
  }
  const view = cards.map((c, i) => ({
    ...c,
    faceUp: faceUp.includes(i),
    matched: matched.includes(i),
    wrong: wrong.includes(i)
  }));
  const fit = `min(100%, calc((100dvh - ${multi ? 255 : 230}px) * ${cols * 3 / (rows * 4)}))`;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      height: '100%',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(HudBar, {
    score: scores[0],
    moves: moves,
    matched: matched.length / 2,
    totalPairs: pairs,
    combo: 1,
    elapsed: elapsed,
    lives: mode === 'survival' && !multi ? 5 : null,
    levelId: levelId,
    multiplayer: multi,
    onQuit: () => setConfirm(true)
  }), multi && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, scores.map((s, i) => /*#__PURE__*/React.createElement(PlayerChip, {
    key: i,
    name: `Người ${i + 1}`,
    index: i,
    score: s,
    active: i === turn,
    turnLeft: i === turn ? 15 - elapsed % 15 : null,
    lives: mode === 'survival' ? 5 : null
  }))), toast && /*#__PURE__*/React.createElement(Toast, {
    tone: "peek"
  }, toast), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(BoardGrid, {
    cols: cols,
    cards: view,
    back: back,
    onFlip: flip,
    style: {
      width: fit
    }
  }), gain && /*#__PURE__*/React.createElement("span", {
    key: gain.key,
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      left: `${(gain.index % cols + 0.5) / cols * 100}%`,
      top: `${(Math.floor(gain.index / cols) + 0.5) / rows * 100}%`,
      transform: 'translate(-50%,-50%)',
      fontWeight: 800,
      fontSize: 'clamp(16px,4vw,24px)',
      color: 'var(--gold)',
      textShadow: '0 1px 8px rgba(0,0,0,.35)',
      pointerEvents: 'none',
      animation: 'mm-rise 1s ease-out forwards'
    }
  }, "+100"), banner && /*#__PURE__*/React.createElement(TurnBanner, {
    key: banner.key,
    name: banner.name,
    avatar: banner.avatar
  })), multi && /*#__PURE__*/React.createElement(EmojiBar, {
    onSend: () => {}
  }), won && /*#__PURE__*/React.createElement(Celebration, null), won && /*#__PURE__*/React.createElement(ResultDialog, {
    title: multi ? `Người ${scores.indexOf(Math.max(...scores)) + 1} thắng! 🏆` : levelId ? 'Hoàn thành! 🎉' : 'Kỷ lục mới! 🏆',
    reason: "B\u1EA1n \u0111\xE3 m\u1EDF h\u1EBFt c\xE1c c\u1EB7p!",
    stars: levelId ? 3 : null,
    ranking: multi ? scores.map((s, i) => ({
      name: `Người ${i + 1}`,
      score: s,
      pairs: s / 100,
      bestStreak: 2
    })).sort((a, b) => b.score - a.score) : null,
    stats: [{
      label: 'Điểm',
      value: scores[0]
    }, {
      label: 'Số lượt',
      value: moves
    }, {
      label: 'Thời gian',
      value: `0:${String(elapsed).padStart(2, '0')}`
    }, {
      label: 'Chuỗi dài nhất',
      value: 3
    }],
    achievements: levelId ? [{
      name: 'Hoàn hảo',
      hint: 'Đạt 3 sao ở một màn Chiến dịch'
    }] : [],
    primaryLabel: levelId ? 'Màn tiếp theo' : 'Chơi lại',
    secondaryLabel: "V\u1EC1 menu",
    onPrimary: onReplay,
    onSecondary: onMenu
  }), confirm && /*#__PURE__*/React.createElement(ConfirmDialog, {
    title: "Tho\xE1t v\xE1n \u0111ang ch\u01A1i?",
    body: "V\xE1n n\xE0y s\u1EBD kh\xF4ng \u0111\u01B0\u1EE3c l\u01B0u k\u1EBFt qu\u1EA3.",
    confirmLabel: "Tho\xE1t v\xE1n",
    onConfirm: onQuit,
    onCancel: () => setConfirm(false)
  }));
}
Object.assign(window, {
  GameScreen,
  buildDeck
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/memory-match-web/GameScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/memory-match-web/MenuScreens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  Panel,
  Button,
  WizardHeader,
  OptionTile,
  Icon,
  GridPreview,
  CampaignNode
} = window.MemoryMatchDesignSystem_ce0961;
const {
  grids,
  themes,
  modes,
  levels
} = window.MM_DATA;
function WizardScreen({
  state,
  set,
  onStart,
  onCampaign,
  onOnline
}) {
  const {
    step,
    mode,
    grid,
    themeIds,
    playerCount,
    totalScore
  } = state;
  const multi = playerCount > 1;
  const path = multi ? ['players', 'count', 'mode', 'grid', 'theme'] : ['players', 'mode', ...(mode === 'campaign' ? ['campaign'] : ['grid', 'theme'])];
  const idx = path.indexOf(step);
  const titles = {
    players: 'Bạn muốn chơi thế nào?',
    count: 'Mấy người chơi?',
    mode: 'Chọn chế độ',
    grid: 'Kích thước lưới',
    theme: 'Chọn theme thẻ'
  };
  const visible = multi ? modes.filter(m => m.id === 'classic' || m.id === 'survival') : modes;
  const pool = new Set(themes.filter(t => themeIds.includes(t.id)).flatMap(t => t.symbols));
  const [cols, rows] = grids[grid];
  const tooSmall = pool.size < Math.floor(cols * rows / 2);
  return /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(WizardHeader, {
    title: titles[step],
    onBack: idx > 0 ? () => set({
      step: path[idx - 1]
    }) : undefined,
    steps: path.length,
    current: idx
  }), step === 'players' && /*#__PURE__*/React.createElement("div", {
    className: "mm-loose"
  }, /*#__PURE__*/React.createElement(OptionTile, {
    tone: "g-violet",
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 40
    }),
    title: "Ch\u01A1i m\u1ED9t m\xECnh",
    description: "Luy\u1EC7n tr\xED nh\u1EDB, ph\xE1 k\u1EF7 l\u1EE5c c\u1EE7a ch\xEDnh b\u1EA1n",
    onClick: () => set({
      playerCount: 1,
      step: 'mode'
    })
  }), /*#__PURE__*/React.createElement(OptionTile, {
    tone: "g-pink",
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "users",
      size: 40
    }),
    title: "Ch\u01A1i nhi\u1EC1u ng\u01B0\u1EDDi",
    description: "2\u20134 ng\u01B0\u1EDDi thay l\u01B0\u1EE3t tr\xEAn c\xF9ng m\xE1y n\xE0y",
    onClick: () => set({
      playerCount: Math.max(2, playerCount),
      mode: 'classic',
      step: 'count'
    })
  }), /*#__PURE__*/React.createElement(OptionTile, {
    tone: "g-cyan",
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "globe",
      size: 40
    }),
    title: "Ch\u01A1i online",
    description: "T\u1EA1o ph\xF2ng, m\u1EDDi b\u1EA1n b\xE8 b\u1EB1ng m\xE3 6 k\xFD t\u1EF1",
    onClick: onOnline
  })), step === 'count' && /*#__PURE__*/React.createElement("div", {
    className: "mm-loose mm-cols3"
  }, [2, 3, 4].map(n => /*#__PURE__*/React.createElement(OptionTile, {
    key: n,
    tone: "g-pink",
    numeral: n,
    title: `${n} người`,
    selected: playerCount === n,
    onClick: () => set({
      playerCount: n,
      step: 'mode'
    })
  }))), step === 'mode' && /*#__PURE__*/React.createElement("div", {
    className: `mm-loose${visible.length > 2 ? ' mm-modes' : ''}`
  }, visible.map(m => /*#__PURE__*/React.createElement(OptionTile, {
    key: m.id,
    tone: m.tone,
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: m.icon,
      size: 26
    }),
    title: m.name,
    description: m.desc,
    selected: mode === m.id,
    onClick: () => m.id === 'campaign' && !multi ? onCampaign() : set({
      mode: m.id,
      step: 'grid'
    })
  }))), step === 'grid' && /*#__PURE__*/React.createElement("div", {
    className: "mm-fill"
  }, Object.entries(grids).map(([k, [c, r]]) => /*#__PURE__*/React.createElement(OptionTile, {
    key: k,
    title: k.replace('x', '×'),
    description: `${Math.floor(c * r / 2)} cặp`,
    selected: grid === k,
    icon: /*#__PURE__*/React.createElement(GridPreview, {
      cols: c,
      rows: r,
      selected: grid === k
    }),
    style: {
      padding: '6px 4px',
      gap: 2
    },
    onClick: () => set({
      grid: k,
      step: 'theme'
    })
  }))), step === 'theme' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 10px',
      color: 'var(--muted)',
      fontSize: 'var(--text-sm)'
    }
  }, "Ch\u1ECDn \u0111\u01B0\u1EE3c nhi\u1EC1u theme \u2014 b\xE0n th\u1EBB s\u1EBD tr\u1ED9n bi\u1EC3u t\u01B0\u1EE3ng c\u1EE7a t\u1EA5t c\u1EA3."), /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": "Theme th\u1EBB",
    className: "mm-fill"
  }, themes.map(t => {
    const locked = t.unlockAt > totalScore;
    return /*#__PURE__*/React.createElement(OptionTile, {
      key: t.id,
      role: "checkbox",
      selected: themeIds.includes(t.id),
      disabled: locked,
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 17,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          opacity: .9
        }
      }, t.symbols.slice(0, 3).join(' ')),
      title: t.name,
      description: locked ? `🔒 ${t.unlockAt / 1000}k điểm` : undefined,
      style: {
        padding: '10px 6px',
        gap: 3
      },
      onClick: () => {
        const next = themeIds.includes(t.id) ? themeIds.filter(x => x !== t.id) : [...themeIds, t.id];
        if (next.length) set({
          themeIds: next
        });
      }
    });
  })), tooSmall && /*#__PURE__*/React.createElement("p", {
    role: "alert",
    style: {
      margin: '14px 0 0',
      padding: '10px 12px',
      borderRadius: 10,
      fontSize: 13,
      background: 'color-mix(in srgb, var(--bad) 14%, transparent)'
    }
  }, "Ch\u01B0a \u0111\u1EE7 bi\u1EC3u t\u01B0\u1EE3ng cho l\u01B0\u1EDBi ", grid.replace('x', '×'), ". H\xE3y ch\u1ECDn th\xEAm theme ho\u1EB7c l\u01B0\u1EDBi nh\u1ECF h\u01A1n."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: tooSmall,
    onClick: onStart
  }, "B\u1EAFt \u0111\u1EA7u"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '14px 0 0',
      color: 'var(--muted)',
      fontSize: 13
    }
  }, "K\u1EF7 l\u1EE5c: ", /*#__PURE__*/React.createElement("b", null, "1180"), " \u0111i\u1EC3m \xB7 14 l\u01B0\u1EE3t \xB7 0:52")));
}
function CampaignScreen({
  onBack,
  onPlay,
  progress
}) {
  const stars = Object.values(progress).reduce((n, s) => n + s, 0);
  return /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(WizardHeader, {
    title: "Ch\u1ECDn m\xE0n",
    onBack: onBack,
    steps: 3,
    current: 2
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 8px',
      color: 'var(--muted)',
      fontSize: 14
    }
  }, "\u0110\xE3 \u0111\u1EA1t ", /*#__PURE__*/React.createElement("b", null, stars), " / 60 sao"), /*#__PURE__*/React.createElement("ol", {
    className: "mm-fill mm-map",
    style: {
      gap: 6,
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, levels.map(l => /*#__PURE__*/React.createElement("li", {
    key: l.id,
    style: {
      display: 'flex',
      minHeight: 0,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(CampaignNode, _extends({}, l, {
    stars: progress[l.id] ?? 0,
    locked: l.id > 6,
    onPlay: () => onPlay(l)
  }))))));
}
Object.assign(window, {
  WizardScreen,
  CampaignScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/memory-match-web/MenuScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/memory-match-web/OnlineScreens.jsx
try { (() => {
const {
  Panel,
  Button,
  WizardHeader,
  OptionTile,
  TextField,
  Icon
} = window.MemoryMatchDesignSystem_ce0961;
const AVATARS = ['🦊', '🐼', '🐯', '🐸'];
function OnlineEntry({
  onBack,
  onLobby
}) {
  const [entry, setEntry] = React.useState('choose');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const title = entry === 'choose' ? 'Chơi online' : entry === 'create' ? 'Tạo phòng mới' : 'Vào phòng';
  return /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(WizardHeader, {
    title: title,
    onBack: () => entry === 'choose' ? onBack() : setEntry('choose')
  }), entry === 'choose' && /*#__PURE__*/React.createElement("div", {
    className: "mm-loose"
  }, /*#__PURE__*/React.createElement(OptionTile, {
    tone: "g-violet",
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 34
    }),
    title: "T\u1EA1o ph\xF2ng m\u1EDBi",
    description: "L\u1EA5y m\xE3 6 s\u1ED1 r\u1ED3i m\u1EDDi b\u1EA1n b\xE8 v\xE0o ch\u01A1i",
    onClick: () => setEntry('create')
  }), /*#__PURE__*/React.createElement(OptionTile, {
    tone: "g-cyan",
    layout: "wide",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "hash",
      size: 34
    }),
    title: "V\xE0o ph\xF2ng c\xF3 s\u1EB5n",
    description: "Nh\u1EADp m\xE3 6 s\u1ED1 b\u1EA1n b\xE8 g\u1EEDi cho",
    onClick: () => setEntry('join')
  })), entry === 'create' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TextField, {
    label: "T\xEAn c\u1EE7a b\u1EA1n",
    value: name,
    onChange: setName,
    placeholder: "VD: An"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: !name.trim(),
    onClick: () => onLobby(name.trim(), true)
  }, "Ti\u1EBFp t\u1EE5c")), entry === 'join' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TextField, {
    label: "T\xEAn c\u1EE7a b\u1EA1n",
    value: name,
    onChange: setName,
    placeholder: "VD: An"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "M\xE3 ph\xF2ng",
    value: code,
    onChange: setCode,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    code: true
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: !name.trim() || code.length !== 6,
    onClick: () => onLobby(name.trim(), false)
  }, "V\xE0o ph\xF2ng ch\u01A1i")));
}
function OnlineLobby({
  me,
  isHost,
  onBack,
  onStart
}) {
  const [copied, setCopied] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const players = [{
    id: 'p1',
    name: isHost ? me : 'An',
    avatar: '🦊',
    host: true,
    ready: true
  }, {
    id: 'p2',
    name: isHost ? 'Bình' : me,
    avatar: '🐼',
    host: false,
    ready: isHost ? true : ready
  }, {
    id: 'p3',
    name: 'Chi',
    avatar: '🐯',
    host: false,
    ready: false,
    connected: false
  }];
  const code = '418203';
  return /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(WizardHeader, {
    title: "Ph\xF2ng ch\u1EDD",
    onBack: onBack,
    trailing: /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '.12em',
        color: 'var(--accent)'
      }
    }, code, /*#__PURE__*/React.createElement(Icon, {
      name: copied ? 'check' : 'copy',
      size: 16
    }))
  }), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: '0 0 6px',
      padding: 0,
      display: 'grid',
      gap: 8
    }
  }, players.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      border: '2px solid var(--line)',
      borderRadius: 'var(--r-md)',
      background: 'var(--panel-soft)',
      opacity: p.connected === false ? .55 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, p.avatar), /*#__PURE__*/React.createElement("b", null, p.name), p.host && /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--muted)',
      fontSize: 'var(--text-xs)'
    }
  }, "ch\u1EE7 ph\xF2ng"), p.name === me && /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--muted)',
      fontSize: 'var(--text-xs)'
    }
  }, "(b\u1EA1n)"), p.connected === false ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 'var(--text-xs)',
      color: 'var(--warn)'
    }
  }, "r\u1EDBt m\u1EA1ng\u2026") : /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 'var(--text-xs)',
      whiteSpace: 'nowrap',
      fontWeight: p.ready ? 700 : 400,
      color: p.ready ? 'var(--ok)' : 'var(--muted)'
    }
  }, p.host ? /*#__PURE__*/React.createElement(Icon, {
    name: "crown",
    size: 15,
    style: {
      color: 'var(--gold)'
    }
  }) : p.ready ? '✓ sẵn sàng' : 'chưa sẵn sàng'))), /*#__PURE__*/React.createElement("li", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '10px 12px',
      border: '2px dashed var(--line)',
      borderRadius: 'var(--r-md)',
      color: 'var(--muted)',
      fontSize: 'var(--text-sm)'
    }
  }, "C\xF2n 1 ch\u1ED7 tr\u1ED1ng \u2014 chia s\u1EBB m\xE3 ", /*#__PURE__*/React.createElement("b", {
    style: {
      marginLeft: 4
    }
  }, code), " \u0111\u1EC3 m\u1EDDi b\u1EA1n b\xE8")), isHost ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      padding: '10px 12px',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      background: 'var(--panel-soft)',
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, "\uD83E\uDDE0 C\u1ED5 \u0111i\u1EC3n \xB7 l\u01B0\u1EDBi ", /*#__PURE__*/React.createElement("b", null, "4\xD74"), " \xB7 \u0110\u1ED9ng v\u1EADt"), /*#__PURE__*/React.createElement(Button, {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings-2",
    size: 16
  }), " Ch\u1EC9nh")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onStart
  }, "B\u1EAFt \u0111\u1EA7u")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => setReady(!ready),
    style: ready ? {
      background: 'var(--ok)',
      boxShadow: '0 8px 22px color-mix(in srgb, var(--ok) 40%, transparent)'
    } : undefined
  }, ready ? '✅ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng!'), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      fontSize: 'var(--text-sm)',
      margin: '14px 0 0'
    }
  }, "\uD83E\uDDE0 C\u1ED5 \u0111i\u1EC3n \xB7 l\u01B0\u1EDBi 4\xD74 \xB7 \u0110\u1ED9ng v\u1EADt \u2014 ch\u1EDD ch\u1EE7 ph\xF2ng b\u1EAFt \u0111\u1EA7u\u2026")));
}
Object.assign(window, {
  OnlineEntry,
  OnlineLobby
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/memory-match-web/OnlineScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/memory-match-web/data.js
try { (() => {
// Real game data, trimmed from the repo (public/data/themes.json, engine presets.ts).
window.MM_DATA = {
  grids: {
    '2x2': [2, 2],
    '2x3': [2, 3],
    '3x3': [3, 3],
    '3x4': [3, 4],
    '4x4': [4, 4],
    '4x5': [4, 5],
    '5x5': [5, 5],
    '5x6': [5, 6],
    '6x6': [6, 6],
    '6x8': [6, 8],
    '7x8': [7, 8],
    '8x8': [8, 8]
  },
  themes: [{
    id: 'animals',
    name: 'Động vật',
    unlockAt: 0,
    symbols: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐵', '🐷', '🐸', '🐧']
  }, {
    id: 'food',
    name: 'Đồ ăn',
    unlockAt: 0,
    symbols: ['🍔', '🍕', '🌭', '🍟', '🍿', '🥪', '🌮', '🌯', '🥗', '🍣', '🍙', '🍤']
  }, {
    id: 'fruits',
    name: 'Trái cây',
    unlockAt: 0,
    symbols: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥑', '🍉', '🍋', '🥕']
  }, {
    id: 'nature',
    name: 'Thiên nhiên',
    unlockAt: 0,
    symbols: ['🌸', '🌻', '🌹', '🌷', '🌵', '🌴', '🍀', '🍁', '🌿', '🍄', '⛰️', '🌋']
  }, {
    id: 'smileys',
    name: 'Mặt cười',
    unlockAt: 0,
    symbols: ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '😘', '😜', '🤪']
  }, {
    id: 'sports',
    name: 'Thể thao',
    unlockAt: 0,
    symbols: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '⛳']
  }, {
    id: 'flags',
    name: 'Cờ quốc gia',
    unlockAt: 5000,
    symbols: ['🇻🇳', '🇯🇵', '🇰🇷', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇧🇷', '🇦🇺', '🇨🇦']
  }, {
    id: 'ocean',
    name: 'Đại dương',
    unlockAt: 8000,
    symbols: ['🐳', '🐋', '🐬', '🦈', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟']
  }, {
    id: 'space',
    name: 'Vũ trụ',
    unlockAt: 10000,
    symbols: ['🚀', '🛸', '🪐', '🌍', '🌎', '🌏', '🌕', '☄️', '🌟', '✨', '👽', '🛰️']
  }, {
    id: 'tech',
    name: 'Công nghệ',
    unlockAt: 12000,
    symbols: ['💻', '🖥️', '⌨️', '🖱️', '📱', '🖨️', '💾', '💿', '🔌', '🔋', '📷', '🎮']
  }, {
    id: 'vehicles',
    name: 'Phương tiện',
    unlockAt: 15000,
    symbols: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚚', '🚜', '🛵']
  }, {
    id: 'letters',
    name: 'Chữ & số',
    unlockAt: 20000,
    symbols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M']
  }],
  modes: [{
    id: 'campaign',
    icon: 'map',
    tone: 'g-violet',
    name: 'Chiến dịch',
    desc: 'Đi từ dễ đến khó qua 20 màn · điểm cộng dồn'
  }, {
    id: 'classic',
    icon: 'brain',
    tone: 'g-blue',
    name: 'Cổ điển',
    desc: 'Thong thả, không giới hạn thời gian'
  }, {
    id: 'time',
    icon: 'timer',
    tone: 'g-amber',
    name: 'Đua thời gian',
    desc: 'Xong càng nhanh, thưởng càng nhiều'
  }, {
    id: 'survival',
    icon: 'heart',
    tone: 'g-red',
    name: 'Sinh tồn',
    desc: '5 mạng — lật sai là mất mạng'
  }, {
    id: 'peek',
    icon: 'eye',
    tone: 'g-teal',
    name: 'Chớp nhoáng',
    desc: 'Nhìn 4 giây, nhớ hết, rồi lật'
  }],
  // Campaign ladder from packages/engine/src/campaign.ts
  levels: Array.from({
    length: 20
  }, (_, i) => {
    const ladder = [[2, 2], [3, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 6], [6, 8]];
    const [cols, rows] = ladder[Math.min(ladder.length - 1, Math.floor(i * ladder.length / 20))];
    return {
      id: i + 1,
      cols,
      rows
    };
  })
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/memory-match-web/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.OptionTile = __ds_scope.OptionTile;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.StepDots = __ds_scope.StepDots;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.WizardHeader = __ds_scope.WizardHeader;

__ds_ns.Celebration = __ds_scope.Celebration;

__ds_ns.ConfirmDialog = __ds_scope.ConfirmDialog;

__ds_ns.ResultDialog = __ds_scope.ResultDialog;

__ds_ns.BoardGrid = __ds_scope.BoardGrid;

__ds_ns.CampaignNode = __ds_scope.CampaignNode;

__ds_ns.CardTile = __ds_scope.CardTile;

__ds_ns.QUICK_EMOJIS = __ds_scope.QUICK_EMOJIS;

__ds_ns.EmojiBar = __ds_scope.EmojiBar;

__ds_ns.GridPreview = __ds_scope.GridPreview;

__ds_ns.HudBar = __ds_scope.HudBar;

__ds_ns.PlayerChip = __ds_scope.PlayerChip;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.TurnBanner = __ds_scope.TurnBanner;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
