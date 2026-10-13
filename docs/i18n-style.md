# Flip Match — localization style guide

Game: "Flip Match", a casual memory card-matching game (flip two cards, find pairs). Audience: families, kids, casual mobile players. Tone: friendly, playful, concise — like a polished App Store game (Nintendo / King / Supercell quality). Never literal machine translation.

Source of truth for MEANING: `apps/web/src/locales/vi.ts` (Vietnamese original).
Source of truth for TERMINOLOGY & TONE: `apps/web/src/locales/en.ts` (just professionally revised — read it fully first).

## Glossary (concept → English term; use ONE consistent native term per concept everywhere)
- bàn (the grid of cards) → "board" (NOT "table"). "{n}-card board". Board size = number of cards.
- tuỳ chọn bàn chơi → "Game Options" (Time, Lives, Preview, Shuffle, Special Cards)
- đấu máy → "Vs Computer" (mode name). The AI opponent = "the computer"/"opponent".
- Bot names (proper nouns, keep playful, consistent everywhere incl. achievements): Wobbly Chick · Tough Chick · Black Panther · Fierce Tiger · Divine Dragon. No "bot" suffix.
- Chơi nhanh → "Quick Play"; Chiến dịch → "Campaign"; Chơi online → "Play Online"; phòng chờ → "Lobby"; chủ phòng → "host"
- danh hiệu → "Achievements" (never "titles"); kỷ lục → "record"/"best"; chuỗi → "streak"; lượt → "moves" (count) / "turn" (whose turn)
- mạng → "lives"; đóng băng → "Freeze/frozen, skips a turn"; tráo đổi → "Swap"; bom → "Bomb"; nhân đôi → "Double"
- đầu hàng → "Forfeit"; Chơi lại → "Play Again"/"Rematch"

## Rules
1. Use the platform-native, idiomatic UI wording for each language (what a top mobile game localized into that language would say). Prefer established gaming terms in that language.
2. Capitalization follows the TARGET language's UI convention (English uses Title Case for buttons/headings — do NOT copy that into languages that don't use it: es/pt/fr/id use sentence case; de capitalizes nouns only; ru sentence case).
3. Keep it SHORT. Buttons must fit a 375px-wide phone (iPhone SE). If the native phrase is long, choose a shorter natural synonym. Never longer than needed.
4. Consistency: same concept → same word in every key. Achievement names should read as catchy titles.
5. Address the player informally where natural for casual games (tú in es, tu in fr? → use "tu" for fr casual games is fine; de "du"; pt "você"; ru "ты" is OK for casual games but pick one and be consistent; ja/ko/zh/th/id: natural casual-polite game register).
6. Preserve EXACTLY: keys, `{placeholders}` (same names), emoji, `|` in 'fx.gameOver', leading/trailing spaces in split-sentence keys (lc.*, tk.loiIch*, cd.daDat etc. are concatenated fragments — read neighbors so the joined sentence is grammatical), function-valued entries (plural functions — keep signature `(p) => ...`, adapt plural rules to the language; ru needs proper one/few/many).
7. Bot taunts (fx.treu.*, menu.bot.*) are deliberately playful exaggeration — keep the humor, localize the joke.
8. Do not translate "Flip Match" (brand). Keep 'tb.thuongHieu' and 'chung.tieuDeTrang' brand name as "Flip Match".
9. Cognates allowed by tests are listed in `apps/web/test/i18n-man-hinh.test.ts` (`DONG_NGUYEN`). Do NOT edit that file. If a visible phrase becomes IDENTICAL to English and is a legit loanword, list it in your final report (I will add it); otherwise reword.
10. Do not change any file except your own locale file .
