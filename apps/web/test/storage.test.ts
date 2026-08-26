import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/lib/storage';
import { DEFAULT_OPTIONS } from '@mm/engine';

beforeEach(() => localStorage.clear());

describe('tuỳ chọn', () => {
  it('trả về mặc định khi chưa có gì lưu', () => {
    expect(store.prefs()).toEqual({
      dark: false, sound: true, soundLevel: 'high',
      mode: 'classic', level: 1, themes: [], playerCount: 1,
      options: DEFAULT_OPTIONS
    });
  });

  it('bản lưu cũ chỉ có sound bật/tắt được chuyển sang ba mức', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { sound: false } }));
    expect(store.prefs().soundLevel).toBe('off');
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { sound: true } }));
    expect(store.prefs().soundLevel).toBe('high');
  });

  it('lưu từng phần, không xoá các tuỳ chọn khác', () => {
    store.savePrefs({ dark: true });
    store.savePrefs({ level: 12 });
    expect(store.prefs()).toMatchObject({ dark: true, level: 12, sound: true });
  });

  it('dữ liệu hỏng thì rơi về mặc định, không ném lỗi', () => {
    localStorage.setItem('mm.v2', '{khong-phai-json');
    expect(store.prefs().level).toBe(1);
  });

  it('migration từ bản cũ chỉ lưu một theme', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { theme: 'fruits' } }));
    expect(store.prefs().themes).toEqual(['fruits']);
  });

  it('mảng theme rỗng được giữ nguyên — App hiểu là "chưa chọn" và bật tất cả', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { themes: [] } }));
    expect(store.prefs().themes).toEqual([]);
  });

  it('bản lưu cũ chỉ có một theme (khoá `theme`) vẫn được chuyển sang mảng', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { theme: 'fruits' } }));
    expect(store.prefs().themes).toEqual(['fruits']);
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

describe('tiến trình các cấp', () => {
  it('mặc định chỉ mở cấp 1', () => {
    expect(store.unlockedLevel()).toBe(1);
    expect(store.progress('campaign')).toEqual({});
  });

  it('qua cấp thì mở cấp kế tiếp', () => {
    store.saveLevel('campaign', 1, 2, 800);
    expect(store.unlockedLevel()).toBe(2);
    store.saveLevel('campaign', 2, 1, 600);
    expect(store.unlockedLevel()).toBe(3);
  });

  it('chơi lại chỉ nâng, không hạ số sao và điểm', () => {
    store.saveLevel('campaign', 3, 3, 1200);
    store.saveLevel('campaign', 3, 1, 400);
    expect(store.progress('campaign')['3']).toEqual({ stars: 3, score: 1200 });
  });

  it('nâng sao khi chơi lại tốt hơn', () => {
    store.saveLevel('campaign', 3, 1, 400);
    store.saveLevel('campaign', 3, 3, 1300);
    expect(store.progress('campaign')['3']).toEqual({ stars: 3, score: 1300 });
  });

  it('mở khoá tính theo cấp cao nhất đã qua, không phụ thuộc thứ tự lưu', () => {
    store.saveLevel('campaign', 5, 1, 100);
    store.saveLevel('campaign', 2, 1, 100);
    expect(store.unlockedLevel()).toBe(6);
  });

  it('sao tính RIÊNG từng chế độ, nhưng mở khoá dùng CHUNG', () => {
    store.saveLevel('classic', 4, 1, 500);
    expect(store.progress('classic')['4']).toBeDefined();
    expect(store.progress('survival')['4']).toBeUndefined();  // sao riêng
    expect(store.unlockedLevel()).toBe(5);                    // mở khoá chung
  });

  it('saveLevel KHÔNG cộng điểm — saveResult mới cộng, gọi cả hai không tính hai lần', () => {
    store.saveLevel('classic', 1, 1, 1000);
    expect(store.totalScore()).toBe(0);
    store.saveResult('classic', 1, { score: 1000, moves: 2, seconds: 5 });
    expect(store.totalScore()).toBe(1000);
  });

  it('đọc được tiến độ Chiến dịch của bản lưu cũ (khoá không mang chế độ)', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ campaign: { '7': { stars: 2, score: 900 } } }));
    expect(store.progress('campaign')['7']).toEqual({ stars: 2, score: 900 });
    expect(store.unlockedLevel()).toBe(8);
  });

  it('bản lưu cũ chỉ có cỡ bàn thì đổi sang cấp có cùng số cặp', () => {
    localStorage.setItem('mm.v2', JSON.stringify({ prefs: { grid: '6x6' } }));
    expect(store.prefs().level).toBe(18);   // 6×6 = 18 cặp
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
