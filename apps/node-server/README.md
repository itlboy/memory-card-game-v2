# Server dự phòng (Node)

Cùng luật chơi với bản Cloudflare, khác chỗ đặt. Dùng khi mạng tới POP của
Cloudflare lag — đã gặp thật từ Việt Nam, cả phòng lỗi mà không sửa được gì.

```bash
pnpm node:dev        # build web + server rồi chạy ở cổng 8080
pnpm docker:build && pnpm docker:run
```

Client trỏ sang bằng `VITE_SERVER_URL` lúc build web, hoặc mở luôn web do chính
server này phục vụ (nó serve `apps/web/dist`, cùng cách bản Cloudflare gộp web
vào Worker).

## Không có bản luật thứ hai

`src/index.ts` **không chứa luật chơi nào**. Nó nạp thẳng `RoomDO` của
`apps/server` và chỉ thay tầng dưới trong `cf-shim.ts`: storage, socket, alarm.
Viết bản luật riêng cho Node là chắc chắn hai bản lệch nhau — mà lệch ở đúng
những chỗ đã tốn hàng loạt sự cố để tìm ra. Có test canh
(`apps/web/test/hai-server.test.ts`).

## Vì sao gói này KHÔNG có `typecheck`

`room.ts` được kiểm kiểu ở `apps/server` với **kiểu thật của Cloudflare**. Kiểm
lần hai ở đây thì shim phải dựng lại cả kiểu `WebSocket` của CF (có
`serializeAttachment`, `deserializeAttachment`…) — công sức lớn mà không bắt được
lỗi nào mới, vì bản CF đã kiểm rồi.

Cái thật sự chứng minh shim đúng là **bộ smoke E2E chạy được với cả hai bản**:

```bash
pnpm node:dev
MM_SERVER=http://127.0.0.1:8080 node tools/smoke-online.mjs
MM_SERVER=http://127.0.0.1:8080 node tools/smoke-options.mjs
MM_SERVER=http://127.0.0.1:8080 node tools/smoke-peek.mjs
MM_SERVER=http://127.0.0.1:8080 node tools/smoke-leave-cancel.mjs
```

GitHub Action chạy đúng bốn lệnh đó trước khi đóng ảnh Docker.

## Khác bản Cloudflare ở hai chỗ, cố ý

- **Phòng nằm trong RAM**: restart là mất phòng đang mở. Bản CF giữ được qua
  hibernation. Với vai trò dự phòng thì đổi lại được: không cần hạ tầng gì.
- **Một tiến trình giữ mọi phòng**: đừng chạy nhiều bản sau một load balancer mà
  không có gì ghim phòng theo mã — hai tiến trình sẽ thấy hai tập phòng khác
  nhau, người chơi vào cùng mã lại ở hai phòng riêng.
