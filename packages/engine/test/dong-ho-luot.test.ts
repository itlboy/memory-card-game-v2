import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';

/**
 * ĐỒNG HỒ LƯỢT PHẢI ĐỨNG khi người đang đi mất kết nối.
 *
 * `turnDeadline` là một mốc TUYỆT ĐỐI, nên trước đây rớt sóng vài giây là mất
 * trắng lượt: quay lại thì đã sang lượt người khác. Mất mạng không phải lỗi của
 * người chơi, không được tính vào thời gian suy nghĩ của họ.
 *
 * Engine không biết ai đang kết nối — đó là việc của tầng phòng. Ở đây chỉ kiểm
 * hai phép: dừng thì đồng hồ đứng, chạy tiếp thì trả lại ĐÚNG số giây còn lại.
 */
const dungBan = () => {
  const g = new MemoryGame({
    cols: 2, rows: 2, pairs: 2, symbols: ['a', 'b'], seed: 7,
    turnLimit: 30, flipBackMs: 800,
    // Người chơi nằm TRONG config, constructor chỉ nhận đúng một tham số
    players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]
  } as never);
  g.start(1000);
  return g;
};

describe('đồng hồ lượt khi mất kết nối', () => {
  it('đang chạy thì đếm ngược bình thường', () => {
    const g = dungBan();
    expect(g.turnTimeLeft(1000)).toBe(30);
    expect(g.turnTimeLeft(11_000)).toBe(20);
  });

  it('tạm dừng thì đồng hồ ĐỨNG, không tụt tiếp', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);                    // rớt mạng ở giây thứ 10
    expect(g.turnTimeLeft(11_000)).toBe(20);
    expect(g.turnTimeLeft(31_000), 'đã dừng mà vẫn tụt').toBe(20);   // dừng 20s, trong trần
  });

  it('chạy tiếp thì trả lại ĐÚNG số giây còn lại lúc rớt', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);                    // còn 20 giây
    g.chayTiepLuot(31_000);                   // mất mạng 20 giây (trong trần)
    expect(g.turnTimeLeft(31_000), 'phải vẫn còn đúng 20 giây').toBe(20);
    expect(g.turnTimeLeft(41_000)).toBe(10);
  });

  it('KHÔNG xử hết giờ trong lúc đang dừng', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);
    const ev = g.tick(31_000);                // quá hạn cũ, chưa quá trần dừng
    expect(ev.some((e) => e.type === 'turn-timeout'), 'mất lượt oan khi đang rớt mạng').toBe(false);
  });

  it('hết giờ vẫn xử bình thường sau khi chạy tiếp', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);
    g.chayTiepLuot(31_000);
    expect(g.tick(45_000).some((e) => e.type === 'turn-timeout'), 'chưa tới hạn mà đã xử').toBe(false);
    expect(g.tick(55_000).some((e) => e.type === 'turn-timeout'), 'quá hạn mà không xử').toBe(true);
  });

  it('gọi tạm dừng nhiều lần vẫn giữ mốc ĐẦU TIÊN', () => {
    // Tầng phòng phát hiện mất mạng bằng hai đường (socket đóng, watchdog nhịp
    // tim) nên hàm này bị gọi lặp là chuyện thường.
    const g = dungBan();
    g.tamDungLuot(11_000);
    g.tamDungLuot(25_000);
    g.chayTiepLuot(31_000);
    expect(g.turnTimeLeft(31_000), 'mốc dừng bị ghi đè').toBe(20);
  });

  /*
   * TRẦN CHO VIỆC DỪNG. Dừng đồng hồ dựa vào nhịp sống do CLIENT gửi, mà đó là
   * thứ server không kiểm soát nổi: bản cũ nằm trong cache service worker, một
   * bản dựng lỗi, hay ai đó nối bằng công cụ riêng. Không có trần thì những ca
   * đó làm ván TREO HẲN — tệ hơn hẳn cái nó định chữa (mất một lượt).
   */
  it('quá trần thì đồng hồ CHẠY TIẾP dù chưa ai gỡ tạm dừng', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);                    // còn 20 giây
    expect(g.turnTimeLeft(41_000)).toBe(20);  // vừa hết trần: mới đứng đủ 30 giây
    expect(g.turnTimeLeft(51_000)).toBe(10);  // từ đây chạy tiếp như không có gì
    expect(g.turnTimeLeft(61_000)).toBe(0);
    expect(g.tick(61_000).some((e) => e.type === 'turn-timeout'),
      'ván treo vĩnh viễn vì một client câm').toBe(true);
  });

  it('quota dừng CỘNG DỒN trong một lượt, không làm mới sau mỗi lần rớt', () => {
    const g = dungBan();
    for (let i = 0; i < 4; i++) {             // 4 lần rớt, mỗi lần 10 giây
      g.tamDungLuot(11_000 + i * 20_000);
      g.chayTiepLuot(21_000 + i * 20_000);
    }
    // Chỉ 30 trong 40 giây được bù, nên hạn chỉ lùi 30 giây chứ không phải 40.
    expect(g.turnPausedMs).toBe(30_000);
  });

  it('lượt mới được cấp lại quota dừng đầy', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);
    g.chayTiepLuot(41_000);                   // dùng hết trần
    g.tick(71_000);                           // hết giờ → sang lượt người kia
    expect(g.turnPausedMs, 'người sau phải được cấp lại quota').toBe(0);
  });

  it('sang lượt mới thì bỏ trạng thái dừng', () => {
    const g = dungBan();
    g.tamDungLuot(11_000);
    g.chayTiepLuot(11_000);
    g.tick(41_000);                           // hết giờ → sang lượt người kia
    expect(g.turnPausedAt, 'người sau nhận một đồng hồ đang đứng im').toBe(0);
  });
});

describe('mốc dừng phải sớm hơn một lượt', () => {
  it('LAG_MS < turnLimit, không thì nghẽn nuốt trọn lượt vẫn không ai biết', async () => {
    const room = await readFile(
      new URL('../../../apps/server/src/room.ts', import.meta.url), 'utf8');
    const lag = /const LAG_MS = ([\d_]+)/.exec(room);
    expect(lag, 'thiếu LAG_MS').not.toBeNull();
    const ms = Number(lag![1]!.replace(/_/g, ''));
    // turnLimit = 15s (options.ts/presets.ts). Ngưỡng dừng đồng hồ PHẢI nhỏ hơn
    // hẳn — đây đúng là lỗi đã lọt: mốc cũ là SILENT_MS 20s, dài hơn cả lượt.
    expect(ms).toBeLessThan(15_000 / 2);

    // Và không được quay về dùng `connected()`: nó chỉ đổi ở 20 giây.
    const than = room.slice(room.indexOf('private nhipDongHoLuot'));
    expect(than.slice(0, 700)).not.toMatch(/this\.connected\(dangDi\)/);
  });
})
