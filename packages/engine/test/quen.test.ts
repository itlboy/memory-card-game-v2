import { describe, expect, it } from 'vitest';
import { makeGame, pairSlots } from './helpers.js';

/**
 * SAO CHIẾN DỊCH ĐẾM "QUÊN", KHÔNG ĐẾM MỌI LẦN LẬT SAI (chủ dự án 14.10.2026:
 * "trừ sao khi ngay cả ô đó chưa mở là không đúng"). Quên = lật sai khi lá
 * cùng cặp với lá lật đầu đã từng lộ — cùng điều kiện mất mạng.
 */
describe('đếm quên và ngôi sao thứ 4', () => {
  const ve = (g: ReturnType<typeof makeGame>, t: number) => g.tick(t + 2000);

  it('lật hai lá chưa từng mở mà không khớp: sai nhưng KHÔNG quên', () => {
    const g = makeGame({ starMisses: [3, 1] }); g.start(0);
    const s = pairSlots(g);
    g.flip(s[0]![0], 10); g.flip(s[1]![0], 20); ve(g, 20);
    expect(g.players[0]!.misses).toBe(1);
    expect(g.players[0]!.quen).toBe(0);
  });

  it('lá cùng cặp đã lộ mà vẫn lật chỗ khác: tính một lần quên', () => {
    const g = makeGame({ starMisses: [3, 1] }); g.start(0);
    const s = pairSlots(g);
    g.flip(s[0]![0], 10); g.flip(s[1]![0], 20); ve(g, 20);      // lộ A1, B1 — dò
    g.flip(s[0]![1], 3000); g.flip(s[2]![0], 3010); ve(g, 3010); // lật A2: A1 đã lộ mà chọn C1
    expect(g.players[0]!.quen).toBe(1);
  });

  it('thắng không quên lần nào thì có ngôi thứ 4; quên một lần là mất', () => {
    const sach = makeGame({ starMisses: [3, 1] }); sach.start(0);
    const s = pairSlots(sach);
    sach.flip(s[0]![0], 10); sach.flip(s[1]![0], 20); ve(sach, 20);   // sai khi dò — không sao
    let t = 5000;
    for (const [a, b] of pairSlots(sach)) { sach.flip(a, t); sach.flip(b, t + 10); t += 100; }
    const tot = sach.summary()!;
    expect(tot.status).toBe('won');
    expect(tot.stars).toBe(3);
    expect(tot.hoanHao).toBe(true);

    const quen = makeGame({ starMisses: [3, 1] }); quen.start(0);
    const q = pairSlots(quen);
    quen.flip(q[0]![0], 10); quen.flip(q[1]![0], 20); ve(quen, 20);
    quen.flip(q[0]![1], 3000); quen.flip(q[2]![0], 3010); ve(quen, 3010);
    t = 8000;
    for (const [a, b] of pairSlots(quen)) { quen.flip(a, t); quen.flip(b, t + 10); t += 100; }
    const sum = quen.summary()!;
    expect(sum.hoanHao).toBe(false);
    expect(sum.stars).toBe(3);      // quên 1 ≤ mốc 3★ (1)
  });

  it('chế độ không có mốc sao thì không có ngôi thứ 4', () => {
    const g = makeGame(); g.start(0);
    let t = 10;
    for (const [a, b] of pairSlots(g)) { g.flip(a, t); g.flip(b, t + 10); t += 100; }
    expect(g.summary()!.hoanHao).toBe(false);
  });
});
