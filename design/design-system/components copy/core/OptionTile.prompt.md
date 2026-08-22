The wizard's workhorse: one tile per choice. Identity steps (what to play, which mode, how many players) always carry their fixed colour; configuration steps (grid, theme) are dark until selected.

```jsx
<OptionTile tone="g-blue" layout="wide" icon={<Icon name="brain" size={26} />}
  title="Cổ điển" description="Thong thả, không giới hạn thời gian" selected />
<OptionTile title="4×4" description="8 cặp" selected />
```

Fixed mode colours: Chiến dịch `g-violet` · Cổ điển `g-blue` · Đua thời gian `g-amber` · Sinh tồn `g-red` · Chớp nhoáng `g-teal`; player branches solo violet / local pink / online cyan. A selected neon tile keeps its colour and lights a white 3px inset outline — never a colour transition.
