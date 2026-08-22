Lucide glyph in the brand's icon language — use it anywhere the app shows an icon (mode tiles, HUD quit, top bar toggles, back chevrons).

```jsx
<Icon name="brain" size={26} style={{ color: 'var(--accent)' }} />
```

Colour comes from `currentColor`, so inside a `.neon` tile it turns white automatically. Sizes seen upstream: 12 (turn clock), 16 (inline buttons), 20 (top bar / HUD), 22 (back chevron), 26 (mode row), 34–40 (big identity tiles).
