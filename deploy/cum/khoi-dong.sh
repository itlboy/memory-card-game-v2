#!/bin/sh
# Xuất mỗi file trong /run/bimat thành một biến môi trường (tên file = tên biến), rồi chạy server như ảnh gốc.
# Mỗi khoá một file để giữ nguyên PEM / JSON nhiều dòng (APNS_PRIVATE_KEY, FCM_SERVICE_ACCOUNT).
for f in /run/bimat/*; do
  [ -f "$f" ] || continue
  ten=$(basename "$f")
  export "$ten=$(cat "$f")"
done
# ĐỢI DB (20.11.2026): lúc máy khởi động, Docker chạy lại mọi container theo restart policy và BỎ QUA depends_on —
# server lên trước MariaDB thì "không mở được MySQL, chạy tiếp bằng RAM": tắt đăng nhập + push, phòng mất khi restart.
# Đợi tối đa 180 giây cổng db:3306 mở; quá hạn thì thoát lỗi để Docker chạy lại (không bao giờ chạy kiểu RAM).
# 27.11.2026: thoát mã 0 = DB đã chạy sẵn từ lần thử đầu (cập nhật ảnh, chuyển máy) → KHÔNG ngủ thêm;
# thoát mã 3 = phải đợi (máy vừa khởi động) → ngủ 3 s cho InnoDB nhận truy vấn.
node -e "
const net=require(\"net\");const het=Date.now()+180000;let lan=0;
(function thu(){lan++;const s=net.connect(3306,\"db\");s.on(\"connect\",()=>{s.end();console.log(\"[khoi-dong] DB đã sẵn sàng\"+(lan>1?\" (đợi \"+lan+\" lần)\":\"\"));process.exit(lan>1?3:0)});
s.on(\"error\",()=>{if(Date.now()>het){console.error(\"[khoi-dong] đợi DB quá 180s\");process.exit(1)}setTimeout(thu,2000)})})()"
kq=$?
[ $kq = 1 ] && exit 1
[ $kq = 3 ] && sleep 3
exec docker-entrypoint.sh node dist/server.mjs
