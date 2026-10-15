# Trang công khai — giới thiệu, có gì mới, hỗ trợ, quyền riêng tư

Bốn trang tĩnh **nằm trong chính app** (không phải subpath của `cozypi.com`) để app tách
ra mang đi được nguyên vẹn. Phục vụ ở tên miền chơi: `https://flipmatch.cozypi.com`.
Xem bức tranh chung ở [`docs/ban-do.md`](ban-do.md).

| Trang | Tiếng Anh | Ngôn ngữ khác | Khai ở đâu |
|---|---|---|---|
| Giới thiệu | `/about.html` | `/<mã>/about.html` | store: Marketing URL · thẻ Flip Match trên `cozypi.com` |
| Có gì mới | `/changes.html` | `/<mã>/changes.html` | — |
| Hỗ trợ | `/support.html` | `/<mã>/support.html` | store: Support URL (App Store bắt buộc) |
| Quyền riêng tư | `/privacy.html` | `/<mã>/privacy.html` | store: Privacy Policy URL · App Privacy / Data safety |

Bản Cloudflare (`thebai2`) tự rút gọn link thành `/about`, `/vi/about`… — link `.html` vẫn vào được.

## Cách dựng

```
apps/web/public/{about,changes,support,privacy}.html   ← KHUÔN, chữ tiếng Anh
apps/web/public/site/site.css · site.js · img/          ← dùng chung, phát lên mạng
apps/web/site-i18n/<mã>.json                            ← 14 bản dịch, CHỈ dùng lúc build
tools/dung-trang-cong-khai.mjs                          ← chạy trong `pnpm build` (sau vite build)
```

`dung-trang-cong-khai.mjs` đọc danh sách ngôn ngữ từ `NGON_NGU` (app) rồi với mỗi trang ×
mỗi ngôn ngữ: thay chữ theo `data-t` (chữ thường), `data-th` (chữ có HTML), `data-t-alt`
(alt ảnh); đặt `<html lang>`, `<title>`, mô tả; gắn `canonical`, `hreflang` của đủ 15
ngôn ngữ + `x-default`, thẻ Open Graph; trang giới thiệu có thêm dữ liệu có cấu trúc
schema.org `SoftwareApplication`. Ghi `dist/sitemap.xml` (kèm alternates) và `dist/robots.txt`.
**Build đỏ** khi một bản dịch thiếu khoá, hoặc số chỗ thay được lệch số chỗ có khoá.

`site.js` lúc chạy KHÔNG đổi chữ — chỉ: menu ngôn ngữ (chuyển sang địa chỉ của ngôn ngữ
đó, ghi `mm.lang` dùng chung với game), tự chuyển ngôn ngữ ở **bản tiếng Anh** khi người
xem đã chọn/trình duyệt nói tiếng khác (máy của Google dùng tiếng Anh → không bị chuyển),
năm ở chân trang, và **nút store** (`STORE.ios.on` / `STORE.android.on` — bật khi app lên
store công khai; đang tắt thì nút hiện "Sắp ra mắt").

## Luật

- **Email luôn bọc `<!--email_off-->…<!--/email_off-->`**: Cloudflare Email Obfuscation đổi
  email thành "[email protected]" với ai không chạy JavaScript (người duyệt store đã thấy vậy).
- **Link giữa các trang để TƯƠNG ĐỐI** (`changes.html`, `site/…`); bản ngôn ngữ ở thư mục
  con được công cụ đổi thành `../site/…`. Nút "Chơi" (`href="/"`) thành `/?lang=<mã>`.
- Ảnh: `.webp`, khung máy + thanh trạng thái vẽ bằng CSS/SVG (`site/img/iphone-status-den.svg` (nền sáng) / `-trang.svg` (nền tối), `ipad-status.svg` — tai thỏ luôn ĐEN — tỷ lệ máy thật: vùng an toàn trên iPhone 59/430 ≈ 13,6% bề ngang);
  ảnh có thuộc tính `width/height` để không nhảy trang — CSS phải có `height: auto`.
- Service worker của game KHÔNG precache và KHÔNG chặn các trang này
  (`globIgnores`, `navigateFallbackDenylist` trong `apps/web/vite.config.ts`).
- **CSS/JS mang mã phiên bản theo nội dung** (`site.css?v=<8 ký tự>`, gắn lúc build): Cloudflare
  của `cozypi.com` ép trình duyệt giữ file tĩnh 4 TIẾNG (Browser Cache TTL), nên sửa CSS mà
  không đổi đường dẫn là người xem thấy HTML mới + CSS cũ. Ảnh mới thì đặt TÊN mới.
- Cache: HTML `no-cache`; `/site/*` 5 phút — luật ở CẢ `apps/node-server/src/index.ts`
  (`cacheControl`) lẫn `apps/web/public/_headers` (`headers.test.ts` canh hai bên khớp).
- Không trang nào được cuộn ngang ở iPhone SE/14/Pro Max, mọi ngôn ngữ — đo bằng giả lập
  thiết bị (CDP), không bằng ảnh chụp cửa sổ headless (Chrome headless không cho cửa sổ
  hẹp dưới ~500px, ảnh cụt giả). Tiêu đề có từ dài (tiếng Nga, Đức) phải được ngắt
  (`hyphens: auto`).

## Thêm một mục vào "Có gì mới"

1. `apps/web/public/changes.html`: thêm một khối `<div class="rel">` lên **đầu** danh sách
   (nhãn `tag web` "Update" cho gói web/OTA, `tag app` "App" + "Version x.y.z" cho bản store),
   khoá mới dạng `r<N>.h`, `r<N>.d`, `r<N>.l`.
2. Thêm 3 khoá đó vào **14** file `apps/web/site-i18n/*.json` (`site-i18n.test.ts` đỏ nếu thiếu).
3. Viết cho NGƯỜI CHƠI đọc (lợi ích họ thấy), không phải log commit.

## Đổi nội dung quyền riêng tư

Là văn bản pháp lý: chủ dự án duyệt trước. Đổi xong phải đổi ngày "Last updated" (khoá
`pv.meta`, 15 ngôn ngữ) và kiểm lại App Privacy (Apple) / Data safety (Google) trong
`docs/store-listing.md`. Đổi dữ liệu thu thập (bảng `users`, thứ gửi lên server) là phải
sửa trang này.

## Google Search Console (ĐÃ BẬT 15.10.2026, làm hoàn toàn bằng API)

Thuộc tính **miền** `sc-domain:cozypi.com` — phủ mọi tên miền con (`flipmatch.cozypi.com`,
`cozypi.com` và app sau này). Đã nộp `https://flipmatch.cozypi.com/sitemap.xml` (61 địa
chỉ) và `https://cozypi.com/sitemap.xml` (15). Chủ sở hữu: tài khoản dịch vụ
`play-ci@lat-the-nkien…` (project CÁ NHÂN `lat-the-nkien`) + Gmail cá nhân của chủ dự án
(secret `SEARCH_CONSOLE_OWNER`) — xem được trên giao diện Search Console như thường.

```bash
gh workflow run search-console.yml -f buoc=trang-thai   # thuộc tính + sitemap đã đọc bao nhiêu, lỗi
gh workflow run search-console.yml -f buoc=xac-minh     # nộp lại sitemap (sau khi thêm vào SITEMAPS)
```

Công cụ: `tools/search-console.mjs` (Site Verification API + Search Console API, khoá ở
secret `PLAY_SERVICE_ACCOUNT_JSON`). Bản ghi TXT `google-site-verification=…` nằm ở DNS
`cozypi.com` (Cloudflare) — **đừng xoá**, mất là mất quyền sở hữu. Thêm app mới: thêm
sitemap của nó vào `SITEMAPS` trong công cụ rồi chạy `xac-minh`. Repo công khai: nhật ký
Actions ai cũng xem được — không in khoá/email.

Kiểm SEO sau mỗi lần đổi trang: `curl` một bản dịch, xem `<html lang>`, `<title>`,
`canonical`, đủ 16 dòng `hreflang`, chữ thân trang đúng ngôn ngữ.
