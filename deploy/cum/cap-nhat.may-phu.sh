#!/bin/sh
# MẪU /opt/latthe/cap-nhat.sh ở MÁY PHỤ: kéo ảnh mới, thay pod của máy này, đợi khoẻ. Do máy chính gọi sang (SSH nội bộ,
# khoá chỉ chạy được lệnh này) SAU KHI pod máy chính đã khoẻ. Cron giờ :30 là dự phòng. Tên service: server3 (đổi nếu khác).
set -eu
cd /opt/latthe
anh=ghcr.io/itlboy/memory-card-game-v2/lat-the-server:latest
cu=$(docker image inspect -f '{{.Id}}' $anh 2>/dev/null || true)
docker compose pull -q server3
moi=$(docker image inspect -f '{{.Id}}' $anh)
if [ "$cu" = "$moi" ] && docker compose ps -q server3 | grep -q .; then echo "server3: ảnh không đổi"; exit 0; fi
docker compose up -d --no-deps server3
i=0
while [ $i -lt 45 ]; do
  if docker compose exec -T server3 wget -qO- http://127.0.0.1:8080/health 2>/dev/null | grep -q '"pod"'; then
    echo "server3 khoẻ"; docker image prune -f >/dev/null; exit 0
  fi
  i=$((i + 1)); sleep 2
done
echo "server3 KHÔNG khoẻ sau 90 s"; exit 1
