# Memory Match — web app UI kit

A click-through recreation of the only product in the source repo: the Vue 3 + Vite
web game at `apps/web`. Every screen composes the design system's components; nothing
here re-implements a primitive.

Two entry points: `index.html` (desktop, 1280) and `phone.html` (390 — where the product is designed first); both run the same screens, `kit.css` holds the breakpoints (560px grids, 700px tiles, 900px-tall fixed panel).

Open either and play: pick solo / local multiplayer / online, choose a mode,
a grid and one or more themes, then flip real pairs until the result dialog appears.

| File | Screens | Built from |
|---|---|---|
| `MenuScreens.jsx` | Wizard (players → count → mode → grid → theme), campaign map | `MenuScreen.vue`, `CampaignMap.vue` |
| `GameScreens.jsx` | Solo + local multiplayer board, turn hand-off, result, quit confirm | `GameScreen.vue`, `BoardGrid.vue`, `ResultDialog.vue` |
| `OnlineScreens.jsx` | Online entry (create / join), waiting room | `OnlineScreen.vue` |
| `App.jsx` | Shell, top bar, routing between screens | `App.vue`, `TopBar.vue` |
| `data.js` | Twelve grids, twelve emoji themes, five modes, 20 campaign levels | `public/data/themes.json`, `engine/presets.ts`, `engine/campaign.ts` |

Deliberate simplifications: no timed modes, no special cards, no network, no
persistence, and the campaign unlocks are fixed at level 6. Card-flip rules,
turn rotation, scoring at 100 a pair and the no-scroll board fit are real.
