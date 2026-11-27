/**
 * TỶ SỐ LOẠT Ở TÌM THẺ ONLINE (28.11.2026, chủ dự án: "tôi thắng mà điểm số của tôi lại từ -1 đến 0"). Bảng kết quả tra số
 * ván thắng (`seriesWins`, server đếm theo người, client giữ theo TÊN THẬT trong phòng) bằng `nguoiChoi[].name`. Màn Tìm Thẻ
 * đưa tên hiển thị ("Bạn") → tra hụt → số thắng của mình = 0, người thắng cuộn "-1 → 0".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Tìm Thẻ online: bảng kết quả nhận TÊN THẬT trong phòng', () => {
  it('nguoiChoi.name lấy từ người trong phòng, không phải tên hiển thị', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineTimThe.vue'), 'utf8');
    expect(src).toContain('name: nguoiPhong(p.id)?.name ?? p.name');
  });
});
