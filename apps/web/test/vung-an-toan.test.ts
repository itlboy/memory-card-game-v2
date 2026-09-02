import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * VÙNG AN TOÀN CỦA iOS.
 *
 * index.html đặt `viewport-fit=cover` để trang trải ra tận mép máy — đẹp,
 * nhưng nó cũng cho trang TRÙM LÊN dải home indicator ở đáy. Dải đó iOS giữ
 * cho cử chỉ hệ thống, nên nút nào nằm trong đó là hệ thống ăn mất cú chạm:
 * vuốt lên ra màn hình chính, giữ lâu thì gọi trợ lý ảo. Người chơi báo đúng
 * chuyện này — hàng nút dưới cùng và icon chat bấm vào lại kích hoạt Siri.
 * Nặng nhất trong PWA, vì ở đó không có thanh công cụ trình duyệt đẩy nội dung
 * lên hộ.
 *
 * Hai thứ đi đôi với nhau: có `viewport-fit=cover` thì PHẢI có `env()`.
 *
 * ĐO THẬT trong Chrome, giả lập iPhone 14 (vùng web 390×664, tai thỏ 47px, home
 * indicator 34px) — đáy của hàng nút dưới cùng cách mép dưới màn hình:
 *     trước:  33px  → NẰM TRONG dải 34px, iOS ăn mất cú chạm
 *     sau:    67px  → thoát hẳn
 * `#app` vẫn cao đúng 664px (border-box), tức đệm nằm TRONG chiều cao đã khoá
 * và không đẩy gì ra ngoài — luật KHÔNG SCROLL nguyên vẹn.
 */
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

/**
 * Khối `#app { … }` ĐỨNG RIÊNG — không phải cái gộp `html, body, #app`.
 *
 * Bắt đầu bằng `#app` ở ĐẦU DÒNG, nếu không `indexOf('#app {')` khớp nhầm vào
 * `html, body, #app {` ở đầu file và test đo một khối chẳng liên quan.
 */
function khoiApp(): string {
  const m = /^#app \{/m.exec(css);
  expect(m, 'không tìm thấy khối #app đứng riêng').not.toBeNull();
  return css.slice(m!.index, css.indexOf('}', m!.index));
}

describe('vùng an toàn iOS', () => {
  it('có viewport-fit=cover thì phải có đệm safe-area', () => {
    if (!html.includes('viewport-fit=cover')) return;   // bỏ cover thì hết chuyện
    const app = khoiApp();
    expect(app, 'đáy: nơi nút bị Siri cướp mất cú chạm')
      .toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom/);
    expect(app, 'đỉnh: tai thỏ đè lên HUD').toMatch(/padding-top:\s*env\(safe-area-inset-top/);
    expect(app, 'hai bên: máy xoay ngang').toMatch(/padding-left:\s*env\(safe-area-inset-left/);
  });

  it('đệm KHÔNG được làm trang cao ra — luật KHÔNG SCROLL', () => {
    const app = khoiApp();
    // #app khoá `100dvh`; thiếu border-box thì đệm CỘNG vào chiều cao đó và
    // đẩy đáy ra ngoài màn hình — đúng thứ mà luật KHÔNG SCROLL cấm.
    expect(app).toMatch(/box-sizing:\s*border-box/);
    expect(app).toMatch(/height:\s*100dvh/);
  });

  it('thứ teleport ra <body> phải TỰ cộng, vì nó ở ngoài #app', () => {
    const blast = readFileSync(resolve(process.cwd(), 'src/components/EmojiBlast.vue'), 'utf8');
    expect(blast, 'teleport ra body nên không hưởng đệm của #app')
      .toMatch(/top:\s*calc\([^)]*env\(safe-area-inset-top/);
  });
});
