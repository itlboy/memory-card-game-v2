/**
 * Kịch bản chụp ảnh THÔ cho trang công khai (about.html, thẻ Flip Match ở cozypi.com):
 *   KICHBAN=$PWD/tools/chup-trang-kichban.mjs node tools/chup-store.mjs <url> <thư mục> en
 *   thêm NEN=toi → giao diện tối; KHUNG=ipad → iPad.
 * Ra 01-gameplay, 02-win, 03-home, 04-board-sizes, 05-themes, 06-two-players,
 * 07-vs-computer, 08-campaign — đúng tên file trong public/site/img (docs/ban-do.md).
 * Viết 21.11.2026 cho màn chọn cách chơi MỘT MÀN (số người + số thẻ + bộ hình + luật):
 * bấm theo class (.option.keo-o, .nh-dong, .seg-btn) nên không lệch khi đổi chữ.
 */
import { readFileSync } from 'node:fs';

function nhan(lang) {
  const s = readFileSync(new URL(`../apps/web/src/locales/${lang}.ts`, import.meta.url), 'utf8');
  const g = (k) => { const d = `'${k}': '`, i = s.indexOf(d); if (i < 0) throw new Error(`${lang}.ts thiếu ${k}`); let j = i + d.length, v = ''; while (s[j] !== "'") { if (s[j] === '\\') j++; v += s[j++]; } return v; };
  return { nhanh: g('menu.choiNhanh'), may: g('menu.dauMay'), cd: g('menu.chienDich') };
}
const bamThe = (js, i) => js(`document.querySelectorAll('button.card')[${i}].click(); true`);
async function cacCap(js) {
  const sym = await js(`[...document.querySelectorAll('button.card')].map(e => { const f = e.querySelector('.front'); return f?.textContent.trim() || f?.querySelector('img')?.getAttribute('src') || ''; })`);
  const m = new Map(); sym.forEach((s, i) => m.set(s, [...(m.get(s) ?? []), i]));
  return [...m.values()].filter((g) => g.length === 2);
}

export async function chay({ js, bam, cho, chup }) {
  const lang = await js(`localStorage.getItem('mm.lang')`) ?? 'en';
  const L = nhan(lang);
  /** Bấm phần tử thứ `i` khớp `sel` đang hiện; thử lại 10 giây (máy chậm). */
  const bamSel = async (sel, i = 0) => {
    for (let k = 0; ; k++) {
      const ok = await js(`(() => { const o=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.offsetParent); if(!o[${i}]) return false; o[${i}].click(); return true; })()`);
      if (ok) return;
      if (k >= 20) throw new Error(`không thấy ${sel}[${i}]`);
      await cho(500);
    }
  };
  const soThe = async (n) => {
    const ok = await js(`(() => { const e=[...document.querySelectorAll('.option.keo-o')].find(e=>e.offsetParent && e.textContent.trim()==='${n}'); if(!e) return false; e.click(); return true; })()`);
    if (!ok) throw new Error(`không thấy ô ${n} thẻ`);
    await cho(600);
  };
  /** Luật bàn chơi: hàng 0 = đồng hồ, mỗi hàng 4 mức. */
  const coDongHo = async () => { await bamSel(".nh-dong", (await js(`[...document.querySelectorAll('.nh-dong')].filter(e=>e.offsetParent).length`)) - 1); await cho(800); await bamSel('.seg-btn', 2); await cho(300); await bamSel('.btn-primary'); await cho(800); };
  const batDau = async () => { await bamSel('.nh-bat-dau'); await cho(3200); };
  const trangChu = async () => { await js(`location.href = location.origin + '/?lang=${lang}'; true`); await cho(2200); };
  const hetKhoe = async () => { for (let i = 0; i < 40 && await js(`!!document.querySelector('.mk-fx, .mo-khoa-toast')`); i++) await cho(1000); };

  // Không chụp dải "Cài như app" (chỉ có trên web)
  await js(`localStorage.setItem('mm.anCai', '1'); location.reload(); true`); await cho(2200);

  // 1. Đang chơi: 30 thẻ, có đồng hồ, 10/15 cặp đã ghép + một lá vừa mở
  await bam(L.nhanh); await cho(900);
  await soThe(30); await coDongHo(); await batDau();
  const cap = await cacCap(js);
  for (const [a, b] of cap.slice(0, 10)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  await bamThe(js, cap[10][0]); await cho(700);
  await chup('01-gameplay');

  // 2. Thắng ván: chờ hết chuỗi khoe danh hiệu rồi mới chụp bảng thắng
  await bamThe(js, cap[10][1]); await cho(900);
  for (const [a, b] of cap.slice(11)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  await cho(7000); await hetKhoe(); await cho(1500);
  await chup('02-win');

  // 3. Trang chủ
  await trangChu(); await chup('03-home');

  // 4. Chọn cách chơi (số người, số thẻ)  5. Bộ hình
  await bam(L.nhanh); await cho(900); await soThe(30);
  await chup('04-board-sizes');
  await bamSel('.nh-dong', (await js(`[...document.querySelectorAll('.nh-dong')].filter(e=>e.offsetParent).length`)) - 2); await cho(900);
  await chup('05-themes');

  // 6. Hai người cùng máy: mỗi người 2 cặp (người 1 trượt một lần để sang lượt), người 1 vừa mở một lá
  await trangChu(); await bam(L.nhanh); await cho(900);
  await bamSel('.option.nh-o:not(.keo-o)', 1); await cho(700);
  await soThe(20); await batDau();
  { const c = await cacCap(js);
    const ghep = async ([a, b]) => { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(1000); };
    await ghep(c[0]); await ghep(c[1]); await ghep([c[3][0], c[4][0]]); await cho(1500);
    await ghep(c[3]); await ghep(c[4]); await bamThe(js, c[5][0]); await cho(500); }
  await chup('06-two-players');

  // 7. Đấu với máy
  await trangChu(); await bam(L.may); await cho(1200);
  await chup('07-vs-computer');

  // 8. Chiến dịch: tiến độ dựng sẵn 12 màn để bản đồ không trơn — chỉ là ảnh minh hoạ
  const sao = [3, 3, 4, 2, 3, 3, 4, 3, 2, 3, 3, 4];
  await js(`(() => { const s = JSON.parse(localStorage.getItem('mm.v2') || '{}'); s.levels = s.levels || {};
    ${JSON.stringify(sao)}.forEach((n, i) => s.levels['campaign:' + (i + 1)] = { stars: Math.min(n, 3), score: 400 + i * 90, ...(n === 4 ? { hh: true } : {}) });
    localStorage.setItem('mm.v2', JSON.stringify(s)); return true; })()`);
  await trangChu(); await bam(L.cd); await cho(2000);
  await chup('08-campaign');
}
