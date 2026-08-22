Buttons. One gradient primary per screen, sitting at the bottom of the panel; everything else is the 44px glass `default`.

```jsx
<Button variant="primary">Bắt đầu</Button>
<Button><Icon name="x" size={20} /></Button>
<Button variant="danger">Thoát ván</Button>
```

Primary is 50px tall, full width, `linear-gradient(135deg, accent, accent-2)`, glow shadow from `--card-back-glow`. Hover lifts 1–2px (desktop only); press returns to 0 and drops the shadow. Disabled is opacity .45 with no lift.
