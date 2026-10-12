#!/usr/bin/env bash
# Tạo UPLOAD KEY cho Google Play — chạy MỘT LẦN trong đời app — và tuỳ chọn nạp
# thẳng vào GitHub Secrets để .github/workflows/mobile.yml ký bản release.
#
#   tools/tao-khoa-android.sh <thư mục cất khoá> [--gh]
#
# Dùng openssl chứ không keytool: máy không cần cài Java. Ra file PKCS12, JDK 9+
# (và Gradle) đọc thẳng, kho và khoá chung một mật khẩu.
#
# CẤT KỸ THƯ MỤC ĐÓ (vd. sổ my-secrets). Google Play giữ khoá ký THẬT (Play App
# Signing), đây chỉ là khoá TẢI LÊN: mất thì vẫn cứu được, nhưng phải gửi yêu
# cầu đổi khoá cho Google và chờ họ duyệt. Vì thế script KHÔNG BAO GIỜ ghi đè.
set -euo pipefail

OUT="${1:-}"
[ -n "$OUT" ] || { echo "Cách dùng: $0 <thư mục cất khoá> [--gh]" >&2; exit 2; }
NAP_GH="${2:-}"

KS="$OUT/upload.keystore"
MK="$OUT/upload.password"
ALIAS=upload

if [ -e "$KS" ]; then
  echo "Đã có $KS — không ghi đè (thay khoá là phải xin Google đổi upload key)." >&2
  exit 1
fi

mkdir -p "$OUT"
chmod 700 "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Mật khẩu đi qua biến môi trường (env:), không lên dòng lệnh — dòng lệnh thì
# tiến trình khác trên máy đọc được qua `ps`.
export KHOA_PASS="$(openssl rand -hex 24)"
openssl req -x509 -newkey rsa:4096 -nodes -sha256 -days 10950 \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
  -subj "/CN=314 Labs/O=314 Labs/C=VN" 2>/dev/null
openssl pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
  -name "$ALIAS" -out "$KS" -passout env:KHOA_PASS
chmod 600 "$KS"
( umask 077; printf 'alias=%s\npassword=%s\n' "$ALIAS" "$KHOA_PASS" > "$MK" )

echo "Đã tạo: $KS"
echo "Mật khẩu + alias: $MK"
echo "SHA-256 (Play Console → App integrity hỏi thì đối chiếu):"
openssl x509 -in "$TMP/cert.pem" -noout -fingerprint -sha256 | sed 's/^.*=/  /'

if [ "$NAP_GH" = "--gh" ]; then
  # Giá trị đi qua stdin của gh — không lên dòng lệnh, không vào shell history
  base64 < "$KS" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
  printf '%s' "$KHOA_PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD
  printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS
  echo "Đã nạp 3 secret ANDROID_* vào GitHub ($(gh repo view --json nameWithOwner -q .nameWithOwner))."
fi
