import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nganXep } from '../src/lib/phan-tich';

describe('báo lỗi JS lên GA', () => {
  it('nganXep giữ tệp:dòng:cột của hai khung đầu, bỏ đường dẫn', () => {
    const e = new TypeError('x');
    e.stack = 'TypeError: x\n    at f (https://flipmatch.cozypi.com/assets/index-Ab12.js?v=1:3:4567)\n    at g (https://flipmatch.cozypi.com/assets/vendor-Zz.js:1:22)\n    at h (a.js:9:9)';
    expect(nganXep(e)).toBe('index-Ab12.js:3:4567 < vendor-Zz.js:1:22');
    expect(nganXep('chuỗi')).toBe('');
  });

  it('ô sửa tên trong v-for dùng function ref (ref chuỗi trong v-for là MẢNG → .select hỏng)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');
    expect(src).not.toMatch(/\s ref="oTen" v-model/);
    expect(src).toMatch(/:ref="ganOTen"/);
  });
});
