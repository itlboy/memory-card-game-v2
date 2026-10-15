/*
 * Menu ngôn ngữ + nút store cho các trang công khai (about/changes/support/privacy).
 *
 * CHỮ ĐÃ DỰNG SẴN theo từng ngôn ngữ lúc build (tools/dung-trang-cong-khai.mjs):
 * tiếng Anh ở /<trang>.html, ngôn ngữ khác ở /<mã>/<trang>.html — để Google đọc được
 * mọi bản (SEO, chủ dự án 15.10.2026). File này KHÔNG còn đổi chữ lúc chạy.
 *
 * Tự chuyển ngôn ngữ CHỈ ở bản tiếng Anh, và chỉ khi người xem đã chọn ngôn ngữ khác
 * (localStorage `mm.lang`, dùng chung với game cùng tên miền) hoặc trình duyệt nói
 * tiếng khác. Không chuyển khi link có ?lang=en, và không chuyển khỏi một bản dịch
 * người ta mở thẳng (vd. từ kết quả Google). Máy của Google dùng tiếng Anh nên không
 * bao giờ bị chuyển hướng.
 */
(() => {
  const LANGS = [
    ['en', 'English'], ['es', 'Español'], ['pt', 'Português (Brasil)'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['it', 'Italiano'], ['tr', 'Türkçe'], ['ja', '日本語'], ['ko', '한국어'],
    ['zh', '简体中文'], ['zh-TW', '繁體中文'], ['ru', 'Русский'],
    ['id', 'Bahasa Indonesia'], ['th', 'ไทย'], ['vi', 'Tiếng Việt']
  ];
  const IDS = LANGS.map((l) => l[0]);

  /*
   * NÚT STORE: bật khi app ĐÃ lên store công khai. Chưa lên thì nút hiện "Sắp có"
   * (link chết làm trang trông như lừa). App Store: 1.3.0 đang chờ duyệt;
   * Google Play: mới ở kênh thử nội bộ (15.10.2026) — lên rồi thì đổi `on`.
   */
  const STORE = {
    ios: { on: false, url: 'https://apps.apple.com/app/id6822105774' },
    android: { on: false, url: 'https://play.google.com/store/apps/details?id=com.cozypi.flipmatch' }
  };

  const doc = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ghi = (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } };

  // Trang đang ở ngôn ngữ nào: /vi/about.html → vi; /about.html (hay /about) → en
  const m = location.pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\/([a-z]+)(?:\.html)?$/);
  const langTrang = m && IDS.includes(m[1]) ? m[1] : 'en';
  const trang = (m ? m[2] : location.pathname.replace(/^\//, '').replace(/\.html$/, '')) || 'about';
  const diaChi = (l) => (l === 'en' ? `/${trang}.html` : `/${l}/${trang}.html`);

  function trinhDuyet() {
    for (const l of navigator.languages || [navigator.language || 'en']) {
      const tag = String(l).toLowerCase();
      // Trung PHỒN THỂ: Đài Loan / Hồng Kông / Macao / "Hant" — trước khi cắt về "zh"
      if (/^zh-(hant|tw|hk|mo)\b/.test(tag)) return 'zh-TW';
      const ma = tag.split('-')[0];
      if (IDS.includes(ma)) return ma;
    }
    return 'en';
  }

  const q = new URLSearchParams(location.search).get('lang');
  if (q && IDS.includes(q)) ghi('mm.lang', q);
  if (langTrang === 'en' && q !== 'en') {
    const luu = doc('mm.lang');
    const muon = luu && IDS.includes(luu) ? luu : trinhDuyet();
    if (muon !== 'en') { location.replace(diaChi(muon) + location.hash); return; }
  }

  /*
   * Google Analytics 4 (cùng mã với game: tài khoản "Cozy Pi"). Tắt Google Signals +
   * cá nhân hoá quảng cáo; người ở châu Âu (đoán theo múi giờ) chạy KHÔNG cookie — không
   * cần hộp hỏi đồng ý (chủ dự án 15.10.2026). Không chạy ở localhost / trình duyệt tự động.
   */
  (() => {
    const GA = 'G-MZ4MDWZRH3';
    if (navigator.webdriver || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
    let eu = false;
    try { eu = /^Europe\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* bỏ qua */ }
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: eu ? 'denied' : 'granted' });
    gtag('js', new Date());
    gtag('config', GA, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
    document.head.appendChild(s);
  })();

  document.querySelectorAll('[data-nam]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  document.querySelectorAll('[data-store]').forEach((a) => {
    const s = STORE[a.dataset.store];
    if (!s) return;
    if (s.on) { a.href = s.url; a.removeAttribute('aria-disabled'); a.querySelector('[data-soon]')?.remove(); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  });

  const sel = document.querySelector('.lang select');
  if (sel) {
    sel.innerHTML = LANGS.map(([id, ten]) => `<option value="${id}"${id === langTrang ? ' selected' : ''}>${ten}</option>`).join('');
    sel.addEventListener('change', () => {
      ghi('mm.lang', sel.value);
      location.href = diaChi(sel.value) + (sel.value === 'en' ? '?lang=en' : '') + location.hash;
    });
  }
})();
