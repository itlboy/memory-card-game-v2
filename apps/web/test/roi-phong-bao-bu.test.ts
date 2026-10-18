import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * RỜI PHÒNG PHẢI TỚI ĐƯỢC SERVER (lỗi chủ dự án báo 18.10.2026): thoát ra, vào lại vẫn thấy phòng
 * mình tạo, vào thì "người kia rớt mạng" — chính là mình. Gốc: gửi `cancel`/`leave` rồi đóng socket
 * NGAY (lời rơi mất), hoặc socket chết mà vẫn báo OPEN; phiên thì bị xoá nên vào lại thành người mới.
 * Đã tái hiện bằng trình duyệt thật (phòng còn trên server sau khi "thoát") và kiểm bản sửa.
 */
const src = readFileSync(resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');
const man = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('rời phòng có xác nhận + báo bù', () => {
  it('đầu hàng / huỷ phòng đi qua roiCoBao (chờ server xác nhận), không send-rồi-đóng-ngay', () => {
    expect(src).toMatch(/surrender: \(\) => roiCoBao\('leave'\)/);
    expect(src).toMatch(/cancelRoom: \(\) => roiCoBao\('cancel'\)/);
    const khoi = src.slice(src.indexOf('function roiCoBao('), src.indexOf('function thoatPhong('));
    expect(khoi, 'phải chờ mã đóng 4001/4002 từ server').toMatch(/4001[\s\S]*4002/);
    expect(khoi, 'không có xác nhận thì ghi ý định để báo bù').toContain('ROI_CHO_KEY');
  });
  it('thoát không qua hộp hỏi (màn lỗi/đang nối) vẫn báo rời — không xoá phiên trơn', () => {
    expect(man).toMatch(/function exit\(\): void \{\s*o\.thoatPhong\(\)/);
  });
  it('mở màn online: báo bù TRƯỚC khi tải danh sách phòng', () => {
    expect(man).toMatch(/o\.guiRoiCho\(\)\.then\(\(\) => o\.taiPhongCongKhai\(\)\)/);
  });
});
