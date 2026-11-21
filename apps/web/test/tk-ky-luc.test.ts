import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TaiKhoanDialog from '@/components/TaiKhoanDialog.vue';
import { me } from '@/lib/taikhoan';
import { campaignSpec } from '@mm/engine';

/**
 * TRANG TÀI KHOẢN: kỷ lục khó trên dễ dưới + nút "Phá" (22.11.2026, mockup duyệt
 * https://claude.ai/artifact/KzuWVG5QwHxQ13Hi7AUN3C — chủ dự án).
 */
const hoSo = (best: Record<string, { score: number; moves: number; seconds: number }>) => ({
  id: 7, name: 'Kiên', avatar: null, totalScore: 819290, matches: 230, wins: 101, losses: 125, draws: 4, best, achievements: []
});
afterEach(() => { me.value = null; });

describe('kỷ lục ở trang tài khoản', () => {
  it('khó (nhiều thẻ) xếp trên, dễ dưới; hai khoá cũ cùng cỡ bàn gộp thành MỘT dòng, giữ điểm cao', () => {
    me.value = hoSo({
      'campaign:L1': { score: 300, moves: 2, seconds: 2 },
      'campaign:L34': { score: 2790, moves: 48, seconds: 128 },
      'classic:L1': { score: 220, moves: 3, seconds: 4 },
      'classic:L3': { score: 970, moves: 8, seconds: 14 },
      'classic:L4': { score: 660, moves: 15, seconds: 34 },
      'classic:L50': { score: 4750, moves: 216, seconds: 617 }
    });
    const w = mount(TaiKhoanDialog);
    const dong = w.findAll('.ky-luc li');
    const ten = dong.map((d) => d.find('.kl-chu b').text());
    // classic:L3 + L4 (cùng 12 thẻ) → một dòng
    expect(ten.filter((x) => x === 'Bàn 12 thẻ')).toHaveLength(1);
    expect(dong).toHaveLength(5);
    expect(dong.find((d) => d.text().includes('Bàn 12 thẻ'))!.find('.kl-diem').text()).toBe('970');
    // dễ nhất (bàn 4 thẻ / màn 1) ở dưới cùng, bàn lớn nhất trên cùng
    const so = dong.map((d) => d.find('.kl-diem').text());
    expect(so[0]).toBe('4.750');
    expect(['220', '300']).toContain(so.at(-1));
    expect(campaignSpec(34).pairs).toBeGreaterThan(campaignSpec(1).pairs);
    expect(ten.indexOf('Chiến dịch màn 34')).toBeLessThan(ten.indexOf('Chiến dịch màn 1'));
  });

  it('nút "Phá" gửi đúng chế độ + màn / số thẻ để App vào thẳng ván đó', async () => {
    me.value = hoSo({ 'campaign:L12': { score: 1430, moves: 19, seconds: 48 }, 'classic:L3': { score: 970, moves: 8, seconds: 14 } });
    const w = mount(TaiKhoanDialog);
    const dong = w.findAll('.ky-luc li');
    for (const d of dong) await d.find('button.kl-pha').trigger('click');
    const ra = w.emitted('pha-ky-luc')!.map((e) => e[0]);
    expect(ra).toContainEqual({ mode: 'campaign', cap: 12, cells: campaignSpec(12).pairs * 2 });
    expect(ra).toContainEqual({ mode: 'classic', cap: 3, cells: 12 });
  });

  it('vòng tỉ lệ thắng + 4 số; hai ô Xếp hạng / Danh hiệu', () => {
    me.value = hoSo({});
    const w = mount(TaiKhoanDialog);
    expect(w.find('.vong').text()).toContain('44%');
    expect(w.findAll('.so dd').map((d) => d.text())).toEqual(['230', '101', '125', '4']);
    expect(w.findAll('.oi button.o')).toHaveLength(2);
  });
});
