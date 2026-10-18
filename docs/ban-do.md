# Bản đồ — nguồn sự thật và mọi chỗ nhắc lại

Điểm vào chung của tài liệu Flip Match (Lật Thẻ). Mục đích: **đổi một thứ ở một chỗ,
biết ngay phải đổi theo ở đâu** — code, app, trang công khai, trang store, tài liệu.

Luật dùng file này:

1. Mỗi "sự thật" (con số, tên, địa chỉ) có **một nguồn gốc** — thường là hằng số trong
   code. Chỗ khác chỉ được *nhắc lại*.
2. Đổi sự thật → sửa nguồn gốc → đi hết cột "Nhắc lại ở" → chạy kiểm tra ở cột cuối.
3. Thêm một chỗ mới nhắc lại sự thật → **thêm nó vào bảng này** trong cùng commit.
4. Chỗ nào đọc thẳng hằng số (`{n}` trong từ điển, `CAMPAIGN_LEVELS`…) thì tự đúng,
   không cần sửa tay — bảng ghi "(tự)".

Viết tắt: `site-i18n` = `apps/web/site-i18n/<mã>.json` (14 file bản dịch trang công khai);
`trang` = `apps/web/public/{about,changes,support,privacy}.html` (bản tiếng Anh, cũng là
khuôn dựng các ngôn ngữ khác); `store` = `docs/store-listing.md` (15 mục ngôn ngữ).

## Sự thật về game

| Sự thật | Nguồn gốc | Nhắc lại ở | Kiểm tra |
|---|---|---|---|
| **60 màn Chiến dịch**, 12 cỡ bàn × 5 lần | `CAMPAIGN_REPEAT`, `BOARDS` — `packages/engine/src/campaign.ts` | trang `about.lead`, `f1.p`, `about.desc`, `changes` (r4) · site-i18n cùng khoá · store (mô tả) · app: `menu.chienDichMo`, `lc.chienDichB` (tự) · CLAUDE.md mục Chiến dịch | `campaign.test.ts` |
| **12 cỡ bàn, 4 → 88 thẻ** | `BOARDS` (campaign.ts) | trang `f1.p`, `g5` · site-i18n · store | `campaign.test.ts`, `board-fit.test.ts` |
| **Sao = số lần quên**, mốc theo cỡ bàn, **sao thứ 4** = không quên | `sao` trong `BOARDS`, `starsByMisses`, `summary.hoanHao` | trang `f1.p`, `q4/a4`, r4 · site-i18n · store · RulesDialog (`lc.chienDich` cả 15 từ điển) · CLAUDE.md | `quen.test.ts` |
| **Giờ Chiến dịch** = `gio` × 1,8…1,1 | `gio`, `HE_GIO` (campaign.ts) | CLAUDE.md | `campaign.test.ts` |
| **5 đối thủ máy** (Gà mờ → Rồng thần) | `BOT_SPECS` — `packages/engine/src/bot.ts` | trang `about.lead`, `f2.h/p`, `about.desc` · site-i18n · store · tên: `bot.*` 15 từ điển | `duel.test.ts` |
| **Online tối đa 4 người** (tạm, hạ từ 10 ngày 15.10.2026), mã phòng 6 số | `ROOM_LIMITS` — engine `online.ts` | trang `f3.p`, `a2` · site-i18n · store | smoke `tools/smoke-*.mjs` |
| **Chung máy tối đa 4 người** | wizard bước `count` (CLAUDE.md) | trang `f4.h/p` · site-i18n · store | `app.test.ts` |
| **48 bộ hình miễn phí** (72 tổng, 24 premium ẩn) | `apps/web/public/data/themes.json` (+ bản sao `apps/server/src/themes.ts`), `banPremium` | trang `f5.h/p`, `about.desc` · site-i18n · store · README | `themes.test.ts`, `emoji-vector` |
| **Hơn 100 danh hiệu** (đang hiện 129, tổng 153) | `ACHIEVEMENTS` / `dsHien` — `apps/web/src/lib/achievements.ts` | trang `f6.p` · site-i18n · store ("100+") · README · CLAUDE.md (con số chính xác) | `achievements.test.ts` |
| **15 ngôn ngữ** | `NGON_NGU` — `apps/web/src/lib/i18n.ts` | xem **docs/ngon-ngu.md** (14 chỗ) · trang `about.b5`, `a5`, `about.desc` · store · README | `i18n*.test.ts`, `site-i18n.test.ts`, `pnpm do:ngon-ngu` |
| **3 skin miễn phí** (Kẹo · Neon · Gỗ) + 2 premium (Đêm Sao · Kẹo Bông, dùng font Kẹo) | `lib/skin.ts`, `styles/skins/*.css`, `banPremium` | trang r2 (lịch sử) · `tb.skin.*` 15 từ điển · CLAUDE.md mục SKIN | `skin.test.ts`, `tuong-phan.test.ts`, `pnpm do:tuong-phan`, `pnpm do:safari` |
| **12 câu nói nhanh**, không chat tự do | `QUICK_SAYS` (engine) | trang `f3.p`, privacy `pv.s2b` · site-i18n · store · privacy (Messaging = Yes) | `smoke-noi-nhanh.mjs` |
| **Miễn phí, không quảng cáo, 4+** | quyết định chủ dự án (CLAUDE.md "APP LÀ 4+") | trang `about.b1`, `about.b4`, `q1/a1` · site-i18n · store (Price, Age rating) | — |
| **Có Google Analytics 4** (từ 15.10.2026; KHÔNG còn hứa "không theo dõi") — tắt Google Signals + quảng cáo, châu Âu không cookie, không hộp hỏi đồng ý | `GA_ID` ở `apps/web/src/lib/phan-tich.ts` (game web + app), `site.js` (trang công khai), `cozypi-site/src/index.html` — cùng mã `G-MZ4MDWZRH3` (tài khoản GA "Cozy Pi") | privacy `pv.intro` + `pv.s4` (mục Google Analytics) · trang `about.b2` "Privacy first" · studio `p2.*`, `hero.lead`, `meta.desc` · store (mô tả bỏ "No tracking"; App Privacy / Data safety phải khai Usage Data) | sự kiện game: `van_bat_dau`, `van_ket_thuc` |

## Sự thật về sản phẩm, địa chỉ, tài khoản

| Sự thật | Nguồn gốc | Nhắc lại ở |
|---|---|---|
| **Tên app**: Flip Match (en) / Lật Thẻ (vi) | `tb.thuongHieu` + `chung.tieuDeTrang` (từ điển) | iOS `ios/App/App/*.lproj/InfoPlist.strings` · trang (`brand` chỉ ở vi) · store (Name) · `index.html` og (tĩnh, tiếng Việt) |
| **Email hỗ trợ** `support@cozypi.com` | Cloudflare Email Routing (catch-all → Gmail) | trang (bọc `<!--email_off-->`) · privacy · store (App Review contact) · repo `itlboy/cozypi-site` |
| **Tên miền** — xem bảng **TÊN MIỀN** ngay dưới | `deploy/k8s/thebai.yaml`, Cloudflare Workers Routes | `tools/dung-trang-cong-khai.mjs` (`SITE`) · `apps/web/src/lib/native.ts` (`SITE_URL`, `SERVER_URL`) · `apps/web/package.json` (`build:*`) · `tools/dong-goi-ota.mjs` · store URLs · CLAUDE.md |
| **Trang công khai** `/about.html` `/changes.html` `/support.html` `/privacy.html` (+ `/<mã>/…`) | `apps/web/public/*.html` | store (Marketing/Support/Privacy URL) · thẻ Flip Match ở `cozypi.com` · xem **docs/trang-cong-khai.md** |
| **App Store ID 6822105774**, bundle iOS `com.hello314.flipmatch` | App Store Connect | `site.js` `STORE.ios` · `tools/asc-*.mjs` · server `APPLE_BUNDLE_ID` |
| **Google Play** `com.cozypi.flipmatch` | Play Console | `site.js` `STORE.android` · `tools/play-store.mjs` · `android/app/build.gradle` |
| **Đã lên store công khai?** (bật nút store trên trang) | thực tế store | `site.js` → `STORE.*.on` (đang `false`) |
| **Phiên bản app** (1.3.0) | `apps/web/package.json` `version` | trang `changes.html` (r3) + site-i18n · `ota.json` `minNative` khi đổi native |
| **Cập nhật nóng (OTA)** — zip + tải chênh lệch (`/ota/manifest.json`, `<id>.files.json`, `f/<sha256><đuôi>`) | `tools/dong-goi-ota.mjs` (build) · `apps/web/src/lib/ota.ts` (app) | cache: `apps/node-server/src/index.ts` + `public/_headers` · Cloudflare bỏ `ota/` (`public/.assetsignore`) · CLAUDE.md mục CẬP NHẬT NÓNG · trạng thái ở trang Debug |
| **Chế độ debug** — bật: 7 chạm chữ "Cài đặt" (menu) / dòng phiên bản (Luật chơi) / `?debug=1` | `components/DebugDialog.vue` + `DebugMenu.vue`, nút ở `TopBar.vue` | CLAUDE.md (mọi chỗ "trang Debug") · test `debug-an.test.ts` |
| **Google Search Console** `sc-domain:cozypi.com` | TXT ở DNS `cozypi.com` + `tools/search-console.mjs` | `docs/trang-cong-khai.md` · sitemap của từng trang (`SITEMAPS`) |
| **Studio Cozy Pi** (`cozypi.com`) | repo riêng **`itlboy/cozypi-site`** | trang (chân trang) · store (Copyright "2026 Cozy Pi") |

## Ảnh chụp màn hình

| Ảnh | Cách tạo | Dùng ở |
|---|---|---|
| Ảnh store iPhone 6.9" | `node tools/chup-store.mjs <server> <thư mục> <mã>` | App Store, Google Play (bộ `KHUNG=android` riêng) |
| Ảnh store iPad 13" | `KHUNG=ipad node tools/chup-store.mjs …` (chờ 5 giây) | App Store (`<mã>-ipad/`) |
| Ảnh trang công khai | lấy từ bộ store tiếng Anh → HAI cỡ mỗi ảnh, `magick -resize 240x` và `464x` `-quality 72` → `public/site/img/<tên>-<đợt>-240.webp` / `-464.webp` (iPad: `ipad-*-<đợt>-300.webp` / `-600.webp`; đợt hiện tại `k3d` = giao diện Kẹo 3D 18.10.2026 — chụp lại là ĐỔI TÊN đợt, vì Cloudflare cozypi giữ ảnh cũ 4 giờ; nhớ sửa `about.html` + `tools/dung-trang-cong-khai.mjs`), gắn `srcset` + `sizes` — ảnh chỉ hiện rộng ≤232px (iPad ≤300px), cỡ lớn hơn là tải thừa | `about.html` (khung máy + thanh trạng thái `site/img/iphone-status-den.svg` (nền sáng) / `-trang.svg` (nền tối), `ipad-status.svg` — tai thỏ luôn ĐEN) |

Đổi giao diện lớn → chụp lại cả ba bộ. Màn có lớp phủ tối (màn thắng) cần màu dải
trạng thái riêng trong `site.css` (`img[src*="02-win"]`).

## Công cụ đo giao diện (chạy sau mỗi lần sửa UI)

| Lệnh | Engine | Bắt được gì |
|---|---|---|
| `pnpm do:safari [url]` | WebKit (Safari/iPhone) | viền/bóng bị khung cắt, nút lòi khỏi màn, trang cuộn — 3 cỡ iPhone × 5 skin × 9 màn |
| `pnpm do:tuong-phan [url]` | Chrome | chữ khó đọc (tương phản) — 5 skin × sáng/tối |
| `pnpm do:ngon-ngu` | Chrome | chữ tràn nút ở 15 ngôn ngữ trên iPhone SE |
| `pnpm do:menu` | Chrome | menu thả xuống bị đè, bảng kết quả, khung màn đang rời |
| `pnpm do:fx` | Chrome | cảnh kết ván tràn khỏi cột game trên máy tính |

Chrome hỗ trợ thứ Safari không có (`overflow-clip-margin`…) — chỉ đo Chrome là bỏ sót lỗi
iPhone. Lỗi lớp GPU (ô trắng khi thiếu bộ nhớ) thì không công cụ nào tái hiện: xem máy thật.

## Tài liệu chuyên đề

- **`CLAUDE.md`** — luật thiết kế/kiến trúc bắt buộc, quy trình deploy. Đọc mục "LÀM VIỆC NHANH" trước.
- **`docs/ngon-ngu.md`** — thêm/bớt/đổi một ngôn ngữ: đủ 14 chỗ phải đổi + kiểm tra.
- **`docs/trang-cong-khai.md`** — 4 trang công khai, dựng theo ngôn ngữ, SEO, Google Search Console, nhật ký phiên bản.
- **`docs/i18n-style.md`** — bảng thuật ngữ + văn phong dịch.
- **`docs/store-listing.md`** — chữ trang App Store / Google Play 15 ngôn ngữ (công cụ `tools/asc-store.mjs`, `tools/play-store.mjs` đọc thẳng file này).
- **`docs/mobile-ci.md`** — build + ký + phát hành app iOS/Android qua GitHub Actions.
- **`README.md`** — giới thiệu nhanh + nhật ký thay đổi kỹ thuật.


## TÊN MIỀN (tổng hợp 18.10.2026)

Mẫu cho MỌI game của studio: **`<game>.cozypi.com` = web** (Cloudflare Worker) · **`<game>-api.cozypi.com` = server game riêng** (k8s). DNS wildcard `*.cozypi.com` đã trỏ tunnel → k8s; thêm game mới chỉ cần thêm host vào Ingress.

| Tên miền | Vai | Ai phục vụ | Ai còn dùng | Số phận |
|---|---|---|---|---|
| `flipmatch.cozypi.com` | **WEB chính** + trang công khai + `/ota/*` | Worker `memory-card-game-v2` (route `/*`) | trình duyệt, link mời, app tải OTA (`SITE_URL`) | giữ mãi |
| `flipmatch-api.cozypi.com` | **SERVER GAME chính** (`/api`, `/ws`, `/health`; đường khác 404) | k8s `thebai-server` | web 3 tên dưới + app build mới + gói OTA từ 18.10 (`SERVER_URL`) | giữ mãi |
| `flipmatch.cozypi.com/api` `/ws` | server cũ trên tên web | route không-Worker → k8s | app/gói OTA trước 18.10 | gỡ khi không còn app cũ (theo dõi log) |
| `flipmatch.hello314.com` | web cũ (localStorage người chơi cũ) | Worker; `/api` `/ws` → k8s | người chơi cũ, app build ≤32 | giữ, KHÔNG redirect |
| `thebai.hello314.com` | web cũ hơn nữa | Worker; `/api` `/ws` → k8s | người chơi cũ, app trước 13.10 | giữ, KHÔNG redirect |
| ~~`thebai-server.hello314.com`~~ | host chỉ-API rất cũ | — | 0 lượt/24h | **ĐÃ GỠ 18.10.2026** (Ingress bỏ host → 404) |
| `thebai2.hello314.com` | dự phòng TOÀN BỘ (web + Durable Object) | Worker, server riêng của nó | chuyển tay khi k8s chết | giữ |
| `cozypi.com` | trang studio | repo `itlboy/cozypi-site` | — | giữ |

Không redirect tên cũ: localStorage (điểm, kỷ lục người chưa đăng nhập) gắn theo origin. Web chạy trên một trong ba tên web k8s thì gọi `flipmatch-api`; chạy nơi khác (thebai2, localhost) thì gọi chính origin.
