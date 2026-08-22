Every step and lobby screen opens with this header — back chevron, one question as the title, progress dots on the right.

```jsx
<WizardHeader title="Kích thước lưới" onBack={back} steps={4} current={2} />
```

Titles are questions in Vietnamese sentence case ("Bạn muốn chơi thế nào?"). 19px, display font, `flex:1` so the dots pin right.
