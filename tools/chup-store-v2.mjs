/**
 * Ảnh store BỘ v2 (chủ dự án duyệt 02.11.2026, mockup
 * https://claude.ai/artifact/5F1wQPr3pkLuy8zDkKma9c): màn THẬT trong khung máy + chữ quảng
 * cáo, ghép NGAY trong trình duyệt đang chụp nên ra đúng cỡ khung (KHUNG=android 1080×1920…).
 *   KHUNG=android KICHBAN=tools/chup-store-v2.mjs node tools/chup-store.mjs <url> anh/<lang> <lang>
 * Ra 10 file 01..10; Play chỉ lấy 8 đầu (play-store.mjs cắt), App Store nhận đủ 10.
 * Máy hiện TRỌN (bốn góc bo, thấy đáy màn — 03.11.2026, mockup
 * https://claude.ai/artifact/14FRbovdsep6xcUscoEphS): khung cũ đặt máy top 25% rộng 84% nên mất
 * ~10% đáy. Nay máy cao bằng chỗ còn lại dưới chữ (flex), chữ hai dòng thì máy tự nhỏ lại.
 * Kịch bản cũ (chup-store-kichban.mjs) GIỮ: trang công khai dùng ảnh thô của nó.
 * Chữ ở tools/anh-store-chu.mjs. Không chụp dải "Cài như app" (mm.anCai) — chỉ có trên web.
 */
import { readFileSync } from 'node:fs';
import { CHU } from './anh-store-chu.mjs';

/** Thứ tự = thứ tự trên store. `may`: màu nền khung [trên, dưới]; `dam`: nền sáng → chữ đậm. */
const CANH = [
  { id: 'choi', mau: ['#5ec8ff', '#1f72e8'] },
  { id: 'thang', mau: ['#ffb347', '#ff6a3d'] },
  { id: 'haiNguoi', mau: ['#ff9a8b', '#e8445a'] },   // điểm khác game khác: chơi chung một máy
  { id: 'chienDich', mau: ['#b388ff', '#6b3fd6'] },
  { id: 'boHinh', mau: ['#4fe0b0', '#14a37a'] },
  { id: 'may', mau: ['#ff8fb8', '#e0457e'] },
  { id: 'online', mau: ['#5fd4ff', '#0d93c9'] },
  { id: 'danhHieu', mau: ['#ffe066', '#ffb300'], dam: true },
  { id: 'nen', mau: ['#7cc8ff', '#141b3d'] },     // thứ 9, 10: Play bỏ, App Store giữ
  { id: 'coBan', mau: ['#9be15d', '#3fa34d'] },
];

function nhan(lang) {
  const s = readFileSync(new URL(`../apps/web/src/locales/${lang}.ts`, import.meta.url), 'utf8');
  const g = (k) => { const d = `'${k}': '`, i = s.indexOf(d); if (i < 0) throw new Error(`${lang}.ts thiếu ${k}`); let j = i + d.length, v = ''; while (s[j] !== "'") { if (s[j] === '\\') j++; v += s[j++]; } return v; };
  return { nhanh: g('menu.choiNhanh'), motMinh: g('menu.soNguoi.1'), tiepTuc: g('menu.tiepTuc'), the: g('menu.the'), tiep: g('menu.tiep'),
    batDau: g('menu.batDau').split('{ban}')[0].replace(/[\s—·:：-]+$/u, ''), online: g('menu.online'), may: g('menu.dauMay'), cd: g('menu.chienDich') };
}
const bamThe = (js, i) => js(`document.querySelectorAll('button.card')[${i}].click(); true`);
async function cacCap(js) {
  const sym = await js(`[...document.querySelectorAll('button.card')].map(e => { const f = e.querySelector('.front'); return f?.textContent.trim() || f?.querySelector('img')?.getAttribute('src') || ''; })`);
  const m = new Map(); sym.forEach((s, i) => m.set(s, [...(m.get(s) ?? []), i]));
  return [...m.values()].filter((g) => g.length === 2);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Khung ghép: đơn vị vw/vh = khung store, nên một khuôn dùng cho mọi cỡ. */
function khuon(c, chu, anh, lang) {
  const [to, phu] = chu;
  const doi = anh.length === 2;
  const may = anh.map((a, k) => `<div class="may${doi ? ` may-${k}` : ''}"><img src="data:image/png;base64,${a}"></div>`).join('');
  const than = doi ? may : `<div class="ke">${may}</div>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grandstander:wght@900&family=Be+Vietnam+Pro:wght@700&display=swap">
<style>
html,body{margin:0;width:100vw;height:100vh;overflow:hidden}
body{position:relative;background:${doi ? `linear-gradient(105deg,${c.mau[0]} 0 50%,${c.mau[1]} 50% 100%)` : `radial-gradient(120% 70% at 50% 0%,${c.mau[0]},${c.mau[1]})`}}
.cap{position:absolute;inset:6vw 7vw auto;text-align:center;color:${c.dam ? '#2a1a00' : '#fff'};font:900 9.6vw/1.05 Grandstander,'Noto Sans CJK SC','Noto Sans Thai',sans-serif;text-wrap:balance;text-shadow:0 .6vw 0 ${c.dam ? 'rgb(255 255 255/.35)' : 'rgb(0 0 0/.18)'}}
.cap{word-break:auto-phrase}/* tiếng Nhật ngắt theo cụm, không giữa từ */:lang(ko) .cap{word-break:keep-all}
.cap small{display:block;font:700 4.6vw/1.25 'Be Vietnam Pro','Noto Sans CJK SC','Noto Sans Thai',sans-serif;margin-top:2.4vw;text-shadow:none}
.mot{display:flex;flex-direction:column}/* VÙNG CHỮ CAO CỐ ĐỊNH (chủ dự án 09.11.2026: "ảnh cái thấp cái cao vì text lúc nhiều lúc ít"): đủ 2 dòng to + 2 dòng phụ, chữ căn giữa trong đó → máy CÙNG CỠ, CÙNG CHỖ ở mọi ảnh, mọi ngôn ngữ. Chữ dài quá thì script dưới thu nhỏ chữ, KHÔNG nới vùng. */.mot .cap{position:static;margin:6vw 7vw 0;height:36vw;flex:none;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.ke{flex:1;min-height:0;display:flex;justify-content:center;align-items:center;padding:5vw 0 6vw}
.may{background:#0e1424;box-shadow:0 2vw 6vw rgb(0 0 0/.3)}
.ke .may{height:100%;box-sizing:border-box;border-radius:6vw;padding:2.4vw}
.ke .may img{display:block;height:100%;width:auto;border-radius:4vw}
.may-0,.may-1{position:absolute}.may-0 img,.may-1 img{display:block;width:100%}
.may-0,.may-1{width:58%;top:27%;border-radius:5vw;padding:2vw}
.may-0 img,.may-1 img{border-radius:3.4vw}
.may-0{left:32%;transform:translateX(-50%) rotate(-6deg)}
.may-1{left:68%;top:33%;transform:translateX(-50%) rotate(6deg)}
</style></head><body${doi ? '' : ' class="mot"'}><div class="cap">${esc(to)}<small>${esc(phu)}</small></div>${than}<script>{const c=document.querySelector('.mot .cap');if(c){let f=9.6,g=4.6;while(c.scrollHeight>c.clientHeight+1&&f>6){f-=.3;g-=.12;c.style.fontSize=f+'vw';c.querySelector('small').style.fontSize=g+'vw';}}}</script></body></html>`;
}

export async function chay({ goi, js, bam, bamDung, cho, chup }) {
  const lang = await js(`localStorage.getItem('mm.lang')`) ?? 'en';
  const L = nhan(lang), chu = CHU[lang];
  if (!chu) throw new Error(`anh-store-chu.mjs thiếu ngôn ngữ ${lang}`);
  const tho = {};   // ảnh thô theo cảnh, base64 PNG
  const chupTho = async (k) => { tho[k] = [...(tho[k] ?? []), (await goi('Page.captureScreenshot', { format: 'png' })).result.data]; };
  const trangChu = async () => { await js(`location.href = location.origin + '/?lang=${lang}'; true`); await cho(2200); };
  await js(`(() => { localStorage.setItem('mm.anCai', '1'); const s = JSON.parse(localStorage.getItem('mm.v2') || '{}');
    s.prefs = { ...(s.prefs || {}), themes: ['animals'] }; localStorage.setItem('mm.v2', JSON.stringify(s)); location.reload(); return true; })()`);
  await cho(2200);

  // Ván 20 thẻ bộ Động vật, có đồng hồ: chụp lúc 6/10 cặp + một lá vừa mở, rồi cảnh thắng
  await bam(L.nhanh); await cho(600); await bam(L.motMinh); await cho(600);
  await bamDung(`20${L.the}`); await cho(600); await bam(L.tiep); await cho(700);
  await js(`(() => { const o=[...document.querySelectorAll('.step-body button')].filter(e=>e.offsetParent && !e.textContent.includes(${JSON.stringify(L.batDau)})); o[2].click(); return true; })()`); await cho(300);
  await bam(L.batDau); await cho(3200);
  const cap = await cacCap(js);
  for (const [a, b] of cap.slice(0, 6)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  await bamThe(js, cap[6][0]); await cho(250);
  await chupTho('choi');
  await cho(500); await bamThe(js, cap[6][1]); await cho(900);
  for (const [a, b] of cap.slice(7)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(450); }
  await cho(1050); await chupTho('thang');   // trước HIEN_BANG_MS: thú + chữ, chưa có bảng
  await cho(6000);
  for (let i = 0; i < 40 && await js(`!!document.querySelector('.mk-fx, .mo-khoa-toast')`); i++) await cho(1000);

  // Ván 2 người cùng máy: mỗi người ghép 2 cặp (người 1 trượt một lần để sang lượt) → hoà điểm,
  // chụp lúc người 1 vừa mở một lá. Tên ở anh-store-chu.mjs (`ten`), ngắn vì ô tên cắt chữ dài.
  await trangChu(); await bam(L.nhanh); await cho(600);
  // ô "2 người" = thanh thứ hai sau "Một mình" (menu.soNguoi.n là HÀM số nhiều ở ru/… nên không bấm theo chữ)
  await js(`(() => { const o=[...document.querySelectorAll('.step-body button')].filter(e=>e.offsetParent); const i=o.findIndex(e=>e.textContent.includes(${JSON.stringify(L.motMinh)})); o[i+1].click(); return true; })()`); await cho(700);
  await js(`(() => { const t = ${JSON.stringify(chu.ten)}; [...document.querySelectorAll('.step-body input')].forEach((e, i) => { e.value = t[i]; e.dispatchEvent(new Event('input', { bubbles: true })); }); return true; })()`);
  await cho(300); await bam(L.tiepTuc); await cho(700);
  await bamDung(`20${L.the}`); await cho(600); await bam(L.tiep); await cho(700);
  await js(`(() => { const o=[...document.querySelectorAll('.step-body button')].filter(e=>e.offsetParent && !e.textContent.includes(${JSON.stringify(L.batDau)})); o[2].click(); return true; })()`); await cho(300);
  await bam(L.batDau); await cho(3200);
  { const c2 = await cacCap(js);
    const ghep = async ([a, b]) => { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(1000); };
    await ghep(c2[0]); await ghep(c2[1]); await ghep([c2[3][0], c2[4][0]]); await cho(1500);
    await ghep(c2[3]); await ghep(c2[4]); await bamThe(js, c2[5][0]); await cho(400); }
  await chupTho('haiNguoi');

  await trangChu(); await bam(L.may); await cho(900); await chupTho('may');
  await trangChu(); await bam(L.nhanh); await cho(600); await bam(L.motMinh); await cho(700); await chupTho('coBan');
  await bamDung(`30${L.the}`); await cho(900); await chupTho('boHinh');
  await trangChu(); await bam(L.online); await cho(2500); await chupTho('online');
  await trangChu();
  await js(`[...document.querySelectorAll('button')].find(e => e.offsetParent && /^\\s*\\d+\\s*\\/\\s*\\d+\\s*$/.test(e.textContent)).click(); true`);
  await cho(1500); await chupTho('danhHieu');

  // Chiến dịch: tiến độ dựng sẵn 12 màn (sao đủ kiểu) để bản đồ không trơn — chỉ là ảnh minh hoạ
  const sao = [3, 3, 4, 2, 3, 3, 4, 3, 2, 3, 3, 4];
  await js(`(() => { const s = JSON.parse(localStorage.getItem('mm.v2') || '{}'); s.levels = s.levels || {};
    ${JSON.stringify(sao)}.forEach((n, i) => s.levels['campaign:' + (i + 1)] = { stars: Math.min(n, 3), score: 400 + i * 90, ...(n === 4 ? { hh: true } : {}) });
    localStorage.setItem('mm.v2', JSON.stringify(s)); return true; })()`);
  await trangChu(); await bam(L.cd); await cho(2000); await chupTho('chienDich');

  // Sáng / tối: trang chủ hai lần, đổi prefers-color-scheme (game mặc định "Tự động")
  for (const toi of [false, true]) {
    await goi('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: toi ? 'dark' : 'light' }] });
    await trangChu(); await cho(500); await chupTho('nen');
  }

  // Ghép: thay cả tài liệu bằng khuôn rồi chụp đúng khung
  const { result: { frameTree } } = await goi('Page.getFrameTree');
  for (const [i, c] of CANH.entries()) {
    await goi('Page.navigate', { url: 'about:blank' }); await cho(300);
    await goi('Page.setDocumentContent', { frameId: frameTree.frame.id, html: khuon(c, chu[c.id], tho[c.id], lang) });
    // display=block + stylesheet nạp chậm: fonts.ready trả về TRƯỚC khi phông bắt đầu tải → ảnh mất chữ.
    // Chờ stylesheet, rồi nạp hẳn hai phông với đúng chữ cần vẽ (CJK/Thái rơi về Noto của máy).
    await js(`(async () => {
      const l = document.querySelector('link[rel=stylesheet]');
      if (!l.sheet) await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 8000); });
      const t = document.querySelector('.cap').textContent;
      await Promise.all([document.fonts.load('900 40px Grandstander', t), document.fonts.load('700 20px "Be Vietnam Pro"', t)]);
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
      return true; })()`);
    await cho(300);
    await chup(`${String(i + 1).padStart(2, '0')}-${c.id}`);
  }
}
