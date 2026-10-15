/*
 * Ngôn ngữ + nút store cho các trang công khai (about/support/privacy/changes).
 *
 * Tiếng Anh viết SẴN trong HTML (máy tìm kiếm, trình duyệt tắt JS vẫn đọc được);
 * ngôn ngữ khác nạp từ site/i18n/<mã>.json rồi thay chữ theo thuộc tính:
 *   data-t="khoá"        → textContent
 *   data-th="khoá"       → innerHTML (chỉ chữ của CHÍNH ta trong i18n/*.json)
 *   data-t-alt / -aria   → thuộc tính alt / aria-label
 * Chọn ngôn ngữ: ?lang= → lựa chọn đã lưu của APP (localStorage `mm.lang`, cùng
 * tên miền nên trang và game nói cùng một thứ tiếng) → ngôn ngữ trình duyệt → en.
 * Đổi trong menu là ghi `mm.lang` — game mở ra cũng theo ngôn ngữ đó.
 */
(() => {
  const LANGS = [
    ['en', 'English'], ['es', 'Español'], ['pt', 'Português (Brasil)'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '简体中文'], ['ru', 'Русский'],
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
  function chon() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && IDS.includes(q)) return q;
    const luu = doc('mm.lang');
    if (luu && IDS.includes(luu)) return luu;
    for (const l of navigator.languages || [navigator.language || 'en']) {
      const ma = String(l).toLowerCase().split('-')[0];
      if (IDS.includes(ma)) return ma;
    }
    return 'en';
  }
  const lang = chon();
  const base = new URL('./', document.currentScript.src);

  function apDung(t) {
    const get = (k) => (k in t ? t[k] : null);
    document.querySelectorAll('[data-t]').forEach((el) => { const v = get(el.dataset.t); if (v != null) el.textContent = v; });
    document.querySelectorAll('[data-th]').forEach((el) => { const v = get(el.dataset.th); if (v != null) el.innerHTML = v; });
    document.querySelectorAll('[data-t-alt]').forEach((el) => { const v = get(el.dataset.tAlt); if (v != null) el.alt = v; });
    document.querySelectorAll('[data-t-aria]').forEach((el) => { const v = get(el.dataset.tAria); if (v != null) el.setAttribute('aria-label', v); });
    const d = get(document.body.dataset.page + '.desc');
    if (d) document.querySelector('meta[name="description"]')?.setAttribute('content', d);
  }

  function nutStore() {
    document.querySelectorAll('[data-store]').forEach((a) => {
      const s = STORE[a.dataset.store];
      if (!s) return;
      if (s.on) { a.href = s.url; a.removeAttribute('aria-disabled'); a.querySelector('[data-soon]')?.remove(); }
      else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
    });
  }

  function menu() {
    const sel = document.querySelector('.lang select');
    if (!sel) return;
    sel.innerHTML = LANGS.map(([id, ten]) => `<option value="${id}"${id === lang ? ' selected' : ''}>${ten}</option>`).join('');
    sel.addEventListener('change', () => {
      try { localStorage.setItem('mm.lang', sel.value); } catch { /* chế độ riêng tư: vẫn đổi qua ?lang */ }
      const u = new URL(location.href);
      u.searchParams.delete('lang');
      if (doc('mm.lang') !== sel.value) u.searchParams.set('lang', sel.value);
      location.href = u.toString();
    });
  }

  document.documentElement.lang = lang;
  document.querySelectorAll('[data-nam]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  nutStore();
  menu();
  if (lang !== 'en') {
    // Giấu trang tới khi chữ đã dịch (không thì nháy tiếng Anh một nhịp); quá
    // 1,5 giây (mạng chậm, file lỗi) thì hiện tiếng Anh còn hơn trang trắng.
    const hien = () => document.documentElement.classList.remove('dang-dich');
    document.documentElement.classList.add('dang-dich');
    setTimeout(hien, 1500);
    fetch(new URL(`i18n/${lang}.json`, base)).then((r) => (r.ok ? r.json() : null))
      .then((t) => { if (t) apDung(t); }).catch(() => {}).finally(hien);
  }
})();
