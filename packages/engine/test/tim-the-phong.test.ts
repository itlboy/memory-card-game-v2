import { describe, expect, it } from 'vitest';
import { PhongTimThe, TIM_PHONG_LECH_MS, TIM_PHONG_TRE_MS, TIM_THE_DAP_AN_MS, TIM_THE_NOI_MS, TIM_THE_UP_MS, timTheChonMs, timTheXemMs } from '../src/index.js';

const HINH = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐷', '🐰', '🐨', '🐯', '🐮', '🐙', '🦄', '🐻', '🐔'];
const CFG = { soThe: 6, doKho: 'vua' as const, soLuot: 2 };
const XEM = timTheXemMs(CFG), CHON = timTheChonMs(CFG);
const moi = (may = false) => new PhongTimThe(CFG, [{ id: 'a', ten: 'A' }, may ? { id: 'm', ten: 'Máy', may: 'normal' as const } : { id: 'b', ten: 'B' }], HINH, 7, 3);
/** Đưa ván tới đầu nhịp hỏi, trả mốc bắt đầu hỏi. */
function toiHoi(p: PhongTimThe, t0 = 1000): number {
  p.batDau(t0);
  const hoi = t0 + XEM + TIM_THE_UP_MS + TIM_THE_NOI_MS;
  p.tick(hoi);
  return hoi;
}

describe('PhongTimThe — nhịp ván online', () => {
  it('đi đủ xem → up → noi → hoi theo mốc cộng dồn', () => {
    const p = moi();
    p.batDau(1000);
    expect(p.pha).toBe('xem');
    expect(p.tick(1000 + XEM - 1)).toBe(false);
    p.tick(1000 + XEM); expect(p.pha).toBe('up');
    p.tick(1000 + XEM + TIM_THE_UP_MS); expect(p.pha).toBe('noi');
    p.tick(1000 + XEM + TIM_THE_UP_MS + TIM_THE_NOI_MS); expect(p.pha).toBe('hoi');
  });

  it('alarm trễ: một lần tick đi qua mọi pha đã lỡ, mốc không trôi', () => {
    const p = moi();
    p.batDau(0);
    p.tick(XEM + TIM_THE_UP_MS + TIM_THE_NOI_MS + 5);
    expect(p.pha).toBe('hoi');
    expect(p.tu).toBe(XEM + TIM_THE_UP_MS + TIM_THE_NOI_MS);
  });

  it('không lộ hình khi úp, không lộ vị trí trước đáp án', () => {
    const p = moi();
    const hoi = toiHoi(p);
    const v = p.view(hoi);
    expect(v.the).toBeNull();
    expect(v.dich).toBeNull();
    expect(v.hinhDich).toBeTruthy();
    p.batDau(0);
    expect(p.view(0).the).toHaveLength(6);
    expect(p.view(0).hinhDich).toBeNull();
  });

  it('mọi người chọn xong thì chấm ngay, không chờ hết giờ', () => {
    const p = moi();
    const hoi = toiHoi(p);
    const dich = p.van.dich;
    expect(p.chon('a', dich, 400, hoi + 450)).toBe(true);
    expect(p.view(hoi + 450).nguoi.find((n) => n.id === 'a')!.da).toBe(true);
    expect(p.view(hoi + 450).nguoi.find((n) => n.id === 'a')!.kq).toBeUndefined();   // chưa lộ
    expect(p.chon('b', (dich + 1) % 6, 700, hoi + 750)).toBe(true);
    p.tick(hoi + 750);
    expect(p.pha).toBe('dap-an');
    const v = p.view(hoi + 750);
    expect(v.dich).toBe(dich);
    expect(v.nguoi.find((n) => n.id === 'a')!.kq).toMatchObject({ ketCuc: 'dung', ms: 400, nhanhNhat: true });
    expect(v.nguoi.find((n) => n.id === 'b')!.kq).toMatchObject({ ketCuc: 'sai' });
  });

  it('giờ máy người chơi: không quá giờ server, không sớm hơn quá TIM_PHONG_LECH_MS', () => {
    const p = moi();
    const hoi = toiHoi(p);
    p.chon('a', p.van.dich, 0, hoi + 2000);   // báo 0 giây mà server đã trôi 2 giây
    expect(p.van.lucChon('a')).toBe(2000 - TIM_PHONG_LECH_MS);
    const q = moi();
    const h2 = toiHoi(q);
    q.chon('a', q.van.dich, 9999, h2 + 300);    // báo lâu hơn thực tế → lấy giờ server
    expect(q.van.lucChon('a')).toBe(300);
  });

  it('chưa đủ người chọn: chờ thêm khoảng trễ đường truyền rồi mới chấm, quá đó thì từ chối', () => {
    const p = moi();
    const hoi = toiHoi(p);
    p.tick(hoi + CHON + 10);
    expect(p.pha).toBe('hoi');
    expect(p.chon('a', 0, CHON, hoi + CHON + 100)).toBe(true);
    p.tick(hoi + CHON + TIM_PHONG_TRE_MS);
    expect(p.pha).toBe('dap-an');
    expect(p.chon('b', 0, CHON, hoi + CHON + TIM_PHONG_TRE_MS + 1)).toBe(false);
  });

  it('máy: thức dậy đúng lúc máy bấm để báo "đã chọn"', () => {
    const p = moi(true);
    const hoi = toiHoi(p);
    const msMay = p.van.lucChon('m');
    expect(msMay).not.toBeNull();
    expect(p.henKe(hoi)).toBe(hoi + msMay!);
    expect(p.tick(hoi + msMay!)).toBe(true);
    expect(p.view(hoi + msMay!).nguoi.find((n) => n.id === 'm')!.da).toBe(true);
  });

  it('hết lượt cuối thì xong, có xếp hạng', () => {
    const p = moi();
    let t = toiHoi(p);
    p.chon('a', p.van.dich, 100, t + 100);
    p.chon('b', p.van.dich, 200, t + 200);
    p.tick(t + 200);
    t = t + 200 + TIM_THE_DAP_AN_MS;
    p.tick(t);
    expect(p.pha).toBe('xem');
    expect(p.view(t).luot).toBe(1);
    p.tick(t + 60_000);
    expect(p.xong).toBe(true);
    expect(p.henKe(t + 60_000)).toBeNull();
    expect(p.xepHang()[0]!.id).toBe('a');
    expect(p.view(t + 60_000).van).toBe(3);
  });
});
