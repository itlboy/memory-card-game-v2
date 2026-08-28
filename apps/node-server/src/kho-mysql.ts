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
import type { Pool, PoolConnection } from 'mysql2/promise';

/** Kho key-value của MỘT phòng — đúng thứ `ctx.storage` giữ. */
export type DuLieuPhong = Record<string, unknown>;

export interface Kho {
  /** Nạp lại phòng ĐANG SỐNG lúc khởi động. */
  napTatCa(): Promise<Map<string, { duLieu: DuLieuPhong; alarmLuc: number | null }>>;
  /** Ghi trạng thái mới nhất của một phòng (gộp, chạy sau). */
  ghi(code: string, duLieu: DuLieuPhong, alarmLuc: number | null): void;
  /** Đóng một phòng — đánh dấu, KHÔNG xoá dòng. */
  dong(code: string, lyDo: string): void;
  /** Đẩy nốt phần đang chờ rồi đóng kết nối — gọi khi server tắt. */
  dongKho(): Promise<void>;
}

/**
 * Gom bao lâu trước khi ghi. 300ms đủ để nuốt cả một chuỗi save() của một nước
 * đi (lật, ghép cặp, chuyển lượt) thành một lần ghi, mà vẫn ngắn hơn nhiều so
 * với thời gian một pod mới cần để lên.
 */
const GOM_MS = 300;

/*
 * SCHEMA — bốn bảng thực thể, mọi trường vô hướng đều có CỘT RIÊNG.
 *
 * Ranh giới: cái gì là THỰC THỂ thì tách bảng và tách cột; cái gì là RUỘT
 * ENGINE thì để nguyên một khối JSON.
 *
 *   rooms        — một phòng. KHÔNG xoá cứng: đóng thì đánh dấu, dòng ở lại.
 *   room_players — ai ngồi trong phòng. Người rời cũng không xoá, đánh dấu left_at.
 *   room_themes  — theme đã chọn. Bảng nối thuần.
 *   matches      — một ván ĐÃ XONG. Một phòng nhiều ván (bấm "Chơi lại").
 *
 * BA ĐIỂM DỄ HIỂU SAI, đừng sửa nếu chưa đọc:
 *
 * 1. `id` là định danh, `code` CHỈ LÀ MỘT GIÁ TRỊ. Phòng không bị xoá nữa, nên
 *    nếu `code` làm khoá chính thì mã 6 số không bao giờ tái dùng được — chơi
 *    vài tháng là `makeCode()` liên tục trúng mã cũ.
 *
 * 2. `closed_at` là SỐ NGUYÊN, 0 = đang sống, không phải NULL. Nhờ vậy ràng
 *    buộc duy nhất đặt thẳng lên `(code, closed_at)`: phòng đang sống đều mang
 *    0 nên chỉ MỘT phòng được giữ một mã, còn phòng đã đóng thì mỗi cái một mốc
 *    nên trùng mã bao nhiêu cũng được. `left_at` cùng quy ước.
 *
 * 3. Mọi truy vấn tìm phòng đang sống PHẢI có `closed_at = 0`. Quên một lần là
 *    phòng đã đóng sống lại và người chơi vào được.
 *
 * Vì sao `game_state` vẫn là JSON: đó là `engine.snapshot()` — bàn thẻ,
 * rngState, seen, summaryCache. Chi tiết cài đặt của engine, không phải thực
 * thể nghiệp vụ; tách ra bảng riêng chỉ buộc database đổi theo mỗi lần đổi luật
 * chơi, mà engine là thứ CLAUDE.md cấm có bản sao thứ hai.
 */
const TAO_BANG: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS rooms (
     id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
     code          CHAR(6)      NOT NULL,
     status        VARCHAR(16)  NOT NULL,
     host_id       VARCHAR(32)  NULL,
     is_public     TINYINT(1)   NOT NULL DEFAULT 1,
     level         SMALLINT     NOT NULL DEFAULT 0,
     opt_time      TINYINT      NOT NULL DEFAULT 0,
     opt_lives     TINYINT      NOT NULL DEFAULT 0,
     opt_peek      TINYINT      NOT NULL DEFAULT 0,
     opt_shuffle   TINYINT      NOT NULL DEFAULT 0,
     opt_special   TINYINT      NOT NULL DEFAULT 0,
     countdown_end BIGINT       NULL,
     empty_at      BIGINT       NULL,
     alarm_at      BIGINT       NULL,
     opened_at     BIGINT       NOT NULL DEFAULT 0,
     game_state    LONGTEXT     NULL,
     closed_at     BIGINT       NOT NULL DEFAULT 0,
     close_reason  VARCHAR(16)  NULL,
     created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uq_rooms_code_open (code, closed_at),
     INDEX idx_rooms_open (closed_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS players (
     client_id    VARCHAR(64)  NOT NULL PRIMARY KEY,
     name         VARCHAR(32)  NULL,
     -- Số PHÒNG đã vào không để ở đây: đếm được chính xác bằng
     --   SELECT COUNT(DISTINCT room_id) FROM room_players WHERE client_id = ?
     -- còn cộng dồn thì sai ngay lần đầu ai đó ghi lại hai lần.
     matches      INT          NOT NULL DEFAULT 0,
     wins         INT          NOT NULL DEFAULT 0,
     first_seen   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
     last_seen    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS room_players (
     room_id         BIGINT       NOT NULL,
     player_id       VARCHAR(32)  NOT NULL,
     seat            SMALLINT     NOT NULL DEFAULT 0,
     name            VARCHAR(32)  NOT NULL,
     avatar          VARCHAR(16)  NULL,
     -- Định danh bền của trình duyệt. KHÔNG khoá ngoại về bảng players: client
     -- gửi lên nên không đáng tin, mà khoá ngoại thì một chuỗi rác là chặn cả
     -- lượt ghi phòng — hỏng ván vì một con số thống kê là sai thứ tự ưu tiên.
     client_id       VARCHAR(64)  NULL,
     token           VARCHAR(64)  NULL,
     is_ready        TINYINT(1)   NOT NULL DEFAULT 0,
     disconnected_at BIGINT       NULL,
     last_seen       BIGINT       NULL,
     joined_at       BIGINT       NOT NULL DEFAULT 0,
     left_at         BIGINT       NOT NULL DEFAULT 0,
     updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (room_id, player_id),
     INDEX idx_room_players_client (client_id),
     CONSTRAINT fk_room_players_room FOREIGN KEY (room_id)
       REFERENCES rooms(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS room_themes (
     room_id  BIGINT      NOT NULL,
     theme_id VARCHAR(32) NOT NULL,
     PRIMARY KEY (room_id, theme_id),
     CONSTRAINT fk_room_themes_room FOREIGN KEY (room_id)
       REFERENCES rooms(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS matches (
     id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
     room_id      BIGINT       NOT NULL,
     seq          SMALLINT     NOT NULL DEFAULT 1,
     level        SMALLINT     NOT NULL DEFAULT 0,
     pairs        SMALLINT     NOT NULL DEFAULT 0,
     status       VARCHAR(8)   NULL,
     reason       VARCHAR(16)  NULL,
     moves        INT          NOT NULL DEFAULT 0,
     seconds      INT          NOT NULL DEFAULT 0,
     winner_name  VARCHAR(32)  NULL,
     winner_score INT          NULL,
     player_count SMALLINT     NOT NULL DEFAULT 0,
     ranking      LONGTEXT     NULL,
     started_at   BIGINT       NOT NULL DEFAULT 0,
     ended_at     BIGINT       NOT NULL DEFAULT 0,
     -- Mốc kết thúc là thứ phân biệt hai ván của CÙNG một phòng. Nhờ nó,
     -- INSERT IGNORE chạy bao nhiêu lần cũng chỉ ra một dòng — kho không phải
     -- nhớ "ván này ghi chưa".
     UNIQUE KEY uq_matches_room_end (room_id, ended_at),
     CONSTRAINT fk_matches_room FOREIGN KEY (room_id)
       REFERENCES rooms(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

/** Phòng đã đóng quá bấy nhiêu thì xoá cứng. Không có bước này thì xoá mềm làm
 *  bảng phình mãi: mỗi ngày vài trăm dòng, 99% là phòng chết. */
const GIU_PHONG_DONG_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Mở kho. `url` dạng mysql://user:pass@host:3306/ten_db.
 *
 * Trả về `null` khi không cấu hình, hoặc khi không kết nối được: server phải
 * CHẠY ĐƯỢC dù database chết — mất khả năng sống sót qua deploy thì còn chơi
 * được, chứ không mở nổi phòng nào thì hỏng hẳn.
 */
export async function moKho(url: string | undefined): Promise<Kho | null> {
  if (!url) return null;
  let pool: Pool;
  try {
    const { createPool } = await import('mysql2/promise');
    /*
     * POOL, không phải một connection.
     *
     * Ghi một phòng là một GIAO DỊCH (rooms + room_players + room_themes phải
     * cùng đúng hoặc cùng sai). Hai giao dịch chạy chồng trên CÙNG một
     * connection thì `beginTransaction` thứ hai lặng lẽ commit cái thứ nhất —
     * sai mà không có gì báo. Pool cấp mỗi giao dịch một connection riêng.
     */
    pool = createPool({ uri: url, connectionLimit: 4, waitForConnections: true });
    const c = await pool.getConnection();
    try {
      // Tuần tự: room_players/room_themes/matches có khoá ngoại trỏ vào rooms.
      for (const cau of TAO_BANG) await c.query(cau);
    } finally { c.release(); }
  } catch (e) {
    console.error('[kho] không mở được MySQL, chạy tiếp bằng RAM:', (e as Error).message);
    return null;
  }
  console.log('[kho] MySQL sẵn sàng — phòng sống sót qua cập nhật ảnh');

  /**
   * Mã phòng → id trong database.
   *
   * `room.ts` chỉ biết mã; `id` do database sinh lúc INSERT. Bảng tra này là
   * cầu nối. PHẢI xoá khỏi đây khi phòng đóng — không thì phòng mới dùng lại mã
   * cũ sẽ ghi đè lên phòng đã đóng, và lịch sử của phòng cũ biến thành lịch sử
   * của phòng mới.
   */
  const idCuaMa = new Map<string, number>();

  /** Phòng đang chờ ghi. `null` = đóng phòng (kèm lý do). */
  type Viec = { duLieu: DuLieuPhong; alarmLuc: number | null } | { dong: string };
  const cho = new Map<string, Viec>();
  let hen: ReturnType<typeof setTimeout> | undefined;
  let dangGhi: Promise<void> = Promise.resolve();

  function henGhi(): void {
    if (hen) return;
    hen = setTimeout(() => { hen = undefined; dangGhi = day(); }, GOM_MS);
  }

  async function day(): Promise<void> {
    const lo = [...cho.entries()];
    cho.clear();
    for (const [code, viec] of lo) {
      try {
        if ('dong' in viec) await dongPhong(code, viec.dong);
        else await ghiPhong(code, viec.duLieu, viec.alarmLuc);
      } catch (e) {
        // Không ném ra ngoài: kho hỏng thì cùng lắm mất khả năng sống sót qua
        // deploy — KHÔNG được phép làm hỏng ván đang chơi.
        console.error(`[kho] ghi phòng ${code} lỗi:`, (e as Error).message);
      }
    }
  }

  /** Trạng thái phòng như room.ts giữ nó. Chỉ khai những trường kho này đụng tới. */
  interface RoomState {
    code: string;
    hostId: string;
    status: string;
    congKhai: boolean;
    countdownEnd?: number;
    emptyAt?: number;
    config: { level: number; themeIds: string[]; options: Record<string, number> };
    players: {
      id: string; name: string; avatar?: string; token: string; clientId?: string;
      ready: boolean; disconnectedAt: number | null; lastSeen?: number;
    }[];
  }

  /**
   * Ghi một phòng: cột riêng cho từng trường, người chơi và theme ra bảng riêng.
   *
   * MỘT GIAO DỊCH cho cả ba bảng. Không có nó thì có lúc `rooms` đã cập nhật mà
   * `room_players` chưa — khôi phục đúng lúc đó ra một phòng thiếu người, và
   * người bị thiếu thường là người vừa vào.
   */
  async function ghiPhong(code: string, duLieu: DuLieuPhong, alarmLuc: number | null): Promise<void> {
    const room = duLieu.room as RoomState | undefined;
    const o = room?.config.options ?? {};
    const gameState = (duLieu.game as string | undefined) ?? null;
    const openedAt = Number(duLieu.openedAt ?? 0);
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();

      let id = idCuaMa.get(code);
      if (id === undefined) {
        /*
         * Chưa biết id. Có thể là phòng mới, cũng có thể là phòng cũ mà tiến
         * trình vừa khởi động lại chưa kịp nạp — nên hỏi database trước, chỉ
         * INSERT khi thật sự chưa có. `closed_at = 0` là chốt: phòng đã đóng
         * mang cùng mã KHÔNG được nhận nhầm.
         */
        const [co] = await c.query('SELECT id FROM rooms WHERE code = ? AND closed_at = 0', [code]);
        const dong = (co as { id: number }[])[0];
        if (dong) id = Number(dong.id);
        else {
          const [kq] = await c.execute(
            'INSERT INTO rooms (code, status, opened_at) VALUES (?, ?, ?)',
            [code, room?.status ?? 'lobby', openedAt]
          );
          id = Number((kq as { insertId: number }).insertId);
        }
        idCuaMa.set(code, id);
      }

      await c.execute(
        `UPDATE rooms SET
           status = ?, host_id = ?, is_public = ?, level = ?,
           opt_time = ?, opt_lives = ?, opt_peek = ?, opt_shuffle = ?, opt_special = ?,
           countdown_end = ?, empty_at = ?, alarm_at = ?, game_state = ?,
           opened_at = IF(? > 0, ?, opened_at)
         WHERE id = ?`,
        [
          room?.status ?? 'lobby', room?.hostId || null, room?.congKhai === false ? 0 : 1,
          room?.config.level ?? 0,
          o.time ?? 0, o.lives ?? 0, o.peek ?? 0, o.shuffle ?? 0, o.special ?? 0,
          room?.countdownEnd ?? null, room?.emptyAt ?? null, alarmLuc, gameState,
          openedAt, openedAt, id
        ]
      );

      const ps = room?.players ?? [];
      if (ps.length) {
        /*
         * UPSERT chứ không xoá-rồi-chèn: `joined_at` phải giữ nguyên. Xoá rồi
         * chèn lại thì "vào phòng lúc nào" bị đặt lại sau MỖI nước lật thẻ, và
         * cột đó thành vô nghĩa.
         */
        await c.query(
          `INSERT INTO room_players
             (room_id, player_id, seat, name, avatar, client_id, token, is_ready,
              disconnected_at, last_seen, joined_at, left_at)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             seat = VALUES(seat), name = VALUES(name), avatar = VALUES(avatar),
             client_id = VALUES(client_id), token = VALUES(token),
             is_ready = VALUES(is_ready),
             disconnected_at = VALUES(disconnected_at), last_seen = VALUES(last_seen),
             left_at = 0`,
          [ps.map((p, i) => [
            id, p.id, i, p.name, p.avatar ?? null, p.clientId ?? null, p.token,
            p.ready ? 1 : 0, p.disconnectedAt, p.lastSeen ?? null, Date.now(), 0
          ])]
        );
      }
      /*
       * Ai không còn trong danh sách thì ĐÁNH DẤU ĐÃ RỜI, không xoá dòng. Một
       * câu, không phải đọc trước rồi so — `NOT IN` với nhiều nhất 10 mã là rẻ.
       */
      const conLai = ps.map((p) => p.id);
      await c.query(
        `UPDATE room_players SET left_at = ?
         WHERE room_id = ? AND left_at = 0
           ${conLai.length ? 'AND player_id NOT IN (?)' : ''}`,
        conLai.length ? [Date.now(), id, conLai] : [Date.now(), id]
      );

      // Theme: bảng nối thuần, xoá-chèn là đúng (không có cột nào phải giữ)
      const themes = room?.config.themeIds ?? [];
      await c.execute('DELETE FROM room_themes WHERE room_id = ?', [id]);
      if (themes.length) {
        await c.query('INSERT INTO room_themes (room_id, theme_id) VALUES ?',
          [themes.map((t) => [id, t])]);
      }

      await ghiNguoiChoi(c, ps);
      await ghiMatch(c, id, room, gameState);
      await c.commit();
    } catch (e) {
      await c.rollback().catch(() => { /* kết nối đã hỏng */ });
      throw e;
    } finally {
      c.release();
    }
  }

  /**
   * Sổ NGƯỜI CHƠI: mỗi trình duyệt một dòng, cộng dồn theo thời gian.
   *
   * `rooms_joined` chỉ tăng ở lần ĐẦU thấy người đó trong một phòng — nếu tăng
   * mỗi lần ghi thì sau một ván nó thành hàng trăm, vì `save()` chạy sau mỗi
   * nước lật thẻ. Chốt là `daDemPhong`: nhớ những cặp (phòng, người) đã đếm.
   *
   * `name` ghi đè bằng tên gần nhất — người ta đổi tên thì sổ theo tên mới.
   */
  async function ghiNguoiChoi(
    c: PoolConnection, ps: { id: string; name: string; clientId?: string }[]
  ): Promise<void> {
    const moi = ps.filter((p) => p.clientId);
    if (!moi.length) return;
    await c.query(
      `INSERT INTO players (client_id, name) VALUES ?
       ON DUPLICATE KEY UPDATE name = VALUES(name), last_seen = CURRENT_TIMESTAMP`,
      [moi.map((p) => [p.clientId, p.name])]
    );
  }

  /**
   * Ván vừa xong thì ghi một dòng vào `matches`.
   *
   * Trích thẳng từ snapshot của engine — KHÔNG cần room.ts báo gì: snapshot đã
   * mang `summaryCache` và `endedAt`. `INSERT IGNORE` cộng khoá duy nhất
   * `(room_id, ended_at)` làm việc này idempotent, nên gọi lại sau mỗi lần ghi
   * phòng cũng chỉ ra đúng một dòng — kho không phải nhớ "ván này ghi chưa".
   */
  async function ghiMatch(
    c: PoolConnection, roomId: number, room: RoomState | undefined, gameState: string | null
  ): Promise<void> {
    if (!gameState || room?.status !== 'ended') return;
    let g: {
      endedAt?: number; startedAt?: number; moves?: number;
      cards?: unknown[]; players?: { name: string; score: number }[];
      summaryCache?: { status: string; reason: string; seconds: number; ranking?: unknown[] } | null;
    };
    try { g = JSON.parse(gameState); } catch { return; }
    const sum = g.summaryCache;
    if (!sum || !g.endedAt) return;

    const xh = (sum.ranking as { name: string; score: number }[] | undefined) ?? g.players ?? [];
    const nhat = xh[0];
    const [kq] = await c.execute(
      `INSERT IGNORE INTO matches
         (room_id, seq, level, pairs, status, reason, moves, seconds,
          winner_name, winner_score, player_count, ranking, started_at, ended_at)
       VALUES (
         ?, (SELECT COALESCE(MAX(m.seq), 0) + 1 FROM matches m WHERE m.room_id = ?),
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId, roomId,
        0, Math.floor((g.cards?.length ?? 0) / 2),
        sum.status, sum.reason, g.moves ?? 0, Math.round(sum.seconds ?? 0),
        nhat?.name ?? null, nhat?.score ?? null, xh.length,
        JSON.stringify(xh), g.startedAt ?? 0, g.endedAt
      ]
    );

    /*
     * Cộng vào sổ người chơi — CHỈ KHI dòng matches vừa rồi là dòng MỚI.
     * `affectedRows` của INSERT IGNORE bằng 0 khi bị bỏ qua vì trùng khoá, mà
     * `ghiMatch` chạy lại sau MỖI lần ghi phòng — thiếu chốt này thì một ván
     * được cộng hàng chục lần.
     */
    if (!((kq as { affectedRows?: number }).affectedRows ?? 0)) return;

    /*
     * Tra client_id từ BẢNG room_players, không từ `room.players` đang có
     * trong bộ nhớ: người đầu hàng bị gỡ khỏi danh sách đó ngay lúc thua, nên
     * tra theo bộ nhớ thì họ không bao giờ được tính là đã chơi ván nào. Đã
     * gặp thật — người thua ra sổ với 0 ván.
     *
     * Bảng thì còn đủ vì người rời chỉ bị đánh dấu `left_at`, không xoá.
     */
    const tenTrongVan = xh.map((p) => p.name);
    if (tenTrongVan.length) {
      await c.query(
        `UPDATE players SET matches = matches + 1 WHERE client_id IN (
           SELECT client_id FROM (
             SELECT DISTINCT client_id FROM room_players
             WHERE room_id = ? AND client_id IS NOT NULL AND name IN (?)
           ) AS t)`,
        [roomId, tenTrongVan]
      );
    }
    if (nhat?.name) {
      await c.query(
        `UPDATE players SET wins = wins + 1 WHERE client_id IN (
           SELECT client_id FROM (
             SELECT DISTINCT client_id FROM room_players
             WHERE room_id = ? AND client_id IS NOT NULL AND name = ?
           ) AS t)`,
        [roomId, nhat.name]
      );
    }
  }

  /**
   * Đóng phòng — KHÔNG xoá dòng.
   *
   * Ba việc phải làm cùng lúc, thiếu cái nào cũng để lại rác:
   *  - `closed_at` khác 0 (mã được giải phóng cho phòng sau),
   *  - bỏ `game_state`: phòng chết ôm 4KB snapshot của ván đã xong thì vô ích,
   *  - bỏ `token` của người chơi: đó là bí mật để vào lại một phòng không còn.
   *
   * Trùng khoá `(code, closed_at)` xảy ra khi hai phòng cùng mã đóng đúng cùng
   * một mili giây. Hiếm, nhưng nếu không xử thì câu UPDATE hỏng và phòng KHÔNG
   * đóng được — mã bị chiếm vĩnh viễn. Nhích thêm 1ms rồi thử lại.
   */
  async function dongPhong(code: string, lyDo: string): Promise<void> {
    const id = idCuaMa.get(code);
    idCuaMa.delete(code);   // phòng sau dùng lại mã này phải nhận id MỚI
    if (id === undefined) return;
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      let luc = Date.now();
      for (let thu = 0; thu < 5; thu++) {
        try {
          await c.execute(
            `UPDATE rooms SET closed_at = ?, close_reason = ?, status = 'closed', game_state = NULL
             WHERE id = ? AND closed_at = 0`,
            [luc, lyDo, id]
          );
          break;
        } catch (e) {
          if ((e as { code?: string }).code !== 'ER_DUP_ENTRY') throw e;
          luc += 1;
        }
      }
      await c.execute(
        'UPDATE room_players SET left_at = IF(left_at = 0, ?, left_at), token = NULL WHERE room_id = ?',
        [luc, id]
      );
      await c.commit();
    } catch (e) {
      await c.rollback().catch(() => { /* kết nối đã hỏng */ });
      throw e;
    } finally {
      c.release();
    }
  }

  /** Một dòng của bảng `rooms` như driver trả về. */
  interface DongPhong {
    id: number; code: string; host_id: string | null; status: string; is_public: number;
    level: number; opt_time: number; opt_lives: number; opt_peek: number;
    opt_shuffle: number; opt_special: number; countdown_end: number | null;
    empty_at: number | null; alarm_at: number | null; opened_at: number;
    game_state: string | null;
  }
  /** Một dòng của bảng `room_players`. */
  interface DongNguoiChoi {
    room_id: number; player_id: string; name: string; avatar: string | null;
    token: string | null; is_ready: number; disconnected_at: number | null; last_seen: number | null;
  }

  return {
    /**
     * Lắp lại phòng ĐANG SỐNG từ các cột, thành đúng hình dạng `ctx.storage` giữ.
     *
     * `closed_at = 0` ở cả ba câu: bỏ sót một chỗ là phòng đã đóng sống lại và
     * người chơi vào được phòng không còn tồn tại.
     *
     * Ba truy vấn cho cả cụm, không phải mỗi phòng một truy vấn — đây nằm trên
     * đường khởi động, server chưa nhận request nào cho tới khi xong.
     */
    async napTatCa() {
      const ra = new Map<string, { duLieu: DuLieuPhong; alarmLuc: number | null }>();
      try {
        const [rows] = await pool.query('SELECT * FROM rooms WHERE closed_at = 0');
        const [prows] = await pool.query(
          `SELECT p.* FROM room_players p JOIN rooms r ON r.id = p.room_id
           WHERE r.closed_at = 0 AND p.left_at = 0 ORDER BY p.room_id, p.seat`
        );
        const [trows] = await pool.query(
          `SELECT t.room_id, t.theme_id FROM room_themes t JOIN rooms r ON r.id = t.room_id
           WHERE r.closed_at = 0`
        );
        const nguoiTheoPhong = new Map<number, Record<string, unknown>[]>();
        for (const p of prows as DongNguoiChoi[]) {
          const ds = nguoiTheoPhong.get(p.room_id) ?? [];
          ds.push({
            id: p.player_id, name: p.name, token: p.token ?? '',
            ready: !!p.is_ready,
            // `null` chứ không phải `undefined`: room.ts so `=== null` để biết
            // ai đang kết nối.
            disconnectedAt: p.disconnected_at === null ? null : Number(p.disconnected_at),
            ...(p.avatar ? { avatar: p.avatar } : {}),
            ...(p.last_seen === null ? {} : { lastSeen: Number(p.last_seen) })
          });
          nguoiTheoPhong.set(p.room_id, ds);
        }
        const themeTheoPhong = new Map<number, string[]>();
        for (const t of trows as { room_id: number; theme_id: string }[]) {
          const ds = themeTheoPhong.get(t.room_id) ?? [];
          ds.push(t.theme_id);
          themeTheoPhong.set(t.room_id, ds);
        }
        for (const r of rows as DongPhong[]) {
          const id = Number(r.id);
          idCuaMa.set(r.code, id);
          const duLieu: DuLieuPhong = {
            // Cờ này là thứ `exists()` đọc để biết mã phòng có thật — thiếu nó
            // thì phòng khôi phục xong bị coi như không tồn tại.
            created: true,
            openedAt: Number(r.opened_at),
            room: {
              code: r.code,
              hostId: r.host_id ?? '',
              status: r.status,
              congKhai: !!r.is_public,
              config: {
                level: Number(r.level),
                themeIds: themeTheoPhong.get(id) ?? [],
                options: {
                  time: Number(r.opt_time), lives: Number(r.opt_lives),
                  peek: Number(r.opt_peek), shuffle: Number(r.opt_shuffle),
                  special: Number(r.opt_special)
                }
              },
              players: nguoiTheoPhong.get(id) ?? [],
              ...(r.countdown_end === null ? {} : { countdownEnd: Number(r.countdown_end) }),
              ...(r.empty_at === null ? {} : { emptyAt: Number(r.empty_at) })
            }
          };
          if (r.game_state !== null) duLieu.game = r.game_state;
          ra.set(r.code, { duLieu, alarmLuc: r.alarm_at === null ? null : Number(r.alarm_at) });
        }
        // Dọn phòng đã đóng lâu. Xoá mềm mà không dọn thì bảng phình mãi:
        // room_players và room_themes đi theo nhờ ON DELETE CASCADE, còn
        // `matches` thì KHÔNG — lịch sử ván đấu nhẹ và đáng giữ lâu hơn.
        const [xoa] = await pool.execute(
          'DELETE FROM rooms WHERE closed_at > 0 AND closed_at < ?',
          [Date.now() - GIU_PHONG_DONG_MS]
        );
        const n = (xoa as { affectedRows?: number }).affectedRows ?? 0;
        if (n) console.log(`[kho] dọn ${n} phòng đã đóng quá 30 ngày`);
      } catch (e) {
        console.error('[kho] nạp phòng lỗi, bắt đầu với kho rỗng:', (e as Error).message);
      }
      return ra;
    },
    ghi(code, duLieu, alarmLuc) { cho.set(code, { duLieu, alarmLuc }); henGhi(); },
    dong(code, lyDo) { cho.set(code, { dong: lyDo }); henGhi(); },
    async dongKho() {
      clearTimeout(hen);
      hen = undefined;
      await dangGhi;
      await day();              // đẩy nốt phần vừa dồn vào trong lúc chờ
      try { await pool.end(); } catch { /* đang tắt, kệ */ }
    }
  };
}
