import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryGame, isDraw } from '@mm/engine';
import { BOT_SPECS } from '@mm/engine';
import { CAU_TREU, HIEN_BANG_MS, TEN_CANH, chonCanh } from '@/lib/ketcuc-fx';
import type { Summary } from '@mm/engine';

/**
 * THẮNG và THUA phải nhìn ra khác nhau — ở MỌI đường thua.
 *
 * `summary.status === 'won'` chỉ có nghĩa BÀN ĐÃ SẠCH, không phải "tôi thắng".
 * Đấu máy mà máy dọn nhiều cặp hơn thì vẫn là 'won', nên trước đây thua bot vẫn
 * được pháo hoa và nhạc chiến thắng — người chơi báo đúng chuyện này. Ba đường
 * thua còn lại ('lost': hết giờ, hết mạng, hết nước) thì ván offline không có
 * HÌNH nào cả, giống hệt một ván đang chơi dở.
 *
 * Test này soi đúng phép quyết định đó, ở cả hai nhánh (offline và online).
 */

/** Bản xếp hạng tối thiểu để `isDraw` và phép chọn hiệu ứng chạy được. */
const p = (id: string, score: number) =>
  ({ id, name: id, score, bestStreak: 1, pairs: score / 100, forfeited: false });

const tomTat = (status: 'won' | 'lost', ranking: unknown[]): Summary =>
  ({ status, reason: 'cleared', score: 0, moves: 0, seconds: 0, timeBonus: 0,
    bestStreak: 0, stars: 0, ranking } as unknown as Summary);

/**
 * Bản sao phép quyết định của `useGameSession.nguoiChoiThang` — giữ ở đây để
 * test đọc được không cần dựng cả App. Sửa một bên PHẢI sửa bên kia; phép kiểm
 * "mã nguồn có đúng luật này" ở cuối file canh chuyện đó.
 */
function nguoiChoiThang(s: Summary): boolean {
  if (s.status !== 'won') return false;
  const champ = s.ranking[0];
  if (!champ || !s.ranking.some((x) => x.id === 'bot')) return true;
  return champ.id !== 'bot' || isDraw(s.ranking);
}

describe('mọi đường thua đều có hiệu ứng thua', () => {
  it('thua BOT (bàn sạch, bot dẫn đầu) KHÔNG được ăn mừng', () => {
    const s = tomTat('won', [p('bot', 900), p('p1', 300)]);
    expect(nguoiChoiThang(s), 'lỗi người chơi báo: thua máy mà vẫn bắn pháo hoa').toBe(false);
  });

  it('thắng bot thì vẫn ăn mừng bình thường', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p1', 900), p('bot', 300)]))).toBe(true);
  });

  it('HOÀ với bot là ăn mừng, không phải thua', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p1', 500), p('bot', 500)]))).toBe(true);
  });

  it('nhiều người CÙNG MÁY: người thắng đang ngồi đây nên vẫn mừng', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p2', 900), p('p1', 300)]))).toBe(true);
  });

  for (const reason of ['timeout', 'no-lives', 'no-moves'] as const) {
    it(`thua vì ${reason} thì không ăn mừng`, () => {
      const s = tomTat('lost', [p('p1', 100)]);
      (s as { reason: string }).reason = reason;
      expect(nguoiChoiThang(s)).toBe(false);
    });
  }

  it('engine thật: hết giờ ra status lost', () => {
    const g = new MemoryGame({
      cols: 2, rows: 2, pairs: 2, symbols: ['a', 'b'], seed: 7, timeLimit: 5,
      players: [{ id: 'p1', name: 'A' }]
    } as never);
    g.start(0);
    const ev = g.tick(6000);
    const end = ev.find((e) => e.type === 'end');
    expect(end && (end as { summary: Summary }).summary.status).toBe('lost');
  });
});

describe('mã nguồn giữ đúng luật', () => {
  const doc = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

  it('App.vue chọn hiệu ứng theo `loaiKetCuc`, KHÔNG theo status trần', () => {
    const src = doc('src/App.vue');
    expect(src, 'ván offline thua phải có hình riêng').toContain('<KetCucFx');
    expect(src).toContain('session.loaiKetCuc.value');
    expect(src, "status === 'won' không phải là 'tôi thắng'")
      .not.toMatch(/v-if="session\.summary\.value\?\.status === 'won'/);
  });

  it('useGameSession nhận ra bot qua BẢNG XẾP HẠNG, không qua cờ botLevel', () => {
    const src = doc('src/composables/useGameSession.ts');
    // Cờ `botLevel` tắt được giữa ván; lúc đó ván vẫn có một người tên 'bot'.
    expect(src).toMatch(/ranking\.some\(\(p\) => p\.id === BOT_ID\)/);
    // Hoà phải ra 'hoa', không được rơi vào nhánh thua.
    expect(src).toMatch(/isDraw\(s\.ranking\)\) return 'hoa'/);
  });

  it('online: ba kết cục đi qua MỘT chỗ quyết định', () => {
    const src = doc('src/components/OnlineGame.vue');
    expect(src, 'hoà mà tro rơi thì nhìn như vừa bị hạ')
      .toMatch(/hoa\.value \? 'hoa' : iWon\.value \? 'thang' : 'thua'/);
  });
});

describe('sổ cảnh kết ván (bộ mới 11.10.2026)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/ketcuc-fx.css'), 'utf8');
  const vue = readFileSync(resolve(process.cwd(), 'src/components/KetCucFx.vue'), 'utf8');

  it('mỗi tình huống ra đúng một cảnh; hoà KHÔNG rơi vào nhánh thua', () => {
    expect(chonCanh('thang')).toBe('thang');
    expect(chonCanh('thang', { kyLuc: true })).toBe('ky-luc');
    expect(chonCanh('thua')).toBe('thua');
    expect(chonCanh('thua', { matMay: '🐯' })).toBe('thua-may');
    expect(chonCanh('hoa', { matMay: '🐯', kyLuc: true })).toBe('hoa');
  });

  it('mọi cảnh có tên và mốc hiện bảng kết quả trong khoảng 2–3 giây', () => {
    for (const c of Object.keys(TEN_CANH) as (keyof typeof TEN_CANH)[]) {
      expect(HIEN_BANG_MS[c], c).toBeGreaterThanOrEqual(1800);
      expect(HIEN_BANG_MS[c], `${c}: người chơi chờ bảng tỉ số quá lâu`).toBeLessThanOrEqual(3000);
    }
  });

  it('mọi lớp mà component dựng đều có CSS (thiếu = cảnh vô hình)', () => {
    const lop = [...vue.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/)).filter((c) => c.startsWith('fx-'));
    expect(lop.length).toBeGreaterThan(5);
    for (const c of lop) expect(css, c).toContain(`.${c}`);
  });

  it('mọi mức máy có câu trêu riêng', () => {
    for (const spec of Object.values(BOT_SPECS)) expect(CAU_TREU[spec.avatar], spec.name).toBeTruthy();
  });

  it('lớp hiệu ứng nằm DƯỚI hộp kết quả', () => {
    // Lỗi đã xảy ra thật (có ảnh): lớp xám + vết rạn phủ lên cả bảng tỉ số.
    const dialog = readFileSync(resolve(process.cwd(), 'src/components/ResultDialog.vue'), 'utf8');
    const zFx = Number(/\.ketcuc-fx \{[\s\S]*?z-index: (\d+)/.exec(css)![1]);
    const zHop = Number(/position: fixed; inset: 0; z-index: (\d+)/.exec(dialog)![1]);
    expect(zFx, 'hiệu ứng đè lên bảng tỉ số thì không ai đọc được kết quả').toBeLessThan(zHop);
  });

  it('lá bài chỉ được động bằng translate/rotate/scale RIÊNG, không ghi đè transform (lộ bài)', () => {
    const so = readFileSync(resolve(process.cwd(), 'src/lib/ketcuc-fx.ts'), 'utf8');
    const khoiLa = so.slice(so.indexOf('export function chayCanh'));
    expect(khoiLa).not.toMatch(/\{\s*transform:/);
  });
});
