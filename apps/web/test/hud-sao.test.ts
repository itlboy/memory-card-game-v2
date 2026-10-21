import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HudBar from '@/components/HudBar.vue';

/**
 * VIÊN SAO KHÔNG CON SỐ (17.10.2026): người thử đọc số "còn được quên N lần" thành MẠNG; chủ
 * dự án: "đơn giản, trực quan, em bé cũng hiểu". Ngôi sao SẮP MẤT (quên thêm 1 lần là tắt)
 * nhấp nháy thay cho con số; số chỉ còn trong aria-label.
 */
const base = { score: 0, moves: 0, matched: 0, totalPairs: 8, combo: 0, elapsed: 0, timeLeft: null, movesLeft: null, lives: null };
const sao = (misses: number, starMisses: [number, number]) => mount(HudBar, { props: { ...base, misses, starMisses } });

describe('viên sao Chiến dịch: nhìn là hiểu, không con số', () => {
  it('không bao giờ hiện con số cạnh sao', () => {
    for (const m of [0, 1, 2, 3, 5]) expect(sao(m, [3, 1]).find('.vien.sao b').exists(), `quên ${m}`).toBe(false);
  });

  it('quên thêm 1 lần là rớt sao → ngôi đó nhấp nháy; còn chỗ thì không', () => {
    // mốc [max2=3, max3=1]: quên 1 → 3 sao, hết chỗ → ngôi 3 nháy
    let w = sao(1, [3, 1]);
    expect(w.findAll('.sao-hang .sao3d').map((i) => i.classes('sap-mat'))).toEqual([false, false, true, false]);
    // quên 2 → 2 sao, còn được quên 1 lần nữa → chưa nháy
    w = sao(2, [3, 1]);
    expect(w.find('.sap-mat').exists()).toBe(false);
    // quên 3 → 2 sao, hết chỗ → ngôi 2 nháy
    w = sao(3, [3, 1]);
    expect(w.findAll('.sao-hang .sao3d').map((i) => i.classes('sap-mat'))).toEqual([false, true, false, false]);
  });

  it('còn 1 sao (không thể mất thêm) và chưa quên lần nào: không ngôi nào nháy', () => {
    expect(sao(9, [3, 1]).find('.sap-mat').exists()).toBe(false);
    expect(sao(0, [3, 1]).find('.sap-mat').exists()).toBe(false);
  });

  it('trình đọc màn hình vẫn nghe đủ số lần còn được quên', () => {
    expect(sao(3, [3, 1]).find('.vien.sao').attributes('aria-label')).toMatch(/0/);
  });
});
