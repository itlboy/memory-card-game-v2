import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('đúng 12 theme: 6 mở sẵn + 6 khoá bằng điểm (lưới 3×4)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { unlockAt: number }[] };
    expect(themes).toHaveLength(12);
    expect(themes.filter((t) => t.unlockAt === 0)).toHaveLength(6);
    expect(themes.filter((t) => t.unlockAt > 0)).toHaveLength(6);
  });
});
