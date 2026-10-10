import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KHOANG_MS, NHIP_SAI, WEB_MS, mauWeb, nhipGhep, rung } from '@/lib/rung';

/**
 * RUNG THEO SỐ NHỊP (chốt 10.10.2026): sai 1 chạm nhẹ · chuỗi 1 → 1 · 2–3 → 2 ·
 * 4–5 → 3 (cuối mạnh) · 6+ → 4, chốt ở 4. Chỉ rung theo nước của chính mình.
 */
const goc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('thang nhịp', () => {
  it('số nhịp tăng theo chuỗi và chốt ở 4', () => {
    expect([1, 2, 3, 4, 5, 6, 10, 40].map((s) => nhipGhep(s).length)).toEqual([1, 2, 2, 3, 3, 4, 4, 4]);
    expect(nhipGhep(0).length).toBe(1);
  });

  it('chuỗi cao thì nhịp cuối mạnh; ghép thường không có nhịp mạnh', () => {
    expect(nhipGhep(1).some((n) => n.muc === 'manh')).toBe(false);
    expect(nhipGhep(3).some((n) => n.muc === 'manh')).toBe(false);
    expect(nhipGhep(4).at(-1)!.muc).toBe('manh');
    expect(nhipGhep(6).at(-1)!.muc).toBe('manh');
  });

  it('lật sai nhẹ hơn mọi cú ghép đúng', () => {
    expect(NHIP_SAI).toEqual([{ muc: 'nhe' }]);
    expect(WEB_MS.nhe).toBeLessThan(WEB_MS.vua);
  });

  it('mẫu web xen nghỉ giữa các nhịp, không có rung dài', () => {
    expect(mauWeb(nhipGhep(4))).toEqual([WEB_MS.vua, KHOANG_MS, WEB_MS.vua, KHOANG_MS, WEB_MS.manh]);
    // Chỉ đoạn BẬT (vị trí chẵn) phải ngắn; vị trí lẻ là khoảng nghỉ
    mauWeb(nhipGhep(9)).forEach((v, i) => { if (i % 2 === 0) expect(v).toBeLessThanOrEqual(60); });
  });
});

describe('phát ra', () => {
  afterEach(() => { vi.unstubAllGlobals(); rung.bat = true; });

  it('web: gọi navigator.vibrate với đúng mẫu; tắt công tắc là im', () => {
    const vib = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vib });
    rung.ghep(2);
    expect(vib).toHaveBeenCalledWith(mauWeb(nhipGhep(2)));
    rung.bat = false;
    rung.sai();
    expect(vib).toHaveBeenCalledTimes(1);
  });

  it('máy không có vibrate (Safari iOS) thì im lặng, không ném lỗi', () => {
    vi.stubGlobal('navigator', {});
    expect(() => { rung.ghep(5); rung.sai(); }).not.toThrow();
    expect(rung.coTheRung()).toBe(false);
  });
});

describe('chỉ rung theo nước của chính mình', () => {
  it('offline: bỏ qua nước của máy', () => {
    const s = goc('src/composables/useGameSession.ts');
    expect(s).toMatch(/if \(e\.playerId !== BOT_ID\) rung\.ghep\(streak\)/);
    expect(s).toMatch(/if \(game\.value\?\.current\?\.id !== BOT_ID\) rung\.sai\(\)/);
  });
  it('online: chỉ nước của tôi', () => {
    const s = goc('src/composables/useOnlineRoom.ts');
    expect(s).toMatch(/if \(e\.playerId === myId\.value\) rung\.ghep\(streak\)/);
    expect(s).toMatch(/if \(myTurn\.value\) rung\.sai\(\)/);
  });
});
