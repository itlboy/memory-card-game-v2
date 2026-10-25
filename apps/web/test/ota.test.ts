import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CẬP NHẬT NÓNG (OTA, 14.10.2026): app gói tự lấy gói web mới từ /ota/manifest.json.
 * Canh: báo sẵn sàng NGAY (không thì plugin quay về gói cũ), bỏ qua khi đã đúng gói /
 * app quá cũ / gói từng hỏng, và chỉ áp ở lần MỞ LẠI app (`kill`).
 */
const goi = { notifyAppReady: vi.fn(async () => ({})), list: vi.fn(), download: vi.fn(), next: vi.fn(async () => ({})), setMultiDelay: vi.fn(async () => {}), set: vi.fn(async () => {}), delete: vi.fn(async () => {}), addListener: vi.fn(async () => ({ remove: async () => {} })) };
let manifest: Record<string, string> | null = null;
let banApp = '1.3.0';
vi.mock('@/lib/native', () => ({ laApp: true, nenApp: 'ios', SITE_URL: 'https://flipmatch.cozypi.com' }));
vi.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: goi }));
let dsFile: [string, string][] | null = null;
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { get: vi.fn(async ({ url }: { url: string }) =>
  url.includes('.files.json') ? { status: dsFile ? 200 : 404, data: dsFile } : { status: manifest ? 200 : 404, data: manifest }) } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: banApp, build: '130' }) } }));

beforeEach(() => {
  for (const f of Object.values(goi)) f.mockClear();
  goi.list.mockResolvedValue({ bundles: [] });
  goi.download.mockResolvedValue({ id: 'b1', version: 'moi', status: 'success' });
  banApp = '1.3.0';
  dsFile = null;
  void import('@/lib/ota').then((m) => m.huyApKhiRanh(true));
  // Trang chủ THẬT đang hiện (lib/ota.ts manTrangChu) — ca nào cần "không ở trang chủ" thì tự gỡ
  if (!document.getElementById('man-chu')) document.body.insertAdjacentHTML('beforeend', '<section id="man-chu" class="panel trang-chu"></section>');
});
const MOI = { id: 'moi', url: '/ota/moi.zip', sha256: 'abc', minNative: '1.3.0' };

describe('cập nhật nóng', () => {
  it('mở app ở TRANG CHỦ, tải kịp: báo "đang cập nhật" rồi áp NGAY', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.set).toHaveBeenCalledWith({ id: 'b1' });
    expect(goi.next).not.toHaveBeenCalled();
    expect(document.querySelector('.bao-cap-nhat')?.textContent).toBeTruthy();
  });

  it('đang trong ván / wizard: KHÔNG áp ngay, hẹn lần mở sau', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/?playing=1');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.set).not.toHaveBeenCalled();
    expect(goi.setMultiDelay).toHaveBeenCalledWith({ delayConditions: [{ kind: 'kill' }] });
    history.replaceState(null, '', '/');
  });

  it('nhận ra trang chủ qua URL', async () => {
    const { oTrangChu } = await import('@/lib/ota');
    expect(oTrangChu('')).toBe(true);
    for (const q of ['?playing=1', '?room=123456', '?online=1', '?w=theme']) expect(oTrangChu(q), q).toBe(false);
  });

  it('có gói mới (không ở trang chủ): báo sẵn sàng, tải đúng url + checksum, hẹn áp khi MỞ LẠI app', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/?w=theme');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).toHaveBeenCalledWith({ url: 'https://flipmatch.cozypi.com/ota/moi.zip', version: 'moi', checksum: 'abc' });
    expect(goi.next).toHaveBeenCalledWith({ id: 'b1' });
    expect(goi.setMultiDelay).toHaveBeenCalledWith({ delayConditions: [{ kind: 'kill' }] });
    history.replaceState(null, '', '/');
  });

  it('TẢI CHÊNH LỆCH: có danh sách file thì đưa plugin từng file + sha256 + url theo mã băm', async () => {
    manifest = { ...MOI, files: '/ota/moi.files.json' };
    dsFile = [['index.html', 'a'.repeat(64)], ['emoji/3d/1f600.webp', 'b'.repeat(64)]];
    history.replaceState(null, '', '/?w=theme');
    const { kiemOta, trangThaiOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).toHaveBeenCalledTimes(1);
    expect(goi.download).toHaveBeenCalledWith({
      url: 'https://flipmatch.cozypi.com/ota/moi.zip', version: 'moi',
      manifest: [
        { file_name: 'index.html', file_hash: 'a'.repeat(64), download_url: `https://flipmatch.cozypi.com/ota/f/${'a'.repeat(64)}` },
        { file_name: 'emoji/3d/1f600.webp', file_hash: 'b'.repeat(64), download_url: `https://flipmatch.cozypi.com/ota/f/${'b'.repeat(64)}` }
      ]
    });
    expect(trangThaiOta.value.buoc).toBe('choMoLai');
    history.replaceState(null, '', '/');
  });

  it('tải chênh lệch LỖI: xoá dấu hỏng của bản đó rồi quay về zip (không bao giờ mất đường cập nhật)', async () => {
    manifest = { ...MOI, files: '/ota/moi.files.json' };
    dsFile = [['index.html', 'a'.repeat(64)]];
    goi.download.mockRejectedValueOnce(new Error('file 404'));
    goi.list.mockResolvedValueOnce({ bundles: [] }).mockResolvedValueOnce({ bundles: [{ id: 'hong', version: 'moi', status: 'error' }] });
    history.replaceState(null, '', '/?w=theme');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.delete).toHaveBeenCalledWith({ id: 'hong' });
    expect(goi.download).toHaveBeenLastCalledWith({ url: 'https://flipmatch.cozypi.com/ota/moi.zip', version: 'moi', checksum: 'abc' });
    expect(goi.next).toHaveBeenCalledWith({ id: 'b1' });
    history.replaceState(null, '', '/');
  });

  it('trạng thái cho khối debug: mới nhất / lỗi kèm lý do', async () => {
    const { kiemOta, trangThaiOta } = await import('@/lib/ota');
    manifest = { ...MOI, id: __OTA_ID__ };
    await kiemOta();
    expect(trangThaiOta.value.buoc).toBe('moiNhat');
    manifest = null;
    await kiemOta();
    expect(trangThaiOta.value).toMatchObject({ buoc: 'loi', loi: 'manifest HTTP 404' });
  });

  it('đang chạy đúng gói trên server: không tải', async () => {
    manifest = { ...MOI, id: __OTA_ID__ };
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('app native cũ hơn minNative: không nhận gói (gói cần plugin app chưa có)', async () => {
    manifest = { ...MOI, minNative: '1.4.0' };
    banApp = '1.3.0';
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('gói này từng hỏng trên máy: không tải lại (khỏi vòng tải/hỏng)', async () => {
    manifest = MOI;
    goi.list.mockResolvedValue({ bundles: [{ id: 'x', version: 'moi', status: 'error' }] });
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('đã tải sẵn từ lần trước: dùng lại, không tải lần nữa', async () => {
    manifest = MOI;
    goi.list.mockResolvedValue({ bundles: [{ id: 'cu', version: 'moi', status: 'success' }] });
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
    expect(goi.set).toHaveBeenCalledWith({ id: 'cu' });
  });

  it('server chưa có /ota (404): vẫn báo sẵn sàng, không lỗi', async () => {
    manifest = null;
    const { kiemOta } = await import('@/lib/ota');
    await expect(kiemOta()).resolves.toBeUndefined();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('so phiên bản theo số, không theo chữ (1.10 > 1.9)', async () => {
    const { soSanhBan } = await import('@/lib/ota');
    expect(soSanhBan('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(soSanhBan('1.3', '1.3.0')).toBe(0);
    expect(soSanhBan('1.2.9', '1.3.0')).toBeLessThan(0);
  });

  it('không gửi thống kê về Capgo, không tự cập nhật theo đám mây', () => {
    const cfg = readFileSync(resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*autoUpdate:\s*false/);
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*statsUrl:\s*''/);
  });

  it('service worker KHÔNG chặn /ota/ (không thì link zip ra trang game) và Node trả đúng kiểu zip', () => {
    const vite = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/navigateFallbackDenylist:[^\n]*\\\/ota\\\//);
    const node = readFileSync(resolve(process.cwd(), '../node-server/src/index.ts'), 'utf8');
    expect(node).toMatch(/'\.zip':\s*'application\/zip'/);
  });

  it('bản build web luôn đóng gói OTA (cả Docker lẫn pnpm release đi qua lệnh này)', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain('dong-goi-ota.mjs');
  });

  /*
   * CHỐT SỐNG CÒN (16.10.2026, chủ dự án: OTA hỏng thì chỉ còn cách chờ bản store). Một bản
   * OTA mà app vẫn mở được nhưng đường cập nhật hỏng = máy KẸT VĨNH VIỄN ở bản đó. Xem mục
   * "ĐỪNG LÀM HỎNG CẬP NHẬT NÓNG" ở CLAUDE.md.
   */
  it('báo "gói chạy được" TRƯỚC mọi lời gọi mạng — mạng chết/manifest lỗi vẫn không quay lui oan', async () => {
    manifest = MOI;
    const core = await import('@capacitor/core');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    const thuTuSanSang = goi.notifyAppReady.mock.invocationCallOrder[0]!;
    const thuTuMang = (core.CapacitorHttp.get as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder.at(-1)!;
    expect(thuTuSanSang).toBeLessThan(thuTuMang);
  });

  it('main.ts LUÔN gọi kiemOta lúc khởi động (không điều kiện, không chờ màn nào)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).toMatch(/^void import\('\.\/lib\/ota'\)\.then\(\(m\) => m\.kiemOta\(\)\);$/m);
  });

  it('MÃ GÓI theo COMMIT, một hàm chung cho vite.config (app) và dong-goi-ota (manifest) — 18.10.2026', { timeout: 20000 }, async () => {
    // Trước: mã = giờ build → app CI và server KHÔNG BAO GIỜ trùng mã → app mới cài tự tải lại gói y hệt.
    const vite = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const goiOta = readFileSync(resolve(process.cwd(), '../../tools/dong-goi-ota.mjs'), 'utf8');
    expect(vite, 'app phải nhúng mã từ hàm chung').toMatch(/__OTA_ID__:\s*JSON\.stringify\(maGoiOta\(\)\)/);
    expect(goiOta, 'manifest phải lấy mã từ hàm chung').toMatch(/const id = maGoiOta\(\);/);
    // Chạy bằng Node thật (như lúc build) — trong jsdom import.meta.url không phải file://
    const { execFileSync } = await import('node:child_process');
    const chay = (otaId?: string) => execFileSync(process.execPath, ['--input-type=module', '-e',
      `import { maGoiOta } from '${resolve(process.cwd(), '../../tools/ma-goi-ota.mjs')}'; process.stdout.write(maGoiOta(${otaId ? `{ OTA_ID: '${otaId}' }` : '{}'}))`], { encoding: 'utf8' });
    expect(chay('ep-tay')).toBe('ep-tay');
    expect(chay(), 'version-băm10[-giờ nếu nguồn chưa commit]').toMatch(/^\d+\.\d+\.\d+-[0-9a-f]{10}(-\d{8}T\d{6})?$/);
  });

  it('mã gói theo NỘI DUNG nguồn web, và mobile.yml ra bản app mỗi khi nguồn đó đổi — 25.10.2026', async () => {
    const { NGUON_GOI } = await import('../../../tools/ma-goi-ota.mjs');
    const yml = readFileSync(resolve(process.cwd(), '../../.github/workflows/mobile.yml'), 'utf8');
    const loc = [...yml.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1].replace(/\/\*\*$/, ''));
    for (const d of NGUON_GOI) expect(loc.some((l) => d === l || d.startsWith(`${l}/`)), d).toBe(true);
    const ma = readFileSync(resolve(process.cwd(), '../../tools/ma-goi-ota.mjs'), 'utf8');
    expect(ma, 'không quay về sha commit').not.toMatch(/rev-parse', '--short=10', 'HEAD'/);
  });

  it('manifest GIỮ các trường bản app cũ đang đọc: id, url, sha256, minNative (chỉ được THÊM trường)', () => {
    const goiOta = readFileSync(resolve(process.cwd(), '../../tools/dong-goi-ota.mjs'), 'utf8');
    const dong = goiOta.split('\n').find((l) => l.includes("'manifest.json'"))!;
    for (const k of ['id', 'url: `/ota/${id}.zip`', 'sha256', 'minNative']) expect(dong, k).toContain(k);
  });

  it('plugin tự quay về gói trước khi gói mới không báo sẵn sàng trong 10 giây', () => {
    const cfg = readFileSync(resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*appReadyTimeout:\s*10000/);
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*resetWhenUpdate:\s*true/);
  });

  it('luật đuôi file tải chênh lệch: build và app KHỚP nhau; HTML không đuôi (Cloudflare sửa HTML)', async () => {
    const { duoiOta } = await import('@/lib/ota');
    expect(duoiOta('assets/index-x.js')).toBe('.js');
    expect(duoiOta('assets/a.CSS')).toBe('.css');
    expect(duoiOta('about.html')).toBe('');
    expect(duoiOta('index.html')).toBe('');
    expect(duoiOta('emoji/3d/1f600.webp')).toBe('');
    const goiOta = readFileSync(resolve(process.cwd(), '../../tools/dong-goi-ota.mjs'), 'utf8');
    const app = readFileSync(resolve(process.cwd(), 'src/lib/ota.ts'), 'utf8');
    const luat = (src: string) => /const DUOI_GIU = (\/[^\n]+\/i);/.exec(src)?.[1];
    expect(luat(goiOta), 'tools/dong-goi-ota.mjs').toBeTruthy();
    expect(luat(goiOta)).toBe(luat(app));
  });

  it('zip bỏ ảnh emoji 512 + chốt < 24MiB (Worker giới hạn 25MiB/file); app thiếu 512 thì dùng 256', async () => {
    const goiOta = readFileSync(resolve(process.cwd(), '../../tools/dong-goi-ota.mjs'), 'utf8');
    expect(goiOta).toMatch(/const LA_512 = \/\^emoji\\\/3d\\\/\[\^\/\]\+\\\.webp\$\/;/);
    expect(goiOta).toMatch(/TRAN_ZIP = 24 \* 1024 \* 1024/);
    const { anhEmoji, co512 } = await import('@/lib/emoji');
    const coBo = anhEmoji('😀', true, 512);
    co512.value = false;
    expect(anhEmoji('😀', true, 512)).toBe(coBo!.replace('/emoji/3d/', '/emoji/3d/256/'));
    expect(anhEmoji('😀', true, 128)).toContain('/emoji/3d/128/');
    co512.value = true;
  });

  it('chờ mở lại: VỀ TRANG CHỦ và rảnh thì áp luôn (đếm 3·2·1); trong ván / hộp thoại / vừa chạm thì chờ', async () => {
    vi.useFakeTimers();
    try {
      const ota = await import('@/lib/ota');
      ota.huyApKhiRanh(true);
      manifest = MOI;
      history.replaceState(null, '', '/?playing=1');
      await ota.kiemOta();
      expect(goi.next).toHaveBeenCalledWith({ id: 'b1' });
      await vi.advanceTimersByTimeAsync(5000);
      expect(goi.set, 'đang trong ván').not.toHaveBeenCalled();
      // Hết ván ONLINE: URL sạch nhưng màn kết quả còn hiện (không có panel trang chủ) — KHÔNG áp
      document.getElementById('man-chu')!.remove();
      document.querySelectorAll('.bao-cap-nhat').forEach((e) => e.remove());   // sót từ ca trước
      history.replaceState(null, '', '/');
      await vi.advanceTimersByTimeAsync(6000);
      expect(goi.set, 'màn kết quả online, URL đã sạch').not.toHaveBeenCalled();
      expect(document.querySelector('.bao-cap-nhat'), 'không đếm 3·2·1 ở màn kết quả').toBeNull();
      document.body.insertAdjacentHTML('beforeend', '<section id="man-chu" class="panel trang-chu"></section>');
      document.body.insertAdjacentHTML('beforeend', '<div id="hop-thu" role="dialog" aria-modal="true"></div>');
      await vi.advanceTimersByTimeAsync(5000);
      expect(goi.set, 'hộp thoại đang mở').not.toHaveBeenCalled();
      document.getElementById('hop-thu')!.remove();
      await vi.advanceTimersByTimeAsync(1500);
      expect(document.querySelector('.bao-cap-nhat'), 'báo trước khi tải lại').toBeTruthy();
      await vi.advanceTimersByTimeAsync(4000);
      expect(goi.set).toHaveBeenCalledWith({ id: 'b1' });
      expect(goi.set).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(goi.set, 'mỗi lần mở app áp tối đa MỘT lần').toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); document.querySelectorAll('.bao-cap-nhat').forEach((e) => e.remove()); }
  });

  it('rảnh = trang chủ + đang hiện + không hộp thoại + không chạm 2 giây', async () => {
    const { dangRanh } = await import('@/lib/ota');
    const ok = { search: '', manChu: true, hien: true, coHop: false, tuLucCham: 5000 };
    expect(dangRanh(ok)).toBe(true);
    // Hết ván online: URL đã sạch (endSession lau ?room=) nhưng màn kết quả vẫn hiện — KHÔNG áp
    expect(dangRanh({ ...ok, manChu: false })).toBe(false);
    expect(dangRanh({ ...ok, search: '?room=123456' })).toBe(false);
    expect(dangRanh({ ...ok, hien: false })).toBe(false);
    expect(dangRanh({ ...ok, coHop: true })).toBe(false);
    expect(dangRanh({ ...ok, tuLucCham: 500 })).toBe(false);
  });

  it('trang chủ nhận bằng MÀN HÌNH: panel trang chủ của MenuScreen phải có, và manTrangChu đọc đúng nó', async () => {
    const { manTrangChu } = await import('@/lib/ota');
    document.getElementById('man-chu')?.remove();
    expect(manTrangChu()).toBe(false);
    const el = document.createElement('section'); el.className = 'panel trang-chu'; document.body.append(el);
    expect(manTrangChu()).toBe(true);
    el.remove();
    // Canh tên lớp: đổi tên ở MenuScreen mà quên ở đây là OTA không bao giờ áp khi rảnh nữa
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    expect(readFileSync(join(__dirname, '..', 'src/components/MenuScreen.vue'), 'utf8')).toContain(`<section class="panel" :class="{ 'trang-chu': buocHien === 'players' }">`);
  });

  it('lỗi tạm thì TỰ THỬ LẠI sau 1 phút, tối đa 3 lần (không bắt người chơi bấm gì)', async () => {
    vi.useFakeTimers();
    try {
      const core = await import('@capacitor/core');
      const get = core.CapacitorHttp.get as unknown as { mock: { calls: unknown[] } };
      const { kiemOta, trangThaiOta } = await import('@/lib/ota');
      manifest = null;
      const truoc = get.mock.calls.length;
      await kiemOta();
      expect(trangThaiOta.value.buoc).toBe('loi');
      for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(60_000);
      expect(get.mock.calls.length - truoc).toBe(1 + 3);       // lần đầu + 3 lần thử lại, rồi thôi
      manifest = { ...MOI, id: __OTA_ID__ };
      await kiemOta();
      expect(trangThaiOta.value.buoc).toBe('moiNhat');
    } finally { vi.useRealTimers(); }
  });
});
