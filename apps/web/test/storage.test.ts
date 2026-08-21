import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/lib/storage';

beforeEach(() => localStorage.clear());

describe('tuỳ chọn', () => {
  it('trả về mặc định khi chưa có gì lưu', () => {
    expect(store.prefs()).toEqual({
      dark: false, sound: true, mode: 'classic', grid: '4x4', theme: 'animals', playerCount: 1
    });
  });

  it('lưu từng phần, không xoá các tuỳ chọn khác', () => {
    store.savePrefs({ dark: true });
    store.savePrefs({ grid: '6x6' });
    expect(store.prefs()).toMatchObject({ dark: true, grid: '6x6', sound: true });
  });

  it('dữ liệu hỏng thì rơi về mặc định, không ném lỗi', () => {
    localStorage.setItem('mm.v2', '{khong-phai-json');
    expect(store.prefs().grid).toBe('4x4');
  });

  it('localStorage bị chặn (chế độ riêng tư) thì vẫn chạy', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => store.savePrefs({ dark: true })).not.toThrow();
    spy.mockRestore();
  });
});

describe('kỷ lục', () => {
  it('chưa chơi thì không có kỷ lục', () => {
    expect(store.best('classic', '4x4')).toBeNull();
  });

  it('lần đầu luôn là kỷ lục mới', () => {
    expect(store.saveResult('classic', '4x4', { score: 500, moves: 12, seconds: 40 })).toBe(true);
    expect(store.best('classic', '4x4')).toEqual({ score: 500, moves: 12, seconds: 40 });
  });

  it('chỉ ghi đè khi điểm cao hơn', () => {
    store.saveResult('classic', '4x4', { score: 500, moves: 12, seconds: 40 });
    expect(store.saveResult('classic', '4x4', { score: 300, moves: 9, seconds: 20 })).toBe(false);
    expect(store.best('classic', '4x4')!.score).toBe(500);
    expect(store.saveResult('classic', '4x4', { score: 900, moves: 8, seconds: 18 })).toBe(true);
    expect(store.best('classic', '4x4')!.score).toBe(900);
  });

  it('kỷ lục tách riêng theo chế độ và theo lưới', () => {
    store.saveResult('classic', '4x4', { score: 500, moves: 12, seconds: 40 });
    expect(store.best('time', '4x4')).toBeNull();
    expect(store.best('classic', '6x6')).toBeNull();
  });

  it('điểm tích lũy cộng dồn cả những ván không phá kỷ lục', () => {
    store.saveResult('classic', '4x4', { score: 500, moves: 12, seconds: 40 });
    store.saveResult('classic', '4x4', { score: 100, moves: 20, seconds: 90 });
    expect(store.totalScore()).toBe(600);
  });
});

describe('tiến trình Chiến dịch', () => {
  it('mặc định chỉ mở màn 1', () => {
    expect(store.unlockedLevel()).toBe(1);
    expect(store.campaign()).toEqual({});
  });

  it('qua màn thì mở màn kế tiếp', () => {
    store.saveLevel(1, 2, 800);
    expect(store.unlockedLevel()).toBe(2);
    store.saveLevel(2, 1, 600);
    expect(store.unlockedLevel()).toBe(3);
  });

  it('chơi lại chỉ nâng, không hạ số sao và điểm', () => {
    store.saveLevel(3, 3, 1200);
    store.saveLevel(3, 1, 400);
    expect(store.campaign()['3']).toEqual({ stars: 3, score: 1200 });
  });

  it('nâng sao khi chơi lại tốt hơn', () => {
    store.saveLevel(3, 1, 400);
    store.saveLevel(3, 3, 1300);
    expect(store.campaign()['3']).toEqual({ stars: 3, score: 1300 });
  });

  it('mọi lần chơi màn đều cộng vào điểm tích lũy', () => {
    store.saveLevel(1, 3, 1000);
    store.saveLevel(1, 1, 200);
    expect(store.totalScore()).toBe(1200);
  });

  it('mở khoá tính theo màn cao nhất đã qua, không phụ thuộc thứ tự lưu', () => {
    store.saveLevel(5, 1, 100);
    store.saveLevel(2, 1, 100);
    expect(store.unlockedLevel()).toBe(6);
  });
});

describe('thành tích', () => {
  it('trả về đúng những thành tích mới mở lần này', () => {
    expect(store.unlockAchievements(['flawless', 'lightspeed'])).toEqual(['flawless', 'lightspeed']);
    expect(store.unlockAchievements(['flawless'])).toEqual([]);
    expect(store.unlockAchievements(['flawless', 'survivor'])).toEqual(['survivor']);
    expect(store.achievements().sort()).toEqual(['flawless', 'lightspeed', 'survivor']);
  });

  it('danh sách rỗng thì không ghi gì', () => {
    expect(store.unlockAchievements([])).toEqual([]);
    expect(store.achievements()).toEqual([]);
  });
});

describe('tên người chơi', () => {
  it('lưu và đọc lại được', () => {
    expect(store.playerNames()).toEqual([]);
    store.savePlayerNames(['An', 'Bình']);
    expect(store.playerNames()).toEqual(['An', 'Bình']);
  });
});
