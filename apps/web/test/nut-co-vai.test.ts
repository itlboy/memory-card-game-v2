import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MỌI NÚT ĐỀU CÓ VAI (ngôn ngữ "Thạch" của Kẹo, styles/skins/keo-thach.css — 17.10.2026).
 *
 * Trước đó mỗi component tự vẽ nút của mình và skin Kẹo phải đè từng tên lớp một: thêm nút mới
 * hay quên một nút là nó PHẲNG, chủ dự án bắt từng cái bằng mắt (HUD, phòng chờ, chat, Chiến
 * dịch…). Nay mỗi <button> phải mang một vai — lớp `thach` (hoặc lớp dùng chung đã là bí danh
 * của vai: btn, btn-primary, option, seg-btn, ô định danh, lá bài) — HOẶC `data-phang` (cố ý phẳng:
 * link chữ, dòng menu, công cụ debug), HOẶC nằm trong danh sách CHUA_XEP dưới đây.
 *
 * CHUA_XEP là nợ: nút ở hộp thoại ít dùng chưa được thiết kế lại. ĐỪNG thêm vào — xếp vai cho
 * nút mới. Xếp xong một nút thì xoá nó khỏi danh sách (test cũng đỏ nếu danh sách còn tên thừa).
 */
const VAI = /\b(thach|btn|btn-primary|option|seg-btn|card|o-vuong|o-chien-dich)\b/;
const CHUA_XEP: Record<string, string[]> = {
  'ChiaSeDialog.vue': ['dong'],
  'OnlineScreen.vue': ['sp-opt', 'nut-luu', 'nut-huy', 'nut-sua', 'nut-moi-ra'],
  'RulesDialog.vue': ['nut-do'],
  'TaiKhoanDialog.vue': ['nut-apple', 'nut-dh']
};

const DIR = resolve('src/components');
const files = [...readdirSync(DIR).filter((f) => f.endsWith('.vue')).map((f) => [f, resolve(DIR, f)]), ['App.vue', resolve('src/App.vue')]];

describe('nút có vai', () => {
  it('mọi <button> mang lớp vai, data-phang, hoặc nằm trong CHUA_XEP', () => {
    const loi: string[] = [];
    const conDung = new Set<string>();
    for (const [ten, duong] of files) {
      const s = readFileSync(duong!, 'utf8');
      const tpl = s.slice(s.indexOf('<template>'), s.lastIndexOf('</template>'));
      // thẻ mở: bỏ qua dấu > trong chuỗi thuộc tính (vd `@click="() => x"`)
      for (const m of tpl.matchAll(/<button\b(?:[^>"]|"[^"]*")*>/g)) {
        const the = m[0];
        if (the.includes('data-phang') || the.includes('data-nosfx-phang')) continue;
        const lop = the.match(/\sclass="([^"]*)"/)?.[1] ?? '';
        if (VAI.test(lop)) continue;
        const no = (CHUA_XEP[ten!] ?? []).find((x) => lop.split(/\s+/).includes(x));
        if (no) { conDung.add(`${ten}:${no}`); continue; }
        loi.push(`${ten}: <button class="${lop}"> chưa có vai (thêm class "thach …" hoặc data-phang)`);
      }
    }
    expect(loi).toEqual([]);
    const thua = Object.entries(CHUA_XEP).flatMap(([f, ds]) => ds.map((x) => `${f}:${x}`)).filter((k) => !conDung.has(k));
    expect(thua, 'CHUA_XEP còn tên không ai dùng — xoá đi').toEqual([]);
  });
});
