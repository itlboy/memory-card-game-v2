The little board diagram on each grid-size tile — it draws the real board, blank centre cell included.

```jsx
<OptionTile icon={<GridPreview cols={5} rows={5} />} title="5×5" description="12 cặp" />
```

Cells keep the card's 3:4 ratio at 75% opacity; width is `cols × 8px`. Twelve grids exist: 2x2 2x3 3x3 3x4 4x4 4x5 5x5 5x6 6x6 6x8 7x8 8x8.
