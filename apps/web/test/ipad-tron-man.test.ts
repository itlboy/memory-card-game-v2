import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * iPAD TRỌN MÀN HÌNH (global.css, chủ dự án duyệt 14.10.2026). App khai hỗ trợ iPad
 * thì không được thu về cột 600px như máy tính — hai dải trống to là thứ App Review
 * chê "giao diện iPhone trên iPad". Số đo thật (6 khổ iPad, cả dọc lẫn ngang) nằm ở
 * lần sửa đó; test này chỉ canh để luật không bị gỡ nhầm.
 */
const css = readFileSync(resolve('src/styles/global.css'), 'utf8');
const MAY_BANG = '(hover: none) and (pointer: coarse)';

describe('iPad trọn màn hình', () => {
  it('máy tính bảng có khối riêng, nhận bằng cảm ứng chứ không chỉ bằng bề rộng', () => {
    expect(css).toContain(`@media (min-width: 700px) and ${MAY_BANG}`);
  });

  it('khối máy tính bảng đứng SAU khối cột máy tính (cùng độ đặc hiệu, sau thắng)', () => {
    const cot = css.indexOf('width: clamp(390px, calc((100dvh - 16px) * 0.55), 600px)');
    const bang = css.indexOf(`@media (min-width: 700px) and ${MAY_BANG}`);
    expect(cot).toBeGreaterThan(0);
    expect(bang).toBeGreaterThan(cot);
  });

  it('phóng chữ/nút theo bậc 1,1 · 1,2 · 1,3, bậc tính theo CẠNH NGẮN', () => {
    expect(css).toMatch(/--ui-zoom:\s*1\.1/);
    expect(css).toMatch(/min-width: 810px\) and \(min-height: 810px\)[^{]*\{\s*:root\s*\{\s*--ui-zoom:\s*1\.2/);
    expect(css).toMatch(/min-width: 1000px\) and \(min-height: 1000px\)[^{]*\{\s*:root\s*\{\s*--ui-zoom:\s*1\.3/);
  });

  it('bàn thẻ KHÔNG bị phóng (nó tự lấp chỗ), hộp thoại thì có', () => {
    const khoi = css.slice(css.indexOf(`@media (min-width: 700px) and ${MAY_BANG}`));
    const zoom = khoi.slice(0, khoi.indexOf('zoom: var(--ui-zoom)'));
    expect(zoom).toContain('.overlay > .panel');
    expect(zoom).toContain('.hud');
    expect(zoom).not.toMatch(/\.board|\.card|section\.game\s*[,{]/);
  });

  it('app iOS khai hỗ trợ cả iPhone lẫn iPad', () => {
    const pbx = readFileSync(resolve('ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
    expect(pbx.match(/TARGETED_DEVICE_FAMILY = "1,2";/g)?.length).toBe(2);
  });
});
