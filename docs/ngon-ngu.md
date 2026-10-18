# Ngôn ngữ — thêm, bớt, đổi

Flip Match có **15 ngôn ngữ** (15.10.2026): en · es · pt · fr · de · it · tr · ja · ko · zh ·
zh-TW · ru · id · th · vi. Nguồn gốc duy nhất: `NGON_NGU` trong `apps/web/src/lib/i18n.ts`
(thứ tự = thứ tự trong menu: English đầu, Tiếng Việt cuối). Xem bức tranh chung ở
[`docs/ban-do.md`](ban-do.md).

Mặc định: **web** tiếng Việt, không đoán theo trình duyệt (người Việt hay cài máy tiếng
Anh); **app** theo ngôn ngữ máy và đồng bộ hai chiều với Cài đặt máy; **trang công khai**
theo lựa chọn đã lưu (`mm.lang`) rồi tới ngôn ngữ trình duyệt.

## Mã ngôn ngữ ở từng nơi

Mỗi hệ gọi cùng một ngôn ngữ bằng mã khác nhau — sai mã là âm thầm không chạy.

| Ngôn ngữ | App (`NGON_NGU.id`) | BCP-47 (`bcp`, `<html lang>`, hreflang) | iOS lproj / Android locale | App Store | Google Play | Mục trong store-listing |
|---|---|---|---|---|---|---|
| English | `en` | en-US | en | en-US | en-US | English (U.S.) |
| Español | `es` | es-ES | es | es-ES | es-ES | Español |
| Português (Brasil) | `pt` | pt-BR | pt-BR | pt-BR | pt-BR | Português (Brasil) |
| Français | `fr` | fr-FR | fr | fr-FR | fr-FR | Français |
| Deutsch | `de` | de-DE | de | de-DE | de-DE | Deutsch |
| Italiano | `it` | it-IT | it | it | it-IT | Italiano |
| Türkçe | `tr` | tr-TR | tr | tr | tr-TR | Türkçe |
| 日本語 | `ja` | ja-JP | ja | ja | ja-JP | 日本語 |
| 한국어 | `ko` | ko-KR | ko | ko | ko-KR | 한국어 |
| 简体中文 | `zh` | zh-CN | zh-Hans | zh-Hans | zh-CN | 简体中文 |
| 繁體中文 | `zh-TW` | zh-TW | zh-Hant | zh-Hant | zh-TW | 繁體中文 |
| Русский | `ru` | ru-RU | ru | ru | ru-RU | Русский |
| Bahasa Indonesia | `id` | id-ID | id | id | id | Bahasa Indonesia |
| ไทย | `th` | th-TH | th | th | th | ไทย |
| Tiếng Việt | `vi` | vi-VN | vi | vi | vi | Tiếng Việt |

Trung **phồn thể** được nhận ra từ thẻ máy `zh-Hant*`, `zh-TW`, `zh-HK`, `zh-MO` — xét
TRƯỚC khi cắt thẻ về `zh` (ở `theoMay` của app và `trinhDuyet` của `site.js`).

## Thêm một ngôn ngữ — đủ 14 chỗ

Làm theo thứ tự; mỗi bước có thứ canh nó.

| # | Chỗ | Làm gì | Canh bởi |
|---|---|---|---|
| 1 | `apps/web/src/locales/<mã>.ts` | Dịch đủ khoá của `en.ts` (kiểu `TuDien`), giữ nguyên `{n}`/`{ten}`…, giá trị hàm giữ là hàm. Theo `docs/i18n-style.md`. | typecheck (thiếu khoá = đỏ), `i18n.test.ts` |
| 2 | `apps/web/src/lib/i18n.ts` | thêm vào `NGON_NGU` (`id`, `ten` bằng chính ngôn ngữ đó, `bcp`). Từ điển tự được nạp theo nhu cầu từ `locales/<id>.ts` (`import.meta.glob`, 18.10.2026) — KHÔNG import tay. Thêm `game.title`/`game.desc` ở `site-i18n/<id>.json` (trang chơi `/<id>/`, docs/seo.md). Mã đặc biệt (như zh-TW) thì thêm vào `theoMay`. | typecheck |
| 3 | `apps/web/src/lib/ngon-ngu-app.ts` | `MA_IOS[<mã>]` = tên thư mục lproj (cũng là thẻ Android). | typecheck (Record đủ khoá) |
| 4 | `apps/web/ios/App/App/<lproj>.lproj/InfoPlist.strings` | Tên app trên màn hình chính (`CFBundleDisplayName`). | build iOS (CI) |
| 5 | `apps/web/ios/App/App.xcodeproj/project.pbxproj` | 3 chỗ: `PBXFileReference`, nhóm `InfoPlist.strings`, `knownRegions`. Dùng ID mới chưa có trong file. | build iOS (CI) |
| 6 | `apps/web/ios/App/App/Info.plist` | `CFBundleLocalizations` thêm mã lproj (mục "Languages" trên App Store + Cài đặt máy). | `plutil -lint` |
| 7 | `apps/web/android/app/src/main/res/xml/locales_config.xml` | Thêm `<locale>` (Android 13+ hiện ngôn ngữ riêng của app). | build Android (CI) |
| 8 | `apps/web/site-i18n/<mã>.json` | Dịch đủ khoá của 4 trang công khai (lấy danh sách từ `data-t`/`data-th` trong `apps/web/public/*.html`). | `site-i18n.test.ts` (đối chiếu với `NGON_NGU`), build (thiếu khoá = đỏ) |
| 9 | `apps/web/public/site/site.js` | `LANGS` (tên trong menu ngôn ngữ). | xem trang |
| 10 | `docs/store-listing.md` | Mục `## <tên>` đủ trường như English, đúng giới hạn ký tự. | `python3 tools/dem-ky-tu-store.py` |
| 11 | `tools/asc-store.mjs` + `tools/play-store.mjs` | Thêm vào `NGON_NGU` của từng công cụ (mã App Store / Play ở bảng trên). | chạy thử công cụ |
| 12 | `apps/web/test/i18n-man-hinh.test.ts` | `DONG_NGUYEN[<mã>]` — chỉ những từ ngôn ngữ đó viết GIỐNG HỆT tiếng Anh (Premium, Neon…), khai từng từ. | chính test này |
| 13 | `tools/do-ngon-ngu.mjs` | `LANGS` mặc định — rồi chạy `pnpm do:ngon-ngu` đo chữ tràn nút trên iPhone SE. | chính công cụ |
| 14 | Con số "N ngôn ngữ" | Sửa mọi chỗ ghi số lượng: xem dòng "15 ngôn ngữ" trong [`ban-do.md`](ban-do.md). | — |

Rồi: chụp ảnh store cho ngôn ngữ mới (`node tools/chup-store.mjs <server> <thư mục> <mã>`,
thêm `KHUNG=ipad`, `KHUNG=android`), và cập nhật `docs/i18n-style.md` nếu có thuật ngữ mới.

Phần **chữ trong game** tới app ngay qua cập nhật nóng (OTA); bước 4–7 là phần NATIVE —
chỉ có hiệu lực từ bản app store kế tiếp. Không cần nâng `minNative`: gói web mới gọi
`NgonNguApp.dat` với mã lproj mới thì app cũ chỉ ghi một mã nó chưa khai, vô hại.

## Bớt một ngôn ngữ

Làm ngược 14 bước. Đừng bỏ thư mục lproj/locale trước khi bản app mới lên store.

## Đổi một chữ

Sửa khoá ở **cả 15** từ điển (`locales/*.ts`) — `vi.ts` là bản GỐC, giữ đúng từng chữ (test
giao diện đọc tiếng Việt). Chữ trên trang công khai: sửa `public/*.html` (tiếng Anh) và 14
file `site-i18n/*.json`. Chữ store: `docs/store-listing.md` rồi chạy công cụ store.
