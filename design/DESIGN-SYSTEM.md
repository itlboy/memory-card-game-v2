# Memory Match — Design System (trích xuất từ hiện trạng)

> Nguồn code: `apps/web/src/styles/tokens.css` (token) + `global.css` (utilities).
> Hướng đã chốt: **C · Arcade neon**. Sửa file này trước → đồng bộ ngược vào code sau.

---

## 1. Danh sách màn cần thiết kế

> **Mỗi màn thiết kế 2 bản: Mobile (khung 390×844) và Desktop (khung 1440×900).**
> Khác biệt chính giữa 2 bản hiện tại:
>
> | | Mobile | Desktop |
> |---|--------|---------|
> | Breakpoint | < 700px | ≥ 700px |
> | Panel | full màn hình (100dvh, không scroll) | căn giữa, cố định 820px cao (khi viewport ≥ 900px cao), max-width 760px |
> | Nút option | cao 92px, nằm ngang (icon trái) | cao 170px, xếp dọc (icon trên) |
> | Lưới cỡ bàn / theme | 3 cột × 4 hàng | 4 cột × 3 hàng |
> | Lưới chế độ | 1 cột | 2 cột (ô đầu wide full hàng) |
> | Hover | KHÔNG có (chỉ `@media (hover:hover)`) | translateY + shadow |
> | Bàn phím mã phòng | bàn phím số hệ thống (`inputmode=numeric`) | gõ thường |

### Màn định danh (ô gradient màu riêng luôn bật, chữ trắng)
| # | Màn | URL state | Ghi chú |
|---|-----|-----------|---------|
| 1 | Trang chủ — chọn cách chơi | `/` | Chiến dịch / Chơi nhanh / Online |
| 2 | Chọn số người | `?w=players` | Solo tím · Local hồng · Online cyan |
| 3 | Chọn chế độ | `?w=mode` | 5 chế độ, mỗi ô một màu cố định |
| 4 | Online entry | `?online=1` | Tạo phòng / Vào phòng (2 ô lớn) |

### Màn cấu hình (ô nền tối, ô được chọn bùng gradient tím + glow)
| # | Màn | URL state | Ghi chú |
|---|-----|-----------|---------|
| 5 | Chọn kích thước bàn | `?w=grid` | 12 cỡ (2x2→8x8), lưới 3×4 mobile / 4×3 desktop, preview chấm đúng hình bàn |
| 6 | Chọn theme | `?w=theme` | 12 theme (6 free / 6 khoá điểm), chọn nhiều, lưới 3×4 / 4×3 |
| 7 | Bản đồ Chiến dịch | `?w=campaign` | Lưới level + sao đạt được |
| 8 | Wizard tạo phòng online | `?room=…` | mode → grid → theme (tái dùng màn 3/5/6) |
| 9 | Nhập tên / mã phòng | `?online=1` | Input 6 số, bàn phím số mobile |

### Màn trạng thái
| # | Màn | Ghi chú |
|---|-----|---------|
| 10 | Lobby phòng online | Danh sách người chơi + Sẵn sàng, summary cấu hình 1 dòng + ⚙️ Chỉnh |
| 11 | Màn chơi (GameScreen) | Bàn bài + HudBar + PlayerStrip + chat emoji + đồng hồ lượt |
| 12 | Overlay đếm ngược 5s | Báo người đi đầu |
| 13 | Banner khán giả | Vào phòng đã bắt đầu |

### Overlay / dialog
| # | Thành phần | Ghi chú |
|---|-----------|---------|
| 14 | ResultDialog | Sao / thống kê / xếp hạng / thành tích; panel bán trong suốt `color-mix(78%)+blur(10px)`, backdrop .3 |
| 15 | CelebrationFx | Pháo hoa 8 bursts + confetti, 5s trước khi popup vào |
| 16 | ConfirmDialog | Thoát ván / đầu hàng / huỷ phòng |
| 17 | TopBar | Logo (về home) · dark · sound · tổng điểm |

---

## 2. Typography

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--font-display` | 'Baloo 2', 'Nunito', system-ui | h1–h3, nút, tiêu đề section |
| `--font-body` | 'Nunito', system-ui | body (400 16px/1.5) |
| `--text-xs` | 11.5px | chú thích nhỏ |
| `--text-sm` | 13px | section-title (uppercase, ls .09em, 700) |
| `--text-md` | 15.5px | |
| `--text-lg` | 18px | nút primary |
| `--text-xl` | 22px | |
| `--text-2xl` | 28px | |

Mặt trước lá bài: `font-size: max(20px, 55cqw)` (container query theo cỡ thẻ).

## 3. Spacing / Radius

| Spacing (base 4px) | Radius |
|---|---|
| `--sp-1..6` = 4 / 8 / 12 / 16 / 20 / 24px | `--r-sm` 10px · `--r-md` 14px · `--r-lg` 18px (= `--radius`) · `--r-full` 999px |

## 4. Màu

### Brand ramp
| Token | Giá trị |
|-------|---------|
| `--brand-300` | `#a99cff` |
| `--brand-500` | `#6a5cff` (= `--accent` light) |
| `--brand-600` | `#5947e8` |
| `--pink-500` | `#c44cf0` (= `--accent-2` light) |
| `--cyan-400` | `#38bdf8` |

### Semantic — Light / Dark
| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#edeffa` | `#0c0e1c` |
| `--panel` | `rgba(255,255,255,.86)` | `rgba(24,27,48,.88)` |
| `--panel-solid` | `#ffffff` | `#181b30` |
| `--panel-soft` | `#f5f6ff` | `#1e2240` |
| `--fg` | `#1c1f36` | `#eef0fc` |
| `--muted` | `#63698c` | `#9ba3cd` |
| `--accent` | `#6a5cff` | `#8b7dff` |
| `--accent-2` | `#c44cf0` | `#cf6bfa` |
| `--accent-soft` | `rgba(106,92,255,.13)` | `rgba(139,125,255,.17)` |
| `--ok` | `#0ea371` | `#2dd48f` |
| `--warn` | `#ea8c00` | `#fbaa2c` |
| `--gold` | `#d99e00` | `#f7c948` |
| `--bad` | `#e5484d` | `#f2555a` |
| `--line` | `rgba(96,92,168,.17)` | `rgba(148,152,220,.16)` |
| `--line-strong` | `rgba(96,92,168,.3)` | `rgba(148,152,220,.32)` |
| `--card-face` | `#ffffff` | `#232849` |
| `--card-back` | gradient 150deg `#6a5cff→#8b5cf6→#c44cf0` | `#5246d6→#7440dd→#a437e8` |

Nền body: 3 quầng radial-gradient (`--bg-glow-1/2/3`) trên `--bg`, `background-attachment: fixed`.

### Gradient neon (`.g-*`, dùng `!important` để thắng scoped styles)
| Class | Gradient 150deg | Glow | Gán cho |
|-------|-----------------|------|---------|
| `g-violet` | `#6a5cff → #8b5cf6` | `rgba(106,92,255,.45)` | Chiến dịch · Solo |
| `g-pink` | `#c44cf0 → #ff5fa2` | `rgba(196,76,240,.45)` | Local multiplayer |
| `g-cyan` | `#2fb6f0 → #38e0c8` | `rgba(56,189,248,.45)` | Online |
| `g-blue` | `#4c7dff → #5fb0ff` | `rgba(76,125,255,.45)` | Cổ điển |
| `g-amber` | `#f59e0b → #ff7b45` | `rgba(245,158,11,.45)` | Đua thời gian |
| `g-red` | `#ef4458 → #ff5fa2` | `rgba(239,68,88,.45)` | Sinh tồn |
| `g-teal` | `#14b8a6 → #38e0c8` | `rgba(20,184,166,.45)` | Chớp nhoáng |

Mọi `.g-*` có `inset 0 1px 0 rgba(255,255,255,.3)` + `box-shadow 0 10px 30px <glow>`.

## 5. Elevation

| Token | Light | Dark |
|-------|-------|------|
| `--elev-1` (= `--shadow-soft`) | 2 lớp rgba(30,27,75) .09/.08 | rgba(0,0,0) .4/.3 |
| `--elev-2` (= `--shadow`) | .1/.14 | .45/.4 |
| `--elev-3` | .14/.2 | .5/.55 |
| `--inner-light` | `inset 0 1px 0 rgba(255,255,255,.65)` | `…,.07` |

## 6. Components hiện có

| Component | Giá trị chốt |
|-----------|--------------|
| `.panel` | bg `--panel` + blur 14px, border `--line`, radius `--r-lg`, padding `--sp-5`, shadow `--elev-2` + inner-light |
| `.btn` | min 44×44px, radius `--r-md`, bg `--panel-solid`; hover: translateY(-1px) (chỉ `@media (hover:hover)`) |
| `.btn-primary` | min-height 50px, full-width, gradient `accent→accent-2`, chữ trắng display 700 |
| `.chip` | min-height 44px, border 2px; selected: border accent + bg accent-soft + inset ring |
| `.option` (wizard) | **cao 92px mobile / 170px desktop** (cố định, không ôm nội dung); selected không-neon: bùng gradient tím + glow; selected neon: outline trắng 3px offset -3px |
| Focus ring | `outline 3px var(--accent), offset 2px` |

## 7. Layout / breakpoint

| Quy tắc | Giá trị |
|---------|---------|
| Viewport | `#app` khoá `100dvh`, **KHÔNG SCROLL mobile** — mọi màn trọn viewport |
| Panel màn cao | `@media (min-height: 900px)`: panel **cố định 820px**, căn giữa; màn chơi vẫn full |
| Content max-width | 760px |
| Breakpoint chính | 700px (mobile ↔ desktop cho lưới option) |
| Lưới lựa chọn | mobile 3 cột × 4 hàng, desktop 4×3 (grid tròn hàng, `grid-auto-rows: minmax(0,1fr); overflow: hidden`) |
| Touch tối thiểu | 44px (NF-07) |

## 8. Motion

| Quy tắc | Giá trị |
|---------|---------|
| Transition chuẩn | `.15s ease` — CHỈ transform / shadow / border-color, **không transition màu** (chọn đổi màu tức thì) |
| Hover | chỉ trong `@media (hover: hover)`; btn -1px, primary -2px + brightness 1.07 |
| Chuyển màn | fade + translateY(10px) scale(.99), .22s |
| Ăn mừng thắng | CelebrationFx 5s (pháo hoa + vỗ tay) → rồi mới hiện ResultDialog |
| Reduced motion | `prefers-reduced-motion` tắt gần hết animation/transition |

## 9. Mặt sau lá bài

3 kiểu random mỗi ván (SVG data-URI trong `CardTile.vue`): `bk-stars` · `bk-diamond` · `bk-aurora`. Cả bàn PHẢI dùng chung một kiểu (khác nhau = đánh dấu bài).

---

## 10. Chỗ trống / cần quyết định khi làm design system mới

- [ ] Lobby online + Bản đồ chiến dịch mới chỉnh nhẹ, chưa "neon hoá" đầy đủ
- [ ] Chưa có ramp màu đủ bậc (chỉ brand-300/500/600) — có cần 50→900?
- [ ] Icon: đang dùng Lucide — chốt cỡ chuẩn (hiện tuỳ nơi)
- [ ] Type scale đang px lẻ (11.5/13/15.5) — có muốn chuẩn hoá?
- [ ] Trạng thái lỗi / loading / empty chưa có mẫu chung
