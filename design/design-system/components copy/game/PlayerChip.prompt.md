One-line player chip. A row of 2–4 sits between the HUD and the board in every multiplayer game, local or online.

```jsx
<PlayerChip name="An" score={300} index={0} active turnLeft={12} lives={4} />
```

Deliberately squeezed to one line so the board keeps the space. Active chip: accent border, 1px ring, brand glow, breathing animation. Frozen and disconnected chips drop to 60% opacity. Status is emoji: ❤️ lives, ❄️ frozen, ✖️2 double-next, 💔 out.
