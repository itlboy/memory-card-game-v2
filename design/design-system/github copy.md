repo: itlboy/memory-card-game-v2
branch: main
path: apps/web, packages/engine

## Last sync

date: 2026-08-22T02:41:35Z

### Updated in this project

- Built the token set, pattern stylesheets and 19 foundation cards from `apps/web/src/styles`.
- Authored 22 components mirroring the app's Vue component inventory.
- Recreated the web game as a click-through UI kit (wizard, board, result, online lobby).
- Documented content, visual and iconography rules in `readme.md`.

## Screen map

| Project screen | Repo files |
|---|---|
| `ui_kits/memory-match-web/MenuScreens.jsx` | `apps/web/src/components/MenuScreen.vue`, `CampaignMap.vue` |
| `ui_kits/memory-match-web/GameScreens.jsx` | `apps/web/src/components/GameScreen.vue`, `BoardGrid.vue`, `CardTile.vue`, `HudBar.vue`, `PlayerStrip.vue`, `ResultDialog.vue`, `CelebrationFx.vue` |
| `ui_kits/memory-match-web/OnlineScreens.jsx` | `apps/web/src/components/OnlineScreen.vue` |
| `ui_kits/memory-match-web/App.jsx` | `apps/web/src/App.vue`, `TopBar.vue` |
| `ui_kits/memory-match-web/data.js` | `apps/web/public/data/themes.json`, `packages/engine/src/presets.ts`, `packages/engine/src/campaign.ts` |
| `tokens/*.css`, `patterns/*.css` | `apps/web/src/styles/tokens.css`, `global.css` |
| `components/**` | the matching `apps/web/src/components/*.vue` |
