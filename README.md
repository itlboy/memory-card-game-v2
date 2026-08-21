# Memory Match — Game Thẻ Bài Trí Nhớ

Game rèn luyện trí nhớ chạy trên trình duyệt. Hiện thực theo SRS v1.0, đã hoàn thành
mốc **v1.0 + v1.1** của lộ trình (mục 6).

## Chạy nhanh

```bash
pnpm install

pnpm dev        # phát triển — Vite + HMR, http://localhost:3001
pnpm test       # 60 test (engine + UI)
pnpm typecheck  # tsc + vue-tsc
pnpm build      # ra apps/web/dist
pnpm serve      # web server Node thuần phục vụ bản build, http://127.0.0.1:3001
```

`pnpm serve` không cần dependency nào; đổi port bằng `node server.js 4000`, đổi thư mục
gốc bằng `MM_ROOT=... node server.js`.

## Cấu trúc

```
packages/engine/     Luật chơi — TypeScript thuần, không phụ thuộc DOM/framework
apps/web/            Giao diện — Vue 3 + Vite
legacy/v1/           Bản vanilla JS đầu tiên, giữ để tham chiếu (node legacy/v1/server.js 3002)
server.js            Web server tĩnh cho bản build production
```

### Nguyên tắc kiến trúc

**Engine là nguồn sự thật duy nhất, và nó tất định.**

- Engine không bao giờ gọi `Date.now()` hay `Math.random()`. Mọi hàm nhận `now` từ
  bên ngoài, mọi ngẫu nhiên đi qua `seed`. Có test canh việc này
  (`packages/engine/test/determinism.test.ts`).
- Nhờ vậy cùng `(seed, chuỗi hành động, mốc thời gian)` luôn cho cùng kết quả — điều
  kiện để **server và client chạy chung một engine** mà không lệch trạng thái. Đây là
  nền cho v2.0 (server-authoritative, ON-09) và chế độ Race (ON-06, mọi người nhận
  bàn giống hệt nhau).
- Vue **không** bọc engine trong `reactive()`. Lớp UI giữ một `shallowRef` tới instance
  cùng số đếm `rev`, và đọc ra bản sao (xem `apps/web/src/composables/useGameSession.ts`).
  Nếu để trạng thái bàn thẻ sống trong hệ reactive của Vue thì engine sẽ không còn dùng
  chung được với server.

## Đã có

| Nhóm | Nội dung |
|---|---|
| Chơi đơn | Cổ điển (SP-01), Đua thời gian (SP-02), Chiến dịch 20 màn (SP-03), Sinh tồn (SP-04), Chớp nhoáng (SP-05) |
| Nhiều người | 2–4 người cùng thiết bị, luân phiên, xếp hạng cuối ván (MP-01…MP-04) |
| Thẻ đặc biệt | Bom, x2, mắt thần, đóng băng — bật từ màn 3 của Chiến dịch (3.4) |
| Điểm | 100/cặp, combo x1.2/x1.5/x2, −10 lượt sai (Cổ điển), +5/giây còn lại, xếp 1–3 sao (3.5) |
| Nội dung | 5 theme nạp từ `apps/web/public/data/themes.json`, mở khoá bằng điểm tích lũy (3.6) |
| Lưu trữ | Kỷ lục, sao Chiến dịch, tuỳ chọn, 7 thành tích — localStorage (3.7) |
| Phi chức năng | Responsive 360px+, dark mode, âm thanh tắt được, điều hướng bàn phím, chạm ≥44px |

### Thêm theme mới (không sửa code)

Thêm một mục vào `apps/web/public/data/themes.json`:

```json
{ "id": "space", "name": "Không gian", "unlockAt": 8000, "symbols": ["🚀", "🛸", "…"] }
```

Cần tối thiểu 18 biểu tượng cho lưới 6×6. `unlockAt` là điểm tích lũy cần có; `0` = mở sẵn.

## Chưa làm (v2.0+)

Online multiplayer (phòng riêng, quick match, Race), tài khoản, bảng xếp hạng toàn cầu,
PWA offline, i18n. Backend dự kiến: **Cloudflare Durable Objects** — mỗi phòng là một
DO instance chạy chính `packages/engine`, client chỉ gửi hành động lật.

## Sai lệch có chủ ý so với SRS

- **Thẻ đặc biệt gắn trên một thẻ đơn, không phải cả cặp.** SRS nói "lật trúng thẻ bom →
  úp lại 2 cặp", nhưng lưới phải luôn chẵn ô. Giải pháp: hiệu ứng gắn lên đúng *một*
  trong hai thẻ của một cặp và kích hoạt ngay khi thẻ đó được lật, dùng một lần.
  Giữ được đúng luật chẵn ô và đúng tinh thần "lật trúng thì lãnh hậu quả".
- **Thưởng thời gian chỉ áp dụng cho chơi đơn.** Ở chế độ luân phiên nhiều người, cộng
  điểm thời gian cho một người là vô nghĩa vì đồng hồ dùng chung.
