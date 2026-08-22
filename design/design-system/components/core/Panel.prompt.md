The one container in the system — translucent white, 14px blur, 18px radius, 20px padding, two-layer shadow plus a light inner top edge.

```jsx
<Panel><h2>Chọn chế độ</h2></Panel>
```

Screens use it full-height (`display:flex;flex-direction:column;min-height:0`); dialogs use it at `max-width:400px` with a 78% opaque background so celebration effects show through.
