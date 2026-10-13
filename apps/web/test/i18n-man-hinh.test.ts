import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Summary } from '@mm/engine';
import App from '@/App.vue';
import ResultDialog from '@/components/ResultDialog.vue';
import DanhHieuDialog from '@/components/DanhHieuDialog.vue';
import KetCucFx from '@/components/KetCucFx.vue';
import { byId } from '@/lib/achievements';
import { NGON_NGU, ngonNgu, t, type NgonNgu } from '@/lib/i18n';

/**
 * LỚP KIỂM THỨ TƯ — TRÊN MÀN HÌNH THẬT, KHÔNG PHẢI TRÊN MÃ NGUỒN.
 *
 * Vì sao cần (chủ dự án báo 12.10.2026, có ảnh): bản English trang chủ vẫn hiện
 * "Khởi đầu". Ba lớp kiểm cũ chỉ nhìn chữ VIẾT THẲNG trong file đã chuyển, mà
 * chữ đó đến từ DỮ LIỆU (tên danh hiệu trong achievements.ts) đi qua props —
 * không lớp nào thấy. Tên theme, tên máy, "Bạn" cũng lọt đúng đường ấy; còn chữ
 * KHÔNG DẤU như "Thua" thì lọt cả phép dò dấu.
 *
 * Nên ở đây: dựng TỪNG MÀN đã tuyên bố xong ở cả hai ngôn ngữ, gom MỌI chữ hiển
 * thị (text + aria-label + title + placeholder), và đỏ khi bản English
 *  (1) còn ký tự có dấu tiếng Việt, hoặc
 *  (2) còn một cụm chữ GIỐNG HỆT bản tiếng Việt của cùng màn đó.
 * Chữ đến từ đâu cũng bị bắt. Màn nào dịch xong thì THÊM vào đây.
 */
const DAU_VIET = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/**
 * Ký tự CHỈ tiếng Việt có — dùng khi soi các ngôn ngữ khác. Dò cả bộ `DAU_VIET`
 * là bắt nhầm chữ đúng chính tả của tiếng Bồ Đào Nha / Pháp / Tây Ban Nha / Đức
 * (á é ó ê ô ã ç…: "Memória" bị báo là tiếng Việt — agent dịch phát hiện). Chữ
 * Việt chỉ mang dấu sắc/huyền vẫn bị phép so "giống hệt bản tiếng Việt" bắt.
 */
const DAU_VIET_RIENG = /[ăằắẳẵặảạầấẩẫậẻẽẹềếểễệỉĩịỏọồốổỗộơờớởỡợủũụưừứửữựỳỷỹỵđ]/i;
/** Cụm CỐ Ý giống nhau ở mọi ngôn ngữ: tên ngôn ngữ trong ô chọn, từ mượn. Tên app KHÔNG còn ở đây:
 *  bản English là "Flip Match" (chủ dự án chốt 12.10.2026). */
const GIONG_NHAU = new Set(['Flip Match', 'Tiếng Việt', 'English', 'VI', 'EN', 'Menu', 'Online', 'GAME', 'OVER', 'GAME OVER', 'Combo']);

const THEMES = {
  themes: [
    { id: 'animals', name: 'Động vật', unlockAt: 0, symbols: Array.from({ length: 30 }, (_, i) => `A${i}`) },
    { id: 'food', name: 'Đồ ăn', unlockAt: 0, symbols: Array.from({ length: 30 }, (_, i) => `F${i}`) },
    { id: 'flags', name: 'Cờ quốc gia', unlockAt: 999999, symbols: Array.from({ length: 24 }, (_, i) => `B${i}`) }
  ]
};
const flush = async (n = 5): Promise<void> => { for (let i = 0; i < n; i++) { await nextTick(); await Promise.resolve(); } };

/** Mọi chữ người dùng thấy hoặc trình đọc màn hình đọc, tách thành từng cụm. */
function gomChu(el: Element): string[] {
  const ra: string[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const cha = (n as Text).parentElement;
    if (cha?.closest('style, script')) continue;
    ra.push(...(n.textContent ?? '').split('\n'));
  }
  for (const e of el.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v) ra.push(v); }
  }
  return [...new Set(ra.map((s) => s.trim()).filter((s) => /\p{L}{2,}/u.test(s)))];
}

let w: VueWrapper | null = null;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, '', location.pathname);
  // Có tiến độ để dải lối tắt hiện ĐỦ (chuỗi ngày, màn chiến dịch, danh hiệu gợi ý)
  const homNay = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  localStorage.setItem('mm.v2', JSON.stringify({
    levels: { 'campaign:1': { stars: 3, score: 100 }, 'campaign:2': { stars: 1, score: 50 } },
    boDem: { wins: 2, botWins: 0, onlineWins: 0, ngayCuoi: `${homNay.getFullYear()}-${p(homNay.getMonth() + 1)}-${p(homNay.getDate())}`, chuoi: 3, chuoiMax: 3 }
  }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(THEMES), { headers: { 'Content-Type': 'application/json' } })));
});
afterEach(() => { w?.unmount(); w = null; ngonNgu.value = 'vi'; vi.unstubAllGlobals(); });

const bam = async (sel: string, i = 0): Promise<void> => {
  const ds = w!.findAll(sel);
  if (!ds[i]) throw new Error(`không thấy "${sel}"[${i}]`);
  await ds[i]!.trigger('click'); await flush();
};

/** Đi qua các màn ĐỢT 1 bằng BỘ CHỌN (chữ đổi theo ngôn ngữ nên không bấm theo chữ). */
async function duyetApp(lang: NgonNgu): Promise<Record<string, string[]>> {
  ngonNgu.value = lang;
  history.replaceState(null, '', location.pathname); sessionStorage.clear();
  w = mount(App); await flush(8);
  const man: Record<string, string[]> = {};
  const chup = (ten: string) => { man[ten] = gomChu(w!.element.parentElement ?? w!.element); };
  chup('trang chủ');
  await bam('header .menu-btn'); chup('menu thanh trên'); await bam('header .menu-btn');
  await bam('.home :is(.o-chien-dich, .o-vuong)', 1); chup('bước số người');
  await bam('.counts .option', 0); chup('bước số thẻ');
  await bam('.size-grid button', 1); chup('bước theme');
  await bam('.btn-primary'); chup('bước luật bàn');
  await bam('.btn-primary'); await flush(8); chup('màn chơi');
  w.unmount(); w = null;
  // Ván vừa rồi để lại ?playing=1 + snapshot: dọn để app mở lại ở trang chủ
  history.replaceState(null, '', location.pathname); sessionStorage.clear();
  // Nhánh đấu máy: bước chọn mức máy + màn chơi có tên máy và "Bạn"
  w = mount(App); await flush(8);
  await bam('.home :is(.o-chien-dich, .o-vuong)', 2); chup('bước mức máy');
  await bam('.options .option.wide', 2); await bam('.size-grid button', 1);
  await bam('.btn-primary'); await bam('.btn-primary'); await flush(8); chup('màn chơi đấu máy');
  w.unmount(); w = null;
  // ĐỢT 3 (13.10.2026): màn Chơi online (sổ phòng), bản đồ Chiến dịch, hộp Luật chơi.
  // Màn online lọt lưới hai đợt đầu và chỉ lộ ra khi chụp ảnh App Store bản English.
  history.replaceState(null, '', location.pathname); sessionStorage.clear();
  w = mount(App); await flush(8);
  await bam('.home :is(.o-chien-dich, .o-vuong)', 3); await flush(8); chup('chơi online');
  w.unmount(); w = null;
  history.replaceState(null, '', location.pathname); sessionStorage.clear();
  w = mount(App, { attachTo: document.body }); await flush(8);
  await bam('.home :is(.o-chien-dich, .o-vuong)', 0); await flush(8); chup('bản đồ chiến dịch');
  w.unmount(); w = null;
  history.replaceState(null, '', location.pathname); sessionStorage.clear();
  w = mount(App, { attachTo: document.body }); await flush(8);
  await bam('header .menu-btn');
  const luat = w.findAll('header .menu .item').find((e) => e.attributes('aria-label') === t('tb.luatChoi'));
  if (!luat) throw new Error('không thấy mục Luật chơi trong menu');
  await luat.trigger('click'); await flush(8);
  man['hộp luật chơi'] = gomChu(document.body);
  w.unmount(); w = null;
  return man;
}

const TONG: Summary = { status: 'won', reason: 'cleared', score: 220, moves: 3, seconds: 7, timeBonus: 15, bestStreak: 2, stars: 3, ranking: [] };

async function duyetThanhPhan(lang: NgonNgu): Promise<Record<string, string[]>> {
  ngonNgu.value = lang;
  const man: Record<string, string[]> = {};
  const dung = async (ten: string, C: unknown, props: Record<string, unknown>) => {
    const m = mount(C as never, { props, attachTo: document.body });
    await flush(); man[ten] = gomChu(document.body); m.unmount();
  };
  await dung('kết quả một mình', ResultDialog, {
    summary: TONG, isRecord: true, showStars: true, multiplayer: false, freshAchievements: ['first-win', 'board-4', 'lightspeed'],
    goiY: byId('flawless'), totalBefore: 0, totalAfter: 220, hasNext: true, levelId: 1
  });
  await dung('kết quả đấu máy', ResultDialog, {
    summary: { ...TONG, ranking: [
      { id: 'bot', name: 'Bot báo đen', avatar: ':bao-den:', score: 300, pairs: 3, bestStreak: 2 },
      { id: 'p1', name: 'Bạn', score: 100, pairs: 1, bestStreak: 1 }] }, // i18n-bo-qua: dữ liệu ván giữ chữ gốc
    isRecord: false, showStars: false, multiplayer: true, freshAchievements: [], totalBefore: 0, totalAfter: 0, hasNext: false
  });
  await dung('màn danh hiệu', DanhHieuDialog, { daCo: new Set(['first-win', 'giay-cuoi']), tk: { wins: 3, botWins: 0, onlineWins: 0, totalScore: 600, chuoiNgay: 2, campaignMax: 3, stars3: 1 }, themeKhoa: { flags: 5000 } });
  for (const [ten, p] of [
    ['cảnh thắng', { loai: 'thang', bienThe: 'phao-giay' }], ['cảnh kỷ lục', { loai: 'thang', kyLuc: true, bienThe: 'vuong-mien' }],
    ['cảnh thua vỡ', { loai: 'thua', bienThe: 'dap-vo' }], ['cảnh thua tro', { loai: 'thua', bienThe: 'tan-tro' }],
    ['cảnh game over', { loai: 'thua', bienThe: 'game-over' }], ['cảnh máy thắng', { loai: 'thua', matMay: '🐯' }], ['cảnh hoà', { loai: 'hoa' }]
  ] as const) await dung(ten, KetCucFx, p as unknown as Record<string, unknown>);
  return man;
}

/**
 * So bản `lang` với bản GỐC (tiếng Việt) và — với ngôn ngữ không phải English —
 * với bản English: cụm giống hệt English trong bản tiếng Nhật/Đức… là chỗ người
 * dịch quên, để nguyên chữ nguồn.
 */
function soSanh(lang: string, viMan: Record<string, string[]>, enMan: Record<string, string[]> | null, xMan: Record<string, string[]>): string[] {
  const loi: string[] = [];
  for (const [ten, ds] of Object.entries(xMan)) {
    const goc = new Set(viMan[ten] ?? []);
    const anh = new Set(enMan?.[ten] ?? []);
    for (const c of ds) {
      if (GIONG_NHAU.has(c) || NGON_NGU.some((l) => l.ten === c)) continue;
      if (/^· build /.test(c)) continue;   // mốc bản dựng (số + chữ 'build'), cố ý giống nhau
      if (DAU_VIET_RIENG.test(c) && lang !== 'vi') loi.push(`[${lang}·${ten}] còn chữ tiếng Việt: "${c}"`);
      else if (goc.has(c) && !DONG_NGUYEN[lang as NgonNgu]?.includes(c)) loi.push(`[${lang}·${ten}] chưa dịch (giống hệt bản tiếng Việt): "${c}"`);
      else if (anh.has(c) && /[a-z]{3,}/i.test(c) && !DONG_NGUYEN[lang as NgonNgu]?.includes(c)) loi.push(`[${lang}·${ten}] còn để nguyên English: "${c}"`);
    }
  }
  return loi;
}

/**
 * TỪ ĐỒNG NGUYÊN hợp lệ: cụm giống hệt English vì ngôn ngữ đó VIẾT Y NHƯ VẬY, không
 * phải quên dịch. Khai TỪNG từ cho TỪNG ngôn ngữ (không nới cả phép kiểm), để một câu
 * English dài bị bỏ quên vẫn đỏ. Đã rà tay từng mục (12.10.2026).
 */
const DONG_NGUYEN: Partial<Record<NgonNgu, readonly string[]>> = {
  es: ['Solo', 'Normal', 'pts', '999.999k pts'],
  pt: ['Solo', 'Normal', 'pts', '999.999k pts', 'Bronze'],
  fr: ['Solo', 'Normal', 'Long', 'Score', 'pts', '999.999k pts', '220 points', '100 points', 'Secret', 'Bronze', 'Double', 'Style', 'Pause'],
  de: ['Solo', 'Normal', 'Level 3', 'Lvl', 'Bronze', 'Gold', 'Neon', 'Pause'],
  en: ['Neon'],   // tên skin (13.10.2026): tiếng Việt cũng gọi là Neon
  id: ['Solo', 'Normal', 'Level 3', 'Bom', 'Neon']   // "Bom" trùng cả tiếng Việt lẫn Indonesia
};

/** Mọi ngôn ngữ trừ tiếng Việt (bản gốc). */
const KHAC = NGON_NGU.map((l) => l.id).filter((l) => l !== 'vi') as NgonNgu[];

describe('mọi ngôn ngữ không còn chữ chưa dịch trên các màn đã dịch', () => {
  it('trang chủ, menu, wizard, màn chơi (một mình + đấu máy), chơi online, chiến dịch, luật chơi', async () => {
    const viMan = await duyetApp('vi');
    const enMan = await duyetApp('en');
    const loi: string[] = [];
    for (const l of KHAC) {
      const x = l === 'en' ? enMan : await duyetApp(l);
      expect(Object.keys(x).length).toBeGreaterThanOrEqual(12);
      loi.push(...soSanh(l, viMan, l === 'en' ? null : enMan, x));
      expect(document.title, `${l}: tiêu đề tab`).not.toMatch(DAU_VIET_RIENG);
    }
    expect(loi).toEqual([]);
  }, 120_000);

  it('bảng kết quả, màn danh hiệu, mọi cảnh kết ván', async () => {
    const viMan = await duyetThanhPhan('vi');
    const enMan = await duyetThanhPhan('en');
    const loi: string[] = [];
    for (const l of KHAC) {
      const x = l === 'en' ? enMan : await duyetThanhPhan(l);
      loi.push(...soSanh(l, viMan, l === 'en' ? null : enMan, x));
    }
    expect(loi).toEqual([]);
  }, 120_000);
});
