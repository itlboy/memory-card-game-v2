import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * THOÁT VÁN ONLINE → VỀ MÀN TẠO/VÀO PHÒNG (16.11.2026, chủ dự án), không về trang chủ.
 * Nút logo (`requestHome`) vẫn về trang chủ.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');
const ham = (ten: string): string => src.slice(src.indexOf(`function ${ten}(`), src.indexOf('\n}\n', src.indexOf(`function ${ten}(`)));

describe('thoát ván online', () => {
  it('✕ trong ván / màn kết quả đi qua quitVeOnline', () => {
    expect(src).toMatch(/<OnlineGame[^>]*@quit="quitVeOnline"/);
  });
  it('veManOnline rời phòng có báo server và ở lại màn online', () => {
    const f = ham('veManOnline');
    expect(f).toMatch(/o\.thoatPhong\(\)/);
    expect(f).toMatch(/entryStep\.value = 'choose'/);
    expect(f).not.toMatch(/emit\('back'\)/);
  });
  it('cử chỉ Back của máy giữa ván cũng về màn online (23.11.2026), không qua đường logo', () => {
    const f = ham('requestBack');
    expect(f).toMatch(/o\.phase\.value === 'playing' \|\| o\.phase\.value === 'ended'/);
    expect(f).toMatch(/quit\(trongVan \? veManOnline : exit\)/);
    const app = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
    expect(app).toMatch(/screen\.value === 'online'\) onlineRef\.value\?\.requestBack\(\)/);
  });
  it('logo vẫn về trang chủ', () => {
    expect(src).toMatch(/requestHome: \(\) => quit\(\)/);
    expect(src).toMatch(/function quit\(sau: \(\) => void = exit\)/);
  });
});
