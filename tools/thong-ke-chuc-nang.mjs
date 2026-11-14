#!/usr/bin/env node
/**
 * THỐNG KÊ CHỨC NĂNG (chỉ đọc GA4 Data API): chức năng nào được vào nhiều/ít, menu dừng ở bước nào,
 * chế độ chơi nào chuộng, ván bỏ dở ở đâu, cài đặt nào hay đổi. Ghi chuc-nang.json + chuc-nang.md.
 *
 *   node tools/thong-ke-chuc-nang.mjs --out-dir <thư mục> [--tu 28daysAgo] [--den today]
 *
 * Biến môi trường: PLAY_SA_JSON (đường dẫn) hoặc SA_JSON (nội dung) — tài khoản dịch vụ của project
 * `lat-the-nkien`, đã là Viewer của thuộc tính GA "Flip Match". Chạy trong CI qua thongke-tai.yml
 * (đầu ra MÃ HOÁ age — repo công khai, KHÔNG in số liệu ra stdout/stderr ngoài tóm tắt đã mã hoá).
 *
 * Tham số sự kiện chỉ lọc được khi đã đăng ký custom dimension (đăng ký 14.11.2026 — số liệu tách
 * theo tham số chỉ có từ ngày đó). Chiều thiếu thì bảng đó ghi lỗi, các bảng khác vẫn chạy.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out-dir');
if (!OUT) { console.error('Cách dùng: node tools/thong-ke-chuc-nang.mjs --out-dir <thư mục>'); process.exit(2); }
const TU = arg('tu', '28daysAgo'), DEN = arg('den', 'today');
const PROP = 'properties/559113062'; // Flip Match

/** Mọi tên `mo_chuc_nang` có trong code — để thấy cả chức năng KHÔNG AI vào (GA chỉ trả hàng có số). */
const CHUC_NANG = [
  'choi_nhanh', 'dau_may', 'chien_dich', 'chien_dich_choi_tiep', 'choi_online', 'mua_the',
  'luat_choi', 'tai_khoan', 'danh_hieu', 'chinh_phuc', 'cai_app', 'luu_chia_se_anh',
  'online_vao_phong_ds', 'online_tao_phong', 'online_vao_link_moi', 'online_vao_ma', 'online_chep_ma',
  'online_chep_loi_moi', 'online_moi_ban', 'online_emoji', 'online_noi_nhanh'
];

const SA = JSON.parse(process.env.SA_JSON || (process.env.PLAY_SA_JSON ? readFileSync(process.env.PLAY_SA_JSON, 'utf8') : '{}'));
if (!SA.client_email) { console.error('Thiếu SA_JSON / PLAY_SA_JSON'); process.exit(2); }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function layToken() {
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'RS256', typ: 'JWT' });
  const than = b64({ iss: SA.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/analytics.readonly' });
  const ky = createSign('RSA-SHA256').update(`${dau}.${than}`).sign(SA.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${than}.${ky}` })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Không lấy được token (${r.status})`);
  return j.access_token;
}
const TOKEN = await layToken();

const suKienLa = (...ten) => ({ filter: { fieldName: 'eventName', inListFilter: { values: ten } } });
async function bao(dims, mets, loc) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROP}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: TU, endDate: DEN }], dimensions: dims.map((name) => ({ name })),
      metrics: mets.map((name) => ({ name })), dimensionFilter: loc, limit: 500,
      orderBys: [{ metric: { metricName: mets[0] }, desc: true }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${j.error?.message ?? ''}`.slice(0, 300));
  return (j.rows ?? []).map((x) => Object.fromEntries([
    ...dims.map((d, i) => [d.replace(/^custom(Event|User):/, ''), x.dimensionValues[i].value]),
    ...mets.map((m, i) => [m.replace(/^customEvent:/, ''), +x.metricValues[i].value])
  ]));
}

const BANG = [
  ['tong', 'Tổng quan', ['customUser:nen_tang'], ['activeUsers', 'sessions', 'userEngagementDuration']],
  ['su_kien', 'Mọi sự kiện', ['eventName'], ['eventCount', 'totalUsers']],
  ['chuc_nang', 'Chức năng được mở', ['customEvent:chuc_nang'], ['eventCount', 'totalUsers'], suKienLa('mo_chuc_nang')],
  ['chuc_nang_nen_tang', 'Chức năng theo nền tảng', ['customEvent:chuc_nang', 'customUser:nen_tang'], ['totalUsers'], suKienLa('mo_chuc_nang')],
  ['menu', 'Bước menu', ['customEvent:nhanh', 'customEvent:buoc'], ['eventCount', 'totalUsers'], suKienLa('buoc_menu')],
  ['van', 'Ván theo chế độ', ['eventName', 'customEvent:che_do'], ['eventCount', 'totalUsers'], suKienLa('van_bat_dau', 'van_ket_thuc', 'van_bo_do', 'mua_the_bo_do')],
  ['so_nguoi', 'Ván bắt đầu theo số người', ['customEvent:che_do', 'customEvent:so_nguoi'], ['eventCount'], suKienLa('van_bat_dau')],
  ['tuy_chon', 'Tuỳ chọn ván', ['customEvent:tuy_chon'], ['eventCount', 'totalUsers'], suKienLa('van_bat_dau')],
  ['theme', 'Chủ đề thẻ', ['customEvent:theme'], ['eventCount', 'totalUsers'], suKienLa('van_bat_dau')],
  ['bo_do', 'Bỏ dở ván', ['customEvent:che_do', 'customEvent:cach'], ['eventCount', 'tien_do', 'giay_choi'], suKienLa('van_bo_do', 'mua_the_bo_do')],
  ['man', 'Chiến dịch theo màn', ['eventName', 'customEvent:man'], ['eventCount', 'totalUsers'], suKienLa('van_bat_dau', 'van_ket_thuc', 'van_bo_do')],
  ['ket_qua', 'Bấm gì sau khi xong ván', ['customEvent:hanh_dong'], ['eventCount', 'totalUsers'], suKienLa('ket_qua_chon')],
  ['cai_dat', 'Đổi cài đặt', ['customEvent:muc', 'customEvent:gia_tri'], ['eventCount', 'totalUsers'], suKienLa('doi_cai_dat')]
];
// Chỉ số tuỳ chỉnh có apiName customEvent:<tên tham số>
const tenChiSo = (m) => ({ tien_do: 'customEvent:tien_do', giay_choi: 'customEvent:giay' }[m] ?? m);

const kq = { tu: TU, den: DEN, luc: new Date().toISOString(), bang: {} };
for (const [id, tieuDe, dims, mets, loc] of BANG) {
  try { kq.bang[id] = { tieuDe, hang: await bao(dims, mets.map(tenChiSo), loc) }; }
  catch (e) { kq.bang[id] = { tieuDe, loi: e.message }; }
}

// Bỏ dở: chỉ số tuỳ chỉnh GA trả TỔNG — đổi ra trung bình mỗi ván
for (const h of kq.bang.bo_do.hang ?? []) {
  h.tb_tien_do_pct = h.eventCount ? Math.round(h.tien_do / h.eventCount) : 0;
  h.tb_giay = h.eventCount ? Math.round(h.giay / h.eventCount) : 0;
  delete h.tien_do; delete h.giay;
}

// Chức năng xếp nhiều → ít, kèm những cái 0 lượt
const cn = kq.bang.chuc_nang.hang ?? [];
const coSo = new Map(cn.map((h) => [h.chuc_nang, h]));
kq.xepHang = [...new Set([...cn.map((h) => h.chuc_nang), ...CHUC_NANG])]
  .map((ten) => ({ chuc_nang: ten, luot: coSo.get(ten)?.eventCount ?? 0, nguoi: coSo.get(ten)?.totalUsers ?? 0 }))
  .sort((a, b) => b.nguoi - a.nguoi || b.luot - a.luot);

// Tỉ lệ chơi hết ván theo chế độ
const van = kq.bang.van.hang ?? [];
const theoCheDo = {};
for (const h of van) (theoCheDo[h.che_do] ??= {})[h.eventName] = h.eventCount;
kq.hoanThanh = Object.entries(theoCheDo).map(([che_do, v]) => ({
  che_do, bat_dau: v.van_bat_dau ?? 0, ket_thuc: v.van_ket_thuc ?? 0, bo_do: (v.van_bo_do ?? 0) + (v.mua_the_bo_do ?? 0),
  ti_le_het: v.van_bat_dau ? Math.round(100 * (v.van_ket_thuc ?? 0) / v.van_bat_dau) : null
})).sort((a, b) => b.bat_dau - a.bat_dau);

// Markdown dễ đọc
const md = [`# Thống kê chức năng Lật Thẻ — ${TU} → ${DEN}`, '', `Lấy lúc ${kq.luc}.`, ''];
const bangMd = (hang) => {
  if (!hang?.length) return ['_(chưa có dữ liệu)_', ''];
  const k = Object.keys(hang[0]);
  const fmt = (v) => (typeof v === 'number' && v % 1 ? v.toFixed(1) : String(v));
  return [`| ${k.join(' | ')} |`, `|${k.map(() => '---').join('|')}|`, ...hang.map((h) => `| ${k.map((x) => fmt(h[x])).join(' | ')} |`), ''];
};
md.push('## Xếp hạng chức năng (theo số người)', '', ...bangMd(kq.xepHang));
md.push('## Chơi hết ván theo chế độ', '', ...bangMd(kq.hoanThanh));
for (const [id, b] of Object.entries(kq.bang)) {
  md.push(`## ${b.tieuDe}`, '');
  if (b.loi) md.push(`Lỗi: ${b.loi}`, ''); else md.push(...bangMd(b.hang));
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'chuc-nang.json'), JSON.stringify(kq, null, 2));
writeFileSync(join(OUT, 'chuc-nang.md'), md.join('\n'));
const loi = Object.values(kq.bang).filter((b) => b.loi).length;
console.error(`chức năng: ${Object.keys(kq.bang).length - loi} bảng ok, ${loi} lỗi`);
