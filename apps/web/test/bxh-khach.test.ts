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

  it('ẩn khỏi bảng = gửi cờ an (không xoá); bảng xếp hạng không mang mã khách', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true, top: [] }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    store.addScore(100);
    store.khach();
    await tk.anKhach(true);
    const an = f.mock.calls.find(([u]) => String(u).endsWith('/api/khach'))!;
    expect(JSON.parse(String((an[1] as RequestInit).body))).toMatchObject({ an: true, totalScore: 100 });
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach/xoa'))).toBe(false);
    f.mockClear();
    await tk.bangXepHang();
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

  it('hạng TUẦN: hỏi MỘT lần lúc khởi động, sau đó chỉ khi điểm tăng / mở bảng; báo lên / xuống / lần đầu có hạng; lỗi mạng giữ số cũ', async () => {
    const tuanNay = (await import('@/lib/hang-xu')).dauTuanUtc();
    let hang: number | null = null, diem = 0;
    const f = vi.fn(async (u: string, init?: { body?: string }) => {
      if (u.endsWith('/api/auth/config')) return json({ googleClientId: 'x' });
      if (u.endsWith('/api/bxh')) {
        expect(JSON.parse(init?.body ?? '{}').loai).toBe('tuan');   // hạng trên viên xu là hạng TUẦN
        return json({ top: [], tuan: { batDau: tuanNay, het: Date.now() + 86_400_000, nay: true, coTruoc: false },
          toi: { hang, tong: 2000, matches: 3, wins: 1, totalScore: diem, name: '', avatar: null, tren: null, duoi: null } });
      }
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
    expect(hx.hangXu.value).toBeNull();          // chưa có xu tuần này → cúp trống
    expect(hx.doiHangCho.value).toBeNull();
    hang = 35; diem = 40;
    await hx.hoiSauDiem();
    expect(hx.hangXu.value).toBe(35);
    expect(hx.doiHangCho.value).toEqual({ kieu: 'moi', tu: null, den: 35 });
    hang = 18;
    await hx.hoiSauDiem();
    expect(hx.doiHangCho.value).toEqual({ kieu: 'len', tu: 35, den: 18 });
    hang = 20;
    await hx.hoiSauDiem();
    expect(hx.doiHangCho.value).toEqual({ kieu: 'xuong', tu: 18, den: 20 });
    expect(JSON.parse(localStorage.getItem('mm.hangTuan')!)).toEqual({ tuan: tuanNay, hang: 20 });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('mất mạng'); }));
    await hx.hoiSauDiem();
    expect(hx.hangXu.value).toBe(20);
    // TopBar KHÔNG hỏi theo giờ / khi quay lại từ nền
    const tb = goc('src/components/TopBar.vue');
    expect(tb).not.toMatch(/setInterval|visibilitychange|appStateChange/);
  });
  it('hạng tuần trước không mang sang tuần mới: số lưu của tuần khác bị bỏ', async () => {
    localStorage.setItem('mm.hangTuan', JSON.stringify({ tuan: '2020-01-06', hang: 3 }));
    const hx = await import('@/lib/hang-xu');
    expect(hx.hangXu.value).toBeNull();
    expect(hx.dauTuanUtc(Date.parse('2026-11-22T23:59:00Z'))).toBe('2026-11-16');   // Chủ nhật → thứ Hai tuần đó
    expect(hx.dauTuanUtc(Date.parse('2026-11-23T00:00:00Z'))).toBe('2026-11-23');
  });
  it('bảng: bục không vương miện, nằm NGOÀI vùng cuộn; mở là kéo tới dòng mình; ghi hạng từ bảng Tuần', () => {
    const src = goc('src/components/BangXepHang.vue');
    expect(src).not.toMatch(/👑/);
    expect(src.indexOf('class="buc"')).toBeLessThan(src.indexOf('ref="vungCuon" class="body"'));
    expect(src).toMatch(/if \(l === 'tuan' && !w\) ghiHang\(b\)/);
    expect(src).toMatch(/void keoToiMinh\(\)/);
    expect(src).not.toMatch(/class="xu"/);
  });
  it('kéo quá ngưỡng / chạm lúc dải đang trôi → nuốt click (pha capture) + im tiếng bấm', () => {
    const src = goc('src/components/BanChon.vue');
    expect(src).toMatch(/@pointerdown="chuotXuong" @pointermove="chuotDi"[\s\S]{0,300}@click\.capture="nuotBam"/);
    expect(src).toMatch(/Math\.hypot\(e\.clientX - x0, e\.clientY - y0\) > NGUONG_KEO/);
    expect(src).toMatch(/Date\.now\(\) - lucCuon < CHAM_DUNG_MS/);
    expect(src).toMatch(/setAttribute\('data-nosfx'/);
  });
  it('huy hiệu hạng: cúp + số, không "#"; đổi hạng có hiệu ứng + âm thanh (lên / xuống / lần đầu)', () => {
    const tb = goc('src/components/TopBar.vue');
    expect(tb).toMatch(/hangHien \? numShort\(hangHien\) : ''/);
    expect(tb).toMatch(/sfx\.lenHang\(\)[\s\S]{0,80}sfx\.xuongHang\(\)[\s\S]{0,40}sfx\.coHang\(\)/);
  });
});

describe('tên ngẫu nhiên cho người mới (19.11.2026)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('Loài + Màu + Nét, ≤16 ký tự, 9 ngôn ngữ có bộ riêng; đủ nhiều tổ hợp', async () => {
    const { taoTen, soToHop, DO_DAI_TOI_DA } = await import('@/lib/ten-ngau-nhien');
    for (let i = 0; i < 500; i++) {
      expect(taoTen('vi').length).toBeLessThanOrEqual(DO_DAI_TOI_DA);
      expect(taoTen('en').length).toBeLessThanOrEqual(DO_DAI_TOI_DA);
    }
    expect(taoTen('vi')).toMatch(/^\S+ \S+ \S+$/);
    // Tiếng có giống ngữ pháp CHƯA có bộ riêng → tiếng Anh
    for (const l of ['es', 'pt', 'fr', 'it', 'de', 'ru']) expect(taoTen(l)).toMatch(/^[A-Za-z]+ [A-Za-z]+ [A-Za-z]+$/);
    // Bảy tiếng ghép thẳng (22.11.2026): có bộ riêng, không còn chữ Latin ở tiếng Nhật/Hàn/Trung/Thái, vẫn ≤ 16 ký tự
    const { NGON_NGU_CO_TEN } = await import('@/lib/ten-goc');
    for (const l of NGON_NGU_CO_TEN) {
      const thay = new Set<string>();
      for (let i = 0; i < 400; i++) { const t = taoTen(l); expect(t.length).toBeGreaterThan(1); expect(t.length).toBeLessThanOrEqual(DO_DAI_TOI_DA); thay.add(t); }
      expect(thay.size).toBeGreaterThan(150);          // không dồn về vài tên vì từ quá dài
      expect(soToHop(l)).toBeGreaterThan(5000);
    }
    for (const l of ['ja', 'ko', 'zh', 'zh-TW', 'th']) expect(taoTen(l)).not.toMatch(/[A-Za-z]/);
    expect(taoTen('zh-TW')).not.toBe('');
    expect(taoTen('ko')).toMatch(/^\S+ \S+ \S+$/);
    expect(taoTen('ja')).not.toMatch(/\s/);
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
    expect(ban).toMatch(/if \(keoTay && giua\.value != null && giua\.value !== truoc\) \{ rung\.tach\(\); sfx\.tach\(\); \}/);
    // Máy tính: lăn chuột dọc → cuộn ngang; kéo chuột → cuộn
    expect(ban).toMatch(/@wheel="khiLan"/);
    expect(ban).toMatch(/d\.scrollLeft \+= e\.deltaY/);
    expect(ban).toMatch(/emit\('chon-co', lv, 'cuon'\)/);
    expect(ban).toMatch(/emit\('chon-co', level, 'bam'\)/);
    expect(goc('src/components/MenuScreen.vue')).toMatch(/if \(cach !== 'cuon'\) sfx\.select\(\)/);
    // MỌI chỗ dùng BanChon phải xử lý 'cuon' — đổi bàn trong phòng online từng sót (vẫn kêu khi cuộn)
    for (const f of ['MenuScreen.vue', 'OnlineScreen.vue']) {
      const src = goc(`src/components/${f}`);
      const ten = /<BanChon[\s\S]*?@chon-co="(\w+)"/.exec(src)![1];
      expect(src, f).toMatch(new RegExp(`function ${ten}\\(level: number, cach: 'cuon' \\| 'bam'`));
    }
  });
  it('rung chọn: selectionStart trước selectionChanged (thiếu là plugin im lặng), có giới hạn tần suất', async () => {
    const src = goc('src/lib/rung.ts');
    expect(src).toMatch(/selectionStart\(\); \}\s*await h\.Haptics\.selectionChanged\(\)/);
    const { CACH_TACH_MS } = await import('@/lib/rung');
    expect(CACH_TACH_MS).toBeGreaterThan(20);
  });
});

describe('dải số thẻ: mũi tên ‹ › cho máy có chuột (19.11.2026)', () => {
  it('chỉ hiện ở (hover: hover) and (pointer: fine); bỏ qua cỡ bị khoá; nhãn đọc là số thẻ đích', () => {
    const src = goc('src/components/BanChon.vue');
    expect(src).toMatch(/\.keo-ben \{ display: none; \}\s*@media \(hover: hover\) and \(pointer: fine\)/);
    expect(src).toMatch(/if \(mo\(BOARD_SIZES\[k\]!\)\) return BOARD_SIZES\[k\]!/);
    expect(src).toMatch(/@click="bamMui\(-1\)"[\s\S]*@click="bamMui\(1\)"/);
  });
});

describe('dải số thẻ: giữ ngón rồi kéo tiếp vẫn rung + tạch (20.11.2026)', () => {
  it('ngón còn chạm thì chưa chốt; theo touch (iOS bắn pointercancel khi cuộn); nhấc ngón mới hẹn chốt', () => {
    const src = goc('src/components/BanChon.vue');
    expect(src).toMatch(/function chot\(\): void \{[\s\S]{0,400}if \(ngon\) return;\s*keoTay = false;/);
    expect(src).toMatch(/@touchstart\.passive="ngonXuong" @touchend\.passive="ngonLen" @touchcancel\.passive="ngonLen"/);
    expect(src).toMatch(/function ngonLen\(\): void \{[\s\S]{0,120}henDung = setTimeout\(chot, 140\)/);
  });
  it('tiếng tạch ≈30% bản đầu', () => {
    expect(goc('src/lib/audio.ts')).toMatch(/type: 'bandpass', q: 3, gain: 0\.015 \}\);\s*this\.voice\(2100, \{ dur: 0\.018, type: 'sine', gain: 0\.0025 \}\)/);
  });
});

describe('bộ mặt bảng xếp hạng (20.11.2026)', () => {
  it('49 mặt, không trùng, không mặt máy / rồng / emoji quá mới', async () => {
    const { MAT_BXH } = await import('../../node-server/src/taikhoan');
    expect(MAT_BXH).toHaveLength(49);
    expect(new Set(MAT_BXH).size).toBe(49);
    for (const x of ['🐣', '🐥', '🐲', '🐉', '🫎', '🪿', '🪼']) expect(MAT_BXH).not.toContain(x);
  });
});

describe('xếp hạng tuần (20.11.2026)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('tuần bắt đầu thứ Hai 00:00 UTC; tuần client xin phải là thứ Hai, không ở tương lai', async () => {
    const { dauTuan, hetTuan, tuanHopLe } = await import('../../node-server/src/taikhoan');
    expect(dauTuan(Date.parse('2026-11-20T10:00:00Z'))).toBe('2026-11-16');   // thứ Năm
    expect(dauTuan(Date.parse('2026-11-22T23:59:59Z'))).toBe('2026-11-16');   // CN cuối tuần
    expect(dauTuan(Date.parse('2026-11-23T00:00:00Z'))).toBe('2026-11-23');   // thứ Hai
    // 23:30 CN giờ UTC = 6:30 sáng thứ Hai giờ VN: vẫn tuần cũ
    expect(dauTuan(Date.parse('2026-11-22T23:30:00Z'))).toBe('2026-11-16');
    expect(hetTuan('2026-11-16')).toBe(Date.parse('2026-11-23T00:00:00Z'));
    const now = Date.parse('2026-11-20T10:00:00Z');
    expect(tuanHopLe('2026-11-09', now)).toBe('2026-11-09');
    expect(tuanHopLe('2026-11-10', now)).toBe('2026-11-16');   // không phải thứ Hai
    expect(tuanHopLe('2026-11-23', now)).toBe('2026-11-16');   // tương lai
    expect(tuanHopLe("x' OR 1", now)).toBe('2026-11-16');
  });

  it('server: ẩn khách chỉ bật cờ, không xoá; mọi truy vấn bảng chung bỏ khách đang ẩn', () => {
    const sv = goc('../node-server/src/taikhoan.ts');
    expect(sv).toMatch(/UPDATE guest_scores SET hidden = 1/);
    expect(sv).not.toMatch(/DELETE FROM guest_scores WHERE guest_hash = \?', \[ma\]\);\n\s*json\(res, \{ ok: true \}\)/);
    for (const m of sv.matchAll(/FROM guest_scores WHERE ([^`']*)/g)) {
      if (/total_score|matches > 0/.test(m[1]!)) expect(m[1]).toMatch(/hidden = 0/);
    }
  });

  it('server: mỗi ván / mỗi lần khách gửi điểm đều cộng vào tuần; xoá tài khoản dọn luôn bảng tuần', () => {
    const sv = goc('../node-server/src/taikhoan.ts');
    expect(sv).toMatch(/congTuan\(false, String\(uid\), van\.score/);
    expect(sv).toMatch(/congTuan\(true, ma,/);
    expect(sv).toMatch(/DELETE FROM weekly_scores WHERE is_guest = 0 AND player = \?/);
    expect(sv).toMatch(/CREATE TABLE IF NOT EXISTS weekly_scores/);
  });

  it('app: bảng tuần là tab mặc định; chỉ bảng Tuần (tuần này) ghi hạng viên xu (20.11.2026 tối)', () => {
    const v = goc('src/components/BangXepHang.vue');
    expect(v).toMatch(/const loai = ref<LoaiBxh>\('tuan'\)/);
    expect(v).toMatch(/if \(l === 'tuan' && !w\) ghiHang\(b\)/);
  });

  it('app: hỏi bảng tuần gửi loai=tuan (+ tuần cũ nếu xem lịch sử)', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true, top: [] }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    await tk.bangXepHang('tuan', '2026-11-09');
    const bxh = f.mock.calls.find(([u]) => String(u).endsWith('/api/bxh'))!;
    expect(JSON.parse(String((bxh[1] as RequestInit).body))).toMatchObject({ loai: 'tuan', tuan: '2026-11-09' });
  });
});
