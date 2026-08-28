# Server dự phòng của Lật Thẻ: web tĩnh + phòng online trong MỘT tiến trình Node.
#
# Vì sao gộp web vào đây: bản Cloudflare cũng gộp (một Worker phục vụ cả hai), nên
# gộp ở đây thì hai bên hành xử giống nhau — không có chuyện web mới chạy với
# server cũ. Chỉ cần mở đúng một cổng.
# `--platform=$BUILDPLATFORM`: TẦNG BUILD LUÔN CHẠY THEO KIẾN TRÚC CỦA MÁY BUILD.
# Sản phẩm ra là JavaScript — không có gì phụ thuộc kiến trúc — nên build nó
# trong QEMU arm64 là trả giá thuần lỗ: đo trên Action, `pnpm install + build`
# mất 19s ở amd64 và 164s ở arm64 (8,6×), chiếm nửa thời gian cả pipeline.
# Ảnh arm64 giờ chỉ COPY dist từ tầng này.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Nạp manifest trước để tận dụng cache lớp: đổi code mà không đổi deps thì
# không phải cài lại từ đầu.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/engine/package.json packages/engine/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY apps/node-server/package.json apps/node-server/
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
# Web build ra apps/web/dist; server gói thành một file
RUN pnpm --filter @mm/web build && pnpm --filter @mm/node-server build
# `ws` cũng cài Ở ĐÂY (kiến trúc máy build) rồi COPY sang: nó là JS thuần, không
# có phần biên dịch, nên `npm i` trong ảnh arm64 chỉ là thêm một lần QEMU vô ích.
# Nhờ vậy ảnh cuối KHÔNG còn lệnh RUN nào — arm64 chỉ là mấy lớp COPY.
# `mysql2` cùng đường với `ws`: để external nên phải có thật trong ảnh chạy.
# Nó là JS thuần (không có phần biên dịch) nên cài ở tầng build rồi COPY sang.
RUN mkdir /deps && cd /deps && npm i --omit=dev ws@8 mysql2@3 --silent

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 WEB_DIR=/app/web
# `ws` để external nên phải có thật trong ảnh chạy — lấy từ tầng build
COPY --from=build /deps/node_modules ./node_modules
COPY --from=build /app/apps/node-server/dist ./dist
COPY --from=build /app/apps/web/dist ./web
EXPOSE 8080
# Ai cũng quên: không có HEALTHCHECK thì container treo mà orchestrator không biết
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.mjs"]
