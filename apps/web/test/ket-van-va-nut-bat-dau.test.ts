import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('nút "Bắt đầu" phải phản hồi ngay khi bấm', () => {
  const src = doc('components/OnlineScreen.vue');

  it('kêu NGAY lúc bấm, không đợi server', () => {
    const i = src.indexOf('function batDauVan()');
    expect(i, 'thiếu hàm bấm bắt đầu').toBeGreaterThan(-1);
    const than = src.slice(i, i + 400);
    // Tiếng phải nằm TRƯỚC lời gọi lên server: đợi server là mạng chậm thành
    // bấm xong im ru, và người ta bấm tiếp.
    expect(than.indexOf('sfx.')).toBeGreaterThan(-1);
    expect(than.indexOf('sfx.')).toBeLessThan(than.indexOf('o.start()'));
  });

  it('có trạng thái chờ nhìn thấy được, và chặn bấm lần hai', () => {
    expect(src).toMatch(/dangMoVan/);
    expect(src, 'nút phải khoá khi đang chờ').toMatch(/:disabled="!canStart \|\| dangMoVan"/);
    expect(src, 'phải có vòng quay').toMatch(/class="quay"/);
    expect(src, 'và CSS cho nó').toMatch(/\.btn-primary \.quay \{/);
  });

  it('KHÔNG treo vòng quay vĩnh viễn khi tin rơi mất', () => {
    // Không có hạn thì một tin `start` rơi giữa đường là nút khoá cứng, phòng
    // chờ chết hẳn và cách duy nhất là tải lại trang.
    expect(src).toMatch(/HAN_MO_VAN/);
    const i = src.indexOf('const HAN_MO_VAN');
    expect(Number(/HAN_MO_VAN = (\d+)/.exec(src.slice(i))![1])).toBeLessThanOrEqual(10_000);
  });
});

describe('kết ván: thắng và thua phải khác nhau, và bảng hiện sớm', () => {
  const game = doc('components/OnlineGame.vue');

  it('bảng tỉ số hiện sớm hơn hẳn mốc cũ 5 giây', () => {
    const m = /showResult\.value = true; \}, iWon\.value \? (\d+) : (\d+)\)/.exec(game);
    expect(m, 'không tìm thấy hẹn giờ bảng tỉ số').not.toBeNull();
    const [thang, thua] = [Number(m![1]), Number(m![2])];
    expect(thang, 'người thắng chờ quá lâu').toBeLessThanOrEqual(2500);
    expect(thua, 'người thua không có gì để xem, đừng bắt chờ').toBeLessThan(thang);
  });

  it('THUA có hiệu ứng hình riêng, không phải chỉ có tiếng', () => {
    // Một component cho cả ba kết cục; hình cụ thể do sổ đăng ký bốc.
    expect(game).toContain('KetCucFx');
    expect(game, 'phải truyền loại kết cục, không hard-code một hình')
      .toMatch(/:loai="loaiKetCuc"/);
  });

  it('hiệu ứng thua đọc ra KHÁC hẳn ăn mừng, không chỉ khác tên hình', () => {
    const so = doc('lib/ketcuc-fx.ts');
    const css = doc('styles/ketcuc-fx.css');
    // Thắng: confetti + chùm pháo. Thua: rút màu + tro rơi + tối dần.
    expect(so).toMatch(/fx-giay/);
    expect(css).toMatch(/fx-tro-roi/);
    expect(css).toMatch(/fx-toi-dan/);
    expect(css, 'lớp rút màu là thứ làm hình thua đọc ra ngay').toMatch(/grayscale/);
    // Không hình thua nào được mang lớp của bên thắng (và ngược lại).
    const khoi = (loai) => so.split(`loai: '${loai}'`).slice(1)
      .map((k) => k.slice(0, k.indexOf('\n  }'))).join('\n');
    expect(khoi('thua'), 'confetti lọt sang màn thua').not.toMatch(/fx-giay|fx-tia\b/);
    expect(khoi('thang'), 'tro lọt sang màn thắng').not.toMatch(/fx-tan|fx-xam/);
    // Không chặn thao tác, không thì bảng tỉ số bấm không được.
    expect(css).toMatch(/pointer-events: none/);
    // Tôn trọng người tắt hiệu ứng chuyển động.
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('tiếng thắng và tiếng thua là hai hàm khác nhau', () => {
    const online = doc('composables/useOnlineRoom.ts');
    expect(online).toMatch(/sfx\.victory\(\)/);
    expect(online).toMatch(/sfx\.defeat\(\)/);
  });
});
