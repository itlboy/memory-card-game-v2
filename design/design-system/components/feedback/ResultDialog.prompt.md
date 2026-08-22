The end-of-game dialog. It appears 5 seconds after a win so the celebration gets the stage first (1–1.5s after a loss).

```jsx
<ResultDialog title="Kỷ lục mới! 🏆" reason="Bạn đã mở hết các cặp!" stars={3}
  stats={[{label:'Điểm',value:1180},{label:'Số lượt',value:14},{label:'Thời gian',value:'0:52'}]}
  primaryLabel="Màn tiếp theo" secondaryLabel="Về menu" tertiaryLabel="Chơi lại màn này" />
```

Only 78% opaque plus blur, so fireworks stay visible behind it. Stars pop in one at a time with a rising tone. Multiplayer passes `ranking` instead of `stats`; the winner's score is emerald.
