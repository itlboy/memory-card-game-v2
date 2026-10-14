/**
 * ĐO TƯƠNG PHẢN CHỮ / NỀN ở MỌI skin (chủ dự án 14.10.2026: viên "Màn 2" chữ trắng
 * trên nền trắng ở Neon + Đêm Sao, viên trắng mất hình trên ô trắng ở Kẹo Bông).
 *
 *   pnpm do:tuong-phan [url=http://127.0.0.1:8080]
 *
 * Chạy bằng Chrome thật (dựng lại chup-store.mjs làm khung): đi qua các màn như người
 * chơi, với MỌI phần tử có chữ đang hiện thì tính màu chữ (nhân opacity của cả chuỗi
 * cha) và màu nền THẬT phía sau nó (trộn các lớp nền bán trong suốt lên tới lớp đặc;
 * gradient lấy điểm màu TỆ NHẤT), rồi tỉ lệ tương phản WCAG 2. Dưới ngưỡng là đỏ.
 *
 * Ngưỡng 3:1 (WCAG cho chữ lớn / thành phần giao diện) — chữ game hầu hết đậm, to;
 * chữ < 14px thường thì 4.5:1. Chữ có viền (-webkit-text-stroke, như skin Kẹo) tính
 * thêm màu viền và lấy cặp TỐT hơn. Nền là ẢNH (scene, svg) thì không đo được → bỏ qua
 * và đếm riêng, đừng coi là xanh.
 *
 * Server phải chạy dist MỚI (`pnpm --filter @mm/web build` rồi node-server với WEB_DIR).
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_APP = process.argv[2] ?? 'http://127.0.0.1:8080';
const OUT = process.env.OUT ?? '/tmp/mm-tuong-phan';
// SKINS=neon,sao để đo nhanh vài skin
const SKINS = process.env.SKINS?.split(',') ?? ['keo', 'go', 'neon', 'sao', 'bong'];

// Chạy chính file này làm KICHBAN của chup-store (nó lo Chrome, CDP, bấm nút).
if (!process.env.MM_TP_TRONG) {
  const r = spawnSync('node', [fileURLToPath(new URL('./chup-store.mjs', import.meta.url)), URL_APP, OUT, 'vi'], {
    stdio: 'inherit', env: { ...process.env, MM_TP_TRONG: '1', KICHBAN: fileURLToPath(import.meta.url) },
  });
  process.exit(r.status ?? 1);
}

/** Đoạn JS chạy trong trang: trả danh sách chữ dưới ngưỡng + số chữ đã đo/bỏ qua. */
const DO = `(() => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const mau = (s) => [...s.matchAll(/rgba?\\([^)]+\\)/g)].map((x) => parse(x[0]));
  const tron = (tren, duoi) => { const a = tren.a + duoi.a * (1 - tren.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (tren.r * tren.a + duoi.r * duoi.a * (1 - tren.a)) / a, g: (tren.g * tren.a + duoi.g * duoi.a * (1 - tren.a)) / a, b: (tren.b * tren.a + duoi.b * duoi.a * (1 - tren.a)) / a, a }; };
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const tp = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  // Các lớp nền từ phần tử lên tới lớp đặc: mỗi lớp là MỘT danh sách màu (gradient = nhiều)
  const nen = (el) => {
    const lop = []; let dac = false;
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e);
      const img = c.backgroundImage;
      if (img && img !== 'none') {
        if (/url\\(/.test(img) && !/gradient/.test(img)) return { anh: true };
        const ds = mau(img); if (ds.length) lop.push(ds);
      }
      const bg = parse(c.backgroundColor);
      if (bg && bg.a > 0) lop.push([bg]);
      if (lop.length && lop[lop.length - 1].every((x) => x.a >= 0.99)) { dac = true; break; }
    }
    // Không tới được lớp ĐẶC = phía sau là ảnh nền / cảnh của skin → không đo được
    if (!dac) return { anh: true };
    // Trộn từ dưới lên; mỗi lớp gradient sinh nhiều khả năng → giữ tất cả
    let ket = [{ r: 255, g: 255, b: 255, a: 0 }];
    for (const l of lop.reverse()) ket = l.flatMap((m) => ket.map((d) => tron(m, d)));
    return { ds: ket.filter((x) => x.a > 0.5) };
  };
  const loi = [], canh = []; let do_ = 0, boQua = 0;
  const xem = new Set();
  for (const el of document.querySelectorAll('#app *, body > *:not(#app) *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const chu = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!chu || chu.length < 1 || !/[\\p{L}\\p{N}]/u.test(chu)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const c = getComputedStyle(el);
    if (c.visibility === 'hidden') continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.15) continue;   // đang mờ dần / ẩn có chủ đích
    const fg = parse(c.color); if (!fg) continue;
    // Chữ tô bằng gradient cắt theo hình chữ (logo "Lật Thẻ"): màu chữ trong suốt
    if (/text/.test(c.backgroundClip + c.webkitBackgroundClip) || fg.a < 0.05) { boQua++; continue; }
    const n = nen(el);
    if (n.anh) { boQua++; continue; }
    do_++;
    const nau = (m) => ({ ...m, a: m.a * op });
    // Viền chữ: -webkit-text-stroke, hoặc text-shadow nhiều lớp không nhoè (skin Kẹo
    // vẽ viền bằng --chu-vien) — tính thêm màu viền, lấy cặp TỐT hơn
    let vien = parseFloat(c.webkitTextStrokeWidth || '0') > 0.4 ? parse(c.webkitTextStrokeColor) : null;
    if (!vien && c.textShadow && c.textShadow !== 'none') {
      // Chrome trả "rgb(..) 0px 2px 0px, rgb(..) …" — số đo thứ ba là độ nhoè
      const bong = c.textShadow.split(/,(?![^(]*\\))/).map((x) => ({ mau: parse(x), so: (x.replace(/rgba?\\([^)]*\\)/, '').match(/-?[\\d.]+px/g) || []).map(parseFloat) }));
      const net = bong.filter((x) => x.mau && (x.so[2] ?? 0) <= 1);
      if (net.length >= 2) vien = net[0].mau;
    }
    let te = Infinity, teNen = null;
    for (const b of n.ds) {
      const f = tron(nau(fg), b);
      let v = tp(f, b);
      if (vien) v = Math.max(v, tp(tron(nau(vien), b), b));
      if (v < te) { te = v; teNen = b; }
    }
    const co = parseFloat(c.fontSize), dam = Number(c.fontWeight) >= 600;
    // LỖI < 2:1 = gần như không đọc được (viên "Màn 2" trắng/trắng đo ra 1:1).
    // CẢNH BÁO dưới ngưỡng WCAG (3:1 chữ to/đậm, 4,5:1 chữ nhỏ thường) — báo, không đỏ.
    const nguong = co < 14 && !dam ? 4.5 : 3;
    const khoa = chu.slice(0, 30) + '|' + Math.round(r.x) + ',' + Math.round(r.y);
    if (te < nguong && !xem.has(khoa)) { xem.add(khoa); (te < 2 ? loi : canh).push({ chu: chu.slice(0, 30), tp: Math.round(te * 100) / 100, nguong, chuMau: hex(fg), nen: hex(teNen), lop: (el.className && String(el.className).slice(0, 40)) || el.tagName.toLowerCase(), o: Math.round(r.x) + ',' + Math.round(r.y) }); }
  }
  return JSON.stringify({ do: do_, boQua, loi, canh });
})()`;

export async function chay({ js, cho, bam, bamDung, chup }) {
  const ketQua = [];
  const doMan = async (skin, toi, man) => {
    await cho(700);
    const r = JSON.parse(await js(DO));
    ketQua.push({ skin, toi, man, ...r });
    const tag = `${skin}${toi ? '-toi' : ''}-${man}`;
    const ke = (ds) => ds.map((l) => `"${l.chu}" ${l.tp} (${l.chuMau}/${l.nen} .${l.lop})`).join(' · ');
    console.log(`${r.loi.length ? '✗' : r.canh.length ? '!' : '✓'} ${tag.padEnd(26)} đo ${r.do}, bỏ qua ${r.boQua}${r.loi.length ? ' — LỖI ' + ke(r.loi) : ''}${r.canh.length ? ' — cảnh báo ' + ke(r.canh) : ''}`);
    if (r.loi.length) await chup(tag);
  };
  for (const skin of SKINS) for (const toi of [false, true]) {
    // Có sẵn tiến độ Chiến dịch + chuỗi ngày để mọi viên/lối tắt trên trang chủ đều hiện
    await js(`localStorage.clear(); localStorage.setItem('mm.lang','vi'); localStorage.setItem('mm.premium','1');
      localStorage.setItem('mm.v2', JSON.stringify({ levels: { 'campaign:1': { stars: 3, best: 500 } }, prefs: { dark: ${toi} } }));
      location.href = location.origin + '/?lang=vi&skin=${skin}'; true`);
    await cho(3500);
    await doMan(skin, toi, 'trang-chu');
    try {
      await bam('Chơi nhanh'); await doMan(skin, toi, 'so-nguoi');
      await bam('Một mình'); await doMan(skin, toi, 'co-ban');
      await bamDung('12thẻ'); await cho(500);
      try { await bam('Tiếp'); } catch { /* cỡ bàn bấm là đi luôn */ }
      await doMan(skin, toi, 'luat-ban');
      await bam('Bắt đầu'); await cho(3000); await doMan(skin, toi, 'van-choi');
      await js(`document.querySelectorAll('button.card')[0].click(); true`); await cho(400);
      await js(`document.querySelectorAll('button.card')[1].click(); true`); await doMan(skin, toi, 'van-mo-la');
    } catch (e) { console.log(`  (${skin}: dừng giữa luồng chơi nhanh — ${e.message})`); }
    try {
      await js(`location.href = location.origin + '/?lang=vi&skin=${skin}'; true`); await cho(3000);
      await bam('Đấu với máy'); await doMan(skin, toi, 'muc-may');
      await js(`location.href = location.origin + '/?lang=vi&skin=${skin}'; true`); await cho(3000);
      await bam('Chơi online'); await cho(1500); await doMan(skin, toi, 'online');
      await js(`location.href = location.origin + '/?lang=vi&skin=${skin}'; true`); await cho(3000);
      await js(`document.querySelector('.topbar [aria-haspopup="menu"]').click(); true`); await doMan(skin, toi, 'menu');
    } catch (e) { console.log(`  (${skin}: dừng — ${e.message})`); }
  }
  writeFileSync(`${OUT}/tuong-phan.json`, JSON.stringify(ketQua, null, 1));
  const tong = ketQua.reduce((n, k) => n + k.loi.length, 0);
  const tongCanh = ketQua.reduce((n, k) => n + k.canh.length, 0);
  console.log(`\n${tong ? '✗' : '✓'} ${tong} chữ KHÔNG ĐỌC ĐƯỢC (< 2:1) · ${tongCanh} cảnh báo dưới chuẩn WCAG · chi tiết ${OUT}/tuong-phan.json`);
  // chup-store gọi process.exit(0) sau kịch bản → phải tự thoát với mã lỗi ở đây
  process.exit(tong ? 1 : 0);
}
