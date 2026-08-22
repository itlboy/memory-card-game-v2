The in-game stat bar — always the top row of the game screen, on a glass panel.

```jsx
<HudBar score={1240} moves={14} matched={5} totalPairs={8} combo={1.5} elapsed={62} onQuit={quit} />
```

Labels are 11.5px uppercase muted; values are display-font tabular numerals. Time turns red and blinks under 10s; combo goes amber at x1.5 and gold with a glow at x2. In multiplayer only Cặp / time remain — per-player numbers move into PlayerChip.
