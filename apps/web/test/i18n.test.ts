import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BOT_SPECS, OPTION_KEYS } from '@mm/engine';
import vi from '@/locales/vi';
import { TU_DIEN, ngonNgu, t, td, theoMay } from '@/lib/i18n';

/**
 * CHỐNG SÓT BẢN DỊCH (chủ dự án yêu cầu 12.10.2026) — ba lớp:
 *  1. TypeScript: `en.ts` khai kiểu `TuDien` → thiếu khoá là typecheck đỏ.
 *  2. Đối chiếu (ở đây): đúng bộ khoá, không bản dịch rỗng, tham số `{n}` khớp.
 *  3. Chặn chữ cứng (ở đây): file ĐÃ chuyển sang đa ngôn ngữ mà còn chữ tiếng
 *     Việt viết thẳng (ngoài chú thích) là đỏ — thêm chữ mới mà quên đưa vào
 *     từ điển sẽ bị bắt ngay. Dòng nào CỐ Ý giữ tiếng Việt thì ghi `i18n-bo-qua`.
 */
/** Mọi từ điển trừ bản gốc tiếng Việt. */
const BO = Object.fromEntries(Object.entries(TU_DIEN).filter(([k]) => k !== 'vi'));
const thamSo = (v: string): string[] => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('đối chiếu từ điển', () => {
  for (const [ten, tu] of Object.entries(BO)) {
    it(`${ten}: đúng bộ khoá của bản tiếng Việt, không thừa không thiếu`, () => {
      expect(Object.keys(tu).sort()).toEqual(Object.keys(vi).sort());
    });
    it(`${ten}: không bản dịch nào rỗng, tham số khớp bản gốc`, () => {
      for (const [k, goc] of Object.entries(vi)) {
        const dich = (tu as Record<string, unknown>)[k];
        if (typeof dich === 'function') {
          // Hàm (số nhiều): chạy thử với mọi tham số của bản gốc, phải ra chữ có số đó
          const p = Object.fromEntries(thamSo(String(goc)).map((x) => [x, 7]));
          const ra = (dich as (p: Record<string, number>) => string)(p);
          expect(ra.trim(), `${ten}.${k}`).not.toBe('');
          for (const x of Object.keys(p)) expect(ra, `${ten}.${k} thiếu {${x}}`).toContain('7');
          continue;
        }
        expect(typeof dich === 'string' && dich.trim() !== '', `${ten}.${k} rỗng`).toBe(true);
        expect(thamSo(dich as string), `${ten}.${k}: tham số lệch bản gốc`).toEqual(thamSo(String(goc)));
      }
    });
  }

  it('mọi khoá GHÉP ĐỘNG đều có thật (td không bao giờ trả về chính khoá)', () => {
    const dong = [
      ...OPTION_KEYS.flatMap((k) => [`opt.${k}`, ...[0, 1, 2, 3].map((m) => `opt.${k}.${m}`)]),
      ...Object.keys(BOT_SPECS).map((b) => `menu.bot.${b}`),
      ...['players', 'bot', 'count', 'names', 'level', 'theme', 'options'].map((b) => `menu.buoc.${b}`),
      ...['cleared', 'timeout', 'no-moves', 'no-lives', 'forfeit'].map((r) => `kq.ly.${r}`),
      ...['off', 'low', 'high'].flatMap((l) => [`tb.am.${l}`, `tb.amNgan.${l}`]),
      ...['dong', 'bac', 'vang', 'bi-mat'].map((b) => `fx.bac.${b}`),
      // Mọi theme thật và mọi nhóm danh hiệu, mức máy đều phải có tên dịch
      ...((): { id: string }[] => { const j = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/themes.json'), 'utf8')); return Array.isArray(j) ? j : j.themes; })().map((t) => `theme.${t.id}`),
      ...['nhap-mon', 'ban', 'may', 'luat', 'thang', 'diem', 'hoan-hao', 'chien-dich', 'online', 'theme', 'chuyen-can', 'bi-mat'].map((n) => `dh.nhom.${n}`),
      ...Object.keys(BOT_SPECS).map((b) => `bot.${b}`)
    ];
    for (const k of dong) expect(k in vi, `thiếu khoá ${k}`).toBe(true);
  });
});

describe('đổi ngôn ngữ', () => {
  afterEach(() => { ngonNgu.value = 'vi'; });
  it('mặc định tiếng Việt; đổi sang English thì t() đổi theo', () => {
    expect(t('menu.buoc.players')).toBe('Bạn muốn chơi thế nào?');
    ngonNgu.value = 'en';
    expect(t('menu.buoc.players')).toBe('How do you want to play?');
    expect(t('fx.conCap', { n: 1 })).toMatch(/1 more pair /);
    expect(t('fx.conCap', { n: 3 })).toMatch(/3 more pairs/);
    expect(td('khoa.khong.co')).toBe('khoa.khong.co');
  });
  it('app đoán theo máy: lấy ngôn ngữ ĐẦU TIÊN của máy mà app có, không có thì English', () => {
    expect(theoMay(['ja-JP', 'en-US'])).toBe('ja');
    expect(theoMay(['zh-Hans-VN'])).toBe('zh');
    expect(theoMay(['pt-BR'])).toBe('pt');
    expect(theoMay(['in-ID'])).toBe('id');          // Android cũ
    expect(theoMay(['sv-SE', 'vi-VN'])).toBe('vi'); // ngôn ngữ đầu không có → lấy cái sau
    expect(theoMay(['sv-SE'])).toBe('en');
  });
  it('mọi ngôn ngữ trong danh sách chọn đều có từ điển', () => {
    expect(Object.keys(TU_DIEN).length).toBeGreaterThanOrEqual(12);
  });
});

/** File ĐÃ chuyển sang bộ dịch — thêm file vào đây khi chuyển xong (đợt 2, 3…). */
const DA_CHUYEN = [
  'components/TopBar.vue', 'components/HudBar.vue', 'components/SizeGrid.vue', 'components/ConfirmDialog.vue',
  'components/GameScreen.vue', 'components/PlayerStrip.vue', 'components/MenuScreen.vue',
  'components/ResultDialog.vue', 'components/KetCucFx.vue', 'components/MoKhoaFx.vue',
  'components/DanhHieu.vue', 'components/DanhHieuDialog.vue', 'components/TaiKhoanDialog.vue',
  'components/BoardGrid.vue', 'components/CardTile.vue', 'lib/achievements.ts', 'lib/ten.ts',
  'components/OnlineScreen.vue', 'components/OnlineGame.vue', 'composables/useOnlineRoom.ts',
  'components/ChiaSeDialog.vue', 'components/EmojiBar.vue', 'App.vue', 'components/RulesDialog.vue', 'components/LevelMap.vue',
  'components/MuaThe.vue', 'lib/mua-the.ts', 'components/DebugMenu.vue'
];
const DAU_VIET = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function boChuThich(src: string): string {
  return src
    // Thay chú thích bằng ĐÚNG số dòng trống của nó: báo lỗi phải chỉ đúng dòng trong file
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .split('\n')
    .map((l) => (l.includes('i18n-bo-qua') ? '' : l))
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}

describe('chặn chữ tiếng Việt viết cứng trong file đã chuyển', () => {
  for (const f of DA_CHUYEN) {
    it(f, () => {
      const src = readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
      const phan = src.slice(0, src.indexOf('<style') >= 0 ? src.indexOf('<style') : undefined);
      const con = boChuThich(phan).split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => DAU_VIET.test(l));
      expect(con.map(([i, l]) => `${i}: ${l.trim()}`), `${f}: chữ tiếng Việt chưa qua t() — thêm khoá vào locales/vi.ts`).toEqual([]);
    });
  }
});
