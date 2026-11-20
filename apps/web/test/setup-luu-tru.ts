/*
 * localStorage / sessionStorage CHO TEST TRÊN NODE ≥ 25 (20.11.2026, nâng Node 22 → 26).
 *
 * Từ Node 25, Node có sẵn `localStorage` TOÀN CỤC (Web Storage) — không cấu hình `--localstorage-file` thì nó trả
 * `undefined`, và vì tên đã có trên globalThis nên vitest KHÔNG đè bằng bản của happy-dom: mọi test gọi
 * `localStorage.clear()` đỏ "Cannot read properties of undefined". Trên Node 22/24 nhánh dưới không chạy (bản
 * happy-dom dùng được) — chỉ khi kho hiện có KHÔNG dùng được mới gắn bản trong RAM. Không ảnh hưởng app thật.
 */
class KhoRam implements Storage {
  private m = new Map<string, string>();
  get length(): number { return this.m.size; }
  clear(): void { this.m.clear(); }
  getItem(k: string): string | null { return this.m.has(String(k)) ? this.m.get(String(k))! : null; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string): void { this.m.delete(String(k)); }
  setItem(k: string, v: string): void { this.m.set(String(k), String(v)); }
}

function dungDuoc(ten: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const kho = (globalThis as Record<string, unknown>)[ten] as Storage | undefined;
    if (!kho || typeof kho.setItem !== 'function') return false;
    kho.setItem('__thu__', '1');
    kho.removeItem('__thu__');
    return true;
  } catch { return false; }
}

for (const ten of ['localStorage', 'sessionStorage'] as const) {
  if (dungDuoc(ten)) continue;
  const kho = new KhoRam();
  Object.defineProperty(globalThis, ten, { value: kho, configurable: true, writable: true });
  if (typeof window !== 'undefined' && window !== (globalThis as unknown)) {
    try { Object.defineProperty(window, ten, { value: kho, configurable: true, writable: true }); } catch { /* bỏ qua */ }
  }
}
