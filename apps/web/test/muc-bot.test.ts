import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOT_HALF_LIFE, BOT_SPECS } from '@mm/engine';
import type { BotLevel } from '@mm/engine';

/**
 * MỖI MỨC CỦA MÁY PHẢI CÓ ĐỦ BA THỨ, ở ba chỗ khác nhau:
 * nửa đời ký ức (engine) · tên + mặt (engine) · ô chọn có mô tả (màn hình).
 * Thiếu ô chọn thì mức đó tồn tại trong engine mà người chơi không vào được;
 * thiếu nửa đời thì `specFrom` nhận `undefined` và bot hoá ra nhớ tuyệt đối.
 */
const menu = readFileSync(resolve(process.cwd(), 'src/components/MenuScreen.vue'), 'utf8');
const MUC = Object.keys(BOT_SPECS) as BotLevel[];

describe('các mức của máy', () => {
  it('mức nào cũng có nửa đời ký ức và tên riêng', () => {
    for (const m of MUC) {
      expect(BOT_HALF_LIFE[m], `mức ${m} thiếu nửa đời`).toBeGreaterThan(0);
      expect(BOT_SPECS[m].name.trim(), `mức ${m} thiếu tên`).not.toBe('');
      expect(BOT_SPECS[m].avatar.trim(), `mức ${m} thiếu mặt`).not.toBe('');
    }
  });

  it('tên và mặt không trùng nhau — hai mức cùng mặt thì không phân biệt được', () => {
    const ten = MUC.map((m) => BOT_SPECS[m].name);
    const mat = MUC.map((m) => BOT_SPECS[m].avatar);
    expect(new Set(ten).size).toBe(ten.length);
    expect(new Set(mat).size).toBe(mat.length);
  });

  it('mức nào cũng có ô chọn kèm mô tả ở màn hình', () => {
    const khoi = menu.slice(menu.indexOf('const BOT_CHOICES'), menu.indexOf('function pickBotMode'));
    for (const m of MUC) {
      expect(khoi, `mức ${m} không có ô chọn — engine có mà người chơi không vào được`)
        .toContain(`id: '${m}' as BotLevel`);
    }
    const desc = [...khoi.matchAll(/desc: '([^']+)'/g)].map((x) => x[1]!);
    expect(desc.length, 'số mô tả phải khớp số mức').toBe(MUC.length);
    for (const d of desc) {
      expect(d, 'mô tả nói bằng cảm giác chơi, không lộ tham số engine')
        .not.toMatch(/retain|nửa đời|half.?life|\d\.\d/i);
    }
  });

  it('càng lên mức cao, máy càng nhớ dai — thang phải đơn điệu tăng', () => {
    const h = MUC.map((m) => BOT_HALF_LIFE[m]);
    for (let i = 1; i < h.length; i++) {
      expect(h[i], `mức ${MUC[i]} phải nhớ dai hơn ${MUC[i - 1]}`).toBeGreaterThan(h[i - 1]!);
    }
  });

  it('ô chọn xếp MỘT CỘT nên thêm mức không làm trang dài ra', () => {
    // Luật KHÔNG SCROLL: thêm lựa chọn thì ô thấp xuống, không phải trang dài ra.
    expect(menu).toMatch(/step === 'bot'[^>]*class="step-body options loose"/);
  });
});
