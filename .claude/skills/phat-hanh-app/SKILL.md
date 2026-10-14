---
name: phat-hanh-app
description: Phát hành bản app iOS/Android mới của Flip Match (Lật Thẻ) — gắn tag app-v*, theo dõi CI ký + đẩy TestFlight/Google Play, soát kết quả. Dùng khi người dùng nói "ra bản app", "đẩy TestFlight", "release app", "phát hành app".
---

# Phát hành app Flip Match

CI làm hết (`.github/workflows/mobile.yml`, secret ở `docs/mobile-ci.md`). Việc ở đây
là chọn đúng commit, gắn tag, và SOÁT bằng log chứ không tin dấu xanh.

## 1. Chuẩn bị

1. `git fetch origin` — tag phải gắn vào commit ĐÃ có trên `main` (bản người chơi
   web đang dùng). Đang có thay đổi chỉ ở `develop` thì hỏi người dùng có giao hàng
   web trước không (quy trình bốn bước trong CLAUDE.md), đừng tự tag lên develop.
2. `pnpm typecheck && pnpm test` xanh (đọc cả dòng `Test Files`).
3. Số phiên bản hiển thị = `version` trong `apps/web/package.json`. Bản mới cho
   người dùng thấy khác thì nâng nó (patch cho sửa lỗi, minor cho tính năng) và
   commit qua develop → main như mọi thay đổi. Số bản dựng (build number) tự tăng
   theo `run_number`, không phải đụng.
4. Đổi luật chơi / thêm tính năng lớn → sửa luôn `docs/store-listing.md`
   (`python3 tools/dem-ky-tu-store.py` soát số ký tự).
5. Trang store (mô tả, ảnh chụp) KHÔNG đi theo bản app: chỉ chạy `play-store.yml` /
   `asc-store.yml` khi giao diện đổi nhiều hoặc mô tả đổi — xem mục "Trang giới thiệu
   trên store" ở `docs/mobile-ci.md`. Bản sửa lỗi thường thì bỏ qua bước này.

## 2. Gắn tag

```bash
V=$(node -p "require('./apps/web/package.json').version")
git tag -a "app-v$V" origin/main -m "App $V" && git push origin "app-v$V"
```

Cùng phiên bản mà chỉ cần bản dựng mới (sửa lỗi trước khi nộp duyệt — TRƯỜNG HỢP HAY
GẶP NHẤT): khỏi tag, chạy tay trên main — `gh workflow run mobile.yml --ref main -f
phat_hanh=true`. Build phát hành có nhóm concurrency riêng, đẩy `main` không huỷ nó.

Chủ dự án thử trên TestFlight / Play internal chứ không trên Safari: sửa giao diện họ
báo từ điện thoại xong là ra bản app luôn, báo lại SỐ BUILD (= run_number).

Tag đã tồn tại (đẩy lại cùng phiên bản sau khi sửa CI) thì phải xoá cả hai đầu
trước — đây là thao tác ghi đè, NÓI với người dùng:
`git tag -d app-v$V && git push origin :refs/tags/app-v$V`.

## 3. Theo dõi + soát

```bash
id=$(gh run list --workflow mobile.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch $id --interval 30 >/dev/null; gh run view $id --json jobs -q '.jobs[]|"\(.name): \(.conclusion)"'
J=$(gh run view $id --json jobs -q '.jobs[]|select(.name=="iOS").databaseId')
gh run view --job $J --log | grep -E "Upload succeeded|Z Authority=Apple Distribution|error:"
```

Đạt khi log iOS có ĐỦ: `Upload succeeded` và `Authority=Apple Distribution`. Bước
soát entitlement (`applesignin`) nằm trong workflow, đỏ là thiếu.

Android: chỉ đẩy lên Play khi có `PLAY_SERVICE_ACCOUNT_JSON`; chưa có thì bước đó
"skipped" — báo người dùng tải `app-release.aab` ở Artifacts lên tay.

## 4. Báo người dùng

- Build number vừa lên (= `run_number`), TestFlight cần 10–30 phút xử lý.
- Lỗi thường gặp: "Invalid Signature" → đọc chú thích ba cách hỏng trong mobile.yml,
  đừng quay lại cách cũ; chứng chỉ/profile hết hạn (13.10.2027) → chạy lại
  `node tools/tao-ky-ios.mjs <AuthKey_*.p8> <Issuer ID> --gh` (người dùng tự chạy,
  file .p8 nằm trong `my-secrets/secrets/apple/` mà Claude không đọc được).
