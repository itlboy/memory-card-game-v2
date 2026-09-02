import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { packView, publicView, unpackView } from '../src/online.js';
import { presetConfig } from '../src/presets.js';
// Bàn 88 thẻ cần 44 biểu tượng — nhiều hơn một theme thật có.
const NHIEU = Array.from({ length: 60 }, (_, i) => String.fromCodePoint(0x1f600 + i));

const ban = (level: number) => new MemoryGame(presetConfig({
  mode: 'classic', level, symbols: NHIEU, seed: 7,
  players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }]
}));

describe('gói view khi gửi trên dây', () => {
  it('mở gói ra ĐÚNG BẰNG view gốc, kể cả khi có thẻ đang ngửa', () => {
    const g = ban(20);
    g.flip(0, 1000);
    const goc = publicView(g, 1000, () => true);
    expect(unpackView(packView(goc))).toEqual(goc);
  });

  it('mở gói nhận cả dạng cũ (đã có cards) — server cũ + client mới vẫn nói chuyện', () => {
    const goc = publicView(ban(1), 0, () => true);
    expect(unpackView(goc)).toBe(goc);
  });

  it('KHÔNG lộ bài: ô úp không mang symbol, cả trước lẫn sau khi gói', () => {
    const g = ban(50);
    g.flip(0, 1000);
    const wire = packView(publicView(g, 1000, () => true));
    // Ô úp bị bỏ hẳn khỏi gói, nên cách duy nhất lộ là ô trong `o` mang symbol
    // mà lẽ ra phải úp. Kiểm cả chuỗi JSON: chỉ đúng một ô đang ngửa.
    expect(wire.o.filter((c) => c.state !== 'down')).toHaveLength(1);
    const ra = unpackView(wire);
    for (const c of ra.cards) if (c.state === 'down') expect(c.symbol).toBeUndefined();
  });

  it('bàn lớn nhẹ đi hẳn — đây là toàn bộ lý do làm việc này', () => {
    const goc = publicView(ban(50), 0, () => true);
    const truoc = JSON.stringify(goc).length;
    const sau = JSON.stringify(packView(goc)).length;
    expect(goc.cards.length).toBe(88);
    // Đo thật lúc viết: 2.998 → 297 byte. Để ngưỡng rộng tay, cái cần canh là
    // đừng có ai vô tình nhét lại mảng cards đầy đủ vào gói.
    expect(sau).toBeLessThan(truoc / 4);
  });
});
