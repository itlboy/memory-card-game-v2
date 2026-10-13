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

  // Lưới theme phải TRÒN HÀNG ở cả 3 lẫn 4 cột (auto-fill: máy hẹp 3, Pro Max 4).
  // Từ 14.10.2026 lưới chia HAI TAB (Miễn phí · Premium) nên MỖI TAB phải tròn:
  // 33 theme qua được phép chia 3 mà hàng cuối máy rộng lẻ một ô (đã chụp thấy).
  it('mỗi tab (miễn phí / premium) chia hết cho 3 và 4 để lưới tròn hàng', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { premium?: boolean; unlockAt: number }[] };
    for (const [ten, ds] of [['miễn phí', themes.filter((t) => !t.premium)], ['premium', themes.filter((t) => t.premium)]] as const) {
      expect(ds.length % 3, `tab ${ten}: ${ds.length} theme không tròn hàng 3 cột`).toBe(0);
      expect(ds.length % 4, `tab ${ten}: ${ds.length} theme không tròn hàng 4 cột`).toBe(0);
      expect(ds.length, `tab ${ten}`).toBeGreaterThanOrEqual(12);
    }
    // Không còn mở bằng điểm: chỉ miễn phí hoặc premium
    expect(themes.filter((t) => t.unlockAt !== 0)).toEqual([]);
  });

  it('theme MIỄN PHÍ xếp trước theme premium, dù nằm cuối file', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(raw, { status: 200 })));
    const list = await loadThemes();
    const co = list.map((t) => Number(!!t.premium));
    expect(co, 'premium phải đứng sau mọi theme miễn phí').toEqual([...co].sort((a, b) => a - b));
  });

  it('bản sao server khớp themes.json, kể cả danh sách premium', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { id: string; premium?: boolean; symbols: string[] }[] };
    const { THEME_SYMBOLS, THEME_PREMIUM } = await import('../../server/src/themes');
    for (const t of themes) expect(THEME_SYMBOLS[t.id], `server thiếu/lệch ${t.id}`).toEqual(t.symbols);
    expect([...THEME_PREMIUM].sort()).toEqual(themes.filter((t) => t.premium).map((t) => t.id).sort());
  });

  it('theme mở sẵn gộp lại đủ biểu tượng cho bàn lớn nhất', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const raw = await fs.readFile(path.resolve(process.cwd(), 'public/data/themes.json'), 'utf8');
    const { themes } = JSON.parse(raw) as { themes: { premium?: boolean; symbols: string[] }[] };
    const pool = new Set(themes.filter((t) => !t.premium).flatMap((t) => t.symbols));
    expect(pool.size, 'pool của theme mở sẵn').toBeGreaterThanOrEqual(CAMPAIGN_MAX_PAIRS);
  });
});
