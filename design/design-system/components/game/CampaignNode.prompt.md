A level on the campaign map — number, grid size, stars.

```jsx
<CampaignNode id={4} cols={3} rows={4} stars={2} onPlay={() => start(4)} />
```

All 20 nodes must fit without scrolling: 4 columns on mobile, 5 on ≥560px, `grid-auto-rows: minmax(0,1fr)` and `overflow:hidden`. Locked nodes show 🔒 at 45% opacity.
