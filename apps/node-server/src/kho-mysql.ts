/**
 * KHO BỀN CHO PHÒNG — MySQL.
 *
 * Vì sao có: phòng của server Node nằm trong RAM của tiến trình, nên mỗi lần
 * cập nhật ảnh là mọi phòng đang mở BIẾN MẤT. Người chơi giữa ván bị văng ra và
 * mã phòng chết theo.
 *
 * VÌ SAO GHI TRỄ (write-behind), KHÔNG GHI THẲNG: `RoomDO.save()` chạy sau MỖI
 * nước lật thẻ. Ghi thẳng xuống MySQL ở đó là mỗi nước đi phải chờ một vòng ra
 * database — đúng thứ cả kiến trúc này vừa tốn công cắt bỏ (xem PREDEAL, 180ms).
 * Nên:
 *
 *   - NGUỒN ĐỌC vẫn là Map trong RAM, đồng bộ, nhanh y như trước. MySQL không
 *     nằm trên đường đi của một nước lật thẻ.
 *   - Ghi xuống MySQL là việc CHẠY SAU, gộp theo phòng với một nhịp chờ ngắn:
 *     mười nước đi trong một giây chỉ tốn một lần ghi.
 *
 * Cái mất khi đổi lấy: chết đột ngột (kill -9, mất điện) có thể mất tối đa
 * GOM_MS cuối. Với một ván lật thẻ thì đó là một nước đi — chấp nhận được, và
 * rẻ hơn nhiều so với việc làm chậm mọi nước đi của mọi người.
 *
 * KHÔNG CÓ MySQL THÌ VẪN CHẠY: thiếu biến môi trường là kho tắt hẳn, server
 * quay về đúng hành vi cũ (phòng trong RAM). Dev và CI không phải dựng database.
 */
import type { Connection } from 'mysql2/promise';

/** Kho key-value của MỘT phòng — đúng thứ `ctx.storage` giữ. */
export type DuLieuPhong = Record<string, unknown>;

export interface Kho {
  /** Nạp lại mọi phòng lúc khởi động. */
  napTatCa(): Promise<Map<string, { duLieu: DuLieuPhong; alarmLuc: number | null }>>;
  /** Ghi trạng thái mới nhất của một phòng (gộp, chạy sau). */
  ghi(code: string, duLieu: DuLieuPhong, alarmLuc: number | null): void;
  /** Xoá hẳn một phòng. */
  xoa(code: string): void;
  /** Đẩy nốt phần đang chờ rồi đóng — gọi khi server tắt. */
  dong(): Promise<void>;
}

/**
 * Gom bao lâu trước khi ghi. 300ms đủ để nuốt cả một chuỗi save() của một nước
 * đi (lật, ghép cặp, chuyển lượt) thành một lần ghi, mà vẫn ngắn hơn nhiều so
 * với thời gian một pod mới cần để lên.
 */
const GOM_MS = 300;

/** Bảng chỉ có một dòng cho mỗi phòng; `du_lieu` là toàn bộ kho của phòng đó. */
const TAO_BANG = `
  CREATE TABLE IF NOT EXISTS phong (
    code       VARCHAR(16)  NOT NULL PRIMARY KEY,
    du_lieu    JSON         NOT NULL,
    alarm_luc  BIGINT       NULL,
    cap_nhat   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/**
 * Mở kho. `url` dạng mysql://user:pass@host:3306/ten_db.
 *
 * Trả về `null` khi không cấu hình, hoặc khi không kết nối được: server phải
 * CHẠY ĐƯỢC dù database chết — mất khả năng sống sót qua deploy thì còn chơi
 * được, chứ không mở nổi phòng nào thì hỏng hẳn.
 */
export async function moKho(url: string | undefined): Promise<Kho | null> {
  if (!url) return null;
  let conn: Connection;
  try {
    const { createConnection } = await import('mysql2/promise');
    conn = await createConnection(url);
    await conn.query(TAO_BANG);
  } catch (e) {
    console.error('[kho] không mở được MySQL, chạy tiếp bằng RAM:', (e as Error).message);
    return null;
  }
  console.log('[kho] MySQL sẵn sàng — phòng sống sót qua cập nhật ảnh');

  /** Phòng đang chờ ghi. Chỉ giữ BẢN MỚI NHẤT: ghi đè là đúng, không xếp hàng. */
  const cho = new Map<string, { duLieu: DuLieuPhong; alarmLuc: number | null } | null>();
  let hen: ReturnType<typeof setTimeout> | undefined;
  let dangGhi: Promise<void> = Promise.resolve();

  function henGhi(): void {
    if (hen) return;
    hen = setTimeout(() => { hen = undefined; dangGhi = day(); }, GOM_MS);
  }

  async function day(): Promise<void> {
    const lo = [...cho.entries()];
    cho.clear();
    for (const [code, gt] of lo) {
      try {
        if (gt === null) {
          await conn.execute('DELETE FROM phong WHERE code = ?', [code]);
        } else {
          await conn.execute(
            `INSERT INTO phong (code, du_lieu, alarm_luc) VALUES (?, CAST(? AS JSON), ?)
             ON DUPLICATE KEY UPDATE du_lieu = VALUES(du_lieu), alarm_luc = VALUES(alarm_luc)`,
            [code, JSON.stringify(gt.duLieu), gt.alarmLuc]
          );
        }
      } catch (e) {
        // Không ném ra ngoài: kho hỏng thì cùng lắm mất khả năng sống sót qua
        // deploy — KHÔNG được phép làm hỏng ván đang chơi.
        console.error(`[kho] ghi phòng ${code} lỗi:`, (e as Error).message);
      }
    }
  }

  return {
    async napTatCa() {
      const ra = new Map<string, { duLieu: DuLieuPhong; alarmLuc: number | null }>();
      try {
        const [rows] = await conn.query('SELECT code, du_lieu, alarm_luc FROM phong');
        for (const r of rows as { code: string; du_lieu: unknown; alarm_luc: number | null }[]) {
          // Driver trả JSON đã parse sẵn hoặc còn là chuỗi, tuỳ phiên bản
          const d = typeof r.du_lieu === 'string' ? JSON.parse(r.du_lieu) : r.du_lieu;
          ra.set(r.code, { duLieu: d as DuLieuPhong, alarmLuc: r.alarm_luc });
        }
      } catch (e) {
        console.error('[kho] nạp phòng lỗi, bắt đầu với kho rỗng:', (e as Error).message);
      }
      return ra;
    },
    ghi(code, duLieu, alarmLuc) { cho.set(code, { duLieu, alarmLuc }); henGhi(); },
    xoa(code) { cho.set(code, null); henGhi(); },
    async dong() {
      clearTimeout(hen);
      hen = undefined;
      await dangGhi;
      await day();              // đẩy nốt phần vừa dồn vào trong lúc chờ
      try { await conn.end(); } catch { /* đang tắt, kệ */ }
    }
  };
}
