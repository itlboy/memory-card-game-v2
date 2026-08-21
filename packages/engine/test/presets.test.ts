import { describe, expect, it } from 'vitest';
import { GRIDS, presetConfig } from '../src/presets.js';
import { SYMBOLS } from './helpers.js';

const make = (mode: Parameters<typeof presetConfig>[0]['mode'], grid = '4x4') =>
  presetConfig({ mode, grid, symbols: SYMBOLS, seed: 1 });

describe('cấu hình mặc định theo chế độ (SRS 3.1)', () => {
  it('mọi lưới đều có ít nhất 2 cặp và giới hạn thời gian dương', () => {
    for (const [key, g] of Object.entries(GRIDS)) {
      expect(Math.floor((g.cols * g.rows) / 2), key).toBeGreaterThanOrEqual(2);
      expect(g.timeLimit, key).toBeGreaterThan(0);
    }
  });

  it('có các lưới nhỏ 2x2 và 3x3 cho người mới', () => {
    expect(GRIDS['2x2']).toBeDefined();
    expect(GRIDS['3x3']).toBeDefined();
  });

  it('Classic: không giới hạn thời gian, không mạng, không thẻ đặc biệt', () => {
    const c = make('classic');
    expect(c.timeLimit).toBeUndefined();
    expect(c.lives).toBeUndefined();
    expect(c.specialRate).toBeUndefined();
  });

  it('Time Attack: lấy đúng giới hạn thời gian của lưới', () => {
    expect(make('time', '4x4').timeLimit).toBe(GRIDS['4x4']!.timeLimit);
    expect(make('time', '6x6').timeLimit).toBe(GRIDS['6x6']!.timeLimit);
  });

  it('Survival: 5 mạng và có thẻ đặc biệt, không giới hạn thời gian', () => {
    const c = make('survival');
    expect(c.lives).toBe(5);
    expect(c.specialRate).toBeGreaterThan(0);
    expect(c.timeLimit).toBeUndefined();
  });

  it('Peek: hé mở 4 giây rồi tính giờ', () => {
    const c = make('peek');
    expect(c.peekMs).toBe(4000);
    expect(c.timeLimit).toBe(GRIDS['4x4']!.timeLimit);
  });

  it('kích thước lưới được truyền đúng vào cấu hình', () => {
    const c = make('classic', '6x6');
    expect([c.cols, c.rows]).toEqual([GRIDS['6x6']!.cols, GRIDS['6x6']!.rows]);
  });

  it('lưới không hỗ trợ thì báo lỗi rõ ràng', () => {
    expect(() => make('classic', '9x9')).toThrow(/không được hỗ trợ/);
  });

  it('Campaign phải dùng levelConfig, không dùng presetConfig', () => {
    expect(() => make('campaign')).toThrow(/levelConfig/);
  });

  it('truyền danh sách người chơi thì giữ nguyên', () => {
    const players = [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }];
    expect(presetConfig({ mode: 'classic', grid: '4x4', symbols: SYMBOLS, seed: 1, players }).players)
      .toEqual(players);
  });
});
