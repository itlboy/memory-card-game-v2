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
  // 28.11.2026: thêm Tìm Thẻ + Chỉ số trí nhớ (chủ dự án: "nhớ cho cả phần tìm thẻ và chỉ số trí nhớ"), lên ĐẦU vì Play chỉ lấy
  // 8 ảnh đầu; bỏ "sáng/tối" (nen) và "4–88 thẻ" (coBan) cho vừa trần 10 ảnh của App Store.
  { id: 'choi', mau: ['#5ec8ff', '#1f72e8'] },
  { id: 'timThe', mau: ['#5ee0c0', '#13917a'] },
  { id: 'triNho', mau: ['#ffcf5a', '#f29b00'], dam: true },
  { id: 'online', mau: ['#5fd4ff', '#0d93c9'] },
  { id: 'thang', mau: ['#ffb347', '#ff6a3d'] },
  { id: 'haiNguoi', mau: ['#ff9a8b', '#e8445a'] },   // điểm khác game khác: chơi chung một máy
  { id: 'may', mau: ['#ff8fb8', '#e0457e'] },
  { id: 'chienDich', mau: ['#b388ff', '#6b3fd6'] },
  { id: 'boHinh', mau: ['#4fe0b0', '#14a37a'] },     // thứ 9, 10: Play bỏ, App Store giữ
  { id: 'danhHieu', mau: ['#ffe066', '#ffb300'], dam: true },
];

function nhan(lang) {
  const s = readFileSync(new URL(`../apps/web/src/locales/${lang}.ts`, import.meta.url), 'utf8');
  // Chữ trong file ngôn ngữ có thể đặt trong nháy ĐƠN hoặc nháy KÉP (vd. 'tt.ten': "Tìm Thẻ")
  const g = (k) => { let q = "'", i = s.indexOf(`'${k}': '`); if (i < 0) { q = '"'; i = s.indexOf(`'${k}': "`); } if (i < 0) throw new Error(`${lang}.ts thiếu ${k}`); let j = i + k.length + 5, v = ''; while (s[j] !== q) { if (s[j] === '\\') j++; v += s[j++]; } return v; };
  return { nhanh: g('menu.choiNhanh'), motMinh: g('menu.soNguoi.1'), tiepTuc: g('menu.tiepTuc'), the: g('menu.the'), tiep: g('menu.tiep'),
    batDau: g('menu.batDau').split('{ban}')[0].replace(/[\s—·:：-]+$/u, ''), online: g('menu.online'), may: g('menu.dauMay'), cd: g('menu.chienDich'),
    // Màn Chơi nhanh MỘT MÀN (16.11.2026): Bộ thẻ / Luật bàn / Tên là bước phụ, thoát bằng "Xong"
    luat: g('menu.nhanh.luat'), boThe: g('menu.nhanh.boThe'), xong: g('menu.nhanh.xong'), sua: g('menu.nhanh.sua'), thongTha: g('opt.time.1'),
    // Nút bắt đầu Tìm Thẻ là khoá RIÊNG (`tt.batDau`: "Empezar — {n} cartas"), khác `menu.batDau` ("Jugar") — tiếng Việt trùng chữ nên trước không thấy
    ttBatDau: g('tt.batDau').split('{n}')[0].replace(/[\s—·:：-]+$/u, ''),
    tt: g('tt.ten'), tn: g('tn.ten') };
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
  // MÀN MÁY như iPhone 15 Pro Max thật (28.11.2026): app đã chừa 59pt trên / 34pt dưới (chup-store ép vùng an toàn) — vẽ
  // giờ 9:41 + sóng/wifi/pin + đảo động vào khoảng trên, vạch vuốt ở đáy. Màu chữ theo độ sáng nền (script cuối khuôn).
  const SB = '<span class="bieu"><svg viewBox="0 0 17 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.5" y="5.5" width="3" height="6.5" rx="1"/><rect x="9" y="3" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12"><path d="M8 2.6c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8 .9 10.4 10.4 0 0 0 .6 3.9l1.2 1.2A8.7 8.7 0 0 1 8 2.6Zm0 3.4c1.5 0 2.9.6 3.9 1.6l1.2-1.2A7.1 7.1 0 0 0 8 4.3a7.1 7.1 0 0 0-5.1 2.1l1.2 1.2c1-1 2.4-1.6 3.9-1.6Zm0 3.4c.6 0 1.1.2 1.5.6L8 11.5 6.5 10c.4-.4.9-.6 1.5-.6Z"/></svg><svg viewBox="0 0 28 13"><rect x=".5" y=".5" width="24" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="21" height="9" rx="2"/><path d="M26 4.5v4a2 2 0 0 0 0-4Z" opacity=".45"/></svg></span>';
  // Chỉ bộ iPhone (không KHUNG): Android / iPad giữ màn trơn
  const iPhone = !process.env.KHUNG;
  const may = anh.map((a, k) => `<div class="may${doi ? ` may-${k}` : ''}"><div class="man"><img src="data:image/png;base64,${a}">${iPhone ? `<i class="dao"></i><span class="gio">9:41</span>${SB}<i class="vuot"></i>` : ''}</div></div>`).join('');
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
.ke .may .man{height:100%}.man{position:relative;--k:calc(var(--h,800px)/932);color:#111}.man.sang{color:#fff}
.dao{position:absolute;left:50%;top:calc(var(--k)*11);width:calc(var(--k)*126);height:calc(var(--k)*37);translate:-50% 0;border-radius:calc(var(--k)*19);background:#000}
.gio{position:absolute;left:calc(var(--k)*51);top:calc(var(--k)*19);width:calc(var(--k)*54);text-align:center;font:600 calc(var(--k)*17)/calc(var(--k)*22) -apple-system,'SF Pro Text','Inter',system-ui,sans-serif;letter-spacing:-.01em}
.bieu{position:absolute;right:calc(var(--k)*30);top:calc(var(--k)*23);display:flex;align-items:center;gap:calc(var(--k)*6)}
.bieu svg{height:calc(var(--k)*12);width:auto;fill:currentColor}.bieu svg:last-child{height:calc(var(--k)*13)}
.vuot{position:absolute;left:50%;bottom:calc(var(--k)*8);width:calc(var(--k)*134);height:calc(var(--k)*5);translate:-50% 0;border-radius:99px;background:currentColor}
.may-0,.may-1{position:absolute}.may-0 img,.may-1 img{display:block;width:100%}
.may-0,.may-1{width:58%;top:27%;border-radius:5vw;padding:2vw}
.may-0 img,.may-1 img{border-radius:3.4vw}
.may-0{left:32%;transform:translateX(-50%) rotate(-6deg)}
.may-1{left:68%;top:33%;transform:translateX(-50%) rotate(6deg)}
</style></head><body${doi ? '' : ' class="mot"'}><div class="cap">${esc(to)}<small>${esc(phu)}</small></div>${than}<script>
/* Màn máy: --h = chiều cao ảnh hiển thị (mọi kích thước đảo động / chữ tính theo pt × h/932); màu chữ thanh trạng thái theo
   độ sáng nền app ở dải trên (đen trên nền sáng, trắng trên nền tối). */
for(const m of document.querySelectorAll('.man')){const i=m.querySelector('img');const lam=()=>{m.style.setProperty('--h',i.clientHeight+'px');try{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(Math.round(i.naturalWidth*.06),Math.round(i.naturalHeight*30/932),Math.round(i.naturalWidth*.1),4).data;let s=0;for(let k=0;k<d.length;k+=4)s+=.2126*d[k]+.7152*d[k+1]+.0722*d[k+2];if(s/(d.length/4)<140)m.classList.add('sang');}catch(e){}};i.complete?lam():i.addEventListener('load',lam);}
{const c=document.querySelector('.mot .cap');if(c){let f=9.6,g=4.6;while(c.scrollHeight>c.clientHeight+1&&f>6){f-=.3;g-=.12;c.style.fontSize=f+'vw';c.querySelector('small').style.fontSize=g+'vw';}}}</script></body></html>`;
}

export async function chay({ goi, js, bam, bamDung, cho, chup, doiKhung }) {
  const lang = await js(`localStorage.getItem('mm.lang')`) ?? 'en';
  const L = nhan(lang), chu = CHU[lang];
  if (!chu) throw new Error(`anh-store-chu.mjs thiếu ngôn ngữ ${lang}`);
  const tho = {};   // ảnh thô theo cảnh, base64 PNG
  /** Màn Chơi nhanh: bàn 20 thẻ + đồng hồ "Thong thả" (bước phụ Luật bàn → Xong) — ảnh có viên giờ trên HUD */
  const batDongHo20 = async () => {
    await bamDung('20'); await cho(400);
    await bam(L.luat); await cho(700); await bamDung(L.thongTha.replace(/\s+/g, '')); await cho(300); await bamDung(L.xong.replace(/\s+/g, '')); await cho(700);
  };
  const chupTho = async (k) => { tho[k] = [...(tho[k] ?? []), (await goi('Page.captureScreenshot', { format: 'png' })).result.data]; };
  /** Huy hiệu mở khoá đang bay (MoKhoaFx `.mk-huy`) — chờ xong mới bấm tiếp. `.mk-fx` LUÔN có trên trang (khung hạt), đừng chờ nó. */
  const choMoKhoa = async () => { for (let i = 0; i < 40 && await js(`!!document.querySelector('.mk-huy, .mo-khoa-toast')`); i++) await cho(1000); };
  const trangChu = async () => { await js(`location.href = location.origin + '/?lang=${lang}'; true`); await cho(2200); await choMoKhoa(); };
  // Người chơi ĐÃ CÓ hồ sơ (bỏ màn chào đặt tên) + đã nhận quà Premium (không bật bảng Premium, không đổi nền ngẫu nhiên)
  await js(`(() => { localStorage.setItem('mm.anCai', '1'); localStorage.setItem('mm.premium.tang', '1'); const s = JSON.parse(localStorage.getItem('mm.v2') || '{}');
    s.prefs = { ...(s.prefs || {}), themes: ['animals'] }; s.names = [${JSON.stringify(chu.ten[0])}]; s.hoSo = { mat: '🦊', mau: '#ff9a1f', xong: true };
    localStorage.setItem('mm.v2', JSON.stringify(s)); location.reload(); return true; })()`);
  await cho(2200);

  // Ván 20 thẻ bộ Động vật, có đồng hồ: chụp lúc 6/10 cặp + một lá vừa mở, rồi cảnh thắng
  await bam(L.nhanh); await cho(700);
  await batDongHo20();
  await bam(L.batDau); await cho(3200);
  const cap = await cacCap(js);
  for (const [a, b] of cap.slice(0, 6)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(900); }
  await bamThe(js, cap[6][0]); await cho(250);
  await chupTho('choi');
  await cho(500); await bamThe(js, cap[6][1]); await cho(900);
  for (const [a, b] of cap.slice(7)) { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(450); }
  await cho(1050); await chupTho('thang');   // trước HIEN_BANG_MS: thú + chữ, chưa có bảng
  await cho(6000);
  await choMoKhoa();

  // Ván 2 người cùng máy: mỗi người ghép 2 cặp (người 1 trượt một lần để sang lượt) → hoà điểm,
  // chụp lúc người 1 vừa mở một lá. Tên ở anh-store-chu.mjs (`ten`), ngắn vì ô tên cắt chữ dài.
  await trangChu(); await bam(L.nhanh); await cho(600);
  // ô "2 người" = nút ngay sau "Một mình" (menu.soNguoi.n là HÀM số nhiều ở ru/… nên không bấm theo chữ)
  await js(`(() => { const o=[...document.querySelectorAll('button')].filter(e=>e.offsetParent); const i=o.findIndex(e=>e.textContent.toLowerCase().includes(${JSON.stringify(L.motMinh.toLowerCase())})); if (i < 0) throw new Error('không thấy nút Một mình'); o[i+1].click(); return true; })()`); await cho(700);
  // Tên hai người: bước phụ "Tên … Sửa" → ô nhập → Tiếp tục
  await bam(L.sua); await cho(700);
  await js(`(() => { const t = ${JSON.stringify(chu.ten)}; [...document.querySelectorAll('input')].filter(e=>e.offsetParent).forEach((e, i) => { if (t[i] === undefined) return; e.value = t[i]; e.dispatchEvent(new Event('input', { bubbles: true })); }); return true; })()`);
  await cho(300); await bam(L.tiepTuc); await cho(700);
  await batDongHo20();
  await bam(L.batDau); await cho(3200);
  { const c2 = await cacCap(js);
    const ghep = async ([a, b]) => { await bamThe(js, a); await cho(450); await bamThe(js, b); await cho(1000); };
    await ghep(c2[0]); await ghep(c2[1]); await ghep([c2[3][0], c2[4][0]]); await cho(1500);
    await ghep(c2[3]); await ghep(c2[4]); await bamThe(js, c2[5][0]); await cho(400); }
  await chupTho('haiNguoi');

  await trangChu(); await bam(L.may); await cho(900); await chupTho('may');
  await trangChu(); await bam(L.nhanh); await cho(900);
  await bamDung('30'); await cho(400); await bam(L.boThe); await cho(900); await chupTho('boHinh');
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

  // TÌM THẺ (bàn vòng tròn): đếm 3-2-1 (3 s) + nhìn 5 thẻ mức Vừa (10 s — 2 s/thẻ từ 28.11.2026) + úp (0,8 s) + lật thẻ giữa (0,6 s) → chụp khi thẻ giữa
  // đã ngửa, vạch giờ đang chạy, quầng sáng đang quét vòng
  await trangChu(); await bam(L.nhanh); await cho(900);
  await bam(L.tt); await cho(700);
  await bam(L.ttBatDau); await cho(14700); await chupTho('timThe');

  // CHỈ SỐ TRÍ NHỚ: dựng 28 ngày nhật ký đi lên dần (3 cỡ bàn/ngày: nhỏ 14, vừa 22, lớn 36 thẻ) để biểu đồ có đường — ảnh minh hoạ
  await js(`(() => { const s = JSON.parse(localStorage.getItem('mm.v2') || '{}'); const tn = {}; const nay = new Date();
    for (let d = 27; d >= 0; d--) {
      const t = new Date(nay); t.setDate(nay.getDate() - d);
      const k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      const p = Math.min(1, Math.max(0, (27 - d) / 27 + 0.07 * Math.sin(d * 1.7)));
      const nho = (a) => [Math.round(a * (0.55 + 0.4 * p)), 0, Math.round(a * (0.5 + 0.42 * p)), Math.round(a * (0.3 + 0.35 * p)), 0];
      const quen = (a) => [Math.round(a * (0.45 - 0.37 * p)), 0, Math.round(a * (0.5 - 0.38 * p)), Math.round(a * (0.3 - 0.22 * p)), 0];
      tn[k] = { ban: { 7: { van: 2, nho: nho(6), quen: quen(6), may: [0.4, 0, 0.5, 0.2, 0] }, 11: { van: 2, nho: nho(9), quen: quen(9), may: [0.5, 0, 0.6, 0.3, 0] },
        18: { van: 1, nho: nho(14), quen: quen(14), may: [0.6, 0, 0.7, 0.3, 0] } }, tam: 8 + Math.round(10 * p) };
    }
    s.triNho = tn; localStorage.setItem('mm.v2', JSON.stringify(s)); return true; })()`);
  await trangChu(); await bam(L.tn); await cho(1800); await chupTho('triNho');

  // Ghép: thay cả tài liệu bằng khuôn rồi chụp đúng khung — đổi sang cỡ KHUNG ẢNH RA (màn app đã chụp ở cỡ iPhone 15 Pro Max)
  await doiKhung();
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
