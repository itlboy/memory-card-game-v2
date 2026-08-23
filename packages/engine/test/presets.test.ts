import { describe, expect, it } from 'vitest';
import { peekMsFor, presetConfig } from '../src/presets.js';
import { CAMPAIGN_LEVELS, levelSpec } from '../src/campaign.js';
import { SYMBOLS } from './helpers.js';

/** Màn 7 = 8 cặp = bàn 4×4 — cỡ bàn quen thuộc trong các test cũ. */
const L = 7;
const make = (mode: Parameters<typeof presetConfig>[0]['mode'], level = L) =>
  presetConfig({ mode, level, symbols: SYMBOLS, seed: 1 });

describe('cấu hình mặc định theo chế độ (SRS 3.1)', () => {
  it('Classic: không giới hạn thời gian, không mạng, không thẻ đặc biệt', () => {
    const c = make('classic');
    expect(c.timeLimit).toBeUndefined();
    expect(c.lives).toBeUndefined();
    expect(c.specialRate).toBeUndefined();
  });

  it('Time Attack: lấy đúng giới hạn thời gian của màn', () => {
    expect(make('time', 7).timeLimit).toBe(levelSpec(7).timeLimit);
    expect(make('time', 20).timeLimit).toBe(levelSpec(20).timeLimit);
  });

  it('Survival: 5 mạng và có thẻ đặc biệt, không giới hạn thời gian', () => {
    const c = make('survival');
    expect(c.lives).toBe(5);
    expect(c.specialRate).toBeGreaterThan(0);
    expect(c.timeLimit).toBeUndefined();
  });

  it('Peek: hé mở 4 giây rồi tính giờ', () => {
    const c = make('peek');
    // Giãn theo số thẻ: cấp 7 = 14 thẻ → 2s + 14×0,26s
    expect(c.peekMs).toBe(peekMsFor(levelSpec(L).pairs * 2));
    expect(peekMsFor(50)).toBe(15_000);            // neo: bàn 50 thẻ được 15 giây
    expect(peekMsFor(4)).toBeLessThan(peekMsFor(50));
    expect(c.timeLimit).toBe(levelSpec(L).timeLimit);
  });

  it('MỌI chế độ cùng một màn thì cùng một bàn — chọn bàn đã đồng nhất', () => {
    const spec = levelSpec(20);
    for (const mode of ['classic', 'time', 'survival', 'peek', 'campaign'] as const) {
      const c = make(mode, 20);
      expect([c.cols, c.rows, c.pairs], mode).toEqual([spec.cols, spec.rows, spec.pairs]);
    }
  });

  it('Campaign có mốc sao, các chế độ khác thì không', () => {
    expect(make('campaign').starThresholds).toHaveLength(2);
    expect(make('classic').starThresholds).toBeUndefined();
  });

  it('màn ngoài khoảng thì báo lỗi rõ ràng', () => {
    expect(() => make('classic', 0)).toThrow(/không tồn tại/);
    expect(() => make('classic', CAMPAIGN_LEVELS + 1)).toThrow(/không tồn tại/);
  });

  it('truyền danh sách người chơi thì giữ nguyên', () => {
    const players = [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }];
    expect(presetConfig({ mode: 'classic', level: L, symbols: SYMBOLS, seed: 1, players }).players)
      .toEqual(players);
  });
});
