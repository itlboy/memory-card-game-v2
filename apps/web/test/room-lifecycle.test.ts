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

  it('vẫn còn các mốc cũ: đồng hồ lượt, hết giờ, úp lại thẻ sai, hạn vào lại', () => {
    for (const mark of ['turnDeadline', 'flipBackMs', 'reconnectMs', 'SILENT_MS']) {
      expect(schedule, `mốc ${mark} biến mất khỏi scheduleNext()`).toMatch(mark);
    }
  });
});
