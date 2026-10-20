# SEO — web + store (ASO)

Nghiên cứu từ khoá 18.10.2026: đọc tên app đứng đầu từng thị trường (App Store / Google Play) +
kết quả tìm web. Chưa có công cụ đo lượng tìm — sau vài tuần lấy SỐ THẬT từ Search Console
(`gh workflow run search-console.yml -f buoc=luot-tim`) và chỉnh lại.

## Ba chỗ đặt từ khoá

| Chỗ | Nguồn | Ghi chú |
|---|---|---|
| Trang CHƠI theo ngôn ngữ `/` (vi) · `/<mã>/` | `game.title` / `game.desc` ở `apps/web/site-i18n/<mã>.json`; English ở `GAME_EN` trong `tools/dung-trang-cong-khai.mjs` | Dựng lúc build từ `dist/index.html` (cùng app, chỉ khác `<head>`): lang, title, mô tả, og, canonical, hreflang 15 thứ tiếng + x-default `/en/`, JSON-LD `VideoGame` + `WebSite`. App đọc ngôn ngữ từ đường dẫn (`duongChoi` ở `lib/i18n.ts`); lần đầu GIỮ tiêu đề trong HTML (Google đọc tiêu đề SAU khi JS chạy). |
| Trang công khai about/changes/support/privacy | `site-i18n` (xem `trang-cong-khai.md`) | Nút "Chơi" trỏ về trang chơi cùng ngôn ngữ. |
| Store | `docs/store-listing.md`: Name, Subtitle, Keywords (App Store) · **Play title** (khi khác Name) + Short description (Play) | `tools/asc-store.mjs` / `tools/play-store.mjs`. Soát độ dài: `python3 tools/dem-ky-tu-store.py`. |

## Từ chính mỗi thị trường (thứ người ta GÕ, không phải thứ mình gọi)

| Ngôn ngữ | Từ chính | Ghi chú |
|---|---|---|
| en | memory game, matching pairs, brain training | ít app có online với bạn → "online with friends" là điểm khác biệt |
| vi | game lật hình, lật hình giống nhau, trò chơi trí nhớ | "lật thẻ" ít người gõ — giữ làm TÊN, từ khoá là "lật hình" |
| es | juego de memoria, memorama (MX), memotest (AR) | |
| pt | jogo da memória | |
| fr | jeu de mémoire, (memory) | |
| de | Paare finden, Gedächtnisspiel, Memo | |
| ja | 神経衰弱, 脳トレ, 対戦 | |
| ko | 같은 그림 찾기, 짝맞추기 | |
| zh / zh-TW | 记忆翻牌, 找相同, 翻翻乐 / 記憶翻牌, 找相同 | KHÔNG 连连看/对对碰 — game khác |
| ru | Мемори, найди пару, игра на память | |
| id | game memori, cocokkan gambar, asah otak | KHÔNG "tebak gambar" — thể loại khác |
| th | เกมจับคู่ภาพ, เกมความจำ, เปิดไพ่ | |
| it | gioco di memoria, trova le coppie | |
| tr | hafıza oyunu, eşini bul, eşleştirme | |

## Luật

- **"Memory" là nhãn hiệu Ravensburger** (DE, FR, IT…): KHÔNG đưa vào Name/Subtitle/Keywords/tiêu đề
  web các nước đó — dùng "Memo", "mémoire", "memoria". Tiếng Anh "memory game" là từ mô tả, dùng được.
- Không tên app đối thủ, không hứa điều không có (sức khoẻ, chữa sa sút trí tuệ…). App 4+.
- Keywords App Store: phẩy không cách, KHÔNG lặp từ đã có ở Name/Subtitle (Apple ghép ba trường).
- Đổi Name/Subtitle/Keywords bên Apple cần một phiên bản ở trạng thái sửa được; Promotional text
  và cả trang Play thì sửa lúc nào cũng được.

## Tốc độ (Lighthouse mobile, 4G giả lập — Google xếp hạng theo đó)

Đo 18.10.2026, trang chơi `/en/`: **63 → 91 điểm**, chữ đầu tiên 5,0 → 2,6 giây, 1,8MB → 0,66MB.
Đo lại: `CHROME_PATH=<chromium của Playwright> npx lighthouse@12.8.2 <url> --form-factor=mobile`
(API PageSpeed ẩn danh hay hết hạn mức). Bốn thứ đã làm, đừng làm ngược lại:
- Từ điển 14 ngôn ngữ là chunk riêng (`napTuDien`), trang `/<mã>/` có `modulepreload` đúng chunk.
- Hình ô theme (~270 ảnh) tải trước từ LẦN CHẠM ĐẦU, không lúc mở trang (`taiTruocTheme`).
- `preconnect` tới `flipmatch-api.cozypi.com`.
- Trang công khai: địa chỉ chuẩn KHÔNG `.html` (Cloudflare 307 `.html` → không đuôi); font Google không chặn.

## Ngoài Google (20.10.2026)

- **AI search**: Cloudflare KHÔNG chặn bot AI (`ai_bots_protection: disabled` ở zone cozypi.com — đừng bật, bật là
  vô hình với ChatGPT/Perplexity/Claude). `public/llms.txt` = tóm tắt sự thật để AI trích dẫn đúng.
- **Bing / IndexNow**: `pnpm release` tự gửi cả sitemap qua IndexNow (`tools/indexnow.mjs`). Bing nuôi cả ChatGPT
  search, DuckDuckGo, Yahoo. Crawler Hints của Cloudflare không bật được qua API ở gói miễn phí.
- Còn cần tài khoản (chủ dự án): Bing Webmaster Tools (nhập từ Search Console), Cốc Cốc, Yandex, Naver; cổng game
  web (CrazyGames, Poki, itch.io, GameDistribution); cộng đồng (Reddit, Product Hunt, nhóm phụ huynh/giáo viên).
