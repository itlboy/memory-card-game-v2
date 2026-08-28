import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * DANH SÁCH PHÒNG TỰ LÀM MỚI mỗi 10 giây, có đếm ngược.
 *
 * Mỗi nhịp là một lần đánh thức Durable Object sổ phòng cho MỌI người đang mở
 * màn này, nên hai chốt dưới đây là thứ giữ cái giá đó khỏi bị nhân lên. Bỏ
 * một trong hai là mỗi tab bị bỏ quên thành một cái máy gõ cửa DO mãi mãi —
 * trên điện thoại tab nền là chuyện thường xuyên nhất.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('tự làm mới danh sách phòng', () => {
  it('có nhịp đếm và chu kỳ 10 giây', () => {
    expect(src).toMatch(/const CHU_KY_S = 10;/);
    expect(src, 'phải có đếm ngược hiện ra cho người chơi').toContain('demNguoc');
  });

  it('DỪNG khi tab xuống nền, và làm mới NGAY khi quay lại', () => {
    expect(src, 'phải nghe visibilitychange').toContain("addEventListener('visibilitychange'");
    expect(src, 'quay lại tab phải tải ngay chứ không đợi hết chu kỳ')
      .toMatch(/visibilityState === 'visible'[\s\S]{0,200}taiPhongCongKhai/);
  });

  it('chỉ đếm khi danh sách thật sự hiện ra trước mắt ai đó', () => {
    // Đang điền form / trong wizard / trong phòng thì không ai nhìn danh sách
    expect(src).toMatch(/dangXemDanhSach[\s\S]{0,160}entryStep\.value === 'choose'/);
    expect(src).toMatch(/dangXemDanhSach[\s\S]{0,160}!wizard\.value/);
  });

  it('dọn nhịp khi rời màn — không để timer chạy tiếp sau khi component chết', () => {
    expect(src).toMatch(/onUnmounted\(\(\) => \{[\s\S]{0,160}dung\(\)/);
    expect(src).toMatch(/onUnmounted\(\(\) => \{[\s\S]{0,200}removeEventListener\('visibilitychange'/);
  });

  it('bấm tay thì đếm lại từ đầu', () => {
    // Không thì vừa bấm xong một giây sau nó tự làm mới lần nữa
    expect(src).toMatch(/function lamMoiNgay\(\)[\s\S]{0,120}datLaiDem\(\)/);
    expect(src).toContain('@click="lamMoiNgay()"');
  });
});
