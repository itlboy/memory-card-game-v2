/**
 * Kịch bản chụp ảnh store (gọi từ tools/chup-store.mjs). Mỗi cảnh đi lại từ
 * trang chủ như người chơi thật. Ván offline mang sẵn ký hiệu trong DOM nên
 * kịch bản biết lá nào đi với lá nào — chỉ để dựng cảnh, không phải luật chơi.
 */
import { readFileSync } from 'node:fs';

/** Chữ trên nút theo ngôn ngữ — ĐỌC THẲNG từ locales/<mã>.ts nên đủ cả 12 ngôn
 *  ngữ và không lệch khi đổi bản dịch (bản cũ chép tay, chỉ có en/vi). */
function nhanTheo(lang) {
  const s = readFileSync(new URL(`../apps/web/src/locales/${lang}.ts`, import.meta.url), 'utf8');
  const g = (k) => {   // không dùng RegExp: khoá có dấu chấm, giá trị có \' — cắt chuỗi cho chắc
    const dau = `'${k}': '`, i = s.indexOf(dau);
    if (i < 0) throw new Error(`${lang}.ts thiếu ${k}`);
    let j = i + dau.length, v = '';
    while (s[j] !== "'") { if (s[j] === '\\') j++; v += s[j++]; }
    return v;
  };
  return {
    nhanh: g('menu.choiNhanh'), motMinh: g('menu.soNguoi.1'), the: g('menu.the'), tiep: g('menu.tiep'),
    // zh viết '开始 · {ban}', không phải '—': cắt ở {ban} rồi bỏ dấu nối
    batDau: g('menu.batDau').split('{ban}')[0].replace(/[\s—·:：-]+$/u, ''), online: g('menu.online'),
  };
}
let L = nhanTheo('en');

async function veTrangChu({ js, cho }) {
  await js(`location.href = location.origin + '/?lang=' + localStorage.getItem('mm.lang'); true`);
  await cho(2200);
}
async function vaoVan({ bam, bamDung, cho }, soThe, chonLuat) {
  await bam(L.nhanh); await cho(600);
  await bam(L.motMinh); await cho(600);
  await bamDung(`${soThe}${L.the}`); await cho(600);
  await bam(L.tiep); await cho(700);
  if (chonLuat) await chonLuat();
  await bam(L.batDau); await cho(3200);
}
const bamThe = (js, i) => js(`document.querySelectorAll('button.card')[${i}].click(); true`);
async function cacCap(js) {
  const sym = await js(`[...document.querySelectorAll('button.card')].map(e => { const f = e.querySelector('.front'); return f?.textContent.trim() || f?.querySelector('img')?.getAttribute('src') || ''; })`);
  const nhom = new Map();
  sym.forEach((s, i) => nhom.set(s, [...(nhom.get(s) ?? []), i]));
  return [...nhom.values()].filter((g) => g.length === 2);
}
/** Ô thứ `muc` (0..3) của hàng tuỳ chọn thứ `hang` (0..4) ở bước luật bàn chơi. */
const chonLuat = (js, hang, muc) =>
  js(`(() => { const o=[...document.querySelectorAll('.step-body button')].filter(e=>e.offsetParent && !e.textContent.includes(${JSON.stringify(L.batDau)})); o[${hang} * 4 + ${muc}].click(); return true; })()`);

export async function chay(ctx) {
  const { js, bam, cho, chup } = ctx;
  L = nhanTheo(await js(`localStorage.getItem('mm.lang')`) ?? 'en');

  // 1. Đang chơi: 2/3 số cặp đã ghép, một lá vừa mở — có đồng hồ cho HUD đủ chữ
  await vaoVan(ctx, 30, async () => { await chonLuat(js, 0, 2); await cho(300); });
  const cap = await cacCap(js);
  for (const [a, b] of cap.slice(0, 10)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  await bamThe(js, cap[10][0]); await cho(700);
  await chup('01-gameplay');

  // 2. Thắng ván
  await bamThe(js, cap[10][1]); await cho(900);
  for (const [a, b] of cap.slice(11)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  // Ván đầu mở cả loạt danh hiệu: chụp màn khoe (ảnh đẹp riêng), rồi chờ hết chuỗi
  // khoe mới chụp bảng thắng — chụp sớm là huy chương/khoe che đúng con số điểm
  await cho(7000);
  await chup('08-achievement');
  for (let i = 0; i < 40 && await js(`!!document.querySelector('.mk-fx, .mo-khoa-toast')`); i++) await cho(1000);
  await cho(1500);
  await chup('02-win');

  // 3. Trang chủ
  await veTrangChu(ctx);
  await chup('03-home');

  // 4. Cỡ bàn  5. Bộ hình  6. Luật bàn chơi
  await bam(L.nhanh); await cho(600);
  await bam(L.motMinh); await cho(700);
  await chup('04-board-sizes');
  await ctx.bamDung(`30${L.the}`); await cho(700);
  await chup('05-themes');
  await bam(L.tiep); await cho(700);
  for (const [hang, muc] of [[0, 2], [1, 2], [3, 1]]) { await chonLuat(js, hang, muc); await cho(250); }
  await chup('06-table-rules');

  // 7. Chơi online
  await veTrangChu(ctx);
  await bam(L.online); await cho(2500);
  await chup('07-online');
}
