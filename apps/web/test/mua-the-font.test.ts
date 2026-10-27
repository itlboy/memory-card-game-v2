import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FONT NÚT Ở MƯA THẺ (27.10.2026). Mưa Thẻ từng dựng nút hành động bằng `thach` trần — lớp đó chỉ tô
 * khối, KHÔNG đặt font, nên chữ rơi về font thường trong khi nút cùng việc ở ván thường (`btn`,
 * `btn-primary`) là font tiêu đề. Chủ dự án báo hai lần (màn tạm dừng, bảng kết quả): "đừng để mắc lỗi nữa".
 * Luật: nút có CHỮ DỊCH (`t(…)`) ở các màn này phải mang `btn`.
 */
const FILES = ['components/MuaThe.vue', 'components/TamDung.vue'];

describe('Mưa Thẻ: nút có chữ dùng btn như ván thường', () => {
  for (const f of FILES) {
    it(f, () => {
      const s = readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
      const tpl = s.slice(s.indexOf('<template>'), s.lastIndexOf('</template>'));
      const loi: string[] = [];
      for (const m of tpl.matchAll(/<button\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/button>/g)) {
        const [, attrs, ruot] = m;
        if (!/\{\{\s*t\(/.test(ruot!)) continue;   // nút chỉ icon / chỉ số: không có chữ dịch
        const lop = attrs!.match(/\sclass="([^"]*)"/)?.[1] ?? '';
        if (!/\bbtn\b/.test(lop)) loi.push(`<button class="${lop}"> ${ruot!.trim().slice(0, 50)}`);
      }
      expect(loi, `${f}: nút có chữ phải mang lớp btn (font tiêu đề của skin)`).toEqual([]);
    });
  }
});
