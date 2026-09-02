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
    expect(game).toContain('DefeatFx');
    // Hai nhánh loại trừ nhau: chồng cả pháo hoa lẫn tro là vô nghĩa.
    expect(game).toMatch(/<CelebrationFx v-if="[^"]*iWon" \/>\s*(<!--[\s\S]*?-->\s*)?<DefeatFx v-else-if=/);
  });

  it('hiệu ứng thua đọc ra KHÁC hẳn ăn mừng, không chỉ khác tên file', () => {
    const thua = doc('components/DefeatFx.vue');
    const thang = doc('components/CelebrationFx.vue');
    expect(thang, 'ăn mừng: pháo hoa + confetti').toMatch(/confetti|burst/);
    expect(thua, 'thua: tro rơi xuống, nền tối dần').toMatch(/tro-roi/);
    expect(thua).toMatch(/toi-dan/);
    // Kiểm phần CHẠY THẬT, không phải chữ trong chú thích: không có lớp giấy
    // màu (.paper) hay chùm pháo (.burst) nào của bên thắng lọt sang.
    const css = thua.slice(thua.indexOf('<style'));
    expect(css).not.toMatch(/\.paper\b/);
    expect(css).not.toMatch(/\.burst\b/);
    // Không chặn thao tác, không thì bảng tỉ số bấm không được.
    expect(thua).toMatch(/pointer-events: none/);
    // Tôn trọng người tắt hiệu ứng chuyển động.
    expect(thua).toMatch(/prefers-reduced-motion/);
  });

  it('tiếng thắng và tiếng thua là hai hàm khác nhau', () => {
    const online = doc('composables/useOnlineRoom.ts');
    expect(online).toMatch(/sfx\.victory\(\)/);
    expect(online).toMatch(/sfx\.defeat\(\)/);
  });
});
