import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * QUÀ TẶNG 1 THÁNG PREMIUM + VIÊN PREMIUM TRANG CHỦ (26.11.2026, mockup duyệt https://claude.ai/artifact/5y6jdDcExegghTLJbfWKUc).
 * Chủ dự án: nút Premium đối diện Chỉ số trí nhớ, bấm ra bảng quyền lợi + cài đặt Premium + ngày hết hạn, "cho người dùng
 * claim ngay"; "hiện tại vẫn cho chế độ debug thôi"; "mọi settings premium đều có thể làm thông qua nút premium".
 */
const NGAY = 86_400_000;
const T = 1_800_000_000_000;
const nap = async (kho: Record<string, string> = {}) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(kho)) localStorage.setItem(k, v);
  vi.resetModules();
  return import('@/lib/premium');
};
beforeEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

describe('quà tặng 1 tháng', () => {
  it('máy mới: còn quà; nhận xong có Premium đúng 30 ngày tính từ lúc bấm, ghi lên máy', async () => {
    const pm = await nap();
    expect(pm.conQuaTang.value).toBe(true);
    expect(pm.daMuaPremium.value).toBe(false);
    expect(pm.nhanQuaTang(T)).toBe(true);
    expect(pm.daMuaPremium.value).toBe(true);
    expect(pm.goiDangCo.value).toMatchObject({ tang: true, tu: T, het: T + 30 * NGAY });
    expect(pm.ngayConLai(T)).toBe(30);
    expect(pm.ngayConLai(T + 29 * NGAY + 1)).toBe(1);
    expect(pm.conQuaTang.value).toBe(false);
    expect(JSON.parse(localStorage.getItem('mm.premium.goi')!)).toMatchObject({ tang: true });
  });

  it('mỗi máy MỘT lần: nhận rồi thì không nhận lại được, kể cả sau khi hết hạn', async () => {
    const pm = await nap();
    pm.nhanQuaTang(T);
    expect(pm.nhanQuaTang(T + 1000)).toBe(false);
    expect(pm.kiemHetHanTang(T + 31 * NGAY)).toBe(true);
    expect(pm.daMuaPremium.value).toBe(false);
    expect(pm.conQuaTang.value, 'đã nhận rồi').toBe(false);
    expect(pm.nhanQuaTang(T + 32 * NGAY)).toBe(false);
  });

  it('hết hạn: đang mở app thì về bản thường ngay; mở app lần sau cũng không còn Premium', async () => {
    const pm = await nap();
    pm.nhanQuaTang(Date.now() - 31 * NGAY);            // đã nhận từ 31 ngày trước
    expect(pm.kiemHetHanTang()).toBe(true);
    expect(localStorage.getItem('mm.premium.goi')).toBeNull();
    const cu = JSON.stringify({ goi: 'thang', tu: 1, het: Date.now() - 1000, tang: true });
    const pm2 = await nap({ 'mm.premium.goi': cu, 'mm.premium.tang': '1' });
    expect(pm2.daMuaPremium.value).toBe(false);
    expect(pm2.conQuaTang.value).toBe(false);
  });

  it('còn hạn thì kiemHetHanTang không đụng gì; đã có Premium bằng đường khác thì không mời quà', async () => {
    const pm = await nap();
    pm.nhanQuaTang(T);
    expect(pm.kiemHetHanTang(T + 5 * NGAY)).toBe(false);
    expect(pm.daMuaPremium.value).toBe(true);
    const pm2 = await nap({ 'mm.premium': '1' });
    expect(pm2.conQuaTang.value).toBe(false);
  });
});

describe('bảng Premium', () => {
  const moBang = async (kho: Record<string, string> = {}) => {
    const pm = await nap(kho);
    const Bang = (await import('@/components/BangPremium.vue')).default;
    const w = mount(Bang, { props: { tu: 'trang-chu', nhacHien: 'Ngẫu nhiên' }, attachTo: document.body });
    return { pm, w };
  };

  it('còn quà: thẻ quà + nút "Nhận miễn phí", KHÔNG bày hai gói mua; bấm nhận là sang trạng thái đang có Premium', async () => {
    const { pm, w } = await moBang();
    expect(w.find('.pm-hero.qua').exists()).toBe(true);
    expect(w.find('.pm-goi').exists(), 'chưa bán thật thì không bày gói').toBe(false);
    expect(w.find('.pm-menu').exists(), 'chưa có Premium thì chưa có cài đặt').toBe(false);
    await w.find('.pm-nhan').trigger('click');
    expect(pm.daMuaPremium.value).toBe(true);
    expect(w.find('.pm-hero.qua').exists()).toBe(false);
    expect(w.find('.pm-han-chu').text(), 'thanh số ngày còn lại').toMatch(/30 \/ 30/);
    w.unmount();
  });

  it('đang có Premium: "Cài đặt Premium" có Chủ đề · Nhạc nền · Huy hiệu — bấm dòng nào App mở đúng bảng đó', async () => {
    const { w } = await moBang({ 'mm.premium': '1' });
    const dong = w.findAll('.pm-menu .pm-o');
    expect(dong).toHaveLength(3);
    for (const d of dong) await d.trigger('click');
    expect(w.emitted('mo')).toEqual([['nen'], ['nhac'], ['hh']]);
    expect(dong[1]!.text()).toContain('Ngẫu nhiên');
    expect(dong[2]!.text(), 'mặc định đeo vương miện').toContain('Vương miện');
    w.unmount();
  });

  it('lưới quyền lợi: 8 thẻ, số lấy từ code (14 mặt lưng, 9 bài, 8 emoji), KHÔNG còn nhãn "Sắp có"', async () => {
    const { w } = await moBang({ 'mm.premium': '1' });
    const the = w.findAll('.pm-ql .q').map((r) => r.text());
    expect(the).toHaveLength(8);
    expect(the.some((x) => x.includes('14 mặt lưng'))).toBe(true);
    expect(the.some((x) => x.includes('9 bài'))).toBe(true);
    expect(the.some((x) => x.includes('8 emoji'))).toBe(true);
    expect(w.text()).not.toContain('Sắp có');
    w.unmount();
  });
});

describe('viên Premium trang chủ + đường về', () => {
  const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
  it('viên CHỈ hiện khi debug, bấm mở bảng Premium từ "trang-chu", có chấm đỏ khi còn quà', () => {
    const s = doc('components/MenuScreen.vue');
    expect(s).toMatch(/<button v-if="dangDebug" class="vien-pm thach"[^>]*@click="sfx\.select\(\); moPremium\('trang-chu'\)"/);
    expect(s).toContain('<i v-if="conQuaTang" class="vpm-cham"');
    expect(s, 'hai viên không đè nhau').toMatch(/\.vien-pm \{[^}]*max-width: 52%/);
  });
  it('App: bảng Premium vẫn chỉ mở khi debug; mở Chủ đề / Nhạc từ bảng Premium thì đóng lại là VỀ bảng Premium', () => {
    const s = doc('App.vue');
    expect(s).toContain('<BangPremium v-if="showPremium && debug"');
    expect(s).toMatch(/function moTuPremium\(muc: 'nen' \| 'nhac' \| 'hh'\): void \{\s*showPremium\.value = false;\s*tuPremium = true;/);
    expect(s, 'đóng bảng huy hiệu cũng về bảng Premium').toContain('watch(showHuyHieu, veMenuKhiDong);');
    expect(s).toMatch(/if \(vePremium\) \{ premiumTu\.value = 'trang-chu'; showPremium\.value = true; \} else topBar\.value\?\.moMenu\(/);
    expect(s).toContain('kiemHetHanTang();');
  });
  it('thống kê đợt tặng: hiện · nhận · bỏ qua', () => {
    const s = doc('components/BangPremium.vue');
    for (const k of ['premium_tang_hien', 'premium_tang_nhan', 'premium_tang_bo_qua']) expect(s, k).toContain(`moChucNang('${k}'`);
  });
});

describe('liên kết Quản lý gói', () => {
  it('chỉ hiện khi gói mua qua cửa hàng THẬT — gói giả lập / quà tặng không có trang quản lý', () => {
    const s = readFileSync(resolve(process.cwd(), 'src/components/BangPremium.vue'), 'utf8');
    expect(s).toContain('<a v-if="cuaHangThat && daMuaPremium && goiDangCo && !goiDangCo.tang && !goiDangCo.vinhVien" :href="LINK_QUAN_LY"');
  });
});
