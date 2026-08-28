import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Player } from '@mm/engine';
import PlayerStrip from '../src/components/PlayerStrip.vue';

/**
 * DẢI NGƯỜI CHƠI khi đông người.
 *
 * Bàn nay tới 10 người. Chia đều một hàng cho 10 chip là mỗi chip 33px trên
 * iPhone SE — tên biến mất, điểm rơi ra ngoài; xếp hai hàng thì đọc được tên
 * nhưng ăn thêm ~20px chiều cao của bàn thẻ, mà bàn nay tới 88 thẻ. Nên từ 5
 * người trở lên dải đổi sang dạng GỌN: một chip lớn cho người đang đi (có tên
 * và đồng hồ) + hàng avatar cho những người còn lại, tên đầy đủ đọc ở bảng.
 */
const nguoi = (i: number, score = 0): Player => ({
  id: `p${i}`,
  name: `Người ${i}`,
  score,
  lives: Number.POSITIVE_INFINITY,
  frozenTurns: 0,
  doubleNext: false
} as unknown as Player);

const day = (n: number): Player[] => Array.from({ length: n }, (_, i) => nguoi(i + 1, (n - i) * 6));

const gan = (players: Player[]) =>
  mount(PlayerStrip, { props: { players, currentId: players[0]!.id, turnLeft: 12 } });

describe('dải người chơi', () => {
  it('tới 4 người: giữ dạng cũ — mỗi người một chip CÓ TÊN', () => {
    const w = gan(day(4));
    expect(w.findAll('.player')).toHaveLength(4);
    expect(w.findAll('.turn-chip')).toHaveLength(0);
    for (let i = 1; i <= 4; i++) expect(w.text()).toContain(`Người ${i}`);
  });

  it('từ 5 người: một chip lượt + hàng avatar, không còn chip-có-tên nào', () => {
    const w = gan(day(5));
    expect(w.findAll('.player')).toHaveLength(0);
    expect(w.findAll('.turn-chip')).toHaveLength(1);
    expect(w.findAll('.mini')).toHaveLength(4);   // 5 người trừ người đang đi
  });

  it('10 người: chip lượt mang tên + đồng hồ, chín người kia chỉ avatar và điểm', () => {
    const w = gan(day(10));
    const turn = w.find('.turn-chip');
    expect(turn.text()).toContain('Người 1');
    expect(turn.text()).toContain('12s');
    expect(w.findAll('.mini')).toHaveLength(9);
    // Tên người khác không được VẼ RA trong dải — chỗ đó chỉ đủ avatar + điểm.
    // (Tên vẫn có trong `.sr-only` cho trình đọc màn hình, nên phải loại nó ra
    // trước khi kiểm, đừng đọc text() của cả hàng.)
    const nhinThay = w.findAll('.mini').map((m) => {
      const el = m.element.cloneNode(true) as HTMLElement;
      el.querySelectorAll('.sr-only').forEach((x) => { x.remove(); });
      return el.textContent ?? '';
    }).join(' ');
    expect(nhinThay).not.toContain('Người 2');
    expect(nhinThay).toContain('54');   // nhưng ĐIỂM thì có
  });

  /*
   * Người ĐI NGAY SAU phải đứng đầu hàng và được tô nền: đọc từ trái sang phải
   * là biết còn mấy người nữa tới lượt mình. Xếp theo thứ tự danh sách thay vì
   * xoay vòng thì cái nhãn "next" nhảy lung tung giữa hàng.
   */
  it('hàng avatar xoay vòng: người đi ngay sau đứng đầu và được đánh dấu', () => {
    const players = day(10);
    const w = mount(PlayerStrip, {
      props: { players, currentId: 'p4', turnLeft: null }
    });
    const minis = w.findAll('.mini');
    expect(minis[0]!.classes()).toContain('next');
    expect(minis[0]!.attributes('title')).toContain('Người 5');
    // Cuối hàng là người ngay TRƯỚC người đang đi
    expect(minis.at(-1)!.attributes('title')).toContain('Người 3');
  });

  it('bảng đầy đủ: mặc định đóng, bấm mới mở, và sắp theo ĐIỂM', async () => {
    const w = gan(day(10));
    expect(w.find('.sheet').exists()).toBe(false);
    await w.find('.more-btn').trigger('click');
    const rows = w.findAll('.sheet li');
    expect(rows).toHaveLength(10);
    for (let i = 1; i <= 10; i++) expect(w.find('.sheet').text()).toContain(`Người ${i}`);
    // day() cho người 1 điểm cao nhất, giảm dần
    expect(rows[0]!.text()).toContain('Người 1');
    expect(rows.at(-1)!.text()).toContain('Người 10');
  });
});

/**
 * Dải được vẽ ở HAI file: PlayerStrip.vue (chơi cùng máy) và OnlineGame.vue
 * (phòng online). Cùng một thiết kế, nên NGƯỠNG đổi dạng phải khớp — lệch là
 * một màn gọn còn màn kia vẫn chen 10 chip, và không có gì báo lỗi. Đây đúng
 * kiểu lỗi đã xảy ra với lưới theme (xem theme-grid.test.ts).
 */
const doc = (f: string) => readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');

describe('hai dải phải cùng luật', () => {
  it('cùng ngưỡng "> 4 người" mới đổi sang dạng gọn', () => {
    const local = /players\.length\s*>\s*(\d+)/.exec(doc('PlayerStrip.vue'));
    const online = /players\.length\s*\?\?\s*0\)\s*>\s*(\d+)/.exec(doc('OnlineGame.vue'));
    expect(local?.[1], 'PlayerStrip không còn ngưỡng nào đọc được').toBeDefined();
    expect(online?.[1], 'OnlineGame không còn ngưỡng nào đọc được').toBeDefined();
    expect(local![1]).toBe(online![1]);
    expect(local![1]).toBe('4');
  });

  /*
   * EmojiBlast tìm chip người gửi qua `data-chip-for` để bay lên từ đúng chỗ đó.
   * Dạng gọn có hai loại ô (chip lượt và avatar nhỏ) — thiếu thuộc tính ở một
   * loại là emoji của người đó lặng lẽ rơi về giữa mép trên màn hình.
   */
  it('dải online: cả ba loại ô đều mang data-chip-for', () => {
    const src = doc('OnlineGame.vue');
    expect(src.match(/data-chip-for/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
