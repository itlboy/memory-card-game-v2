Progress dots for the step-by-step wizard, always at the right end of the panel header.

```jsx
<StepDots count={4} current={1} />
```

The count follows the active branch (solo: 3–4 steps, local multiplayer: 5, online: 3), so it shrinks and grows with the path the player took.
