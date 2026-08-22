The card board. Twelve grids ship, 2×2 → 8×8; odd grids (3×3, 5×5) keep a blank centre cell.

```jsx
<BoardGrid cols={4} cards={cards} back="aurora" onFlip={flip} />
```

The board must never force a scroll: the game screen caps its width with
`--fit: min(100%, calc((100dvh - 230px) * (cols*3)/(rows*4)))` — 255px of chrome instead of 230px when a player strip is present.
