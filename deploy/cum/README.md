# Cụm nhiều máy — server Lật Thẻ

Mẫu để chạy server game trên nhiều máy (đang chạy thật từ 28.11.2026: máy chính `tierhive-da-2` + máy phụ `tierhive-da-3`).
Hạ tầng thật, bẫy đã gặp: `my-secrets/docs/services/latthe-tierhive.md`. Code: `apps/node-server/src/cum.ts`, `chon-pod.ts`.

| File | Đặt ở | Ghi chú |
|---|---|---|
| `compose.may-chinh.yaml` | máy chính `/opt/latthe/compose.yaml` | DB, Redis, pod `server`, tunnel, hook, bot |
| `compose.may-phu.yaml` | mỗi máy phụ `/opt/latthe/compose.yaml` | pod `server3`, tunnel phụ, hook chuyển tiếp |
| `env.mau` | `/opt/latthe/.env` (600) | biến bí mật + IP nội bộ |
| `khoi-dong.sh` | `/opt/latthe/khoi-dong.sh` | xuất `bimat/*` thành biến môi trường, đợi DB, chạy server |
| `cap-nhat.may-chinh.sh` / `cap-nhat.may-phu.sh` | `/opt/latthe/cap-nhat.sh` | cập nhật cuốn chiếu |
| `tuong-lua.start` | `/etc/local.d/` mọi máy | chỉ các máy trong cụm vào được cổng nội bộ |

## Cụm chạy thế nào

- **Mỗi phòng một pod chủ** (khoá Redis `lt:chu:<mã>`, hạn 6 s, gia hạn 2 s). Request vào pod khác → chuyển tiếp HTTP /
  WebSocket sang pod chủ qua `POD_ADDR`. Sảnh (mời người online, BXH online) là "phòng" `sanh`, một pod giữ.
- **Phòng mới giao cho máy ít phòng nhất**, rồi pod ít phòng nhất trên máy đó (`chon-pod.ts`). Cloudflare KHÔNG chia đều giữa
  các tunnel (đo được: gần hết request vào một tunnel) nên chia phải làm ở server. Phòng đang chơi không bị dời.
- **Pod tắt êm** (deploy): ghi MySQL → nhả khoá → đóng socket mã 1012 → app nối lại sang pod khác sau ~1–2 s.
- **Pod chết đột ngột**: pod khác nhận phòng sau ~6 s (đo 6,2 s), bù giờ lượt bằng đúng khoảng gián đoạn.
- **Redis mất** → mọi pod bỏ hết phòng rồi nạp lại từ MySQL (người chơi nối lại, không mất ván). **DB + Redis chỉ ở máy
  chính**: máy chính chết là cả cụm chết — máy phụ chỉ gánh thêm pod, chưa phải dự phòng toàn phần.

## Biến môi trường của pod

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `MYSQL_URL` | có | `mysql://root:<mật khẩu>@db:3306/latthe` — máy phụ: `db` trỏ sang IP máy chính (`extra_hosts`) |
| `REDIS_URL` | để chạy cụm | `redis://:<mật khẩu>@redis:6379`. **Có = chạy kiểu cụm, thiếu = một pod.** Có mà không nối được Redis hoặc thiếu MySQL → pod DỪNG (cố ý) |
| `POD_ADDR` | để chạy cụm | `http://<IP nội bộ máy>:<cổng công bố>` — pod khác chuyển tiếp tới đây. KHÔNG dùng IP Docker 172.x |
| `AUTH_SECRET` | có | khoá ký phiên đăng nhập — **trùng nhau ở mọi pod**; cũng sinh khoá nội bộ giữa các pod (`/_noi/*`) |
| `PORT` | — | cổng trong container (8080) |
| `NODE_OPTIONS` | — | `--max-old-space-size=128` — heap tối đa, khớp `mem_limit` 200m |
| `./bimat/*` | — | mỗi file một biến: `GOOGLE_CLIENT_ID`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `FCM_SERVICE_ACCOUNT`, `THONGKE_KEY`, `QUANTRI_KEY` — thiếu thì tính năng tương ứng tắt |
| `THI_DAU=1` | — | bật ghép trận thi đấu (đang tắt) |

Biến của `.env` (compose đọc): `MYSQL_ROOT_PASSWORD`, `AUTH_SECRET`, `TUNNEL_TOKEN`, `REDIS_PASSWORD`, `MAY_CHINH_IP`,
`MAY_PHU_IP` — xem `env.mau`. Giá trị thật chỉ nằm trên máy (600); chép giữa máy bằng đường ống, không qua chat / git.

## Quy trình SCALE: thêm một máy phụ

1. **Tạo VPS** cùng tài khoản TierHive (tự vào mạng nội bộ `10.19.106.0/24`), Alpine, **chọn SSH key lúc tạo** (key chỉ
   cài lúc Reinstall). Ghi lại cổng SSH NAT + IP nội bộ.
2. **Nền máy**: `apk add docker docker-cli-compose iptables flock`, `rc-update add docker default`, `rc-update add local
   default`, `rc-update add crond default`; chép `/etc/sysctl.d/99-tinh-chinh.conf`, `/etc/local.d/zram.start`,
   `/etc/docker/daemon.json` từ máy chính (bẫy `no buffer space available`: xem docs platform/tierhive.md).
3. **Tường lửa TRƯỚC khi mở cổng**: `tuong-lua.start` ở máy mới (`DONG_MINH` = IP các máy khác) VÀ thêm IP máy mới vào
   `DONG_MINH` ở mọi máy cũ, chạy lại. Thử từ máy mới: `nc -z -w3 <IP máy chính> 3306` (mở) — từ máy ngoài cụm phải đóng.
4. **Chép cấu hình + khoá** từ máy chính bằng đường ống (không hiện giá trị):
   `ssh <chính> 'cd /opt/latthe && tar -cf - bimat khoi-dong.sh chay.sh' | ssh <mới> 'cd /opt/latthe && tar -xpf -'` và 4 dòng
   `.env` như trong `env.mau`; thêm `MAY_CHINH_IP`, `MAY_PHU_IP`.
5. **Compose**: `compose.may-phu.yaml` → `/opt/latthe/compose.yaml`; `docker compose config -q`.
6. **Nối cập nhật cuốn chiếu**: thêm IP máy mới vào `/opt/latthe/may-phu` ở máy chính; cài public key `/root/.ssh/cum_may_phu.pub`
   vào `authorized_keys` máy mới với `command="/opt/latthe/chay.sh cap-nhat",from="<IP máy chính>",no-pty,no-port-forwarding`;
   cron dự phòng máy mới: `30 * * * * /opt/latthe/chay.sh cap-nhat`.
7. **Bật**: từ máy chính chạy `ssh -i /root/.ssh/cum_may_phu root@<IP máy mới>` (= dựng pod lần đầu), rồi ở máy mới
   `docker compose up -d hook tunnel`. Log tunnel phải có `Registered tunnel connection`.
8. **Soát** bằng API quản trị (không cần SSH): `GET /api/quantri/cum` phải thấy pod mới; tạo vài phòng thử
   (`POST /api/rooms?thu=1`) → `/api/quantri/cum` thấy phòng chia sang máy mới. Thử tải: `PHONG_THU=1 SO_PHONG=10
   MM_SERVER=<tên miền> node apps/node-server/dist/phong-bot.mjs` (phòng thử: không lên danh sách, không bắn thông báo).
9. **Cập nhật docs**: `my-secrets/docs/platform/tierhive.md` (bảng máy) + `docs/services/latthe-tierhive.md` (bảng cụm).

**Bớt một máy phụ**: bỏ IP khỏi `may-phu` ở máy chính → ở máy đó `docker compose stop` (tắt êm, phòng tự sang máy khác)
→ bỏ IP khỏi `DONG_MINH` các máy còn lại → xoá VPS.

**Thêm pod trên cùng máy** không tăng sức chịu tải (mỗi máy 1 vCPU) — chủ dự án chốt **mỗi máy một pod** (28.11.2026).

## Số đo (28.11.2026, hai máy 1 vCPU, mỗi máy một pod)

| Tải (phòng thử, 2 người giả / phòng) | Phòng da-2 / da-3 | CPU pod | Tải máy |
|---|---|---|---|
| 40 | 21 / 22 | 3–6 % | < 0,2 |
| 100 | 58 / 60 | 6,5–8,5 % | < 0,4 |

So với 20.11 (một pod, 50 phòng × 2–4 người): CPU 10–50 %, đỉnh 76 %. Ngưỡng TierHive bóp CPU: > 30 % kéo dài.

## Xem số liệu không cần SSH

`/api/quantri/*` (header `x-quantri-key`, khoá ở my-secrets `latthe-quantri`; sai 20 lần / 10 phút / IP là chặn):
`/tong` (online, người trong phòng, phòng, ván, người chơi, tài khoản) · `/cum` (pod, Redis, MySQL) · `/phong[?trangThai=&congKhai=1|0&boMa=1]` ·
`/phong/<mã>` · MCP `POST /mcp`. Trang admin.cozypi.com có ô "Máy chủ · trực tiếp" đọc `/tong` + `/phong`.
