import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { store } from '@/lib/storage';

/*
 * TẠO PHÒNG ONLINE GỌN (17.11.2026): bấm "Tạo phòng" là có phòng ngay với bàn của phòng
 * mình làm chủ lần trước (Prefs.banOnline); đổi bàn là MỘT màn (BanChon) trong phòng chờ.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('Prefs.banOnline', () => {
  beforeEach(() => localStorage.clear());

  it('lưu rồi đọc lại đúng bàn', () => {
    store.savePrefs({ banOnline: { level: 15, themeIds: ['animals'], options: { time: 1, lives: 0, peek: 0, shuffle: 0, special: 0 } } });
    expect(store.prefs().banOnline).toEqual({ level: 15, themeIds: ['animals'], options: { time: 1, lives: 0, peek: 0, shuffle: 0, special: 0 } });
  });

  it('bản lưu hỏng thì coi như chưa tạo phòng lần nào', () => {
    for (const hong of [{ level: 0, themeIds: [] }, { level: 9999, themeIds: [] }, { level: 6, themeIds: [1] }, { level: 6 }]) {
      localStorage.setItem('mm.v2', JSON.stringify({ prefs: { banOnline: hong } }));
      expect(store.prefs().banOnline, JSON.stringify(hong)).toBeUndefined();
    }
  });
});

describe('luồng tạo phòng', () => {
  it('create() gọi createRoom ngay, không mở bước chọn bàn', () => {
    const create = src.slice(src.indexOf('function create(): void'), src.indexOf('\n}', src.indexOf('function create(): void')));
    expect(create).toContain('o.createRoom(');
    expect(create).not.toContain("wizard.value =");
  });

  it('nút Đổi bàn (phòng chờ, màn kết quả) mở màn một màn "ban"', () => {
    const mo = src.slice(src.indexOf('function openCfgWizard'), src.indexOf('\n}', src.indexOf('function openCfgWizard')));
    expect(mo).toContain("wizard.value = 'ban'");
  });
});
