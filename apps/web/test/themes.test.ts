import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_MAX_PAIRS } from '@mm/engine';
import { loadThemes } from '@/lib/themes';

const ok = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('nạp theme từ JSON', () => {
  it('đọc được danh sách theme', async () => {
    vi.stubGlobal('fetch', vi.fn(ok({
      themes: [{ id: 'space', name: 'Không gian', unlockAt: 0, symbols: ['🚀', '🛸'] }]
    })));
    const themes = await loadThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0]!.name).toBe('Không gian');
  });

  it('mất mạng thì dùng theme dự phòng, không ném lỗi (NF-08)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const themes = await loadThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0]!.id).toBe('animals');
    expect(themes[0]!.symbols.length).toBeGreaterThanOrEqual(18);
  });

  it('404 thì dùng theme dự phòng', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect((await loadThemes())[0]!.id).toBe('animals');
  });

  it('JSON hỏng thì dùng theme dự phòng', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{khong-phai-json')));
    expect((await loadThemes())[0]!.id).toBe('animals');
  });

  it('JSON đúng cú pháp nhưng rỗng thì dùng theme dự phòng', async () => {
    vi.stubGlobal('fetch', vi.fn(ok({ themes: [] })));
    expect((await loadThemes())[0]!.id).toBe('animals');
    vi.stubGlobal('fetch', vi.fn(ok({})));
    expect((await loadThemes())[0]!.id).toBe('animals');
  });

  it('theme dự phòng đủ biểu tượng cho lưới lớn nhất (6×6 = 18 cặp)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await loadThemes())[0]!.symbols.length).toBeGreaterThanOrEqual(18);
  });
});

describe('file themes.json thực trong repo', () => {
  it('mỗi theme đủ 18 biểu tượng cho lưới 6×6 và id không trùng', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    // happy-dom thay thế URL toàn cục nên không dùng được import.meta.url ở đây
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as {
      themes: { id: string; name: string; unlockAt: number; symbols: string[] }[];
    };
    expect(themes.length).toBeGreaterThan(1);
    expect(new Set(themes.map((t) => t.id)).size).toBe(themes.length);
    for (const t of themes) {
      expect(t.symbols.length, t.id).toBeGreaterThanOrEqual(18);
      expect(new Set(t.symbols).size, `${t.id} có biểu tượng trùng`).toBe(t.symbols.length);
      expect(typeof t.unlockAt, t.id).toBe('number');
      expect(t.name.length, t.id).toBeGreaterThan(0);
    }
    // Phải có ít nhất một theme mở sẵn, nếu không người mới không chơi được
    expect(themes.some((t) => t.unlockAt === 0)).toBe(true);
  });

  // Lưới theme phải TRÒN HÀNG trong cột 3 ô: 12 → 3×4, 15 → 3×5. Thêm theme thì
  // số theme phải chia hết cho 3, không thì hàng cuối còn ô lẻ lệch sang trái.
  it('số theme chia hết cho 3 để lưới tròn hàng, và có đủ theme mở sẵn', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { unlockAt: number }[] };
    expect(themes.length % 3, `${themes.length} theme không tròn hàng 3 cột`).toBe(0);
    expect(themes.filter((t) => t.unlockAt === 0).length, 'theme mở sẵn')
      .toBeGreaterThanOrEqual(6);
    expect(themes.filter((t) => t.unlockAt > 0).length, 'theme khoá bằng điểm')
      .toBeGreaterThanOrEqual(6);
  });

  /*
   * Trộn theme thì biểu tượng trùng bị GỘP (Set), nên pool nhỏ hơn tổng cộng.
   * Trùng là có chủ đích — cá heo vừa là động vật vừa là sinh vật biển — nên
   * không cấm; thứ phải đúng là POOL CUỐI CÙNG đủ cho bàn lớn nhất.
   */
  it('theme MỞ SẴN xếp trước theme còn khoá, dù nằm cuối file', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(raw, { status: 200 })));
    const list = await loadThemes();
    const mocs = list.map((t) => t.unlockAt);
    expect(mocs, 'mốc mở khoá phải không giảm').toEqual([...mocs].sort((a, b) => a - b));
    // Và đúng cái bẫy đã xảy ra: theme mở sẵn thêm sau cùng vẫn phải lên trước
    const cuoiFile = (JSON.parse(raw) as { themes: { id: string; unlockAt: number }[] }).themes.at(-1)!;
    if (cuoiFile.unlockAt === 0) {
      const viTri = list.findIndex((t) => t.id === cuoiFile.id);
      const viTriKhoaDau = list.findIndex((t) => t.unlockAt > 0);
      expect(viTri, `${cuoiFile.id} mở sẵn nhưng đứng sau nhóm khoá`).toBeLessThan(viTriKhoaDau);
    }
  });

  it('theme mở sẵn gộp lại đủ biểu tượng cho bàn lớn nhất', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { unlockAt: number; symbols: string[] }[] };
    const pool = new Set(themes.filter((t) => t.unlockAt === 0).flatMap((t) => t.symbols));
    expect(pool.size, 'pool của theme mở sẵn').toBeGreaterThanOrEqual(CAMPAIGN_MAX_PAIRS);
  });
});
