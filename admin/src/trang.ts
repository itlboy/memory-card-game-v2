/**
 * Giao diện admin — HTML + CSS + JS thuần, phục vụ từ chính Worker (CSP 'self', không script nội tuyến).
 * Theo mockup đã duyệt 17.11.2026 (https://claude.ai/artifact/VdBjJtK6bNfLz1AXFcjRB9): nền arcade tối,
 * ô/nút nổi khối (thạch) như game. LƯU Ý khi sửa: JS dưới đây nằm trong String.raw — không dùng
 * dấu backtick hay "${" trong đó.
 */

export const HTML = String.raw`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Lật Thẻ · Quản trị</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/app.css">
<script src="/app.js" defer></script>
</head>
<body>
<div class="khung">
  <header class="dau">
    <div class="ten">
      <div class="logo" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="12" rx="2"/><rect x="13" y="8" width="8" height="12" rx="2"/></svg></div>
      <div><h1>Lật Thẻ · Quản trị</h1><p class="phu" id="capNhat">admin.cozypi.com</p></div>
    </div>
    <div class="dieu-khien">
      <div class="chips" id="khoang" role="group" aria-label="Khoảng thời gian"></div>
      <button class="chip" id="nutTuyChon" type="button" aria-expanded="false">Tuỳ chọn…</button>
      <button class="chip" id="nutMoi" type="button" title="Bỏ qua bộ nhớ tạm, hỏi GA lại">Làm mới</button>
      <a class="nguoi" id="nguoi" href="/cdn-cgi/access/logout" title="Đăng xuất Cloudflare Access">Access</a>
    </div>
  </header>

  <form class="tuy-chon thach" id="tuyChon" hidden>
    <label>Từ ngày <input type="date" id="tu" required></label>
    <label>Đến ngày <input type="date" id="den" required></label>
    <button class="chip chon" type="submit">Xem</button>
  </form>

  <div class="bao" id="bao" hidden></div>

  <section class="thach song" aria-live="polite">
    <div class="song-tieu"><span class="cham"></span><h2 class="ktieu">30 phút qua</h2><span class="nguon n-live">GA Realtime</span></div>
    <div class="song-so" id="song"><span class="mo">đang tải…</span></div>
  </section>

  <section class="luoi-kpi" id="kpi"></section>

  <section class="hang">
    <div class="thach the bieu-do">
      <div class="the-dau">
        <div class="tieu"><h2 class="ktieu" id="tieuChuoi">Người chơi</h2><span class="nguon n-ga">GA4</span></div>
        <div class="chips nho" id="hat" role="group" aria-label="Mỗi cột ứng với"></div>
      </div>
      <div class="the-phu"><span id="ghiChuoi" class="mo"></span><span class="chu-giai" id="chuGiai"></span></div>
      <div class="cuon"><div class="cot-vung" id="chuoi"></div></div>
      <p class="loi-o" id="loi-chuoi" hidden></p>
    </div>
    <div class="thach the nen-tang">
      <div class="tieu"><h2 class="ktieu">Nền tảng</h2><span class="nguon n-ga">GA4</span></div>
      <div class="thanh" id="thanhNt"></div>
      <div id="nenTang"></div>
      <p class="loi-o" id="loi-nenTang" hidden></p>
    </div>
  </section>

  <section class="thach the">
    <div class="the-dau">
      <div class="tieu"><h2 class="ktieu">Giờ cao điểm · ván bắt đầu theo giờ trong tuần</h2><span class="nguon n-ga">GA4</span></div>
      <span class="mo" id="ghiHeat"></span>
    </div>
    <div class="cuon"><div id="heat" class="heat"></div></div>
    <p class="loi-o" id="loi-heat" hidden></p>
  </section>

  <section class="luoi-ds" id="danhSach"></section>

  <footer class="chan">
    <span><span class="nguon n-live">GA Realtime</span> 30 phút gần nhất</span>
    <span><span class="nguon n-ga">GA4</span> chỉ hỏi GA khi mở trang · số trong ngày trễ vài giờ · không chạm MySQL/server game</span>
    <span>Số GA là ước lượng: người chặn quảng cáo hoặc từ chối đồng ý thu thập không được đếm.</span>
  </footer>
</div>
</body>
</html>`;

export const CSS = String.raw`
:root{--nen:#0c0e1c;--o:#171a30;--o2:#10132a;--vien:#2a2f52;--day:#070812;--chu:#e6e8f8;--mo:#9aa0c8;--vua:#c9cdea;--tim:#6a5cff;--tim2:#8b7dff;
--web:#67e8f9;--ios:#8b7dff;--android:#c026d3;--tat_ca:#a99fff}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;background:var(--nen);color:var(--chu);font:16px/1.5 Nunito,system-ui,sans-serif}
.khung{max-width:1320px;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font:800 28px/1.1 'Baloo 2',sans-serif;color:#fff}
.phu{margin:2px 0 0;font-size:13px;color:var(--mo)}
.mo{color:var(--mo);font-size:13px;font-weight:700}
.dau{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.ten{display:flex;align-items:center;gap:14px}
.logo{width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:var(--tim);border:2px solid var(--tim2);border-radius:18px;box-shadow:0 5px 0 #3b2fb0}
.dieu-khien,.chips{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.chips.nho{gap:8px}
.thach{background:var(--o);border:2px solid var(--vien);border-radius:18px;box-shadow:0 5px 0 var(--day)}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid var(--vien);background:var(--o);box-shadow:0 4px 0 var(--day);color:var(--vua);font:700 14px Nunito,sans-serif;cursor:pointer;text-decoration:none}
.chips.nho .chip{padding:0 12px;font-size:13px}
.chip.chon{background:var(--tim);border-color:var(--tim2);color:#fff;box-shadow:0 2px 0 #3b2fb0;transform:translateY(2px)}
.chip:active{transform:translateY(3px);box-shadow:0 1px 0 var(--day)}
.chip:focus-visible,.nguoi:focus-visible{outline:3px solid #fcd34d;outline-offset:2px}
@media (hover:hover){.chip:not(.chon):hover{border-color:var(--tim2);color:#fff}}
.nguoi{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;background:rgba(74,222,128,.1);color:#86efac;font-weight:700;font-size:13px;text-decoration:none}
.tuy-chon{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;padding:16px 18px}
.tuy-chon label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:700;color:var(--mo)}
.tuy-chon input{min-height:44px;padding:0 12px;border-radius:12px;border:2px solid var(--vien);background:var(--o2);color:var(--chu);font:600 15px Nunito,sans-serif}
.bao{padding:14px 16px;border-radius:14px;background:rgba(251,191,36,.1);color:#fcd34d;font-size:14px;font-weight:600}
.bao code{background:rgba(0,0,0,.3);padding:1px 6px;border-radius:6px}
.bao.do{background:rgba(252,165,165,.12);color:#fca5a5}
.nguon{display:inline-block;padding:2px 8px;border-radius:999px;font:800 10.5px Nunito,sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.n-ga{background:rgba(251,191,36,.16);color:#fcd34d}
.n-live{background:rgba(74,222,128,.16);color:#86efac}
.ktieu{margin:0;font:700 13px Nunito,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--mo)}
.song{padding:18px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:28px}
.song-tieu{display:flex;align-items:center;gap:10px}
.cham{width:12px;height:12px;border-radius:999px;background:#4ade80;box-shadow:0 0 0 5px rgba(74,222,128,.18)}
.song-so{display:flex;flex-wrap:wrap;gap:28px}
.song-so b,.kpi b{font:800 30px/1 'Baloo 2',sans-serif;color:#fff}
.song-so span.k{font-size:14px;color:var(--mo);font-weight:700;margin-left:8px}
.luoi-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.kpi{padding:18px;display:flex;flex-direction:column;gap:8px}
.kpi .nhan{font-size:14px;font-weight:700;color:var(--vua)}
.kpi b{font-size:36px}
.kpi .doi{font-size:13px;font-weight:700;color:var(--vua)}
.kpi .doi.len{color:#86efac}.kpi .doi.xuong{color:#fca5a5}
.hang{display:flex;flex-wrap:wrap;gap:16px}
.the{padding:20px;display:flex;flex-direction:column;gap:14px;min-width:0}
.bieu-do{flex:999 1 560px}
.nen-tang{flex:1 1 300px}
.the-dau{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px}
.the-phu{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
.tieu{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.chu-giai{display:flex;gap:14px;font-size:13px;font-weight:700;color:var(--vua)}
.chu-giai i,.nt-dong i{display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:6px;vertical-align:-1px}
.cuon{overflow-x:auto}
.cot-vung{display:flex;align-items:flex-end;gap:3px;height:250px;border-bottom:2px solid var(--vien);padding-top:20px}
.cot{flex:1 0 6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;position:relative}
.cot .so{font-size:11px;font-weight:800;color:var(--mo);margin-bottom:4px}
.cot .khoi{width:100%;max-width:34px;display:flex;flex-direction:column-reverse;border-radius:6px 6px 0 0;overflow:hidden}
.cot .nhan{position:absolute;bottom:-22px;font-size:11px;color:var(--mo);white-space:nowrap}
.cot.moc .nhan{color:var(--vua);font-weight:800}
.cot-vung{margin-bottom:26px}
.thanh{display:flex;height:20px;border-radius:999px;overflow:hidden;background:var(--o2)}
.nt-dong{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #222743;font-weight:700}
.nt-dong b{font:800 18px 'Baloo 2',sans-serif}
.nt-dong small{font:700 13px Nunito,sans-serif;color:var(--mo);margin-left:6px}
.heat{min-width:760px;display:flex;flex-direction:column;gap:4px}
.heat .h{display:flex;gap:4px;align-items:center}
.heat .h > span:first-child{width:48px;flex:none;font-size:12.5px;font-weight:700;color:var(--vua)}
.heat .o{flex:1;height:26px;border-radius:6px}
.heat .gio span{flex:1;text-align:center;font-size:11px;color:var(--mo)}
.luoi-ds{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.ds-dong{display:flex;flex-direction:column;gap:4px}
.ds-dong .tren{display:flex;justify-content:space-between;font-size:14px;font-weight:700;gap:8px}
.ds-dong .tren span:last-child{color:var(--vua)}
.ds-dong .ray{height:8px;border-radius:999px;background:var(--o2);overflow:hidden}
.ds-dong .ray div{height:100%;border-radius:999px}
.loi-o{margin:0;padding:10px 12px;border-radius:12px;background:rgba(252,165,165,.1);color:#fca5a5;font-size:13px;font-weight:600}
.chan{display:flex;flex-wrap:wrap;gap:10px 20px;font-size:13px;color:var(--mo)}
@media (max-width:700px){h1{font-size:22px}.kpi b{font-size:30px}}
`;

export const JS = String.raw`
(function () {
  var KHOANG = [['30m','30 phút'],['6h','6 giờ'],['24h','24 giờ'],['today','Hôm nay'],['yday','Hôm qua'],['7','7 ngày'],['30','30 ngày'],['90','90 ngày'],['all','Từ khi công khai']];
  var HAT = { '5m': '5 phút', '1h': 'Giờ', '1d': 'Ngày', '1w': 'Tuần' };
  var MAU = { web: '#67e8f9', ios: '#8b7dff', android: '#c026d3', tat_ca: '#a99fff' };
  var CHE_DO = { choi_nhanh: 'Chơi nhanh', chien_dich: 'Chiến dịch', dau_may: 'Đấu máy', online: 'Online', nhieu_nguoi: 'Nhiều người (một máy)', nhieu_nguoi_may: 'Nhiều người + máy' };
  var CACH_VAO = { online_vao_link_moi: 'Link mời', online_vao_ma: 'Nhập mã', online_vao_phong_ds: 'Danh sách phòng' };
  var THEME = { animals: 'Động vật', ocean: 'Đại dương', nature: 'Thiên nhiên', seasons: 'Bốn mùa', food: 'Đồ ăn', letters: 'Chữ & hình', smileys: 'Mặt cười', games: 'Trò chơi', objects: 'Đồ vật', travel: 'Du lịch', festive: 'Lễ hội', flags: 'Cờ' };
  var THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var HEAT = ['#14183a', '#2c2a6e', '#4b3fb3', '#7a63f0', '#c4b5ff'];
  var tenNuoc = null;
  try { tenNuoc = new Intl.DisplayNames(['vi'], { type: 'region' }); } catch (e) { /* trình duyệt cũ */ }

  var nho = {}; try { nho = JSON.parse(localStorage.getItem('admin-loc') || '{}'); } catch (e) {}
  var tt = { khoang: nho.khoang || '24h', hat: '', tu: nho.tu || '', den: nho.den || '' };
  var $ = function (id) { return document.getElementById(id); };
  var so = function (n) { return n == null ? '—' : Number(n).toLocaleString('vi-VN'); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function luu() { try { localStorage.setItem('admin-loc', JSON.stringify({ khoang: tt.khoang, tu: tt.tu, den: tt.den })); } catch (e) {} }

  function veKhoang() {
    var c = $('khoang'); c.textContent = '';
    KHOANG.forEach(function (k) {
      var b = el('button', 'chip' + (tt.khoang === k[0] ? ' chon' : ''), k[1]);
      b.type = 'button'; b.setAttribute('aria-pressed', String(tt.khoang === k[0]));
      b.onclick = function () { tt.khoang = k[0]; tt.hat = ''; $('tuyChon').hidden = true; luu(); veKhoang(); tai(false); };
      c.appendChild(b);
    });
    $('nutTuyChon').classList.toggle('chon', tt.khoang === 'custom');
  }

  $('nutTuyChon').onclick = function () {
    var f = $('tuyChon'); f.hidden = !f.hidden; this.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden) { $('tu').value = tt.tu; $('den').value = tt.den; $('tu').focus(); }
  };
  $('tuyChon').onsubmit = function (e) {
    e.preventDefault(); tt.khoang = 'custom'; tt.tu = $('tu').value; tt.den = $('den').value; tt.hat = ''; luu(); veKhoang(); tai(false);
  };
  $('nutMoi').onclick = function () { tai(true); song(true); };

  // loai 'do' = chữ từ GA/mạng → textContent; chỉ thông báo cố định của trang mới dùng innerHTML.
  function bao(noiDung, loai) {
    var b = $('bao'); if (!noiDung) { b.hidden = true; return; }
    b.hidden = false; b.className = 'bao' + (loai ? ' ' + loai : '');
    if (loai === 'do') b.textContent = noiDung; else b.innerHTML = noiDung;
  }
  function loiO(id, msg) { var p = $('loi-' + id); if (!p) return; p.hidden = !msg; p.textContent = msg || ''; }

  var dangTai = 0;
  function tai(moi) {
    var lan = ++dangTai;
    var q = new URLSearchParams({ khoang: tt.khoang });
    if (tt.hat) q.set('hat', tt.hat);
    if (tt.khoang === 'custom') { q.set('tu', tt.tu); q.set('den', tt.den); }
    if (moi) q.set('moi', '1');
    $('capNhat').textContent = 'admin.cozypi.com · đang tải…';
    fetch('/api/tong-quan?' + q, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 403 || r.redirected) { location.reload(); return null; }
      return r.json().then(function (j) { return { s: r.status, j: j }; });
    }).then(function (kq) {
      if (!kq || lan !== dangTai) return;
      if (kq.j.chuaCauHinh) {
        bao('Chưa nối GA: cần đặt bí mật <code>GA_SA_JSON</code> và <code>GA_PROPERTY_ID</code> cho Worker <code>latthe-admin</code> (xem admin/README.md).');
        $('capNhat').textContent = 'admin.cozypi.com · chưa nối GA'; return;
      }
      if (kq.j.loiChung) { bao('GA báo lỗi: ' + kq.j.loiChung, 'do'); return; }
      bao(''); ve(kq.j);
    }).catch(function (e) { if (lan === dangTai) bao('Không tải được: ' + e.message, 'do'); });
  }

  function song(moi) {
    fetch('/api/dang-dien-ra' + (moi ? '?moi=1' : ''), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var c = $('song'); c.textContent = '';
      if (!j || j.chuaCauHinh) { c.appendChild(el('span', 'mo', 'chưa có số')); return; }
      [[j.nguoi, 'người đang chơi'], [j.van, 'ván bắt đầu'], [j.quocGia, 'quốc gia']].forEach(function (x) {
        var d = el('div'); d.appendChild(el('b', null, so(x[0]))); d.appendChild(el('span', 'k', x[1])); c.appendChild(d);
      });
    }).catch(function () {});
  }

  function doi(v, truoc) {
    if (v == null || truoc == null) return null;
    if (!truoc) return v ? { t: 'mới có số', c: 'len' } : null;
    var p = Math.round((v - truoc) / truoc * 100);
    return { t: (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + '% so với kỳ trước', c: p > 0 ? 'len' : p < 0 ? 'xuong' : '' };
  }

  function ve(g) {
    var gio = new Date(g.capNhat);
    $('capNhat').textContent = 'admin.cozypi.com · ' + (g.email || '') + ' · số lúc ' + gio.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (g.email) $('nguoi').textContent = 'Access · Đăng xuất';

    // KPI
    var k = g.kpi || {}, c = $('kpi'); c.textContent = '';
    var phut = k.giayMoiNguoi && k.giayMoiNguoi.v != null ? Math.floor(k.giayMoiNguoi.v / 60) + ':' + String(k.giayMoiNguoi.v % 60).padStart(2, '0') : null;
    [
      ['Người chơi hoạt động', k.nguoi, null],
      ['Người chơi mới', k.nguoiMoi, null],
      ['Ván đã chơi', k.van, k.vanXong && k.vanXong.v != null ? so(k.vanXong.v) + ' ván chơi tới cuối' : null],
      ['Ván online', k.vanOnline, null],
      ['Phòng online đã tạo', k.phongTao, null],
      ['Thời gian chơi TB', phut == null ? null : { v: phut }, 'phút:giây mỗi người']
    ].forEach(function (x) {
      if (g.khoang === '30m' && x[1] == null) return;
      var o = el('div', 'thach kpi');
      var tren = el('div', 'tieu'); tren.style.justifyContent = 'space-between';
      tren.appendChild(el('span', 'nhan', x[0])); tren.appendChild(el('span', 'nguon n-ga', g.khoang === '30m' ? 'Realtime' : 'GA4'));
      o.appendChild(tren);
      var v = x[1] ? x[1].v : null;
      o.appendChild(el('b', null, typeof v === 'string' ? v : so(v)));
      var d = x[1] ? doi(x[1].v, x[1].truoc) : null;
      var ghi = d ? d.t : x[2] || (v == null ? 'chưa có số (xem lỗi bên dưới)' : '');
      o.appendChild(el('span', 'doi' + (d && d.c ? ' ' + d.c : ''), ghi));
      c.appendChild(o);
    });
    loiO('chuoi', g.loi.chuoi || g.loi.kpi);

    // Biểu đồ
    var hatTen = HAT[g.hat] || g.hat;
    $('tieuChuoi').textContent = 'Người chơi hoạt động theo ' + hatTen.toLowerCase();
    var hc = $('hat'); hc.textContent = '';
    (g.hatDuocChon || []).forEach(function (h) {
      var b = el('button', 'chip' + (h === g.hat ? ' chon' : ''), HAT[h] || h); b.type = 'button';
      b.onclick = function () { tt.hat = h; tai(false); }; hc.appendChild(b);
    });
    $('ghiChuoi').textContent = g.hat === '5m' ? 'Ước lượng từ GA Realtime (người hoạt động mỗi phút, lấy mức cao nhất trong 5 phút)'
      : 'Kỳ ' + g.ky.startDate.split('-').reverse().join('.') + ' → ' + g.ky.endDate.split('-').reverse().join('.') + ' · giờ theo thuộc tính GA';
    var cg = $('chuGiai'); cg.textContent = '';
    g.chuoi.nhom.forEach(function (n) { var s = el('span'); var i = el('i'); i.style.background = MAU[n.id]; s.appendChild(i); s.appendChild(document.createTextNode(n.ten)); cg.appendChild(s); });
    var cot = g.chuoi.cot, nhom = g.chuoi.nhom, vung = $('chuoi'); vung.textContent = '';
    var tong = cot.map(function (_, i) { return nhom.reduce(function (s, n) { return s + (n.gia[i] || 0); }, 0); });
    var max = Math.max.apply(null, tong.concat([1]));
    var buoc = Math.max(1, Math.ceil(cot.length / 24));
    vung.style.minWidth = Math.max(0, cot.length * 9) + 'px';
    cot.forEach(function (ct, i) {
      var o = el('div', 'cot' + (ct.moc ? ' moc' : ''));
      o.title = ct.nhan + ': ' + nhom.map(function (n) { return n.ten + ' ' + so(n.gia[i]); }).join(' · ');
      if (cot.length <= 31) o.appendChild(el('span', 'so', so(tong[i])));
      var khoi = el('div', 'khoi');
      nhom.forEach(function (n) { var p = el('div'); p.style.height = Math.round((n.gia[i] || 0) / max * 190) + 'px'; p.style.background = MAU[n.id]; khoi.appendChild(p); });
      o.appendChild(khoi);
      if (i % buoc === 0 || ct.moc) o.appendChild(el('span', 'nhan', ct.nhan));
      vung.appendChild(o);
    });

    // Nền tảng
    var nt = g.nenTang || [], tnt = nt.reduce(function (s, x) { return s + x.v; }, 0), th = $('thanhNt'), dsNt = $('nenTang');
    th.textContent = ''; dsNt.textContent = '';
    nt.forEach(function (x) {
      var p = tnt ? Math.round(x.v / tnt * 100) : 0;
      var seg = el('div'); seg.style.width = p + '%'; seg.style.background = MAU[x.id]; th.appendChild(seg);
      var d = el('div', 'nt-dong'); var t = el('span'); var i = el('i'); i.style.background = MAU[x.id]; t.appendChild(i); t.appendChild(document.createTextNode(x.ten));
      var v = el('b', null, so(x.v)); v.appendChild(el('small', null, p + '%'));
      d.appendChild(t); d.appendChild(v); dsNt.appendChild(d);
    });
    if (!nt.length) dsNt.appendChild(el('p', 'mo', g.khoang === '30m' ? 'Realtime không tách được nền tảng.' : 'Không có số.'));
    loiO('nenTang', g.loi.nenTang);

    // Heatmap (GA dayOfWeek: 0 = Chủ nhật) — hiển thị T2 → CN
    var hm = $('heat'); hm.textContent = '';
    if (g.heat) {
      var mx = Math.max.apply(null, g.heat.map(function (r) { return Math.max.apply(null, r); }).concat([1]));
      var dinh = { v: -1, d: 0, h: 0 };
      var hang = el('div', 'h gio'); hang.appendChild(el('span'));
      for (var h = 0; h < 24; h++) hang.appendChild(el('span', null, h % 3 === 0 ? String(h).padStart(2, '0') : ''));
      hm.appendChild(hang);
      [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
        var r = el('div', 'h'); r.appendChild(el('span', null, THU[d]));
        g.heat[d].forEach(function (v, h) {
          if (v > dinh.v) dinh = { v: v, d: d, h: h };
          var o = el('div', 'o'); var lv = v ? Math.min(4, Math.ceil(v / mx * 4)) : 0;
          o.style.background = HEAT[lv]; o.title = THU[d] + ' ' + String(h).padStart(2, '0') + ':00 · ' + so(v) + ' ván';
          r.appendChild(o);
        });
        hm.appendChild(r);
      });
      $('ghiHeat').textContent = dinh.v > 0 ? 'Cao nhất: ' + THU[dinh.d] + ' ' + String(dinh.h).padStart(2, '0') + ':00 (' + so(dinh.v) + ' ván)' : '';
    } else {
      $('ghiHeat').textContent = g.khoang === '30m' ? 'Không có ở chế độ 30 phút' : '';
    }
    loiO('heat', g.loi.heat);

    // Danh sách
    var dsv = $('danhSach'); dsv.textContent = '';
    var nuoc = function (code) { try { return tenNuoc ? tenNuoc.of(code) : code; } catch (e) { return code; } };
    [
      ['Quốc gia', g.quocGia, '#fcd34d', nuoc, 'quocGia'],
      ['Chế độ chơi', g.danhSach.che_do, '#86efac', function (x) { return CHE_DO[x] || x; }, 'che_do'],
      ['Cỡ bàn hay chơi', g.danhSach.so_the, '#67e8f9', function (x) { return x + ' thẻ'; }, 'so_the'],
      ['Chủ đề hay chọn', g.danhSach.theme, '#e3a6ff', function (x) { return THEME[x] || x; }, 'theme'],
      ['Cách vào phòng online', g.danhSach.cach_vao, '#fca5a5', function (x) { return CACH_VAO[x] || x; }, 'chuc_nang'],
      ['Phiên bản web', g.danhSach.ban_web, '#8b7dff', function (x) { return x; }, 'ban_web']
    ].forEach(function (x) {
      if (g.khoang === '30m' && x[4] !== 'quocGia') return;
      var o = el('div', 'thach the'); var t = el('div', 'tieu'); t.appendChild(el('h2', 'ktieu', x[0])); t.appendChild(el('span', 'nguon n-ga', 'GA4')); o.appendChild(t);
      var ds = x[1] || [], m = Math.max.apply(null, ds.map(function (r) { return r.v; }).concat([1]));
      ds.forEach(function (r) {
        var d = el('div', 'ds-dong'); var tr = el('div', 'tren'); tr.appendChild(el('span', null, x[3](r.k))); tr.appendChild(el('span', null, so(r.v)));
        var ray = el('div', 'ray'); var f = el('div'); f.style.width = Math.max(2, Math.round(r.v / m * 100)) + '%'; f.style.background = x[2]; ray.appendChild(f);
        d.appendChild(tr); d.appendChild(ray); o.appendChild(d);
      });
      if (g.loi[x[4]]) o.appendChild(el('p', 'loi-o', g.loi[x[4]]));
      else if (!ds.length) o.appendChild(el('p', 'mo', 'Chưa có số trong kỳ này.'));
      dsv.appendChild(o);
    });
  }

  veKhoang(); tai(false); song(false);
  setInterval(function () { if (!document.hidden) song(false); }, 60000);
})();
`;
