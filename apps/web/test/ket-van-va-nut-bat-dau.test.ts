import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('nút "Bắt đầu" phải phản hồi ngay khi bấm', () => {
  const src = doc('components/OnlineScreen.vue');

  it('kêu NGAY lúc bấm, không đợi server', () => {
    const i = src.indexOf('function batDauVan()');
    expect(i, 'thiếu hàm bấm bắt đầu').toBeGreaterThan(-1);
    // Cắt TRỌN thân hàm, không phải 400 ký tự đầu: cửa sổ cố định làm test đỏ
    // ngay khi thêm một chú thích vào giữa hàm, mà thứ tự gọi thì vẫn đúng.
    const than = src.slice(i, src.indexOf('\n}', i));
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

  it('bảng tỉ số hiện theo mốc của CẢNH, không chép tay con số', () => {
    expect(game).toMatch(/showResult\.value = true; \}, HIEN_BANG_MS\[chonCanh\(loaiKetCuc\.value\)\]\)/);
  });

  it('THUA có hiệu ứng hình riêng, không phải chỉ có tiếng', () => {
    // Một component cho cả ba kết cục; hình cụ thể do sổ đăng ký bốc.
    expect(game).toContain('KetCucFx');
    expect(game, 'phải truyền loại kết cục, không hard-code một hình')
      .toMatch(/:loai="loaiKetCuc"/);
  });

  it('cảnh thua đọc ra KHÁC hẳn ăn mừng', () => {
    const vue = doc('components/KetCucFx.vue');
    const css = doc('styles/ketcuc-fx.css');
    // Thắng: chữ vàng đập + pháo giấy. Thua: bàn rút màu + lá rơi + chữ xám.
    expect(vue).toMatch(/fx-thang/);
    expect(vue).toMatch(/fx-thua/);
    expect(doc('lib/ketcuc-fx.ts'), 'lớp rút màu là thứ làm hình thua đọc ra ngay').toMatch(/grayscale/);
    expect(css).toMatch(/pointer-events: none/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('tiếng thắng và tiếng thua là hai hàm khác nhau', () => {
    const online = doc('composables/useOnlineRoom.ts');
    expect(online).toMatch(/sfx\.victory\(\)/);
    // Thua: KetCucFx phát theo biến thể (kèn buồn + sư tử khóc), KHÔNG
    // phát ở chỗ gọi (phát ở đó là chồng hai tiếng thua lên nhau)
    expect(online).not.toMatch(/sfx\.lose\(\)/);
    const fx = doc('components/KetCucFx.vue');
    for (const t of ['sfx.suTuKhoc()', 'sfx.gauCuoi()', 'sfx.chuotHoa()']) expect(fx).toContain(t);
  });
});
