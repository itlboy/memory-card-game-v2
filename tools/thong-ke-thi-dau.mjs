#!/usr/bin/env node
/**
 * THỐNG KÊ THI ĐẤU — lấy sự kiện thô từ server (`GET /api/thongke/thidau`, bảng `td_events`) rồi gộp thành phễu, bảng theo
 * ngày, theo giờ, theo nền tảng / nước. Khoá đọc ở my-secrets (provider `latthe-thongke`), KHÔNG ghi vào repo này:
 *
 *   cd ../my-secrets && node bin/secrets.mjs run latthe-thongke -- node ../memory-card-game-v2/tools/thong-ke-thi-dau.mjs [số ngày=30] [file.json]
 *
 * In bảng tóm tắt ra màn hình; có tên file thì ghi thêm JSON đã gộp (nguồn cho dashboard). Không có dữ liệu cá nhân nào:
 * server chỉ lưu mã băm 12 ký tự (`who`), nền tảng, ngôn ngữ, nước.
 */
import { writeFileSync } from 'node:fs';

const SERVER = process.env.MM_SERVER ?? 'https://flipmatch-api-us.cozypi.com';
const KHOA = process.env.LATTHE_THONGKE_KEY;
const [NGAY = '30', FILE] = process.argv.slice(2);
if (!KHOA) { console.error('Thiếu LATTHE_THONGKE_KEY — chạy qua `secrets run latthe-thongke -- …`'); process.exit(1); }

const res = await fetch(`${SERVER}/api/thongke/thidau?ngay=${Number(NGAY) || 30}`, { headers: { 'x-thongke-key': KHOA } });
if (!res.ok) { console.error(`Server trả ${res.status} — khoá sai, hoặc server chưa nạp THONGKE_KEY (cần khởi động lại sau khi đặt)`); process.exit(1); }
const { ds = [] } = await res.json();

/** Giờ Việt Nam: mọi "ngày" và "giờ" trong báo cáo tính theo UTC+7. */
const VN = 7 * 3_600_000;
const ngayVN = (at) => new Date(at + VN).toISOString().slice(0, 10);
const gioVN = (at) => new Date(at + VN).getUTCHours();
const sk = ds.map(([at, kind, who, platform, lang, country, data]) => {
  let d = {}; try { d = JSON.parse(data); } catch { /* dòng hỏng: bỏ dữ liệu, giữ sự kiện */ }
  return { at, kind, who, platform: platform || '?', lang: lang || '?', country: country || '?', d };
});
const dem = (ds2, f) => ds2.filter(f).length;
const nguoi = (ds2) => new Set(ds2.map((x) => x.who).filter(Boolean)).size;
const tb = (so) => (so.length ? Math.round(so.reduce((a, b) => a + b, 0) / so.length) : null);
const phanVi = (so, p) => { if (!so.length) return null; const s = [...so].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

function gop(ds2) {
  const hoi = ds2.filter((x) => x.kind === 'td_hoi');
  const tra = ds2.filter((x) => x.kind === 'td_tra_loi');
  const chia = ds2.filter((x) => x.kind === 'td_chia');
  const van = ds2.filter((x) => x.kind === 'td_van');
  const cho = ds2.filter((x) => x.kind === 'td_cho');
  const chon = ds2.filter((x) => x.kind === 'td_chon_the');
  const push = ds2.filter((x) => x.kind === 'td_push');
  return {
    dotGoi: dem(ds2, (x) => x.kind === 'td_dot'),
    hoi: hoi.length, nguoiDuocHoi: nguoi(hoi),
    hoiTheoKenh: { theHoi: dem(hoi, (x) => x.d.kenh === 'theHoi'), coNguoiCho: dem(hoi, (x) => x.d.kenh === 'coNguoiCho') },
    thamGia: dem(tra, (x) => x.d.tra === 'thamGia'), deSau: dem(tra, (x) => x.d.tra === 'deSau'), boQua: dem(tra, (x) => x.d.tra === 'boQua'),
    nguoiThamGia: nguoi(tra.filter((x) => x.d.tra === 'thamGia')),
    giayToiLucBam: tb(tra.filter((x) => x.d.tra === 'thamGia' && typeof x.d.giay === 'number').map((x) => x.d.giay)),
    dotChia: chia.length, dotDuNguoi: dem(chia, (x) => x.d.du === true),
    tran2: chia.reduce((a, x) => a + (x.d.tran2 || 0), 0), tran3: chia.reduce((a, x) => a + (x.d.tran3 || 0), 0),
    batDauCho: dem(cho, (x) => x.d.viec === 'batDau'), hetGioCho: dem(cho, (x) => x.d.viec === 'hetGio'), thoiCho: dem(cho, (x) => x.d.viec === 'thoi' || x.d.viec === 'dongApp'),
    banChot: chon.length, soTheBoc: chon.reduce((m, x) => { m[x.d.boc] = (m[x.d.boc] || 0) + 1; return m; }, {}),
    chonTrung: dem(chon, (x) => Array.isArray(x.d.chon) && new Set(x.d.chon.filter(Boolean)).size === 1 && x.d.chon.filter(Boolean).length > 1),
    vanBatDau: dem(van, (x) => x.d.viec === 'batDau'), vanXong: dem(van, (x) => x.d.viec === 'xong'),
    vanCoNguoiRoi: dem(van, (x) => x.d.viec === 'xong' && x.d.roi > 0),
    giayVanTrungVi: phanVi(van.filter((x) => x.d.viec === 'xong' && x.d.giay > 0).map((x) => x.d.giay), 0.5),
    choiLai: dem(ds2, (x) => x.kind === 'td_choi_lai'),
    tatGoiY: dem(ds2, (x) => x.kind === 'td_tat'),
    pushGui: push.reduce((a, x) => a + (x.d.gui || 0), 0), pushDot: push.length
  };
}
const theoKhoa = (f) => { const m = {}; for (const x of sk) (m[f(x)] ??= []).push(x); return m; };
const ra = {
  tu: sk.length ? ngayVN(sk[0].at) : null, den: sk.length ? ngayVN(sk[sk.length - 1].at) : null, soNgay: Number(NGAY) || 30,
  suKien: sk.length, luc: new Date().toISOString(),
  tong: gop(sk),
  theoNgay: Object.fromEntries(Object.entries(theoKhoa((x) => ngayVN(x.at))).sort().map(([k, v]) => [k, gop(v)])),
  theoGio: Array.from({ length: 24 }, (_, g) => { const v = sk.filter((x) => gioVN(x.at) === g); return { gio: g, hoi: dem(v, (x) => x.kind === 'td_hoi'), thamGia: dem(v, (x) => x.kind === 'td_tra_loi' && x.d.tra === 'thamGia'), van: dem(v, (x) => x.kind === 'td_van' && x.d.viec === 'batDau') }; }),
  theoNenTang: Object.fromEntries(Object.entries(theoKhoa((x) => x.platform)).filter(([k]) => k !== '?').map(([k, v]) => [k, { hoi: dem(v, (x) => x.kind === 'td_hoi'), thamGia: dem(v, (x) => x.kind === 'td_tra_loi' && x.d.tra === 'thamGia'), nguoi: nguoi(v) }])),
  theoNuoc: Object.fromEntries(Object.entries(theoKhoa((x) => x.country)).filter(([k]) => k !== '?').map(([k, v]) => [k, { hoi: dem(v, (x) => x.kind === 'td_hoi'), thamGia: dem(v, (x) => x.kind === 'td_tra_loi' && x.d.tra === 'thamGia'), nguoi: nguoi(v) }]))
};

const t = ra.tong;
const pt = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
console.log(`Thi đấu ${ra.soNgay} ngày qua (${ra.tu ?? '–'} → ${ra.den ?? '–'}, giờ VN) — ${ra.suKien} sự kiện`);
console.log(`  Đợt gọi: ${t.dotGoi} · lượt hỏi: ${t.hoi} (${t.nguoiDuocHoi} người) — thẻ hỏi ${t.hoiTheoKenh.theHoi}, có người chờ ${t.hoiTheoKenh.coNguoiCho}`);
console.log(`  Trả lời: tham gia ${t.thamGia} (${pt(t.thamGia, t.hoi)}) · để sau ${t.deSau} · bỏ qua ${t.boQua}`);
console.log(`  Đợt chia: ${t.dotChia}, đủ người ${t.dotDuNguoi} (${pt(t.dotDuNguoi, t.dotChia)}) · trận 2 người ${t.tran2} · trận 3 người ${t.tran3}`);
console.log(`  Giữ chờ: ${t.batDauCho} lần · hết 10 phút không ai vào ${t.hetGioCho} · tự thôi / đóng app ${t.thoiCho}`);
console.log(`  Ván: bắt đầu ${t.vanBatDau} · xong ${t.vanXong} · có người rời ${t.vanCoNguoiRoi} · chơi lại ${t.choiLai} · ván trung vị ${t.giayVanTrungVi ?? '–'} giây`);
console.log(`  Tin đẩy: ${t.pushGui} tin trong ${t.pushDot} đợt · tắt gợi ý: ${t.tatGoiY}`);
if (FILE) { writeFileSync(FILE, JSON.stringify(ra, null, 1)); console.log(`→ ${FILE}`); }
