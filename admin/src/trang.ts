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
<link rel="stylesheet" href="/app.css?v=__PHIEN__">
<script src="/app.js?v=__PHIEN__" defer></script>
</head>
<body>
<div class="thanh-tai" role="progressbar" aria-label="Đang tải số liệu" aria-hidden="true"></div>
<div class="khung" id="khung">
  <header class="dau">
    <div class="ten">
      <div class="logo" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="12" rx="2"/><rect x="13" y="8" width="8" height="12" rx="2"/></svg></div>
      <div><h1>Lật Thẻ · Quản trị</h1><p class="phu" id="capNhat">admin.cozypi.com</p></div>
    </div>
    <!-- NGAY LÚC NÀY: luôn là 30 phút gần nhất, KHÔNG theo khoảng đang chọn — đặt cạnh tiêu đề, tách khỏi
         phần thống kê (17.11.2026: để dưới hàng nút thì bấm "Hôm nay" vẫn thấy "30 phút qua", gây hiểu lầm) -->
    <section class="song" aria-live="polite" aria-label="Ngay lúc này, 30 phút gần nhất">
      <div class="song-tieu"><span class="cham"></span><div><h2 class="ktieu">Ngay lúc này</h2><span class="phu-nho">30 phút gần nhất · cập nhật mỗi phút</span></div></div>
      <div class="song-so" id="song"><span class="sk" style="width:110px;height:28px"></span><span class="sk" style="width:110px;height:28px"></span><span class="sk" style="width:90px;height:28px"></span></div>
    </section>
  </header>

  <nav class="dieu-khien" aria-label="Khoảng thời gian thống kê">
    <div class="chips" id="khoang" role="group" aria-label="Khoảng thời gian"></div>
    <button class="chip" id="nutTuyChon" type="button" aria-expanded="false">Tuỳ chọn…</button>
    <button class="chip" id="nutMoi" type="button" title="Bỏ qua bộ nhớ tạm, hỏi GA lại">Làm mới</button>
    <a class="nguoi" id="nguoi" href="/cdn-cgi/access/logout" title="Đăng xuất Cloudflare Access">Access</a>
  </nav>

  <form class="tuy-chon thach" id="tuyChon" hidden>
    <label>Từ ngày <input type="date" id="tu" required></label>
    <label>Đến ngày <input type="date" id="den" required></label>
    <button class="chip chon" type="submit">Xem</button>
  </form>

  <div class="bao" id="bao" hidden></div>

  <p class="ky-chon" id="kyChon">Đang tải…</p>

  <!-- TỪNG Ô TẢI RIÊNG (19.11.2026): mỗi khung mang data-phan = tên ô ở /api/o/<phan>; chỉ tải khi cuộn tới gần
       (IntersectionObserver), tối đa 3 ô cùng lúc. Khung xương lần đầu: vẽ đè bằng số thật. -->
  <div class="o-kpi" data-phan="kpi">
    <section class="luoi-kpi" id="kpi">
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
    </section>
    <p class="loi-o" id="loi-kpi" hidden></p>
  </div>

  <section class="hang">
    <div class="thach the bieu-do" data-phan="chuoi">
      <div class="the-dau">
        <div class="tieu"><h2 class="ktieu" id="tieuChuoi">Người chơi</h2></div>
        <div class="chips nho" id="hat" role="group" aria-label="Mỗi cột ứng với"></div>
      </div>
      <div class="the-phu"><span id="ghiChuoi" class="mo"></span><span class="chu-giai" id="chuGiai"></span></div>
      <div class="cuon"><div class="cot-vung" id="chuoi"><span class="sk" style="flex:1;height:190px;align-self:flex-end"></span></div></div>
      <p class="loi-o" id="loi-chuoi" hidden></p>
    </div>
    <div class="thach the nen-tang" data-phan="nen_tang">
      <div class="tieu"><h2 class="ktieu">Nền tảng</h2></div>
      <div class="thanh" id="thanhNt"></div>
      <div id="nenTang"><span class="sk" style="height:40px"></span><span class="sk" style="height:40px"></span><span class="sk" style="height:40px"></span></div>
      <p class="loi-o" id="loi-nen_tang" hidden></p>
    </div>
  </section>

  <section class="thach the" data-phan="heat">
    <div class="the-dau">
      <div class="tieu"><h2 class="ktieu">Giờ cao điểm · ván bắt đầu theo giờ trong tuần</h2></div>
      <span class="mo" id="ghiHeat"></span>
    </div>
    <div class="cuon"><div id="heat" class="heat"><span class="sk" style="height:200px"></span></div></div>
    <p class="loi-o" id="loi-heat" hidden></p>
  </section>

  <!-- Các ô danh sách: JS dựng từ bảng DS (mỗi ô một data-phan) -->
  <section class="luoi-ds" id="danhSach"></section>

  <footer class="chan">
    <span>Số liệu từ Google Analytics · chỉ hỏi khi mở trang · số trong ngày trễ vài giờ · không chạm MySQL/server game</span>
    <span>Số GA là ước lượng: người chặn quảng cáo hoặc từ chối đồng ý thu thập không được đếm.</span>
  </footer>
</div>
</body>
</html>`;

export const CSS = String.raw`
:root{--nen:#0c0e1c;--o:#171a30;--o2:#10132a;--vien:#2a2f52;--day:#070812;--chu:#e6e8f8;--mo:#9aa0c8;--vua:#c9cdea;--tim:#6a5cff;--tim2:#8b7dff;
--web:#67e8f9;--ios:#8b7dff;--android:#c026d3;--tat_ca:#a99fff}
*{box-sizing:border-box}
[hidden]{display:none!important}   /* .tuy-chon{display:flex} đè thuộc tính hidden */
/* ĐANG TẢI: thanh chạy trên đầu + ô mờ nhịp + vòng xoay ở nút vừa bấm + khung xương lần đầu */
.thanh-tai{position:fixed;top:0;left:0;right:0;height:4px;overflow:hidden;z-index:50;opacity:0;transition:opacity .25s;pointer-events:none}
body.dang-tai .thanh-tai{opacity:1}
.thanh-tai::before{content:'';position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:999px;background:linear-gradient(90deg,transparent,#8b7dff,#67e8f9,transparent);animation:tt-chay 1.1s ease-in-out infinite}
@keyframes tt-chay{from{transform:translateX(-100%)}to{transform:translateX(260%)}}
/* ô đang chờ/đang tải số mới thì mờ nhịp — chỉ ô đó, không cả trang */
.cho-o{animation:tt-tho 1.2s ease-in-out infinite}
@keyframes tt-tho{50%{opacity:.5}}
.sk{display:block;border-radius:10px;background:linear-gradient(90deg,#1c2040 25%,#2a3060 50%,#1c2040 75%);background-size:200% 100%;animation:tt-lap 1.3s linear infinite}
@keyframes tt-lap{to{background-position:-200% 0}}
.song-so .sk{display:inline-block}
#nenTang .sk+.sk{margin-top:10px}
/* vòng xoay ĐÈ lên chữ (chữ trong suốt) — nút giữ nguyên bề ngang, không đẩy hàng nút xuống dòng */
.chip.quay{position:relative;color:transparent!important}
.chip.quay::after{content:'';position:absolute;inset:0;margin:auto;width:16px;height:16px;border-radius:999px;border:2px solid #fff;border-right-color:transparent;animation:tt-xoay .7s linear infinite}
@keyframes tt-xoay{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.thanh-tai::before,.sk,.chip.quay::after,.cho-o{animation-duration:3s}}
html{color-scheme:dark}
body{margin:0;background:var(--nen);color:var(--chu);font:16px/1.5 Nunito,system-ui,sans-serif}
.khung{max-width:1320px;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font:800 28px/1.1 'Baloo 2',sans-serif;color:#fff}
.phu{margin:2px 0 0;font-size:13px;color:var(--mo)}
.mo{color:var(--mo);font-size:13px;font-weight:700}
.dau{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.dau .song{margin-left:auto}   /* cạnh tiêu đề, dạt phải; thiếu chỗ thì xuống dòng gọn */
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
.song{padding:8px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;border-radius:18px;border:2px solid #23573a;background:rgba(74,222,128,.06)}
.phu-nho{font-size:12px;color:var(--mo);font-weight:600}
.ky-chon{margin:0;font:700 13px Nunito,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--mo)}
.ky-chon b{color:#fff}
.kpi-dau{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.kpi-dau .nhan{min-width:0}
.song-tieu{display:flex;align-items:center;gap:10px}
.song-tieu .phu-nho{display:block;font-size:11.5px;line-height:1.2}
.song-tieu .ktieu{line-height:1.2}
.cham{width:12px;height:12px;border-radius:999px;background:#4ade80;box-shadow:0 0 0 5px rgba(74,222,128,.18)}
.song-so{display:flex;flex-wrap:wrap;gap:28px}
.song-so b,.kpi b{font:800 26px/1 'Baloo 2',sans-serif;color:#fff}
.song-so span.k{font-size:14px;color:var(--mo);font-weight:700;margin-left:8px}
.luoi-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
/* 8 ô: 4 + 4 cho cân (auto-fit ra 6 + 2 trên màn rộng) */
@media (min-width:900px){.luoi-kpi{grid-template-columns:repeat(4,minmax(0,1fr))}}
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
.chu-giai span,.nt-dong > span{display:inline-flex;align-items:center}
.icon-nt{width:18px;height:18px;flex:none;margin-right:6px}
.chu-giai .icon-nt{width:15px;height:15px;margin-right:5px}
.co{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;margin-right:6px;font-size:1.15em;line-height:1}
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
.o-kpi{display:flex;flex-direction:column;gap:12px}
.ds-than{display:flex;flex-direction:column;gap:14px}
.ds-dong .ngan-xep{display:block;margin-top:2px;font:600 11.5px ui-monospace,Menlo,Consolas,monospace;color:var(--mo);word-break:break-all}
.ghi-o{margin:0;font-size:12.5px;color:var(--mo);font-weight:600}
/* trạng thái tải của từng ô: lỗi + nút Thử lại, hoặc đang hiện số cũ vì GA bận */
.o-trang{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:600}
.o-trang.loi{background:rgba(252,165,165,.1);color:#fca5a5}
.o-trang.cu{background:rgba(251,191,36,.1);color:#fcd34d}
.o-trang .chip{min-height:36px;padding:0 14px;font-size:13px}
.loi-o{margin:0;padding:10px 12px;border-radius:12px;background:rgba(252,165,165,.1);color:#fca5a5;font-size:13px;font-weight:600}
.chan{display:flex;flex-wrap:wrap;gap:10px 20px;font-size:13px;color:var(--mo)}
.song-nuoc{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nuoc{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--o2);font-size:13px;font-weight:700;color:var(--vua)}
.nuoc b{font:800 15px 'Baloo 2',sans-serif;color:#fff}
/* ĐIỆN THOẠI (17.11.2026, chủ dự án: "trên mobile hơi xấu"): khoảng thời gian thành dải vuốt ngang
   một dòng, ô số 2 cột gọn, số trên chữ ở dải 30 phút. */
@media (max-width:700px){
  .khung{padding:14px 12px 40px;gap:14px}
  .ten{gap:10px}
  .logo{width:40px;height:40px;border-radius:14px;box-shadow:0 4px 0 #3b2fb0}
  .logo svg{width:22px;height:22px}
  h1{font-size:20px}
  .phu{font-size:12px}
  .dau{gap:12px}
  .dieu-khien{width:100%;gap:8px}
  #khoang{flex-wrap:nowrap;width:100%;overflow-x:auto;gap:8px;padding:2px 2px 8px;margin:0 -2px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  #khoang::-webkit-scrollbar{display:none}
  #khoang .chip{flex:none;scroll-snap-align:center}
  .chip{padding:0 14px;font-size:13.5px}
  .nguoi{margin-left:auto;padding:0 12px}
  .song{width:100%;padding:12px 14px;gap:8px 16px}
  .song-so{width:100%;gap:12px 22px}
  .song-so b{font-size:26px}
  .song-so span.k{display:block;margin:2px 0 0;font-size:12px}
  .song-nuoc{width:100%}
  .luoi-kpi{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .kpi{padding:12px 14px;gap:4px;border-radius:16px}
  .kpi .nguon{display:none}
  .kpi .nhan{font-size:12.5px;line-height:1.3}
  .kpi b{font-size:26px}
  .kpi .doi{font-size:11.5px;line-height:1.3}
  .the{padding:16px;gap:12px}
  .luoi-ds{gap:12px}
}
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
  var PHEU = { lan_dau: 'Lần đầu vào game', vao_menu: 'Vào menu chọn', bat_dau_van: 'Bắt đầu ván', choi_xong: 'Chơi xong ván' };
  var CHU = { tu_roi: 'Tự rời', huy_phong: 'Chủ phòng tự huỷ', chu_huy: 'Bị chủ phòng huỷ', bi_kick: 'Bị mời ra', phong_dong: 'Phòng đã đóng',
    mat_mang: 'Mất mạng', khac: 'Khác', noi_lai_ok: 'Rớt rồi nối lại được', noi_lai_hong: 'Rớt, không nối lại được',
    mat_nhip: 'Mất nhịp tim', mat_nhip_noi_lai: 'Mất nhịp → nối lại', ack_cham: 'Nước đi xác nhận chậm', ack_hong: 'Nước đi không được xác nhận',
    ban_dung: 'Bàn đứng im', ban_dung_noi_lai: 'Bàn đứng im → nối lại', thuc_noi_lai: 'Mở lại app → nối lại', chap_chon: 'Chập chờn (nối được rồi đứt ngay)', choi: 'đang chơi', ket_qua: 'màn kết quả', cho: 'phòng chờ',
    ok: 'thành công', xong: 'xong', huy: 'huỷ', loi: 'lỗi', cu_qua: 'app quá cũ — cần lên store', moi: 'tài khoản mới',
    google: 'Google', apple: 'Apple', luu_anh: 'Lưu ảnh', anh: 'Chia sẻ ảnh', chu: 'Chia sẻ chữ', copy: 'Chép link',
    '(direct)': 'Vào thẳng', moi_ban: 'Link mời bạn', chia_se: 'Ảnh chia sẻ', 'play.google.com': 'Google Play', 'apps.apple.com': 'App Store' };
  var dich = function (x) { return String(x).split(' · ').map(function (p) { return CHU[p] || p; }).join(' · '); };
  var HEAT = ['#14183a', '#2c2a6e', '#4b3fb3', '#7a63f0', '#c4b5ff'];
  var tenNuoc = null;
  try { tenNuoc = new Intl.DisplayNames(['vi'], { type: 'region' }); } catch (e) { /* trình duyệt cũ */ }
  // Cờ = 2 ký tự "regional indicator" từ mã ISO (VN → 🇻🇳). Không phải mã 2 chữ cái thì 🌐.
  function co(code) {
    if (!/^[A-Za-z]{2}$/.test(code || '')) return '\uD83C\uDF10';
    return String.fromCodePoint.apply(null, code.toUpperCase().split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; }));
  }
  function coNuoc(code) { var s = el('span', 'co', co(code)); s.setAttribute('aria-hidden', 'true'); return s; }
  // Icon nền tảng (SVG tự vẽ, tô theo màu nền tảng). id lạ → null, giữ ô màu cũ.
  var ICON_NT = {
    web: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    ios: '<path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/>',
    android: '<path fill="currentColor" d="M5 10.5h14V18a1.5 1.5 0 0 1-1.5 1.5H16V22h-2v-2.5h-4V22H8v-2.5H6.5A1.5 1.5 0 0 1 5 18zM2.5 10.5a1.25 1.25 0 0 1 2.5 0v5a1.25 1.25 0 0 1-2.5 0zm16.5 0a1.25 1.25 0 0 1 2.5 0v5a1.25 1.25 0 0 1-2.5 0zM5 9.5a7 7 0 0 1 3.6-6.1L7.3 1.5l.8-.5 1.4 2a7 7 0 0 1 5 0l1.4-2 .8.5-1.3 1.9A7 7 0 0 1 19 9.5zm4.3-3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm5.4 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/>'
  };
  function iconNt(id) {
    if (!ICON_NT[id]) { var i = el('i'); i.style.background = MAU[id]; return i; }
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon-nt'); s.setAttribute('aria-hidden', 'true');
    s.style.color = MAU[id]; s.innerHTML = ICON_NT[id]; return s;
  }
  function tenNuocVi(code) { try { return tenNuoc && code && code !== '(not set)' ? tenNuoc.of(code) : (code || '?'); } catch (e) { return code; } }

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
    var dc = c.querySelector('.chon');
    if (dc && c.scrollWidth > c.clientWidth) c.scrollLeft = dc.offsetLeft - (c.clientWidth - dc.offsetWidth) / 2;
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

  /*
   * TẢI TỪNG Ô (19.11.2026, chủ dự án: "có thể lazyload từng thành phần ko?"). Trước đây một lần mở trang
   * bắn 29 báo cáo GA cùng lúc → GA4 (10 request đồng thời mỗi thuộc tính) trả 429. Nay mỗi khung
   * [data-phan] chỉ tải khi cuộn tới gần (rootMargin 200px), qua hàng đợi tối đa 3 ô cùng lúc. Ô lỗi hiện
   * lỗi riêng + nút "Thử lại"; GA bận (429/503) thì tự thử lại theo Retry-After. Đổi khoảng → huỷ lượt đang
   * tải (AbortController). Tự làm mới chỉ làm mới ô đang hiện.
   */
  var PHAN = ['kpi', 'chuoi', 'nen_tang', 'quoc_gia', 'heat', 'choi', 'nguoi_moi', 'online', 'loi_js', 'khac'];
  var TOI_DA = 3;
  var o = {};
  PHAN.forEach(function (p) { o[p] = { tt: 'chua', g: null, lucHoi: 0, lan: 0, hen: 0, moi: false }; });
  var theHe = 0, ac = new AbortController(), hang = [], dangChay = 0, kyHien = null, emailHien = '';

  var nuocVi = function (code) { try { return tenNuoc ? tenNuoc.of(code) : code; } catch (e) { return code; } };
  var nguyen = function (x) { return x; };
  // phan = ô ở server · khoa = khoá trong danhSach (quocGia: g.quocGia) · loi = khoá trong g.loi
  var DS = [
    { phan: 'quoc_gia', khoa: 'quocGia', tieu: 'Quốc gia', mau: '#fcd34d', ten: nuocVi, loi: 'quoc_gia' },
    { phan: 'choi', khoa: 'che_do', tieu: 'Chế độ chơi', mau: '#86efac', ten: function (x) { return CHE_DO[x] || x; }, loi: 'che_do' },
    { phan: 'choi', khoa: 'so_the', tieu: 'Cỡ bàn hay chơi', mau: '#67e8f9', ten: function (x) { return x + ' thẻ'; }, loi: 'so_the' },
    { phan: 'choi', khoa: 'theme', tieu: 'Chủ đề hay chọn', mau: '#e3a6ff', ten: function (x) { return THEME[x] || x; }, loi: 'theme' },
    { phan: 'choi', khoa: 'cach_vao', tieu: 'Cách vào phòng online', mau: '#fca5a5', ten: function (x) { return CACH_VAO[x] || x; }, loi: 'chuc_nang' },
    { phan: 'choi', khoa: 'ban_web', tieu: 'Phiên bản web', mau: '#8b7dff', ten: nguyen, loi: 'ban_web' },
    { phan: 'nguoi_moi', khoa: 'pheu', tieu: 'Phễu người mới', mau: '#86efac', ten: function (x) { return PHEU[x] || x; }, loi: 'pheu',
      so: function (r, ds) { var dau = ds[0] && ds[0].v; return so(r.v) + (dau ? ' · ' + Math.round(r.v / dau * 100) + '%' : ''); } },
    { phan: 'nguoi_moi', khoa: 'nguon', tieu: 'Nguồn người chơi', mau: '#fcd34d', ten: dich, loi: 'nguon' },
    { phan: 'nguoi_moi', khoa: 'man_kho', tieu: 'Màn chiến dịch khó (thua + bỏ dở)', mau: '#fca5a5', ten: function (x) { return 'Màn ' + x; }, loi: 'man_kho', tran: 100,
      so: function (r) { return r.v + '% · ' + so(r.luot) + ' lượt'; } },
    { phan: 'loi_js', khoa: 'loi_js', tieu: 'Lỗi JavaScript', mau: '#fca5a5', ten: nguyen, loi: 'loi_js' },
    { phan: 'online', khoa: 'roi_phong', tieu: 'Rời phòng online vì', mau: '#67e8f9', ten: dich, loi: 'roi_phong' },
    { phan: 'online', khoa: 'ket_noi', tieu: 'Kết nối online', mau: '#67e8f9', ten: dich, loi: 'ket_noi' },
    { phan: 'online', khoa: 'su_co', tieu: 'Sự cố mạng online (app tự cứu)', mau: '#fca5a5', ten: dich, loi: 'su_co' },
    { phan: 'khac', khoa: 'dang_nhap', tieu: 'Đăng nhập', mau: '#8b7dff', ten: dich, loi: 'dang_nhap' },
    { phan: 'khac', khoa: 'chia_se', tieu: 'Chia sẻ', mau: '#e3a6ff', ten: dich, loi: 'chia_se' },
    { phan: 'khac', khoa: 'ota', tieu: 'Cập nhật nóng (OTA)', mau: '#86efac', ten: dich, loi: 'ota' }
  ];

  function dungDs() {
    var c = $('danhSach');
    DS.forEach(function (x, i) {
      var b = el('div', 'thach the o-ds'); b.setAttribute('data-phan', x.phan); b.setAttribute('data-ds', String(i));
      var t = el('div', 'tieu'); t.appendChild(el('h2', 'ktieu', x.tieu)); b.appendChild(t);
      var than = el('div', 'ds-than');
      [['40%', 14], ['100%', 22], ['100%', 22]].forEach(function (k) { var s = el('span', 'sk'); s.style.width = k[0]; s.style.height = k[1] + 'px'; than.appendChild(s); });
      b.appendChild(than); c.appendChild(b);
    });
  }
  // 30 phút (GA Realtime) chỉ có Quốc gia trong các ô danh sách → ẩn ô khác (ô ẩn không bị tải)
  function apDungKhoang() {
    Array.prototype.forEach.call(document.querySelectorAll('.o-ds'), function (b) {
      b.hidden = tt.khoang === '30m' && b.getAttribute('data-phan') !== 'quoc_gia';
    });
  }

  function cacO(p) { return Array.prototype.slice.call(document.querySelectorAll('[data-phan="' + p + '"]')); }
  function gan(p) { return cacO(p).some(function (e) { return e._gan && !e.hidden; }); }
  function moNhip(p, bat) { cacO(p).forEach(function (e) { e.classList.toggle('cho-o', bat); }); }

  // Thanh chạy trên đầu khi còn ô đang tải; hết thì tắt vòng xoay ở nút vừa bấm.
  function batTai() {
    var bat = dangChay > 0 || hang.length > 0;
    document.body.classList.toggle('dang-tai', bat);
    $('khung').setAttribute('aria-busy', String(bat));
    if (!bat) quay(null);
  }
  function quay(nut) {
    Array.prototype.forEach.call(document.querySelectorAll('.chip.quay'), function (n) { n.classList.remove('quay'); });
    if (nut) nut.classList.add('quay');
  }

  function thamSo(moi) {
    var q = new URLSearchParams({ khoang: tt.khoang });
    if (tt.hat) q.set('hat', tt.hat);
    if (tt.khoang === 'custom') { q.set('tu', tt.tu); q.set('den', tt.den); }
    if (moi) q.set('moi', '1');
    return q.toString();
  }

  function xepHang(p) {
    var s = o[p];
    if (s.tt === 'cho' || s.tt === 'dang') return;
    clearTimeout(s.hen); s.hen = 0;
    s.tt = 'cho'; hang.push(p); moNhip(p, true);
    chay();
  }
  function chay() {
    while (dangChay < TOI_DA && hang.length) {
      var p = hang.shift();
      if (o[p].tt !== 'cho') continue;
      dangChay++;
      taiO(p).then(function () { dangChay--; chay(); });
    }
    batTai();
  }

  // Không bao giờ reject. Lượt cũ (đã đổi khoảng: theHe khác; đã hỏi lại ô: lan khác) bị bỏ qua.
  function taiO(p) {
    var s = o[p], the = theHe, lan = ++s.lan, moi = s.moi;
    s.moi = false; s.tt = 'dang'; s.lucHoi = Date.now();
    var conDung = function () { return the === theHe && lan === s.lan; };
    return fetch('/api/o/' + p + '?' + thamSo(moi), { credentials: 'same-origin', signal: ac.signal }).then(function (r) {
      if (r.status === 403 || r.redirected) { location.reload(); return null; }
      var sau = parseInt(r.headers.get('retry-after') || '', 10) || 0;
      return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j, sau: sau }; });
    }).then(function (kq) {
      if (!kq || !conDung()) return;
      moNhip(p, false);
      if (kq.j.chuaCauHinh) {
        s.tt = 'loi';
        bao('Chưa nối GA: cần đặt bí mật <code>GA_SA_JSON</code> và <code>GA_PROPERTY_ID</code> cho Worker <code>latthe-admin</code> (xem admin/README.md).');
        trangThai(p, 'Chưa nối GA.', 0); return;
      }
      if (kq.s !== 200) {
        s.tt = 'loi';
        var ban = kq.s === 429 || kq.s === 503;
        trangThai(p, kq.j.loiChung || ('Lỗi ' + kq.s), ban ? (kq.sau || 5) : 0);
        return;
      }
      s.tt = 'xong'; s.g = kq.j;
      if (kq.j.email) { emailHien = kq.j.email; $('nguoi').textContent = 'Đăng xuất'; }
      if (!kyHien && kq.j.ky) { kyHien = kq.j.ky; veKy(kq.j); }
      try { VE[p](kq.j); } catch (e) { trangThai(p, 'Lỗi vẽ ô: ' + e.message, 0); return; }
      trangThai(p, kq.j.cu ? 'cu' : '', 0);
    }).catch(function (e) {
      if (!conDung()) return;               // gồm AbortError khi đổi khoảng
      moNhip(p, false); s.tt = 'loi';
      trangThai(p, 'Không tải được: ' + e.message, 0);
    }).then(function () { if (the === theHe) capNhatTuoi(); });
  }

  function giayDoc(n) { return n >= 120 ? Math.round(n / 60) + ' phút' : n + ' giây'; }
  function gioPhut(iso) { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }

  // Dòng trạng thái của ô: '' = ẩn · 'cu' = đang hiện số cũ · chữ khác = lỗi + nút Thử lại (sau > 0: tự thử lại)
  function trangThai(p, msg, sau) {
    var s = o[p];
    cacO(p).forEach(function (e) {
      var t = e.querySelector('.o-trang');
      if (!t) { t = el('div', 'o-trang'); t.setAttribute('role', 'status'); e.appendChild(t); }
      t.textContent = ''; t.className = 'o-trang'; t.hidden = !msg;
      if (!msg) return;
      if (msg === 'cu') {
        t.classList.add('cu');
        t.textContent = 'Đang hiện số cũ lúc ' + gioPhut(s.g.capNhat) + ' — GA đang bận, sẽ tự hỏi lại.';
        return;
      }
      t.classList.add('loi');
      t.appendChild(el('span', null, msg + (sau ? ' · tự thử lại sau ' + giayDoc(sau) : '')));
      var b = el('button', 'chip', 'Thử lại'); b.type = 'button';
      b.onclick = function () { xepHang(p); };
      t.appendChild(b);
    });
    if (sau) s.hen = setTimeout(function () { s.hen = 0; if (s.tt !== 'loi') return; if (gan(p)) xepHang(p); else s.tt = 'chua'; }, sau * 1000);
  }

  // Đổi khoảng / Làm mới: huỷ lượt đang tải, mọi ô về "chưa tải", tải lại ô đang hiện (ô khác tải khi cuộn tới).
  function tai(moi, nutBam) {
    theHe++; ac.abort(); ac = new AbortController(); hang = [];
    kyHien = null;
    quay(nutBam || (moi ? $('nutMoi') : document.querySelector('#khoang .chip.chon') || $('nutTuyChon')));
    $('capNhat').textContent = 'admin.cozypi.com · đang tải…';
    bao('');
    apDungKhoang();
    PHAN.forEach(function (p) {
      var s = o[p]; clearTimeout(s.hen); s.hen = 0; s.tt = 'chua'; s.g = null; s.moi = !!moi;
      moNhip(p, true);
      cacO(p).forEach(function (e) { var t = e.querySelector('.o-trang'); if (t) t.hidden = true; });
    });
    PHAN.forEach(function (p) { if (gan(p)) xepHang(p); });
  }

  function song(moi) {
    fetch('/api/dang-dien-ra' + (moi ? '?moi=1' : ''), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var c = $('song'); c.textContent = '';
      if (!j || j.chuaCauHinh) { c.appendChild(el('span', 'mo', 'chưa có số')); return; }
      var nuoc = Array.isArray(j.quocGia) ? j.quocGia : [];
      [[j.nguoi, 'người đang chơi'], [j.van, 'ván bắt đầu']].forEach(function (x) {
        var d = el('div'); d.appendChild(el('b', null, so(x[0]))); d.appendChild(el('span', 'k', x[1])); c.appendChild(d);
      });
      var dn = el('div', 'song-nuoc');
      if (!nuoc.length) dn.appendChild(el('span', 'k', j.quocGia ? 'chưa có nước nào' : 'chưa có số nước'));
      nuoc.forEach(function (r) { var t = el('span', 'nuoc'); t.appendChild(coNuoc(r.k)); t.appendChild(document.createTextNode(tenNuocVi(r.k) + ' ')); t.appendChild(el('b', null, so(r.v))); dn.appendChild(t); });
      c.appendChild(dn);
    }).catch(function () {});
  }

  function doi(v, truoc) {
    if (v == null || truoc == null) return null;
    if (!truoc) return v ? { t: 'mới có số', c: 'len' } : null;
    var p = Math.round((v - truoc) / truoc * 100);
    return { t: (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + '% so với kỳ trước', c: p > 0 ? 'len' : p < 0 ? 'xuong' : '' };
  }
  function ngay(d) { return d.split('-').reverse().join('.'); }

  function veKy(g) {
    var tenKhoang = (KHOANG.find(function (k) { return k[0] === g.khoang; }) || ['', 'Tuỳ chọn'])[1];
    var kc = $('kyChon'); kc.textContent = 'Thống kê theo khoảng: ';
    kc.appendChild(el('b', null, tenKhoang + (g.ky ? ' · ' + (g.ky.startDate === g.ky.endDate ? ngay(g.ky.startDate) : ngay(g.ky.startDate) + ' → ' + ngay(g.ky.endDate)) : '')));
  }

  function veKpi(g) {
    var k = g.kpi || {}, c = $('kpi'); c.textContent = '';
    var phut = k.giayMoiNguoi && k.giayMoiNguoi.v != null ? Math.floor(k.giayMoiNguoi.v / 60) + ':' + String(k.giayMoiNguoi.v % 60).padStart(2, '0') : null;
    [
      ['Người chơi hoạt động', k.nguoi, null],
      ['Người chơi mới', k.nguoiMoi, null],
      ['Ván đã chơi', k.van, k.vanXong && k.vanXong.v != null ? so(k.vanXong.v) + ' ván chơi tới cuối' : null],
      ['Ván online', k.vanOnline, null],
      ['Phòng online đã tạo', k.phongTao, null],
      ['Người quay lại', k.quayLai && k.quayLai.v != null ? { v: k.quayLai.v + '%' } : k.quayLai, 'trong số người chơi của kỳ'],
      ['Tài khoản mới', k.taiKhoanMoi, 'đăng nhập Google/Apple lần đầu'],
      ['Thời gian chơi TB', phut == null ? k.giayMoiNguoi : { v: phut }, 'phút:giây mỗi người']
    ].forEach(function (x) {
      if (g.khoang === '30m' && x[1] == null) return;
      var b = el('div', 'thach kpi');
      var tren = el('div', 'kpi-dau');
      tren.appendChild(el('span', 'nhan', x[0]));
      b.appendChild(tren);
      var v = x[1] ? x[1].v : null;
      b.appendChild(el('b', null, typeof v === 'string' ? v : so(v)));
      var d = x[1] ? doi(x[1].v, x[1].truoc) : null;
      var ghi = d ? d.t : x[2] || (v == null ? 'chưa có số (xem lỗi bên dưới)' : '');
      b.appendChild(el('span', 'doi' + (d && d.c ? ' ' + d.c : ''), ghi));
      c.appendChild(b);
    });
    var l = g.loi || {};
    loiO('kpi', [l.kpi, l.che_do, l.chuc_nang, l.dang_nhap].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · '));
  }

  function veChuoi(g) {
    var hatTen = HAT[g.hat] || g.hat;
    $('tieuChuoi').textContent = 'Người chơi hoạt động theo ' + hatTen.toLowerCase();
    var hc = $('hat'); hc.textContent = '';
    (g.hatDuocChon || []).forEach(function (h) {
      var b = el('button', 'chip' + (h === g.hat ? ' chon' : ''), HAT[h] || h); b.type = 'button';
      // đổi hạt chỉ đổi ô biểu đồ — các ô khác không phụ thuộc hạt
      b.onclick = function () { tt.hat = h; quay(b); o.chuoi.tt = 'chua'; xepHang('chuoi'); };
      hc.appendChild(b);
    });
    $('ghiChuoi').textContent = g.hat === '5m' ? 'Ước lượng từ GA Realtime (người hoạt động mỗi phút, lấy mức cao nhất trong 5 phút)'
      : 'Kỳ ' + ngay(g.ky.startDate) + ' → ' + ngay(g.ky.endDate) + ' · giờ theo thuộc tính GA';
    var cg = $('chuGiai'); cg.textContent = '';
    var ch = g.chuoi || { cot: [], nhom: [] };
    ch.nhom.forEach(function (n) { var s = el('span'); s.appendChild(iconNt(n.id)); s.appendChild(document.createTextNode(n.ten)); cg.appendChild(s); });
    var cot = ch.cot, nhom = ch.nhom, vung = $('chuoi'); vung.textContent = '';
    var tong = cot.map(function (_, i) { return nhom.reduce(function (s, n) { return s + (n.gia[i] || 0); }, 0); });
    var max = Math.max.apply(null, tong.concat([1]));
    var buoc = Math.max(1, Math.ceil(cot.length / 24));
    vung.style.minWidth = Math.max(0, cot.length * 9) + 'px';
    cot.forEach(function (ct, i) {
      var b = el('div', 'cot' + (ct.moc ? ' moc' : ''));
      b.title = ct.nhan + ': ' + nhom.map(function (n) { return n.ten + ' ' + so(n.gia[i]); }).join(' · ');
      if (cot.length <= 31) b.appendChild(el('span', 'so', so(tong[i])));
      var khoi = el('div', 'khoi');
      nhom.forEach(function (n) { var q = el('div'); q.style.height = Math.round((n.gia[i] || 0) / max * 190) + 'px'; q.style.background = MAU[n.id]; khoi.appendChild(q); });
      b.appendChild(khoi);
      if (i % buoc === 0 || ct.moc) b.appendChild(el('span', 'nhan', ct.nhan));
      vung.appendChild(b);
    });
    loiO('chuoi', (g.loi || {}).chuoi);
  }

  function veNenTang(g) {
    var nt = g.nenTang || [], tnt = nt.reduce(function (s, x) { return s + x.v; }, 0), th = $('thanhNt'), dsNt = $('nenTang');
    th.textContent = ''; dsNt.textContent = '';
    nt.forEach(function (x) {
      var p = tnt ? Math.round(x.v / tnt * 100) : 0;
      var seg = el('div'); seg.style.width = p + '%'; seg.style.background = MAU[x.id]; th.appendChild(seg);
      var d = el('div', 'nt-dong'); var t = el('span'); t.appendChild(iconNt(x.id)); t.appendChild(document.createTextNode(x.ten));
      var v = el('b', null, so(x.v)); v.appendChild(el('small', null, p + '%'));
      d.appendChild(t); d.appendChild(v); dsNt.appendChild(d);
    });
    if (!nt.length) dsNt.appendChild(el('p', 'mo', g.khongCo ? 'Realtime không tách được nền tảng.' : 'Không có số.'));
    loiO('nen_tang', (g.loi || {}).nen_tang);
  }

  // Heatmap (GA dayOfWeek: 0 = Chủ nhật) — hiển thị T2 → CN
  function veHeat(g) {
    var hm = $('heat'); hm.textContent = '';
    if (g.heat) {
      var mx = Math.max.apply(null, g.heat.map(function (r) { return Math.max.apply(null, r); }).concat([1]));
      var dinh = { v: -1, d: 0, h: 0 };
      var dongGio = el('div', 'h gio'); dongGio.appendChild(el('span'));
      for (var h = 0; h < 24; h++) dongGio.appendChild(el('span', null, h % 3 === 0 ? String(h).padStart(2, '0') : ''));
      hm.appendChild(dongGio);
      [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
        var r = el('div', 'h'); r.appendChild(el('span', null, THU[d]));
        g.heat[d].forEach(function (v, h) {
          if (v > dinh.v) dinh = { v: v, d: d, h: h };
          var b = el('div', 'o'); var lv = v ? Math.min(4, Math.ceil(v / mx * 4)) : 0;
          b.style.background = HEAT[lv]; b.title = THU[d] + ' ' + String(h).padStart(2, '0') + ':00 · ' + so(v) + ' ván';
          r.appendChild(b);
        });
        hm.appendChild(r);
      });
      $('ghiHeat').textContent = dinh.v > 0 ? 'Cao nhất: ' + THU[dinh.d] + ' ' + String(dinh.h).padStart(2, '0') + ':00 (' + so(dinh.v) + ' ván)' : '';
    } else {
      $('ghiHeat').textContent = g.khongCo ? 'Không có ở chế độ 30 phút' : '';
    }
    loiO('heat', (g.loi || {}).heat);
  }

  // Các ô danh sách của MỘT phần (vd 'choi' vẽ 5 ô)
  function veDs(g) {
    var loi = g.loi || {}, ghi = g.ghiChu || {};
    cacO(g.phan).forEach(function (b) {
      var x = DS[Number(b.getAttribute('data-ds'))]; if (!x) return;
      var than = b.querySelector('.ds-than'); than.textContent = '';
      var ds = (x.khoa === 'quocGia' ? g.quocGia : (g.danhSach || {})[x.khoa]) || [];
      var m = x.tran || Math.max.apply(null, ds.map(function (r) { return r.v; }).concat([1]));
      ds.forEach(function (r) {
        var d = el('div', 'ds-dong'); var tr = el('div', 'tren'); var nh = el('span');
        if (x.khoa === 'quocGia') nh.appendChild(coNuoc(r.k));
        nh.appendChild(document.createTextNode(x.ten(r.k)));
        if (r.phu) nh.appendChild(el('small', 'ngan-xep', r.phu));       // lỗi JS: chỗ lỗi trong mã (tệp:dòng:cột)
        tr.appendChild(nh); tr.appendChild(el('span', null, x.so ? x.so(r, ds) : so(r.v)));
        var ray = el('div', 'ray'); var f = el('div'); f.style.width = Math.max(2, Math.round(r.v / m * 100)) + '%'; f.style.background = x.mau; ray.appendChild(f);
        d.appendChild(tr); d.appendChild(ray); than.appendChild(d);
      });
      if (loi[x.loi]) than.appendChild(el('p', 'loi-o', loi[x.loi]));
      else if (!ds.length) than.appendChild(el('p', 'mo', 'Chưa có số trong kỳ này.'));
      if (ghi[x.khoa]) than.appendChild(el('p', 'ghi-o', ghi[x.khoa]));
    });
  }

  var VE = { kpi: veKpi, chuoi: veChuoi, nen_tang: veNenTang, heat: veHeat,
    quoc_gia: veDs, choi: veDs, nguoi_moi: veDs, online: veDs, loi_js: veDs, khac: veDs };

  /*
   * TỰ LÀM MỚI (17.11.2026): khoảng có HÔM NAY thì số còn đổi → tự hỏi lại khi số đã cũ 5 phút (đúng bằng
   * thời gian server nhớ tạm — hỏi sớm hơn cũng chỉ nhận lại số cũ); khoảng 30 phút thì 1 phút. Khoảng đã
   * qua (Hôm qua…) không làm mới. Chỉ chạy khi tab đang hiện, và (19.11.2026) chỉ ô đang hiện — ô khác
   * hỏi lại khi cuộn tới. Ô đang hiện số cũ (GA bận) cũng hỏi lại, nhưng mỗi ô cách nhau ≥ 1 phút.
   */
  var lucSong = Date.now();
  function homNay() { return new Date().toLocaleDateString('sv-SE'); }
  function conChay() { return tt.khoang === '30m' || (!!kyHien && kyHien.endDate >= homNay()); }
  function hanMs() { return tt.khoang === '30m' ? 60000 : 300000; }
  function canMoi(p) {
    var s = o[p], bay = Date.now();
    if (s.tt !== 'xong' || !s.g || bay - s.lucHoi < 60000) return false;
    return !!s.g.cu || (conChay() && bay - new Date(s.g.capNhat).getTime() >= hanMs());
  }
  // Giờ số = số CŨ NHẤT trong các ô đã tải
  function capNhatTuoi() {
    var cu = null;
    PHAN.forEach(function (p) { var g = o[p].g; if (o[p].tt === 'xong' && g && g.capNhat && (!cu || g.capNhat < cu)) cu = g.capNhat; });
    if (!cu) return;
    var phut = Math.floor((Date.now() - new Date(cu).getTime()) / 60000);
    $('capNhat').textContent = 'admin.cozypi.com · ' + (emailHien || '') + ' · số lúc ' + gioPhut(cu)
      + ' (' + (phut < 1 ? 'vừa xong' : phut + ' phút trước') + ')' + (conChay() ? ' · tự làm mới' : '');
  }
  function kiemMoi() {
    if (document.hidden) return;
    capNhatTuoi();
    PHAN.forEach(function (p) { if (gan(p) && canMoi(p)) xepHang(p); });
  }

  dungDs(); veKhoang(); tai(false); song(false);
  // Quan sát MỌI khung [data-phan]: tới gần màn hình 200px thì tải (lần đầu) hoặc làm mới (nếu số đã cũ).
  var cacKhung = Array.prototype.slice.call(document.querySelectorAll('[data-phan]'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ds) {
      ds.forEach(function (d) { d.target._gan = d.isIntersecting; });
      PHAN.forEach(function (p) { if (gan(p) && (o[p].tt === 'chua' || canMoi(p))) xepHang(p); });
      batTai();
    }, { rootMargin: '200px 0px' });
    cacKhung.forEach(function (e) { io.observe(e); });
  } else {
    cacKhung.forEach(function (e) { e._gan = true; });
    PHAN.forEach(function (p) { if (gan(p)) xepHang(p); });
  }
  setInterval(function () { if (!document.hidden) { song(false); lucSong = Date.now(); } }, 60000);
  setInterval(kiemMoi, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (Date.now() - lucSong > 60000) { song(false); lucSong = Date.now(); }
    kiemMoi();
  });
})();
`;
