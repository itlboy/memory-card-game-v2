Fires the moment a game is won, five seconds before the result dialog, and keeps running behind it.

```jsx
{won && <Celebration />}
```

Confetti only — the app pairs it with eight staggered firework bursts (`CelebrationFx.vue`); that part is not reproduced here. Always `pointer-events:none`, so it never blocks a tap.
