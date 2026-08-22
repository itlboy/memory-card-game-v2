# Memory Match — Design System

Memory Match (*Game Thẻ Bài Trí Nhớ*) is a browser memory game in Vietnamese: flip
cards two at a time, find the pairs, beat your record. One product, three ways to play —
solo (five modes plus a 20-level campaign), 2–4 players passing one device, and online
rooms joined with a six-digit code.

The whole interface is Vietnamese, mobile-first, and built on one hard rule the codebase
repeats everywhere: **no screen may ever scroll**. Menus, the campaign map, the board and
the lobby all fit the viewport; adding another option makes the tiles smaller, never the
page longer.

## Sources

Everything here was read from one repository:

- <https://github.com/itlboy/memory-card-game-v2> — `apps/web` (Vue 3 + Vite UI),
  `packages/engine` (deterministic rules, TypeScript), `apps/server` (Cloudflare Durable
  Objects for online rooms), `design/` (design-exploration mockups), `legacy/v1`.

Read that repo directly if you want more fidelity than this system carries — in particular
`apps/web/src/styles/tokens.css`, `global.css`, and the `.vue` components, which are the
authority for every value in `tokens/`. `github.md` records the exact screen → file map.

There is **no logo file** in the source. The mark is the 🃏 playing-card emoji next to
"Memory Match" set in Baloo 2 with a gradient-clipped fill. Don't draw one.

## Index

| Path | What's there |
|---|---|
| `styles.css` | The single entry point consumers link — imports only |
| `tokens/` | `colors.css` `typography.css` `spacing.css` `elevation.css` `gradients.css` `fonts.css` |
| `patterns/` | `base.css` (page/background/reset), `primitives.css` (`.panel` `.btn` `.chip` `.neon .g-*`), `animations.css` (`mm-*` keyframes) |
| `components/core/` | Panel, Button, OptionTile, Chip, TextField, StepDots, WizardHeader, Icon |
| `components/game/` | CardTile, BoardGrid, GridPreview, HudBar, PlayerChip, CampaignNode, TurnBanner, Toast, EmojiBar |
| `components/feedback/` | ResultDialog, ConfirmDialog, Celebration |
| `components/nav/` | TopBar |
| `ui_kits/memory-match-web/` | Click-through recreation of the whole game — see its README |
| `guidelines/` | 19 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `assets/card-backs/` | The three card-back artworks as SVG |
| `SKILL.md` | Agent Skills front-matter for using this system in Claude Code |

## Components

Core: **Panel**, **Button**, **OptionTile**, **Chip**, **TextField**, **StepDots**, **WizardHeader**, **Icon**.
Game: **CardTile**, **BoardGrid**, **GridPreview**, **HudBar**, **PlayerChip**, **CampaignNode**, **TurnBanner**, **Toast**, **EmojiBar**.
Feedback: **ResultDialog**, **ConfirmDialog**, **Celebration**.
Navigation: **TopBar**.

Each has a sibling `.d.ts` (props) and `.prompt.md` (what & when, with an example).

### Intentional additions

The Vue app has no component for these; they were extracted because the pattern is
repeated inline in several files:

- **Icon** — wrapper for the Lucide glyph set the app imports as `lucide-vue-next`.
- **WizardHeader** — the back-chevron + question + dots header, duplicated in
  `MenuScreen.vue` and `OnlineScreen.vue`.
- **GridPreview** — the mini board on grid-size tiles, likewise duplicated.
- **Toast** / **TurnBanner** — inline `<p class="toast">` and the turn banner markup.

Not included: the eight-burst firework layer of `CelebrationFx.vue` (only the confetti
half ships, as **Celebration**), the peek/power-card overlays, and the countdown overlay.

## Content fundamentals

**Language is Vietnamese, always.** Sentence case, never ALL CAPS except the 11.5px
uppercase micro-labels above numbers (`ĐIỂM`, `LƯỢT`, `CẶP`, `CÒN LẠI`). Diacritics are
correct and non-negotiable.

**The product speaks to "bạn", and never says "tôi".** Copy is warm, second-person and
brief: *"Luyện trí nhớ, phá kỷ lục của chính bạn"*, *"Ván này sẽ không được lưu kết quả."*

**Step titles are questions.** The wizard asks one thing per screen: *"Bạn muốn chơi thế
nào?"*, *"Mấy người chơi?"*, *"Chọn chế độ"*, *"Kích thước lưới"*. Destructive dialogs are
questions too — *"Thoát ván đang chơi?"*, *"Đầu hàng?"*, *"Huỷ phòng?"* — answered by a
verb button (*Thoát ván*, *Huỷ phòng*) against a fixed escape hatch, *"Ở lại"*.

**Every option is a name plus a consequence.** Tile titles are 1–3 words; the `small`
below explains the rule in one clause: *"5 mạng — lật sai là mất mạng"*, *"Xong càng
nhanh, thưởng càng nhiều"*, *"2–4 người thay lượt trên cùng máy này"*.

**Emoji are load-bearing, not decoration.** They are the game's content (the cards
themselves are emoji), its status language (❤️ lives, ❄️ frozen, 🔒 locked, ⭐ score,
🏅 achievement, 🏆 win, 🎉 done, 😢 lost), its chat (a closed list of nine), and its
avatars (🦊 🐼 🐯 🐸). Use them the way the app does — as meaning, one per message,
leading the sentence: *"💥 Thẻ bom! Hai cặp đã mở bị úp lại."*

**Numbers carry the tone.** Results are stated flatly and specifically: *"Kỷ lục: 1180
điểm · 14 lượt · 0:52"*. Middots separate facts; en dashes join ranges (2–4 người);
grid sizes always use × (4×4, never 4x4) in UI text.

**Vibe:** an arcade that respects your time. Playful in colour and motion, plain in
words. No marketing voice, no exclamation-mark inflation (one per moment of victory),
no jokes at the player's expense.

## Visual foundations

**Colour.** A violet core (`#6a5cff`) with magenta (`#c44cf0`) and cyan (`#38bdf8`).
Semantics: emerald `#0ea371` for matched, amber `#ea8c00` for warnings and peek, gold
`#d99e00` for stars and x2 combos, red `#e5484d` for wrong and destructive. Full light and
dark palettes ship; dark is a real mode (`[data-theme='dark']`), not an inversion — it
lightens the accent to `#8b7dff` and deepens the shadows.

**"Arcade neon" is the committed direction** (documented in the repo's own CLAUDE.md).
Identity choices — what to play, which mode, how many players — are tiles with a
*permanent* colour gradient and white text. Configuration choices — grid size, theme —
are dark tiles that burst violet when selected. Mode colours are fixed for the whole
product: Chiến dịch violet · Cổ điển blue · Đua thời gian amber · Sinh tồn red ·
Chớp nhoáng teal; solo violet / local pink / online cyan.

**Type.** Two Google fonts, both loaded from Google Fonts (no local binaries exist
upstream): **Baloo 2** 600/700/800 for headings, buttons and *every number*; **Nunito**
400–800 for body. Six sizes only: 11.5 / 13 / 15.5 / 18 / 22 / 28px. Numbers are
`font-variant-numeric: tabular-nums` so HUD values don't jitter.

**Background.** Never an image. Three fixed radial brand glows over a flat tint, at
88%/-10%, -12%/104% and 55%/118% — a violet, a cyan and a magenta wash. `background-attachment: fixed`, so it doesn't move with content.

**Surfaces and glass.** Everything sits on `.panel`: 86% white (88% dark), 14px backdrop
blur, 1px hairline `--line`, 18px radius, 20px padding, a two-layer shadow and a light
inner top edge. Cards are 12px radius; tiles 14px; chips and pills 999px. Transparency
and blur appear only on panels, dialogs, the turn banner and the countdown — never on text.

**Borders.** 1px hairlines on panels and the top bar; **2px** on anything selectable
(tiles, chips, lobby rows, campaign nodes) so the selected state can recolour the border
without shifting layout. Dashed 2px marks an empty slot ("Còn 1 chỗ trống").

**Shadows.** Three neutral elevations (`--elev-1/2/3`) plus a *coloured* glow for anything
brand-primary: `0 8px 22px var(--card-back-glow)`. Selected tiles get
`0 8px 26px rgba(106,92,255,.5)` and an inset white top highlight. Emphasis inside
elements is `inset 0 0 0 2px` rings — emerald on a matched card, white on a diamond back.

**Motion.** Springy and short. Deal-in 380ms `cubic-bezier(.2,.9,.3,1.2)` staggered 28ms
per card; flip 340ms `cubic-bezier(.3,.8,.4,1.1)` on rotateY; match pop to 1.14; wrong-pair
shake 320ms; dialogs enter at 300ms from `translateY(18px) scale(.94)`; stars pop in one
at a time 350ms apart. Fades alone are rare — nearly everything also scales or lifts.
`prefers-reduced-motion` collapses all of it to 0.01ms.

**Hover, press, focus.** Hover only inside `@media (hover: hover)` — touch devices keep
stale hover, which would light two tiles at once. Hover lifts 1–2px and recolours the
border to accent (primary buttons brighten 7%); press returns to `translateY(0)` and drops
the shadow; disabled is opacity .45 with no transform. Focus is a 3px accent outline at
2px offset. **Selection state never transitions colour** — only transform and shadow are
animated, so a tap reads as instant.

**Layout.** Column shell locked to `100dvh`; a max-width 760px content column; the current
step is `flex:1; min-height:0` with `grid-auto-rows: minmax(0,1fr); overflow:hidden`.
Option grids must come out even (12 grids and 12 themes both run 3×4 mobile / 4×3
desktop). The board caps its own width from viewport height and grid aspect so it never
scrolls. Minimum touch target 44px everywhere (50px for the primary CTA); the emoji chat
pills at 40px are the single exception.

**Imagery.** There is none — no photography, no illustration. The only art in the product
is the three card backs (`assets/card-backs/`): flat white-on-violet SVG motifs (stars,
diamond lattice, aurora) over deep violet gradients, with a hover shine sweep. Cards on a
board must all share one back; mixing them would mark the deck.

## Iconography

- **Lucide** is the icon set (`lucide-vue-next` in the app). Used at 12–40px, default
  stroke, always monochrome via `currentColor` — accent on light tiles, white on neon
  tiles. Icons seen upstream: `map` `brain` `timer` `heart` `eye` `user` `users` `globe`
  `chevron-left` `x` `sun` `moon` `volume-2` `volume-x` `check` `copy` `crown` `hash`
  `sparkles` `settings-2`.
- No icon binaries exist in the repo, so this system links Lucide from a CDN
  (`lucide-static@0.454.0`) through the **Icon** component, which masks the SVG with
  `currentColor`. **Flagged substitution:** same icon set and version family as upstream,
  but served from the CDN rather than bundled.
- **No icon font, no sprite sheet, no PNG icons.** Nothing beyond Lucide plus emoji.
- **Emoji do the work icons usually would**: state (❤️ ❄️ 🔒 ⭐ 🏅 🏆 🎉 😢 💔),
  card powers (💥 ✖️ 👁️ ❄️), avatars (🦊 🐼 🐯 🐸), chat (👍 😂 😡 😮 😭 🔥 🎉 🤔 💩),
  the brand mark (🃏), and all card faces.
- **Unicode as glyphs**: ★ / ☆ for campaign stars, · as the separator between facts,
  × in grid labels, ✓ in "✓ sẵn sàng", • as the room-code placeholder.

## Caveats

- Fonts come from Google Fonts; there are no font binaries to ship.
- Timed modes, special cards, sound and persistence are documented but not implemented in
  the UI kit — it is a visual/interaction recreation, not the game.
