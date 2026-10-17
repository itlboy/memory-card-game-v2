import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HINH_TRANG_CHU } from '../src/lib/hinh-trang-chu';
import { tenFileEmoji } from '../src/lib/emoji';

/** Hình tuyển chọn của quạt lá trang chủ: có trong theme MIỄN PHÍ (tai-noto3d giữ file) và có ảnh Noto 3D. */
describe('hình trang chủ', () => {
  const themes = JSON.parse(readFileSync(resolve('public/data/themes.json'), 'utf8')).themes as { premium?: boolean; symbols: string[] }[];
  const mienPhi = new Set(themes.filter((t) => !t.premium).flatMap((t) => t.symbols));
  it('mỗi hình nằm trong một theme miễn phí và có file 3D', () => {
    for (const e of HINH_TRANG_CHU) {
      expect(mienPhi.has(e), `${e} không thuộc theme miễn phí`).toBe(true);
      expect(existsSync(resolve(`public/emoji/3d/${tenFileEmoji(e)}.webp`)), `${e} thiếu ảnh Noto 3D`).toBe(true);
    }
  });
});
