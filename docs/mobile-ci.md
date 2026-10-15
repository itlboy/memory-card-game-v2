# App mobile — build qua GitHub Actions

Workflow: `.github/workflows/mobile.yml`. Không build ở máy local. Thiếu secret
nào thì bước cần nó tự bỏ qua, workflow vẫn xanh — điền đủ là chạy, không sửa file.

| Khi nào | Android | iOS |
|---|---|---|
| Đẩy `develop` / `main` | APK debug (cài thử) · có khoá → AAB + APK release đã ký | có key Apple → IPA đã ký · chưa có → build simulator (chỉ kiểm biên dịch) |
| Tag `app-v*` hoặc chạy tay, tích **"Đẩy lên store"** | + đẩy AAB lên Google Play | + đẩy lên TestFlight |

Tải file: tab **Actions** → lần chạy → mục **Artifacts** ở cuối trang.

Phát hành:
- **Cùng phiên bản, chỉ thêm build** (hay dùng nhất — sửa lỗi trước khi nộp duyệt):
  `gh workflow run mobile.yml --ref main -f phat_hanh=true`. Build phát hành có nhóm
  concurrency riêng nên lần đẩy `main` sau đó KHÔNG huỷ nó.
- **Phiên bản mới**: nâng `version` trong `apps/web/package.json` (qua develop → main),
  rồi `git tag app-v<phiên bản> origin/main && git push origin app-v<phiên bản>`.

Số phiên bản hiển thị lấy từ `apps/web/package.json`; số bản dựng = `run_number` của
workflow (+ biến `VERSION_CODE_OFFSET`). Soát log iOS bằng `Upload succeeded` và dòng
`Authority=Apple Distribution` (grep `"Z Authority="` — grep trần dính dòng lệnh).
App Store chỉ đòi phiên bản MỚI sau khi phiên bản đang soạn đã được phát hành; trước
đó cứ thêm build vào cùng phiên bản rồi chọn build mới nhất khi nộp.

## Trang giới thiệu trên store (tách khỏi bản app)

Ba workflow, ba việc khác nhau — đừng nhầm "ra bản app" với "sửa trang store":

| Workflow | Làm gì | Khi nào chạy |
|---|---|---|
| `mobile.yml` | Build app, đẩy TestFlight / Google Play | MỖI lần ra bản app (tag `app-v*` hoặc chạy tay `phat_hanh=true`) |
| `play-store.yml` | Trang Google Play: tên, mô tả 12 ngôn ngữ, ảnh chụp, ảnh bìa, icon | CHẠY TAY, chỉ khi trang cần đổi |
| `asc-store.yml` | Trang App Store: như trên + gắn build | CHẠY TAY, chỉ khi trang cần đổi |

Hai workflow trang store chỉ có `workflow_dispatch` — không chạy theo commit, và cũng
KHÔNG phải chạy mỗi bản app. Chạy lại khi: giao diện đổi nhiều tới mức ảnh chụp cũ
không còn giống app · sửa mô tả ở `docs/store-listing.md` (nguồn CHUNG cho cả hai
store) · thêm ngôn ngữ. Bản sửa lỗi thường chỉ cần `mobile.yml`.

```bash
gh workflow run play-store.yml --ref main                    # chụp lại + điền
gh workflow run play-store.yml --ref main -f chup_anh=false  # chỉ cập nhật chữ
```

Ảnh chụp lấy từ bản web (mặc định `thebai2`, lên bản mới ngay lúc `pnpm release`),
nên giao hàng web TRƯỚC rồi mới chụp. Ảnh Play chụp trên Ubuntu khung Android
1080×1920; ảnh App Store chụp trên macOS (emoji giao diện kiểu Apple). Mặt bài là
Noto 3D ở CẢ HAI (15.10.2026) — đổi bộ hình mặt bài là chạy lại cả hai workflow. Kịch bản bấm nút theo CHỮ của từng ngôn ngữ (`tools/chup-store-kichban.mjs`
đọc từ điển) — đổi chữ nút trong `locales/*` là chạy thử một ngôn ngữ ở máy trước:
`KHUNG=android node tools/chup-store.mjs https://thebai2.hello314.com <thư mục> zh`.
Service account Play cần quyền "Quản lý trang thông tin cửa hàng" trên Play Console.

## Secrets (Settings → Secrets and variables → Actions)

Không dán giá trị vào chat hay commit. Bản gốc cất ở sổ `my-secrets`.

### Android — ký app

| Secret | Lấy ở đâu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `tools/tao-khoa-android.sh <thư mục> --gh` tự tạo và nạp cả ba |
| `ANDROID_KEYSTORE_PASSWORD` | 〃 |
| `ANDROID_KEY_ALIAS` | 〃 (`upload`) |

Đây là **upload key**; Google Play giữ khoá ký thật (Play App Signing). Mất upload
key thì xin Google đổi được, nhưng phải chờ duyệt — cất kỹ.

### Android — đẩy lên Google Play

| Secret | Lấy ở đâu |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | **ĐÃ CÓ (14.10.2026)**: service account `play-ci@lat-the-nkien.iam.gserviceaccount.com` (project `lat-the-nkien`, tài khoản Google cá nhân), đã mời vào Play Console. Làm lại từ đầu: Google Cloud Console (project cá nhân) → IAM → Service Accounts → tạo, tab Keys → *Add key* → JSON. Rồi Play Console → **Users and permissions** → *Invite new user* bằng email của service account, quyền *Release to testing tracks* (+ *Release to production* khi cần) cho app Lật Thẻ. Dán NGUYÊN nội dung file JSON. |

Hai bẫy:
1. **App mới phải tải AAB đầu tiên BẰNG TAY** (Play Console → Testing → Internal
   testing → Create release, lấy `app-release.aab` từ Artifacts). Trước đó API trả
   "Package not found".
2. App chưa phát hành lần nào thì Play chỉ nhận release ở trạng thái `draft`
   (mặc định của workflow). Sau lần phát hành đầu, đặt **biến** repo
   `PLAY_RELEASE_STATUS=completed` để bản mới tự lên luôn — **đã đặt 14.10.2026**.
   Soi trạng thái track không cần file khoá: `gcloud --account=<gmail cá nhân> auth
   print-access-token --impersonate-service-account=play-ci@lat-the-nkien.iam.gserviceaccount.com
   --scopes=https://www.googleapis.com/auth/androidpublisher` rồi gọi
   `androidpublisher/v3/applications/com.cozypi.flipmatch/edits` (tạo edit → đọc
   `tracks` → xoá edit). `PLAY_TRACK` mặc định
   `internal` (đổi sang `alpha` = closed testing, `production`). Sau đó bước "Đưa sang kênh
   khép kín" đặt CÙNG build làm bản của kênh `alpha` (`tools/play-track.mjs`; biến repo
   `PLAY_KENH_THEM` đổi kênh đích, `none` để tắt). Đưa tay một build cũ:
   `gh workflow run play-track.yml --ref main -f version_code=<số> -f kenh=alpha`.

### iOS — ký + đẩy TestFlight

Hai bộ, khác việc:

| Secret | Dùng để | Lấy ở đâu |
|---|---|---|
| `APPLE_TEAM_ID` | ký | developer.apple.com → Account → Membership details → *Team ID* |
| `IOS_DIST_P12_BASE64` | ký | `node tools/tao-ky-ios.mjs <AuthKey_XXXX.p8> <Issuer ID> --gh` tự tạo và nạp cả ba |
| `IOS_DIST_P12_PASSWORD` | ký | 〃 |
| `IOS_PROFILE_BASE64` | ký | 〃 |
| `ASC_KEY_ID` | đẩy TestFlight (+ script trên) | App Store Connect → Users and Access → **Integrations** → App Store Connect API → *Team Keys*, quyền **Admin** |
| `ASC_ISSUER_ID` | 〃 | dòng *Issuer ID* phía trên bảng key |
| `ASC_KEY_P8_BASE64` | 〃 | file `AuthKey_XXXX.p8` (CHỈ tải được một lần): `base64 -i AuthKey_XXXX.p8 \| gh secret set ASC_KEY_P8_BASE64` |

**Chứng chỉ phân phối + profile hết hạn sau 1 NĂM** — chạy lại `tools/tao-ky-ios.mjs`
(xoá `ios-distribution.p12` cũ trước, script không ghi đè). Khoá riêng của chứng chỉ
sinh trên máy chạy script, không qua Apple.

Vì sao ký thủ công chứ không để Xcode ký tự động trên CI: đã thử ba cách và cả ba
hỏng — lý do ghi ngay trong `mobile.yml` (ký tự động đòi iPhone đăng ký; ký lúc
xuất thì mất entitlements; ký tạm rồi ký lại thì Apple từ chối "Invalid Signature").

Trước lần đẩy TestFlight đầu tiên phải có app trên App Store Connect:
- developer.apple.com → Identifiers → App ID `com.hello314.flipmatch`, bật
  **Sign In with Apple** (app có nút Đăng nhập Apple; thiếu là profile không mang
  entitlement và CI đỏ ở bước soát);
- App Store Connect → Apps → **+** → New App, chọn đúng bundle ID đó.

`ITSAppUsesNonExemptEncryption = false` đã có trong Info.plist nên TestFlight
không hỏi khai báo mã hoá mỗi bản.

## Plugin native (Capacitor)

Đang dùng: `@capacitor/app` (nút Back Android), `@capacitor/haptics` (rung),
`@capacitor/splash-screen`, `@capgo/capacitor-social-login` (Apple), và plugin TỰ VIẾT
`NgonNguApp` (ghi ngôn ngữ game xuống Cài đặt máy).

- **Thêm plugin npm** → `npx cap sync` → commit `android/app/capacitor.build.gradle`,
  `android/capacitor.settings.gradle`, `ios/App/CapApp-SPM/Package.swift`.
- **Plugin tự viết**: Android là class `@CapacitorPlugin` trong
  `android/app/src/main/java/com/cozypi/flipmatch/`, đăng ký `registerPlugin(...)`
  TRƯỚC `super.onCreate` ở `MainActivity`. iOS đặt class ngay trong
  `ios/App/App/SceneDelegate.swift` và đăng ký ở `GameViewController.capacitorDidLoad`
  — thêm file `.swift` mới là phải sửa tay `project.pbxproj`, nên đừng.
- Máy local KHÔNG build native được: đẩy `develop` để CI biên dịch thử cả hai nền
  (build thường, không lên store) TRƯỚC khi chạy phát hành.

