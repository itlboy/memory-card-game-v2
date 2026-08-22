The only text input in the product — player name, and the room code.

```jsx
<TextField label="Tên của bạn" value={name} onChange={setName} placeholder="VD: An" />
<TextField label="Mã phòng" value={code} onChange={setCode} placeholder="••••••" code />
```

48px tall, 2px border, `--panel-soft` fill; focus swaps the border to accent and removes the outline.
