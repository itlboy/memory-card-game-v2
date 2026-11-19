// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { store } from '@/lib/storage';

/**
 * BẢNG XẾP HẠNG CÓ KHÁCH (19.11.2026): người chưa đăng nhập cũng lên bảng chung và biết hạng mình.
 * Canh: mã khách ngẫu nhiên + bền, gửi TỔNG (không nhân đôi), không gửi khi đã đăng nhập / đã ẩn /
 * đã gộp vào tài khoản; server chỉ giữ băm của mã và không cho điểm nhảy vọt.
 */

const goc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('client: khách trên bảng', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('mã khách: ngẫu nhiên, đủ dài cho server, sinh một lần rồi giữ nguyên', () => {
    expect(store.khach(false)).toBeNull();
    const a = store.khach()!.id;
    expect(a).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
    expect(store.khach()!.id).toBe(a);
    expect(a).not.toBe(store.clientId());
  });

  it('chưa chơi ván nào thì không gửi gì; có điểm thì gửi tổng + tên + số ván', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    await tk.guiKhach();
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach'))).toBe(false);

    store.addScore(500);
    store.ghiVanBoDem({ thang: true });
    store.savePlayerNames(['Bông']);
    await tk.ghiVan({ ketQua: 'thang', score: 500 });
    await new Promise((r) => setTimeout(r, 0));
    const gui = f.mock.calls.find(([u]) => String(u).endsWith('/api/khach'));
    expect(gui).toBeTruthy();
    const than = JSON.parse(String((gui![1] as RequestInit).body));
    expect(than).toMatchObject({ id: store.khach(false)!.id, name: 'Bông', totalScore: 500, wins: 1, matches: 1 });
  });

  it('đã ẩn khỏi bảng thì thôi gửi; bảng xếp hạng không mang mã khách', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true, top: [] }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    store.addScore(100);
    store.khach();
    await tk.anKhach(true);
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach/xoa'))).toBe(true);
    f.mockClear();
    await tk.bangXepHang();
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach'))).toBe(false);
    const bxh = f.mock.calls.find(([u]) => String(u).endsWith('/api/bxh'))!;
    expect(JSON.parse(String((bxh[1] as RequestInit).body)).khach).toBeUndefined();
  });

  it('đồng bộ tài khoản mang mã khách lên để server gộp, rồi máy thôi lên bảng dạng khách', () => {
    const src = goc('src/lib/taikhoan.ts');
    expect(src).toMatch(/khach: store\.khach\(false\)\?\.id/);
    expect(src).toMatch(/ganKhach\(\{ daGop: true \}\)/);
  });

  it('viên đồng xu là NÚT mở bảng xếp hạng', () => {
    const tb = goc('src/components/TopBar.vue');
    expect(tb).toMatch(/<button class="total thach"[\s\S]{0,300}@click="moBxh"/);
    expect(tb).toMatch(/function moBxh\(\)[\s\S]{0,120}emit\('xep-hang'\)/);
    expect(goc('src/App.vue')).toMatch(/@xep-hang="showBxh = true"/);
  });
});

describe('server Node: khách', () => {
  it('maKhach: chỉ nhận mã đúng dạng, lưu BĂM (không lưu mã gốc)', async () => {
    const { maKhach } = await import('../../node-server/src/taikhoan');
    expect(maKhach('ngắn')).toBeNull();
    expect(maKhach(42)).toBeNull();
    expect(maKhach("x'; DROP TABLE khach; --".padEnd(30, 'x'))).toBeNull();
    const id = 'AbCdEfGhIjKlMnOpQrStUvWx';
    expect(maKhach(id)).toMatch(/^[0-9a-f]{64}$/);
    expect(maKhach(id)).not.toContain(id);
  });

  it('locTen: bỏ ký tự điều khiển và <>, cắt 16 ký tự', async () => {
    const { locTen } = await import('../../node-server/src/taikhoan');
    expect(locTen('  <b>Bông</b>\n ')).toBe('bBông/b');
    expect(locTen('a'.repeat(30))).toHaveLength(16);
    expect(locTen(null)).toBe('');
  });

  it('locDiemKhach: không bao giờ giảm, không nhảy vọt quá số ván chơi được trong khoảng đó', async () => {
    const { locDiemKhach } = await import('../../node-server/src/taikhoan');
    // Lần đầu: nhận cả lịch sử của máy (tới trần)
    expect(locDiemKhach({ totalScore: 250_000, wins: 40, matches: 10 }, null, 0)).toEqual({ total: 250_000, wins: 40, matches: 40 });
    const cu = { total: 1000, wins: 2, matches: 5, updatedAt: 0 };
    // Gửi lại số cũ / nhỏ hơn → giữ nguyên
    expect(locDiemKhach({ totalScore: 10, wins: 0, matches: 0 }, cu, 1000)).toEqual({ total: 1000, wins: 2, matches: 5 });
    // Ngay sau đó (1 ván) tăng 9 triệu → bị chặn ở một ván tối đa
    const r = locDiemKhach({ totalScore: 9_000_000, wins: 99, matches: 99 }, cu, 1000);
    expect(r.total).toBe(1000 + 100_000);
    expect(r.wins).toBe(3);
    // Tăng bình thường thì nhận đủ
    expect(locDiemKhach({ totalScore: 1800, wins: 3, matches: 6 }, cu, 60_000)).toEqual({ total: 1800, wins: 3, matches: 6 });
  });

  it('bảng xếp hạng nhận mã khách trong THÂN POST, không qua URL', () => {
    const src = goc('../node-server/src/taikhoan.ts');
    expect(src).toMatch(/p === '\/api\/bxh' && \(req\.method === 'GET' \|\| req\.method === 'POST'\)/);
    expect(src).not.toMatch(/searchParams\.get\('khach'\)/);
  });
});

describe('đồng xu có hạng + bảng gọn + ảnh tỷ số (19.11.2026)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('hạng: hỏi MỘT lần lúc khởi động, sau đó chỉ khi điểm tăng / mở bảng; thấy lên hạng thì báo; lỗi mạng giữ số cũ', async () => {
    let hang = 137;
    const f = vi.fn(async (u: string) => {
      if (u.endsWith('/api/auth/config')) return json({ googleClientId: 'x' });
      if (u.endsWith('/api/bxh')) return json({ top: [], toi: { hang, tong: 2000, matches: 3, wins: 1, totalScore: 10, name: '', avatar: null, tren: null, duoi: null } });
      return json({ ok: true });
    });
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    const hx = await import('@/lib/hang-xu');
    const soLanHoi = () => f.mock.calls.filter(([u]) => String(u).endsWith('/api/bxh')).length;
    await hx.hoiLanDau();
    await hx.hoiLanDau();
    expect(soLanHoi()).toBe(1);
    expect(hx.hangXu.value).toBe(137);
    expect(hx.lenHangCho.value).toBeNull();
    hang = 129;
    await hx.hoiSauDiem();
    expect(hx.hangXu.value).toBe(129);
    expect(hx.lenHangCho.value).toEqual({ hang: 129, n: 8 });
    expect(localStorage.getItem('mm.hangXu')).toBe('129');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('mất mạng'); }));
    await hx.hoiSauDiem();
    expect(hx.hangXu.value).toBe(129);
    // TopBar KHÔNG hỏi theo giờ / khi quay lại từ nền
    const tb = goc('src/components/TopBar.vue');
    expect(tb).not.toMatch(/setInterval|visibilitychange|appStateChange/);
  });

  it('mẹo đồng xu chỉ một lần', async () => {
    const hx = await import('@/lib/hang-xu');
    expect(hx.daXemMeoXu()).toBe(false);
    hx.tatMeoXu();
    expect(hx.daXemMeoXu()).toBe(true);
  });

  it('bảng xếp hạng gọn: không còn thẻ vàng giải thích, không chữ "x/y thắng" hiện ra', () => {
    const src = goc('src/components/BangXepHang.vue');
    expect(src).not.toContain('hang-toi');
    expect(src).not.toMatch(/<small[^>]*>\{\{ t\('tk\.thangTren'/);
  });

  it('kết quả: nút "Khoe tỷ số" có chữ cạnh "Chi tiết ván" (bỏ ô biểu tượng ở góc); ảnh vẽ bảng tỷ số theo sáng/tối', () => {
    const kq = goc('src/components/ResultDialog.vue');
    expect(kq).not.toContain('lcs-nho');
    expect(kq).toMatch(/class="hang-ct"[\s\S]{0,600}t\('kq\.khoeTySo'\)/);
    const anh = goc('src/lib/anh-ket-qua.ts');
    expect(anh).toMatch(/async function veBangTySo/);
    expect(anh).toMatch(/dataset\.theme === 'dark'/);
  });
});

describe('bảng xếp hạng mở nhanh (19.11.2026)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lưu bảng lần trước theo người xem; điểm khách không đổi thì không gửi lại', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' })
      : u.endsWith('/api/bxh') ? json({ top: [{ name: 'A', avatar: null, totalScore: 5, wins: 1, matches: 1 }] }) : json({ ok: true }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect(tk.bxhLanTruoc()).toBeNull();
    store.addScore(100);
    await tk.bangXepHang();
    await tk.bangXepHang();
    expect(f.mock.calls.filter(([u]) => String(u).endsWith('/api/khach')).length).toBe(1);
    expect(tk.bxhLanTruoc()?.top[0]?.name).toBe('A');
    const src = goc('src/components/BangXepHang.vue');
    expect(src).toMatch(/ref<BangXh \| null>\(bxhLanTruoc\(\)\)/);
    expect(src).toContain('class="bxh xuong"');
  });
});

describe('server: cache top 20 (19.11.2026)', () => {
  it('ghepTop: xếp điểm rồi số thắng, cắt 20; thay dòng cũ của người hỏi bằng dòng mới', async () => {
    const { ghepTop, BXH_CACHE_MS } = await import('../../node-server/src/taikhoan');
    expect(BXH_CACHE_MS).toBeLessThanOrEqual(60_000);
    const ds = Array.from({ length: 25 }, (_, i) => ({ k: String(i), la_khach: 0, total_score: 1000 - i * 10, wins: 0 }));
    expect(ghepTop(ds)).toHaveLength(20);
    expect(ghepTop([{ k: 'a', la_khach: 0, total_score: 5, wins: 1 }, { k: 'b', la_khach: 0, total_score: 5, wins: 3 }])[0]!.k).toBe('b');
    // Khách "x" trong cache còn 0 điểm, giờ đã 995 → đứng thứ 2, không hai dòng
    const cache = ghepTop([...ds, { k: 'x', la_khach: 1, total_score: 0, wins: 0 }]);
    const moi = ghepTop(cache, { k: 'x', la_khach: 1, total_score: 995, wins: 0 }, 'x', true);
    expect(moi.filter((r) => r.k === 'x')).toHaveLength(1);
    expect(moi[1]!.k).toBe('x');
    // Tài khoản id "3" và khách mã "3" là HAI người khác nhau
    const hai = ghepTop(ds, { k: '3', la_khach: 1, total_score: 2000, wins: 0 }, '3', true);
    expect(hai.filter((r) => r.k === '3')).toHaveLength(2);
  });

  it('server không còn gộp UNION rồi mới sắp/đếm (quét sạch hai bảng)', () => {
    const src = goc('../node-server/src/taikhoan.ts');
    expect(src).not.toContain('NGUON_BXH');
    expect(src).toMatch(/bxhCache && now - bxhCache\.luc < BXH_CACHE_MS/);
  });
});

describe('dải chọn số thẻ: vuốt không phải bấm (19.11.2026)', () => {
  it('kéo quá ngưỡng / chạm lúc dải đang trôi → nuốt click (pha capture) + im tiếng bấm', () => {
    const src = goc('src/components/BanChon.vue');
    expect(src).toMatch(/@pointerdown="khiCham" @pointermove\.passive="khiDi" @click\.capture="nuotBam"/);
    expect(src).toMatch(/Math\.hypot\(e\.clientX - x0, e\.clientY - y0\) > NGUONG_KEO/);
    expect(src).toMatch(/Date\.now\(\) - lucCuon < CHAM_DUNG_MS/);
    expect(src).toMatch(/setAttribute\('data-nosfx'/);
  });
  it('huy hiệu hạng: cúp + số, không "#"', () => {
    expect(goc('src/components/TopBar.vue')).toMatch(/hangXu \? numShort\(hangXu\) : ''/);
  });
});

describe('tên ngẫu nhiên cho người mới (19.11.2026)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('Loài + Màu + Nét, ≤16 ký tự, tiếng Việt / tiếng Anh; đủ nhiều tổ hợp', async () => {
    const { taoTen, soToHop, DO_DAI_TOI_DA } = await import('@/lib/ten-ngau-nhien');
    for (let i = 0; i < 500; i++) {
      expect(taoTen('vi').length).toBeLessThanOrEqual(DO_DAI_TOI_DA);
      expect(taoTen('en').length).toBeLessThanOrEqual(DO_DAI_TOI_DA);
    }
    expect(taoTen('vi')).toMatch(/^\S+ \S+ \S+$/);
    expect(taoTen('ja')).toMatch(/^[A-Za-z]+ [A-Za-z]+ [A-Za-z]+$/);
    expect(soToHop('vi')).toBeGreaterThan(5000);
    expect(soToHop('en')).toBeGreaterThan(5000);
  });

  it('chưa có tên thì đặt; đã có tên thì không đụng; trùng thì đổi sang tên trống — trừ khi người chơi đã sửa', async () => {
    const { ganTenNeuChua } = await import('@/lib/ten-ngau-nhien');
    store.savePlayerNames(['Bông']);
    expect(await ganTenNeuChua('vi')).toBeNull();
    expect(store.playerNames()[0]).toBe('Bông');

    store.savePlayerNames([]);
    const t1 = await ganTenNeuChua('vi', async (ds) => ds.slice(1, 2));   // tên đầu đã có người dùng
    expect(t1).not.toBeNull();
    expect(store.playerNames()[0]).toBe(t1);

    store.savePlayerNames([]);
    const t2 = await ganTenNeuChua('vi', async (ds) => { store.savePlayerNames(['Tự gõ']); return ds.slice(1, 2); });
    expect(t2).toBe('Tự gõ');
    expect(store.playerNames()[0]).toBe('Tự gõ');

    store.savePlayerNames([]);
    await ganTenNeuChua('vi', async () => { throw new Error('mất mạng'); });
    expect(store.playerNames()[0]!.length).toBeGreaterThan(3);
  });

  it('server: /api/ten/trong chỉ đọc, ≤10 tên, so không phân biệt dấu/hoa', () => {
    const src = goc('../node-server/src/taikhoan.ts');
    expect(src).toMatch(/p === '\/api\/ten\/trong' && req\.method === 'POST'/);
    expect(src).toMatch(/\.slice\(0, 10\)/);
  });
});

describe('dải số thẻ: rung từng ô, cuộn không kêu (19.11.2026)', () => {
  it('cuộn qua ô mới → rung.tach() (chỉ khi ngón kéo); chốt bằng cuộn không phát tiếng, bấm thì có', () => {
    const ban = goc('src/components/BanChon.vue');
    expect(ban).toMatch(/if \(keoTay && giua\.value != null && giua\.value !== truoc\) rung\.tach\(\)/);
    expect(ban).toMatch(/emit\('chon-co', lv, 'cuon'\)/);
    expect(ban).toMatch(/emit\('chon-co', level, 'bam'\)/);
    expect(goc('src/components/MenuScreen.vue')).toMatch(/if \(cach !== 'cuon'\) sfx\.select\(\)/);
  });
  it('rung chọn: selectionStart trước selectionChanged (thiếu là plugin im lặng), có giới hạn tần suất', async () => {
    const src = goc('src/lib/rung.ts');
    expect(src).toMatch(/selectionStart\(\); \}\s*await h\.Haptics\.selectionChanged\(\)/);
    const { CACH_TACH_MS } = await import('@/lib/rung');
    expect(CACH_TACH_MS).toBeGreaterThan(20);
  });
});
