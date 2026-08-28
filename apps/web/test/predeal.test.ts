import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryGame, predealSymbols, publicView } from '@mm/engine';

/**
 * Bàn-biết-trước (`t:'predeal'`) đánh đổi có ý thức: client giữ cả bàn trong bộ
 * nhớ để lật thẻ hiện ngay, không chờ vòng đi-về ~180ms. Ai mở DevTools là thấy
 * hết — chấp nhận, trò này chơi với bạn bè.
 *
 * Cái KHÔNG chấp nhận được là LỖI CỦA CHÍNH MÌNH làm lộ bài ra màn hình. Nên bộ
 * test này khoá đúng hai điều:
 *
 *   1. Dữ liệu đi bằng thông điệp RIÊNG, không lẫn vào `GameView` — `publicView`
 *      phải tiếp tục che thẻ úp y như trước khi có tính năng này.
 *   2. Client chỉ rót symbol vào ô ĐƯỢC PHÉP ngửa. Thẻ úp luôn nhận `''`, nên
 *      hỏng CSS hay hỏng animation cũng không lôi được cả bàn ra.
 */

function vanMoi(): MemoryGame {
  return new MemoryGame({
    cols: 4, rows: 4, mode: 'classic', seed: 12345,
    symbols: ['🦊', '🐼', '🐧', '🦁', '🐸', '🐙', '🦋', '🐝'],
    players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }],
  });
}

describe('bàn-biết-trước: dữ liệu không được lẫn vào view', () => {
  it('predealSymbols trả đủ nội dung cả bàn', () => {
    const g = vanMoi();
    const map = predealSymbols(g);
    const soThucChoi = g.cards.filter((c) => !c.blank).length;
    expect(Object.keys(map)).toHaveLength(soThucChoi);
    for (const c of g.cards) {
      if (c.blank) expect(map[c.index]).toBeUndefined();
      else expect(map[c.index]).toBe(c.symbol);
    }
  });

  it('publicView VẪN che thẻ úp — tính năng này không được nới lỏng NF-04', () => {
    const g = vanMoi();
    const v = publicView(g, 0, () => true);
    for (const c of v.cards) {
      if (c.state === 'down') {
        expect(c, `thẻ ${c.index} úp mà vẫn có symbol`).not.toHaveProperty('symbol');
      }
    }
  });

  it('view sau một nước lật chỉ hở đúng thẻ vừa lật', () => {
    const g = vanMoi();
    g.flip(0, 1000);
    const v = publicView(g, 1000, () => true);
    const hoRa = v.cards.filter((c) => 'symbol' in c && c.symbol).map((c) => c.index);
    expect(hoRa).toEqual([0]);
  });

  it('thông điệp predeal KHÔNG phải một field của GameView', () => {
    // Trộn vào view là mọi chỗ đang vẽ từ view đều có thể vô tình vẽ thẻ úp.
    const g = vanMoi();
    const v = publicView(g, 0, () => true) as Record<string, unknown>;
    expect(v.predeal).toBeUndefined();
    expect(v.symbols).toBeUndefined();
  });
});

describe('bàn-biết-trước: client chỉ nhả symbol cho ô được phép ngửa', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');

  it('có đúng MỘT cửa lấy dữ liệu, và nó kiểm điều kiện ngửa', () => {
    expect(src).toContain('function symbolNeuDuocPhep');
    // Điều kiện sống còn: chưa ngửa và không nằm trong pending thì trả rỗng.
    expect(src).toMatch(/if \(!ngua && !pending\.value\.has\(index\)\) return ''/);
  });

  it('không nơi nào ngoài cửa đó đọc `predeal.value`', () => {
    // Đọc trực tiếp là mất lớp kiểm tra — bug lộ bài đi qua đúng khe này.
    const doc = [...src.matchAll(/predeal\.value/g)].length;
    const trongCua = [...src.matchAll(/predeal\.value\.get\(index\)/g)].length;
    const ganKhiNhan = [...src.matchAll(/predeal\.value = new Map/g)].length;
    expect(doc, 'có chỗ đọc predeal.value ngoài symbolNeuDuocPhep')
      .toBe(trongCua + ganKhiNhan);
  });

  it('KHÔNG xuất `predeal` ra ngoài composable', () => {
    // Xuất ra là component nào cũng đọc được, lớp kiểm tra thành vô nghĩa.
    const khoiReturn = src.slice(src.lastIndexOf('return {'));
    expect(khoiReturn).not.toMatch(/^\s*predeal\s*,/m);
  });

  it('UI lấy symbol qua cửa đó, không đọc thẳng', () => {
    const ui = readFileSync(resolve(process.cwd(), 'src/components/OnlineGame.vue'), 'utf8');
    expect(ui).toContain('o.symbolNeuDuocPhep(');
    expect(ui).not.toMatch(/o\.predeal/);
  });
});

describe('bàn-biết-trước: công tắc ở server, và chỉ một chỗ', () => {
  const flags = readFileSync(
    resolve(process.cwd(), '../server/src/flags.ts'), 'utf8');
  const room = readFileSync(
    resolve(process.cwd(), '../server/src/room.ts'), 'utf8');

  it('có cờ PREDEAL và tắt được bằng biến môi trường', () => {
    expect(flags).toMatch(/export const PREDEAL/);
    expect(flags).toMatch(/PREDEAL'\)/);
  });

  it('server chỉ gửi predeal khi cờ bật', () => {
    expect(room).toMatch(/if \(!PREDEAL\) return null/);
  });

  it('móc gửi đặt ở send/broadcast, không rải ra từng chỗ dựng view', () => {
    // Rải ra là có ngày thêm đường gửi thứ N mà quên, rồi bàn lệch sau một lần
    // xáo mà không ai hiểu vì sao.
    expect(room).toMatch(/private predealKem/);
    const goi = [...room.matchAll(/this\.predealKem\(/g)].length;
    expect(goi, 'phải gọi ở đúng 2 nơi: send và broadcast').toBe(2);
  });

  it('client không có cờ riêng — tắt ở server là tắt hẳn', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');
    expect(src).not.toMatch(/VITE_PREDEAL|PREDEAL_ENABLED/);
  });
});
