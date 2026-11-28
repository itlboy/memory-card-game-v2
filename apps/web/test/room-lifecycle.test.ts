import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOM_LIMITS } from '@mm/engine';

/**
 * VÒNG ĐỜI PHÒNG + CHUỖI ALARM của Durable Object.
 *
 * Vì sao test nằm ở apps/web: đây là package duy nhất có vitest trong
 * `pnpm test` (giống deploy-config.test.ts). Nội dung nó kiểm là
 * apps/server/src/room.ts.
 *
 * Vì sao phải kiểm bằng đọc nguồn: mỗi luật dưới đây chỉ vỡ ra sau hàng phút
 * chờ thật, hoặc chỉ vỡ khi mạng đứt đúng kiểu — không có smoke nào chịu chờ 10
 * phút, mà sai thì KHÔNG có gì báo đỏ. Cả bốn thứ ở đây đều đã từng sai thật.
 */
const src = readFileSync(
  resolve(process.cwd(), '../server/src/room.ts'), 'utf8'
);
/** Đọc một hằng số ms trong room.ts (viết kiểu 20_000). */
const hangSo = (ten: string): number => {
  const m = new RegExp(`const ${ten} = ([0-9_]+);`).exec(src);
  expect(m, `không thấy hằng số ${ten} trong room.ts`).toBeTruthy();
  return Number(m![1].replace(/_/g, ''));
};

describe('ngưỡng phát hiện mất kết nối', () => {
  it('SILENT_MS phải NGẮN HƠN hạn xử thua, không thì vừa phát hiện đã xử thua', () => {
    // Lúc phát hiện, `disconnectedAt` được LÙI về `lastSeen` chứ không phải
    // `now`, nên hạn xử thua luôn là reconnectMs kể từ lần cuối thấy họ. Đặt
    // SILENT_MS bằng hoặc quá reconnectMs là mất sạch cửa vào lại.
    expect(hangSo('SILENT_MS')).toBeLessThan(ROOM_LIMITS.reconnectMs);
    // Và phải chừa lại một khoảng thật sự dùng được, không phải 1 giây
    expect(ROOM_LIMITS.reconnectMs - hangSo('SILENT_MS')).toBeGreaterThanOrEqual(5_000);
  });

  it('disconnectedAt LÙI về lastSeen, không phải now', () => {
    // Đây chính là thứ làm phép tính trên đúng. Đổi thành `now` là hạn vào lại
    // âm thầm dài ra thành SILENT_MS + reconnectMs.
    expect(src).toMatch(/p\.disconnectedAt = seen/);
  });

  it('ngoài ván tha lâu hơn hẳn trong ván — lobby là chỗ người ta ngồi chờ nhau', () => {
    // Rời app đi mời bạn thì trình duyệt bóp setInterval của tab nền; lấy ngưỡng
    // trong ván ra dùng cho lobby là đá người ta khỏi phòng của chính mình.
    expect(hangSo('IDLE_SILENT_MS')).toBeGreaterThan(hangSo('SILENT_MS') * 2);
  });
});

describe('phòng rỗng và mã phòng đã chia', () => {
  it('lobby cạn người thì KHÔNG xoá ngay — link đã gửi phải còn dùng được', () => {
    expect(hangSo('EMPTY_LOBBY_MS')).toBeGreaterThanOrEqual(300_000);
    // Cạn người ở lobby là đánh dấu `emptyAt`, không phải deleteAll()
    expect(src).toMatch(/this\.room\.emptyAt = /);
  });

  it('có người vào lại thì mốc hẹn xoá bị bỏ, không thì phòng đang chơi vẫn bị dọn', () => {
    expect(src).toMatch(/delete this\.room\.emptyAt/);
  });

  it('phòng lập rồi không ai vào cũng có hạn — cờ `created` không tự mất', () => {
    expect(hangSo('UNUSED_ROOM_MS')).toBeGreaterThan(0);
    expect(src, 'open() phải ghi mốc và hẹn giờ dọn').toMatch(/openedAt/);
  });
});

describe('phòng thi đấu đã giải tán thì không được hẹn alarm nữa', () => {
  /*
   * 22.11.2026, server Mỹ: một trận thi đấu có người bỏ, người kia thoát app ở bảng kết quả → `veLobby()` giải tán phòng
   * (`dongThiDau`) nhưng nơi gọi chạy tiếp như thể phòng vừa về phòng chờ, hẹn mốc "im lặng" cho phòng đã chết. Tới mốc,
   * alarm giải tán lần nữa rồi hẹn lại mốc ĐÃ QUA → nổ mỗi ~1 ms: Node ăn ~26% CPU suốt 7 giờ, tới khi khởi động lại.
   */
  it('dongThiDau() bỏ phòng khỏi bộ nhớ', () => {
    const at = src.indexOf('private async dongThiDau()');
    expect(at, 'không thấy dongThiDau()').toBeGreaterThan(-1);
    const than = src.slice(at, src.indexOf('\n  }', at));
    expect(than, 'phòng đã dẹp mà `this.room` còn nguyên là nơi gọi hẹn alarm tiếp').toMatch(/this\.room = null/);
  });

  it('nơi gọi veLobby() rồi đặt emptyAt phải dừng khi phòng đã giải tán', () => {
    const cho = [...src.matchAll(/await this\.veLobby\(this\.room\.players\);\n([^\n]*)\n\s*this\.room\.emptyAt = /g)];
    expect(cho.length, 'không còn thấy hai chỗ "hết ván, 0 socket → về phòng chờ vắng"').toBe(2);
    for (const m of cho) expect(m[1], 'thiếu `if (!this.room) return;` ngay sau veLobby()').toMatch(/if \(!this\.room\) return;/);
  });

  it('server Node: phòng đã dẹp thì setAlarm bị bỏ qua', () => {
    const shim = readFileSync(resolve(process.cwd(), '../node-server/src/cf-shim.ts'), 'utf8');
    const at = shim.indexOf('setAlarm: async');
    expect(shim.slice(at, shim.indexOf('deleteAlarm: async', at))).toMatch(/if \(daDep\)/);
  });
});

describe('chuỗi alarm: mọi hạn chót đều phải có mốc đánh thức', () => {
  /** Khối scheduleNext() — nơi duy nhất quyết định DO thức lúc nào. */
  const schedule = (() => {
    const at = src.indexOf('private async scheduleNext()');
    expect(at, 'không thấy scheduleNext()').toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('\n  }', at));
  })();

  it('hết HÉ MỞ CẢ BÀN có mốc — thiếu nó thì bàn nằm mở tới khi alarm khác nổ', () => {
    // Đo được: bàn 6 thẻ đáng hé 3,6 giây thì nằm mở 15,5 giây. Lúc hé mở
    // `flip()` bị chặn nên KHÔNG nước đi nào làm engine nhích.
    expect(schedule).toMatch(/revealUntil/);
  });

  it('phòng rỗng có mốc — thiếu nó thì không bao giờ bị dọn', () => {
    expect(schedule).toMatch(/emptyAt/);
  });

  it('người im tiếng ngoài ván có mốc — thiếu nó thì phòng chết sống vĩnh viễn', () => {
    expect(schedule).toMatch(/IDLE_SILENT_MS/);
  });

  it('phòng chờ / đã kết thúc KHÔNG bao giờ nằm không alarm (28.11.2026: ~28 phòng ma sống tới 45 ngày)', () => {
    expect(schedule).toMatch(/!marks\.length && \(this\.room\?\.status === 'lobby' \|\| this\.room\?\.status === 'ended'\)\) marks\.push\(now \+ KIEM_TRA_MS\)/);
    expect(hangSo('KIEM_TRA_MS')).toBeGreaterThan(0);
  });

  it('người cuối rời phòng chờ: máy KHÔNG tính là còn người (phòng chỉ còn máy phải vắng)', () => {
    const at = src.indexOf('async webSocketClose(');
    const than = src.slice(at, src.indexOf('\n  }', at));
    expect(than).toMatch(/players\.some\(\(p\) => !p\.may && this\.connected\(p\.id\)\)/);
  });

  it('server Node: phòng khôi phục KHÔNG có mốc đã lưu vẫn được hẹn thức một lần', () => {
    const node = readFileSync(resolve(process.cwd(), '../node-server/src/index.ts'), 'utf8');
    const at = node.indexOf('async function khoiPhuc()');
    const than = node.slice(at, node.indexOf('\n}', at));
    expect(than).toMatch(/setAlarm\(alarmLuc !== null \?[^:]+: Date\.now\(\)/);
    expect(than, 'không được chỉ hẹn khi alarmLuc khác null').not.toMatch(/if \(alarmLuc !== null\) \{\s*void box/);
  });

  it('vẫn còn các mốc cũ: đồng hồ lượt, hết giờ, úp lại thẻ sai, hạn vào lại', () => {
    for (const mark of ['turnDeadline', 'flipBackMs', 'reconnectMs', 'SILENT_MS']) {
      expect(schedule, `mốc ${mark} biến mất khỏi scheduleNext()`).toMatch(mark);
    }
  });
});

/*
 * TỶ SỐ LOẠT DO SERVER ĐẾM (23.11.2026) — trước chỉ đếm ở client nên khán giả / người vào sau thấy 0–0–0.
 * Canh ba mắt xích: server cộng lúc hết ván (hoà thì không), gửi kèm thông tin phòng, và kho MySQL giữ qua lần thay ảnh.
 */
describe('tỷ số loạt nằm ở server', () => {
  const room = readFileSync(resolve(process.cwd(), '../server/src/room.ts'), 'utf8');
  const kho = readFileSync(resolve(process.cwd(), '../node-server/src/kho-mysql.ts'), 'utf8');
  const client = readFileSync(resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');
  it('hết ván: +1 cho người đứng đầu, hoà thì không ai; đếm số ván của loạt', () => {
    expect(room).toMatch(/this\.room\.soVan = \(this\.room\.soVan \?\? 0\) \+ 1/);
    expect(room).toMatch(/if \(nhat && !isDraw\(het\.summary\.ranking\)\)/);
    expect(room).toMatch(/p\.thang = \(p\.thang \?\? 0\) \+ 1/);
  });
  it('thông tin phòng mang `soVan` và `thang` của từng người', () => {
    expect(room).toMatch(/soVan: room\.soVan \?\? 0/);
    expect(room).toMatch(/p\.thang \? \{ thang: p\.thang \} : \{\}/);
  });
  it('kho MySQL lưu và nạp lại số ván thắng', () => {
    expect(kho).toMatch(/\['room_players', 'series_wins', 'INT NOT NULL DEFAULT 0'\]/);
    expect(kho).toMatch(/series_wins = VALUES\(series_wins\)/);
    expect(kho).toMatch(/p\.series_wins \? \{ thang: Number\(p\.series_wins\) \}/);
  });
  it('client lấy theo server ở cả `welcome` lẫn `room`, và thôi tự cộng', () => {
    expect(client.match(/layLoatTuServer\(msg\.room\);/g)?.length).toBe(2);
    expect(client).toMatch(/if \(!loatTuServer\) soVanLoat\.value\+\+/);
    expect(client).toMatch(/champName && !draw && !loatTuServer/);
  });
});
