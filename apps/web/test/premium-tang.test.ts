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

  // BẢNG PHƯƠNG ÁN B (26.11.2026, mockup https://claude.ai/artifact/1ZwuoozRFvTHxkdK9wRNeo): ảnh đầu bảng · 4 dòng quyền lợi ·
  // dòng thời gian của quà · một nút; đang có thì thanh ngày còn lại + khối "Cài đặt Premium" nổi bật
  it('còn quà: 4 dòng quyền lợi + dòng thời gian (hôm nay · ngày 27 nhắc · ngày 30 tự về) + nút nhận, KHÔNG bày hai gói mua', async () => {
    const { pm, w } = await moBang();
    expect(w.findAll('.pm-ql li')).toHaveLength(4);
    expect(w.findAll('.pm-moc > div')).toHaveLength(3);
    expect(w.find('.pm-moc').text()).toMatch(/Ngày 27[\s\S]*Ngày 30/);
    expect(w.find('.pm-goi').exists(), 'chưa bán thật thì không bày gói').toBe(false);
    expect(w.find('.pm-cd').exists(), 'chưa có Premium thì chưa có cài đặt').toBe(false);
    expect(w.text()).not.toContain('Sắp có');
    await w.find('.pm-mua').trigger('click');
    expect(pm.daMuaPremium.value).toBe(true);
    expect(w.find('.pm-moc').exists()).toBe(false);
    expect(w.find('.pm-con').text(), 'thanh số ngày còn lại').toMatch(/Còn 30 ngày/);
    w.unmount();
  });

  it('đang có Premium: khối "Cài đặt Premium" có Chủ đề · Nhạc nền · Huy hiệu — bấm ô nào App mở đúng bảng đó', async () => {
    const { w } = await moBang({ 'mm.premium': '1' });
    const o = w.findAll('.pm-cd-o .thach');
    expect(o).toHaveLength(3);
    for (const x of o) await x.trigger('click');
    expect(w.emitted('mo')).toEqual([['nen'], ['nhac'], ['hh']]);
    expect(o[1]!.text()).toContain('Ngẫu nhiên');
    expect(o[2]!.text(), 'mặc định đeo vương miện').toContain('Vương miện');
    w.unmount();
  });

  it('còn quà: KHÔNG ghi "Hết hạn …" dưới nút nhận', async () => {
    const { w } = await moBang();
    expect(w.text()).not.toMatch(/Hết hạn/);
    w.unmount();
  });
});

describe('viên Premium trang chủ + đường về', () => {
  const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
  it('viên CHỈ hiện khi debug, bấm mở bảng Premium từ "trang-chu", có chấm đỏ khi còn quà', () => {
    const s = doc('components/MenuScreen.vue');
    expect(s).toMatch(/<button v-if="dangDebug" class="vien-pm thach"[^>]*@click="sfx\.select\(\); moPremium\('trang-chu'\)"/);
    expect(s, 'chấm đỏ khi còn quà, và khi quà sắp hết (nhắc trước 3 ngày)').toContain('<i v-if="conQuaTang || sapHetQua" class="vpm-cham"');
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
