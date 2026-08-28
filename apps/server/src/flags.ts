/**
 * Công tắc tính năng phía server. Dùng CHUNG cho cả Cloudflare Worker và
 * apps/node-server (node-server nạp thẳng room.ts của thư mục này).
 */

/**
 * Gửi trước nội dung cả bàn cho client, để lật thẻ hiện ngay không phải chờ
 * vòng đi-về (đo được 180ms qua Cloudflare tunnel).
 *
 * ĐÂY LÀ CÔNG TẮC DUY NHẤT. Tắt ở đây là tắt hẳn: server không gửi gì thêm,
 * client không có gì trong tay và tự động quay về hành vi chờ server như cũ.
 * Không có cờ nào phía client — cờ ở hai nơi là có lúc lệch nhau.
 *
 * Đánh đổi đã biết và đã chấp nhận: ai mở DevTools ra là thấy cả bàn. Trò này
 * chơi với bạn bè nên không chống bằng code; bù lại phải chống LỖI CỦA CHÍNH
 * MÌNH làm lộ bài, bằng ba lớp:
 *
 *  1. Không trộn vào `GameView`. Dữ liệu đi bằng thông điệp RIÊNG (`t:'predeal'`)
 *     và nằm ở biến riêng phía client — `view.cards[].symbol` của thẻ úp vẫn
 *     rỗng y như trước.
 *  2. Client chỉ rót symbol vào props của thẻ ĐANG ĐƯỢC PHÉP NGỬA (server đã
 *     báo up/matched, hoặc chính mình vừa bấm và đang chờ ack). Thẻ úp nhận
 *     `symbol: ''`, nên hỏng CSS hay hỏng animation cũng không lộ.
 *  3. Có test canh đúng hai điều trên (`test/predeal.test.ts`).
 *
 * Đặt biến môi trường `PREDEAL=0` thì tắt được ngay mà không phải build lại —
 * dùng khi cần dập gấp trên bản Node.
 */
export const PREDEAL: boolean = doc_env('PREDEAL') !== '0';

/**
 * Ở lobby, rớt kết nối thì giữ CHỖ VÀ QUYỀN CHỦ PHÒNG bấy nhiêu ms (xem
 * LOBBY_HOLD_MS trong room.ts để biết vì sao có mốc này).
 *
 * Cho đặt qua `LOBBY_HOLD_MS` chỉ để BỘ SMOKE khỏi phải ngồi chờ 30 giây thật.
 * Đừng hạ nó trên máy chạy thật: đúng 30 giây đó là thứ giữ quyền chủ phòng
 * qua một lần mất sóng.
 */
export const LOBBY_HOLD_MS: number = Number(doc_env('LOBBY_HOLD_MS') ?? 30_000);

/**
 * Đọc biến môi trường mà không giả định đang chạy ở đâu. Worker không có
 * `process`, Node không có `env` toàn cục — chạm thẳng vào là ném lỗi ở một
 * trong hai nơi.
 */
function doc_env(ten: string): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[ten];
}
