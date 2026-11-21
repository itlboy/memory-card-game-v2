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
  sanh = moSanh({ xemPhong: (ma) => phong[ma] ?? null, avatars: ['🦊'], now: () => gio });
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
    expect(j).toEqual({ ok: true, han: HAN_MOI_MS });
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

  it('đóng app (socket đóng) là biến khỏi danh sách', async () => {
    const a = await may('A');
    a.ws.close();
    await cho(100);
    expect((await post('/api/sanh/ds', CHU)).j.ds).toEqual([]);
  });
});

describe('client: nối sảnh đúng lúc, giao diện', () => {
  it('lib/sanh.ts: chỉ giữ kết nối khi app đang hiện, bật nhận lời mời và KHÔNG ở phòng online', () => {
    const s = doc('lib/sanh.ts');
    expect(s).toMatch(/nhanLoiMoi\.value && !trongPhongOnline\.value[\s\S]*visibilityState === 'visible'/);
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
