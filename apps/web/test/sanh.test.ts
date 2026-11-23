// @vitest-environment node
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CACH_MOI_LAI_MS, HAN_MOI_MS, MOI_MOI_PHUT, moSanh, type Sanh, type XemPhong } from '../../node-server/src/sanh';

/**
 * SẢNH — mời người đang online vào phòng chờ (21.11.2026). Chạy server THẬT trên cổng tạm, máy giả nối
 * WebSocket như app: kiểm xác thực chủ phòng, lời mời tới đúng máy, và các luật chống làm phiền.
 */
const ROOT = new URL('../src/', import.meta.url);
const doc = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');

let gio = 1_000_000;
let phong: Record<string, XemPhong>;
let sanh: Sanh;
let server: Server;
let goc = '';
const mo: WebSocket[] = [];

beforeEach(async () => {
  gio = 1_000_000;
  phong = {
    '482913': { status: 'lobby', hostToken: 'tok-chu', host: { ten: 'Hổ Con', mat: '🐯' }, nguoi: 2, toiDa: 4, soThe: 12 }
  };
  sanh = moSanh({
    xemPhong: (ma) => phong[ma] ?? null, avatars: ['🦊'], now: () => gio,
    // Giả lớp tài khoản: phiên "phien-7" = tài khoản 7; mã khách hợp lệ = chuỗi dài ≥ 22
    xacDinh: (khach, token) => (token === 'phien-7' ? 'u:7' : typeof khach === 'string' && khach.length >= 22 ? `k:${khach}` : null)
  });
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!sanh.xuLyHttp(req, res, url)) { res.writeHead(404); res.end(); }
  });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!sanh.nhanUpgrade(req, url, socket, head)) socket.destroy();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  goc = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  for (const w of mo.splice(0)) { try { w.close(); } catch { /* đã đóng */ } }
  sanh.dong();
  await new Promise((ok) => server.close(ok));
});

/** Máy giả: nối sảnh, chờ `chao`, gom tin nhận được. */
async function may(ten = '', tt = 'chu'): Promise<{ ws: WebSocket; sid: string; tin: Record<string, unknown>[] }> {
  const ws = new WebSocket(`ws://${goc}/ws/sanh?ten=${encodeURIComponent(ten)}&tt=${tt}`);
  mo.push(ws);
  const tin: Record<string, unknown>[] = [];
  const sid = await new Promise<string>((ok, hong) => {
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Record<string, unknown>;
      tin.push(m);
      if (m.t === 'chao') ok(String(m.sid));
    };
    ws.onerror = () => hong(new Error('không nối được'));
  });
  return { ws, sid, tin };
}
const post = async (duong: string, body: unknown): Promise<{ status: number; j: Record<string, unknown> }> => {
  const r = await fetch(`http://${goc}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, j: (await r.json()) as Record<string, unknown> };
};
const cho = (ms = 60): Promise<void> => new Promise((ok) => setTimeout(ok, ms));
const CHU = { ma: '482913', token: 'tok-chu' };

describe('server: sanh.ts', () => {
  it('chỉ CHỦ PHÒNG (đúng token) xem được danh sách; tên và trạng thái đúng, không lộ mã máy', async () => {
    const a = await may('Cáo Nhỏ');
    const b = await may('', 'choi');
    expect((await post('/api/sanh/ds', { ma: '482913', token: 'sai' })).status).toBe(403);
    expect((await post('/api/sanh/ds', { ma: '999999', token: 'tok-chu' })).status).toBe(403);
    const { status, j } = await post('/api/sanh/ds', CHU);
    expect(status).toBe(200);
    const ds = j.ds as Array<Record<string, unknown>>;
    expect(ds.map((n) => n.sid)).toEqual([a.sid, b.sid]);   // người ở trang chủ lên trước
    expect(ds[0]).toMatchObject({ ten: 'Cáo Nhỏ', tt: 'chu', mat: '🦊' });
    expect(ds[1]).toMatchObject({ ten: '', tt: 'choi' });
    expect(Object.keys(ds[0]!).sort()).toEqual(['mat', 'sid', 'ten', 'tt']);
  });

  it('mời → đúng máy đó nhận thẻ mời (mã phòng, người mời, số người, số thẻ); máy khác không', async () => {
    const a = await may('A');
    const b = await may('B');
    const { j } = await post('/api/sanh/moi', { ...CHU, sid: a.sid });
    expect(j).toEqual({ ok: true, han: HAN_MOI_MS, cach: CACH_MOI_LAI_MS });
    await cho();
    const moi = a.tin.find((m) => m.t === 'moi');
    expect(moi).toMatchObject({ ma: '482913', tu: { ten: 'Hổ Con', mat: '🐯' }, nguoi: 2, toiDa: 4, soThe: 12, han: HAN_MOI_MS });
    expect(b.tin.some((m) => m.t === 'moi')).toBe(false);
  });

  it('chống làm phiền: một lời mời treo mỗi người, mời lại phải chờ, bị "Để sau" là khoá với phòng đó', async () => {
    phong['111111'] = { ...phong['482913']!, hostToken: 'tok-2' };
    const a = await may('A');
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.ok).toBe(true);
    // phòng khác mời khi lời mời đầu còn treo
    expect((await post('/api/sanh/moi', { ma: '111111', token: 'tok-2', sid: a.sid })).j.loi).toBe('banMoi');
    // cùng phòng mời lại ngay
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.loi).toBe('vuaMoi');
    // danh sách của chủ phòng thấy "đã mời" đang đếm ngược
    const ds = (await post('/api/sanh/ds', CHU)).j.ds as Array<Record<string, unknown>>;
    expect(ds[0]!.daMoi).toBe(HAN_MOI_MS);
    // …và còn bao lâu mới mời lại được (nút Mời thành vạch chờ suốt khoảng này, không sáng lại sau 20 giây)
    expect(ds[0]!.choMoi).toBe(CACH_MOI_LAI_MS);
    gio += HAN_MOI_MS + 1;
    const ds2 = (await post('/api/sanh/ds', CHU)).j.ds as Array<Record<string, unknown>>;
    expect(ds2[0]!.daMoi).toBeUndefined();
    expect(ds2[0]!.choMoi).toBe(CACH_MOI_LAI_MS - HAN_MOI_MS - 1);
    gio -= HAN_MOI_MS + 1;
    // người kia bấm Để sau → phòng đó bị khoá dù đã qua thời gian chờ
    const id = a.tin.find((m) => m.t === 'moi')!.id;
    a.ws.send(JSON.stringify({ t: 'tuChoi', id }));
    await cho();
    gio += CACH_MOI_LAI_MS + 1;
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.loi).toBe('tuChoi');
    expect(((await post('/api/sanh/ds', CHU)).j.ds as Array<Record<string, unknown>>)[0]!.tuChoi).toBe(true);
    // phòng KHÁC vẫn mời được (lời mời cũ đã gỡ)
    expect((await post('/api/sanh/moi', { ma: '111111', token: 'tok-2', sid: a.sid })).j.ok).toBe(true);
  });

  it('phòng đầy / đang chơi / người đã thoát thì không mời được; mỗi phòng tối đa MOI_MOI_PHUT lời mời một phút', async () => {
    const a = await may('A');
    phong['482913']!.nguoi = 4;
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.loi).toBe('day');
    phong['482913'] = { ...phong['482913']!, nguoi: 2, status: 'playing' };
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.loi).toBe('dangChoi');
    expect((await post('/api/sanh/ds', CHU)).j.ds).toEqual([]);
    phong['482913']!.status = 'lobby';
    expect((await post('/api/sanh/moi', { ...CHU, sid: 'khong-co' })).j.loi).toBe('khongCo');
    const ds: string[] = [];
    for (let i = 0; i <= MOI_MOI_PHUT; i++) ds.push((await may(`N${i}`)).sid);
    const kq: unknown[] = [];
    for (const sid of ds) { const { j } = await post('/api/sanh/moi', { ...CHU, sid }); kq.push(j.ok ?? j.loi); }
    expect(kq.slice(0, MOI_MOI_PHUT).every((x) => x === true)).toBe(true);
    expect(kq[MOI_MOI_PHUT]).toBe('nhieuQua');
  });

  it('bảng xếp hạng: danh tính gửi qua tin nhắn → online/rảnh; ở phòng online → "Đang chơi", không mời được', async () => {
    const a = await may('A');
    expect(sanh.trangThai('u:7')).toBeNull();   // chưa xưng danh
    a.ws.send(JSON.stringify({ t: 'ai', token: 'phien-7' }));
    await cho();
    expect(sanh.trangThai('u:7')).toEqual({ sid: a.sid, ban: false });
    // Vào phòng online: vẫn nối (để bảng hiện "Đang chơi") nhưng không có sid, không lên danh sách mời, mời bị chặn
    a.ws.send(JSON.stringify({ t: 'tt', tt: 'phong' }));
    await cho();
    expect(sanh.trangThai('u:7')).toEqual({ ban: true });
    expect((await post('/api/sanh/ds', CHU)).j.ds).toEqual([]);
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid })).j.loi).toBe('banPhong');
    // Ra phòng: rảnh lại
    a.ws.send(JSON.stringify({ t: 'tt', tt: 'chu' }));
    await cho();
    expect(sanh.trangThai('u:7')).toEqual({ sid: a.sid, ban: false });
    // Danh tính giả không được nhận; đăng xuất (gửi lại không token) là thôi gắn
    const b = await may('B');
    b.ws.send(JSON.stringify({ t: 'ai', token: 'gia-mao' }));
    a.ws.send(JSON.stringify({ t: 'ai' }));
    await cho();
    expect(sanh.trangThai('u:7')).toBeNull();
  });

  it('khách: mã khách → `k:`; đóng app là hết online', async () => {
    const a = await may('Khách');
    const ma = 'abcdefghijklmnopqrstuvwxyz';
    a.ws.send(JSON.stringify({ t: 'ai', khach: ma }));
    await cho();
    expect(sanh.trangThai(`k:${ma}`)).toEqual({ sid: a.sid, ban: false });
    a.ws.close();
    await cho(100);
    expect(sanh.trangThai(`k:${ma}`)).toBeNull();
  });

  it('thách đấu: lời mời mang cờ `thach` tới máy kia, luật chống làm phiền y như mời thường', async () => {
    const a = await may('A');
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid, thach: true })).j.ok).toBe(true);
    await cho();
    expect(a.tin.find((m) => m.t === 'moi')).toMatchObject({ thach: true, ma: '482913' });
    expect((await post('/api/sanh/moi', { ...CHU, sid: a.sid, thach: true })).j.loi).toBe('vuaMoi');
  });

  it('đóng app (socket đóng) là biến khỏi danh sách', async () => {
    const a = await may('A');
    a.ws.close();
    await cho(100);
    expect((await post('/api/sanh/ds', CHU)).j.ds).toEqual([]);
  });
});

describe('client: nối sảnh đúng lúc, giao diện', () => {
  it('lib/sanh.ts: giữ kết nối khi app đang hiện và bật nhận lời mời; ở phòng online thì báo `phong` (không đóng)', () => {
    const s = doc('lib/sanh.ts');
    // 22.11.2026: nối khi bật MỘT trong hai công tắc (nhận lời mời / gợi ý thi đấu); tắt nhận lời mời thì khai `nm=0`
    expect(s).toMatch(/const nenMo = \(\): boolean => \(nhanLoiMoi\.value \|\| goiYThiDau\.value\)\s*&& typeof document !== 'undefined' && document\.visibilityState === 'visible';/);
    expect(s).toContain("nm: nhanLoiMoi.value ? '1' : '0'");
    expect(s).toContain("trongPhongOnline.value ? 'phong'");
    // danh tính đi trong tin nhắn sau `chao`, KHÔNG trên URL
    expect(s).toContain("gui({ t: 'ai', ...danhTinhSanh() })");
    // đã nối thì gửi lại trạng thái hiện tại — tin `tt` gửi lúc socket còn CONNECTING bị rơi
    // 23.11.2026: tin `tt` kèm `mot` (đang chơi offline MỘT MÌNH — thi đấu vẫn hỏi người này)
    expect(s).toMatch(/m\.t === 'chao'[\s\S]{0,500}gui\(\{ t: 'tt', tt: ttHienTai\(\), mot: choiMotMinh\.value \}\)/);
    expect(s).not.toMatch(/URLSearchParams\(\{[^}]*(token|khach)/);
    expect(s).toContain("addEventListener('visibilitychange', canBang)");
    // mã phòng + token đi bằng POST body, không vào URL
    expect(s).toMatch(/method: 'POST'[\s\S]*body: JSON\.stringify\(body\)/);
  });
  it('App.vue: đang chơi offline mà nhận lời → dừng ván và hỏi lại trước khi bỏ', () => {
    const a = doc('App.vue');
    expect(a).toMatch(/session\.pause\(\); hoiBoVanMoi\.value = true/);
    expect(a).toContain('<LoiMoi @vao="vaoPhongMoi" />');
    expect(a).toMatch(/trongPhongOnline\.value = screen\.value === 'online' && !!onlineRef\.value\?\.trongPhong/);
  });
  it('phòng chờ: nút mời chỉ cho chủ phòng, phòng đang chờ và còn chỗ', () => {
    const o = doc('components/OnlineScreen.vue');
    expect(o).toMatch(/coTheMoi = computed\(\(\) => o\.isHost\.value && o\.room\.value\?\.status === 'lobby' && conCho\.value > 0/);
  });
  it('trang Cài đặt: menu giữ Giao diện/Âm thanh/Nhạc; Rung, Ngôn ngữ, lời mời, cập nhật nằm trong trang', () => {
    const tb = doc('components/TopBar.vue');
    const menu = tb.slice(tb.indexOf('class="menu"'), tb.indexOf('</header>'));
    const trang = tb.slice(tb.indexOf('class="cd-trang'));
    for (const k of ["t('tb.giaoDien')", "t('tb.amThanh')", "t('tb.nhacNen')", 'moTrangCd']) expect(menu).toContain(k);
    for (const k of ["t('tb.rung')", "t('tb.ngonNgu')", 'kiemCapNhat']) expect(menu).not.toContain(k);
    for (const k of ["t('tb.rung')", "t('tb.ngonNgu')", 'kiemCapNhat', "t('cd.nhanMoi')", "t('cd.baoPhong')"]) expect(trang).toContain(k);
  });
  it('phòng chờ không tràn ngang: cột danh sách người chơi khoá bằng bề ngang khung (Xiaomi 360px, 21.11.2026)', () => {
    const o = doc('components/OnlineScreen.vue');
    const khoi = o.slice(o.indexOf('.lobby-list {'), o.indexOf('}', o.indexOf('.lobby-list {')));
    expect(khoi).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(o).toMatch(/li\.empty:has\(\.moi-online\) \{[\s\S]*?min-width: 0;/);
  });
  it('ping chỉ báo "chậm" từ 400ms (chủ dự án 21.11.2026 — server Dallas, VN thường ~280ms)', () => {
    expect(doc('composables/useOnlineRoom.ts')).toMatch(/if \(p < 100\) return 'good';\s*if \(p < 400\) return 'ok';/);
  });
  it('màn tối có màu riêng cho dải báo và dòng "Bạn" ở bảng xếp hạng', () => {
    expect(doc('components/DaiBao.vue')).toMatch(/:global\(\[data-theme='dark'\] \.dai-bao\.b-tot\)/);
    expect(doc('components/BangXepHang.vue')).toMatch(/:global\(\[data-theme='dark'\] \.panel\) \{ --toi-nen/);
  });
});

describe('icon: không dùng emoji hệ thống làm icon giao diện (21.11.2026)', () => {
  it('dải báo chỉ nhận tên icon vòng màu, không emoji', () => {
    const goi = [doc('composables/useBaoPhong.ts'), doc('components/OnlineScreen.vue')].join('\n');
    const ic = [...goi.matchAll(/baoNoi\(\{[^}]*\bic: '([^']+)'/g)].map((m) => m[1]!);
    expect(ic.length).toBeGreaterThan(5);
    for (const x of ic) expect(x, x).toMatch(/^[a-zA-Z]+$/);
  });
  it('không còn 📡 📴 🚪 ⚠️ 🔔 ⏳ 🧊 💔 🐞 trong giao diện', () => {
    const tep = ['components/OnlineGame.vue', 'components/PlayerStrip.vue', 'components/OnlineScreen.vue', 'components/NhacSanSang.vue',
      'components/EmojiBar.vue', 'components/ResultDialog.vue', 'components/BaoPhongDong.vue', 'components/TaiKhoanDialog.vue',
      'components/TopBar.vue', 'components/DebugDialog.vue', 'composables/useBaoPhong.ts', 'lib/nhac.ts'];
    for (const f of tep) {
      const s = doc(f).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(s, f).not.toMatch(/[📡📴🚪⚠🔔⏳🧊💔🐞🎹🐋🎐]/u);
    }
  });
});

describe('số người online = người KHÁC, tính lại theo trạng thái kết nối (23.11.2026)', () => {
  it('hỏi đúng lúc sảnh vừa nối (lời chào chưa về) không còn bị đếm chính mình', async () => {
    const { dangNoiSanh, ghiSoOnline, soNguoiOnline } = await import('@/lib/sanh');
    dangNoiSanh.value = false;
    ghiSoOnline(1);                       // server đã đếm mình, client chưa biết mình đã nối
    expect(soNguoiOnline.value).toBe(1);
    dangNoiSanh.value = true;             // lời chào về → trừ mình ngay, không chờ lần hỏi kế
    expect(soNguoiOnline.value).toBe(0);
    ghiSoOnline(3);
    expect(soNguoiOnline.value).toBe(2);
    dangNoiSanh.value = false;            // vừa rớt sảnh: số thô lúc hỏi vẫn còn tính mình
    expect(soNguoiOnline.value).toBe(2);
    ghiSoOnline(2);                       // lần hỏi kế, không còn nối: không trừ nữa
    expect(soNguoiOnline.value).toBe(2);
    ghiSoOnline('x'); ghiSoOnline(undefined);   // số hỏng: giữ số cũ
    expect(soNguoiOnline.value).toBe(2);
  });
});
