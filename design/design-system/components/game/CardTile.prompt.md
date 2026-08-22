The card. 3:4 ratio, 12px radius, flips 340ms on Y; the face is a light panel with an emoji sized by container query (55cqw) so big boards and small boards both read.

```jsx
<CardTile symbol="🦊" back="stars" faceUp />
<CardTile back="stars" onFlip={() => flip(3)} />
```

Requires the keyframes in `patterns/animations.css` (`mm-deal`, `mm-pop`, `mm-shake`, `mm-twinkle`). Three back styles ship — stars, diamond, aurora — picked once per game: mixed backs would mark the deck. Matched cards get an emerald inset ring and a 1.14 pop; wrong pairs shake.
