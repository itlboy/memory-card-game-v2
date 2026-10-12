# App mobile — build qua GitHub Actions

Workflow: `.github/workflows/mobile.yml`. Không build ở máy local. Thiếu secret
nào thì bước cần nó tự bỏ qua, workflow vẫn xanh — điền đủ là chạy, không sửa file.

| Khi nào | Android | iOS |
|---|---|---|
| Đẩy `develop` / `main` | APK debug (cài thử) · có khoá → AAB + APK release đã ký | có key Apple → IPA đã ký · chưa có → build simulator (chỉ kiểm biên dịch) |
| Tag `app-v*` hoặc chạy tay, tích **"Đẩy lên store"** | + đẩy AAB lên Google Play | + đẩy lên TestFlight |

Tải file: tab **Actions** → lần chạy → mục **Artifacts** ở cuối trang.

Phát hành: `git tag app-v1.1.0 && git push origin app-v1.1.0`. Số phiên bản hiển
thị lấy từ `apps/web/package.json` (`version`); số bản dựng = `run_number` của
workflow (+ biến `VERSION_CODE_OFFSET`).

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
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Cloud Console (project cá nhân) → IAM → Service Accounts → tạo, tab Keys → *Add key* → JSON. Rồi Play Console → **Users and permissions** → *Invite new user* bằng email của service account, quyền *Release to testing tracks* (+ *Release to production* khi cần) cho app Lật Thẻ. Dán NGUYÊN nội dung file JSON. |

Hai bẫy:
1. **App mới phải tải AAB đầu tiên BẰNG TAY** (Play Console → Testing → Internal
   testing → Create release, lấy `app-release.aab` từ Artifacts). Trước đó API trả
   "Package not found".
2. App chưa phát hành lần nào thì Play chỉ nhận release ở trạng thái `draft`
   (mặc định của workflow). Sau lần phát hành đầu, đặt **biến** repo
   `PLAY_RELEASE_STATUS=completed` để bản mới tự lên luôn. `PLAY_TRACK` mặc định
   `internal` (đổi sang `alpha` = closed testing, `production`).

### iOS — ký + đẩy TestFlight

| Secret | Lấy ở đâu |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Account → Membership details → *Team ID* (10 ký tự) |
| `ASC_KEY_ID` | App Store Connect → Users and Access → **Integrations** → App Store Connect API → *Team Keys* → tạo key, quyền **Admin** |
| `ASC_ISSUER_ID` | cùng trang đó, dòng *Issuer ID* phía trên bảng key |
| `ASC_KEY_P8_BASE64` | file `AuthKey_XXXX.p8` tải về (CHỈ tải được một lần): `base64 -i AuthKey_XXXX.p8 \| gh secret set ASC_KEY_P8_BASE64` |

Ký tự động trên đám mây (cloud-managed signing) — không có .p12 / provisioning
profile nào phải giữ. Key cần quyền **Admin**: quyền thấp hơn thì không xin được
chứng chỉ phân phối và archive báo "No signing certificate".

Trước lần đẩy TestFlight đầu tiên phải có app trên App Store Connect:
- developer.apple.com → Identifiers → đăng ký App ID `com.hello314.flipmatch`;
- App Store Connect → Apps → **+** → New App, chọn đúng bundle ID đó.

`ITSAppUsesNonExemptEncryption = false` đã có trong Info.plist nên TestFlight
không hỏi khai báo mã hoá mỗi bản.
