import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, makeGame, pairSlots } from './helpers.js';

/**
 * TẠM DỪNG CẢ VÁN (nút ⏸, ván offline). Ba điều phải đúng: lúc dừng mọi đồng
 * hồ đứng và không nhận nước đi; chạy tiếp thì thời gian ván KHÔNG tính phần
 * ngồi chờ; và F5 giữa lúc dừng vẫn còn dừng.
 */
describe('tạm dừng cả ván', () => {
  it('thời gian ván và thời gian còn lại đứng yên khi dừng', () => {
    const g = makeGame({ timeLimit: 60 });
    g.start(0);
    g.tamDungVan(10_000);
    expect(g.elapsed(50_000)).toBe(10);
    expect(g.timeLeft(50_000)).toBe(50);
    expect(g.tick(500_000), 'đang dừng mà vẫn hết giờ').toEqual([]);
    expect(g.status).toBe('playing');
  });

  it('chạy tiếp thì không tính phần đã dừng', () => {
    const g = makeGame({ timeLimit: 60 });
    g.start(0);
    g.tamDungVan(10_000);
    g.chayTiepVan(70_000);                  // dừng 60 giây
    expect(g.elapsed(75_000)).toBe(15);
    expect(g.timeLeft(75_000)).toBe(45);
  });

  it('không nhận nước đi khi đang dừng', () => {
    const g = makeGame();
    g.start(0);
    const [a] = pairSlots(g)[0]!;
    g.tamDungVan(1000);
    expect(g.flip(a, 2000)).toEqual([]);
    g.chayTiepVan(3000);
    expect(g.flip(a, 3500).length).toBeGreaterThan(0);
  });

  it('lá đang chờ úp lại thì chờ đủ phần còn lại sau khi chạy tiếp', () => {
    const g = makeGame({ flipBackMs: 1000 });
    g.start(0);
    const s = pairSlots(g);
    g.flip(s[0]![0], 100);
    g.flip(s[1]![0], 100);                  // sai — úp lại lúc 1100
    g.tamDungVan(600);
    g.chayTiepVan(10_600);                  // dời 10 giây → úp lại lúc 11_100
    g.tick(11_000);
    expect(g.locked, 'úp lại sớm — không dời mốc chờ').toBe(true);
    g.tick(11_101);
    expect(g.locked).toBe(false);
  });

  it('F5 giữa lúc dừng vẫn còn dừng', () => {
    const g = makeGame({ timeLimit: 60 });
    g.start(0);
    g.tamDungVan(5000);
    const r = MemoryGame.restore(g.snapshot());
    expect(r.dangTamDung).toBe(true);
    expect(r.elapsed(99_000)).toBe(5);
  });
});

/**
 * DEPLOY KHÔNG MẤT LƯỢT (18.10.2026): server Node dừng ván lúc nhận SIGTERM, lưu snapshot xuống
 * MySQL, pod mới dựng lại từ snapshot rồi chạy tiếp (room.ts dungDeKhoiDongLai / chayTiepSauKhoiDong).
 * Server tắt bao lâu thì đồng hồ LƯỢT và đồng hồ VÁN không được trừ bấy nhiêu.
 */
describe('deploy giữa ván online: tắt server không làm mất lượt', () => {
  it('giờ lượt còn nguyên sau khi tắt 10 giây và dựng lại từ snapshot', () => {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 42, turnLimit: 25, shufflePlayers: false,
      players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }]
    });
    g.start(0);
    expect(g.turnTimeLeft(10_000)).toBe(15);
    g.tamDungVan(10_000);                                   // SIGTERM lúc 10s
    const r = MemoryGame.restore(g.snapshot());             // qua MySQL (game_state)
    expect(r.dangTamDung).toBe(true);
    expect(r.vanDungTu, 'pod mới phải biết đã dừng từ lúc nào').toBe(10_000);
    r.chayTiepVan(20_000);                                  // pod mới lên sau 10s
    expect(r.turnTimeLeft(20_000), 'người đang tới lượt mất 10 giây vì deploy').toBe(15);
    expect(r.tick(34_000), 'chưa hết lượt mà đã bị chuyển').toEqual([]);
  });
});
