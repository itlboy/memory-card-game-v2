The only chrome in the product — present on every screen, above the panel.

```jsx
<TopBar totalScore={1200} dark={false} sound onHome={goHome} />
```

There is no logo file in the source: the mark is the 🃏 emoji plus "Memory Match" in gradient-clipped text (accent → accent-2, 100deg). Tapping it goes home, asking for confirmation if a game is in progress. The score pill is a `--accent-soft` capsule with ⭐.
