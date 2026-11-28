#!/bin/sh
# MẪU /opt/latthe/cap-nhat.sh ở MÁY CHÍNH — điều khiển cập nhật CUỐN CHIẾU cả cụm. Gọi qua chay.sh (flock + syslog):
# từ hook CI (inotifyd) và cron 15 phút. Thứ tự: pod máy chính → đợi khoẻ → bot → lần lượt từng máy phụ (đợi khoẻ bên đó).
# KHÔNG BAO GIỜ tắt hai pod cùng lúc: pod nào không khoẻ trong 90 s thì DỪNG, các pod còn lại giữ ảnh cũ.
set -eu
cd /opt/latthe
anh=ghcr.io/itlboy/memory-card-game-v2/lat-the-server:latest
cu=$(docker image inspect -f '{{.Id}}' $anh 2>/dev/null || true)
docker compose pull -q server
moi=$(docker image inspect -f '{{.Id}}' $anh)
[ "$cu" = "$moi" ] && exit 0
echo "ảnh server mới → thay cuốn chiếu"

doi_khoe() {
  i=0
  while [ $i -lt 45 ]; do
    if docker compose exec -T "$1" wget -qO- http://127.0.0.1:8080/health 2>/dev/null | grep -q '"pod"'; then
      echo "$1 khoẻ"; return 0
    fi
    i=$((i + 1)); sleep 2
  done
  echo "$1 KHÔNG khoẻ sau 90 s — dừng, các pod khác giữ nguyên"; return 1
}

docker compose up -d --no-deps server
doi_khoe server
docker compose up -d --no-deps bot
docker image prune -f >/dev/null

# Máy phụ: mỗi dòng của /opt/latthe/may-phu là IP nội bộ một máy. Khoá /root/.ssh/cum_may_phu chỉ chạy được
# `chay.sh cap-nhat` bên đó (authorized_keys: command=…, from=<IP máy chính>). Máy phụ tự đợi pod của nó khoẻ.
[ -f may-phu ] || exit 0
while read -r ip; do
  [ -n "$ip" ] || continue
  echo "máy phụ $ip…"
  ssh -T -n -i /root/.ssh/cum_may_phu -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=10 "root@$ip" || echo "máy phụ $ip: không gọi được (cron bên đó sẽ tự cập nhật)"
done < may-phu
echo "xong"
