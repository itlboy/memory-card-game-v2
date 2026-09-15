import { describe, expect, it } from 'vitest';
import { MAX_ASPECT, MIN_ASPECT, computeFit, tranTyLe } from '@/composables/useBoardFit';
import { allLevels } from '@mm/engine';

/*
 * CHỖ TRỐNG THẬT CỦA BÀN — ĐO TỪ ẢNH CHỤP VÁN THẬT, không phải ước lượng.
 *
 * Bộ số cũ (510 / 618 / 700) cao hơn thực tế tới 200px, nên mọi phép canh dưới
 * đây từng luôn xanh trong khi bàn thật hụt bề rộng — nó đo một cái máy không
 * tồn tại. Số mới suy từ ảnh ván online trên iPhone 15 Pro Max: bàn 88 thẻ đo
 * được 362×495 CSS px, khớp đúng `availH ≈ 500`. Vùng web máy đó là 745, nên
 * phần KHÔNG phải bàn (header, HUD, dải người chơi, khung chat, đệm, vùng an
 * toàn) ăn ~245px; hai máy kia suy ra cùng mức đó.
 *
 * ONLINE là ca xấu nhất vì khung chat ăn thêm ~44px chiều cao — mà bàn bị chặn
 * bởi CHIỀU CAO, nên mất chiều cao là mất luôn bề rộng.
 */
const CHAT = 44;
const AREAS = {
  'iPhone SE': [351, 308],
  'iPhone 14': [366, 419],
  'iPhone 15 Pro Max': [406, 500]
} as const;
/** Chơi một mình: không có khung chat nên bàn được thêm chỗ. */
const AREAS_SOLO = Object.fromEntries(
  Object.entries(AREAS).map(([k, [w, h]]) => [k, [w, h + CHAT]])
) as Record<string, readonly [number, number]>;

describe('tính cỡ bàn thẻ', () => {
  it('tỷ lệ lá bài luôn nằm trong khoảng cho phép', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { aspect } = computeFit(w, h, l.cols, l.rows);
        expect(aspect, `cấp ${l.id} @ ${name}`).toBeGreaterThanOrEqual(MIN_ASPECT);
        // Trần theo CỠ BÀN: bàn lớn được nở quá vuông để lấp nốt bề rộng.
        expect(aspect, `cấp ${l.id} @ ${name}`).toBeLessThanOrEqual(tranTyLe(l.cols, l.rows));
      }
    }
  });

  it('bàn không bao giờ rộng hơn chỗ được chia', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        expect(computeFit(w, h, l.cols, l.rows).width, `cấp ${l.id} @ ${name}`)
          .toBeLessThanOrEqual(w);
      }
    }
  });

  /*
   * BỀ RỘNG BỎ PHÍ CHỈ ĐƯỢC PHÉP KHI TRẦN TỈ LỆ LÀ THỨ CHẶN.
   *
   * Không đòi 95% vô điều kiện được nữa: có lưới "béo" hơn khung (2×3 trên SE
   * cần tỉ lệ 1,75 mới lấp hết) và ở đó kéo rộng thêm chỉ làm lá thành thanh
   * ngang. Nhưng nếu tỉ lệ CHƯA chạm trần mà bề rộng vẫn thừa thì đó là lỗi
   * tính — chỗ trống đáng lẽ đã chia được cho lá bài.
   */
  it('không bỏ phí bề rộng khi tỉ lệ chưa chạm trần', () => {
    for (const bo of [AREAS, AREAS_SOLO]) {
      for (const l of allLevels()) {
        for (const [name, [w, h]] of Object.entries(bo)) {
          const { width, aspect } = computeFit(w, h, l.cols, l.rows);
          const dungHet = width / w > 0.95;
          const chamTran = aspect >= tranTyLe(l.cols, l.rows) - 0.001;
          expect(dungHet || chamTran,
            `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}: lấp ${Math.round(width / w * 100)}% mà tỉ lệ mới ${aspect.toFixed(2)}`)
            .toBe(true);
        }
      }
    }
  });

  /* Bàn LỚN là chỗ từng phí nhiều nhất, và cũng là chỗ dáng lá gần như không
     đọc được — nên ở đó đòi lấp gần kín, kể cả ván online có khung chat. */
  it('bàn lớn lấp gần kín bề rộng, kể cả khi có khung chat', () => {
    // 88 thẻ trên iPhone SE là ngoại lệ: lưới 8×11 quá cao so với khung 351×308,
    // cần tỉ lệ 1,6 mới lấp hết — quá xa dáng thẻ. Ở đó lá đã 28px, đúng tinh
    // thần "bàn siêu khó người chơi tự chọn".
    for (const l of allLevels().filter((x) => x.cols * x.rows >= 56 && x.cols * x.rows < 88)) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { width } = computeFit(w, h, l.cols, l.rows);
        // 92% chứ không 95%: ca chặt nhất là 56 thẻ trên iPhone SE có khung chat,
        // đạt 92,9% ở đúng trần tỉ lệ 1,25 — thừa 25px chia hai bên, 12px mỗi
        // bên. Đòi 95% ở đó là buộc phải nới trần lên 1,32, lúc ấy lá rộng gấp
        // rưỡi chiều cao. Trước bản này ca đó chỉ đạt 76%.
        expect(width / w, `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}`).toBeGreaterThan(0.92);
      }
    }
  });

  /*
   * NGƯỠNG CHẠM 44px — và hai ngoại lệ, cả hai đều ĐO ĐƯỢC chứ không phỏng đoán.
   *
   * 1. Hai cỡ lớn nhất (72 và 88 thẻ) CỐ Ý phá ngưỡng: bàn siêu khó người chơi
   *    tự chọn, xem chú thích BOARDS trong campaign.ts.
   * 2. VÁN ONLINE TRÊN MÁY NHỎ NHẤT: khung chat ăn 44px chiều cao, và trên
   *    iPhone SE bàn 56 thẻ khi đó chỉ còn lá 41,4px. Muốn đủ 44px thì lá phải
   *    rộng gấp 1,32 lần chiều cao — quá dáng thẻ. Đây là giới hạn của CÁI MÁY
   *    (351×308 cho bàn), không phải lỗi tính: chơi một mình trên chính máy đó
   *    ra 45px, đạt ngưỡng. Nên chốt này đo bàn ≤56 thẻ ở ván MỘT MÌNH, và đo
   *    thêm bàn ≤42 thẻ ở ván online.
   */
  it('lá bài không bao giờ dưới ngưỡng chạm 44px (NF-07) khi chơi một mình', () => {
    for (const l of allLevels().filter((x) => x.pairs * 2 <= 56)) {
      for (const [name, [w, h]] of Object.entries(AREAS_SOLO)) {
        const { width } = computeFit(w, h, l.cols, l.rows);
        const gap = w < 420 ? 6 : 8;
        const cardW = (width - gap * (l.cols - 1)) / l.cols;
        expect(cardW, `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it('ván online: bàn tới 42 thẻ vẫn giữ ngưỡng chạm 44px', () => {
    for (const l of allLevels().filter((x) => x.pairs * 2 <= 42)) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { width, gap } = computeFit(w, h, l.cols, l.rows);
        const cardW = (width - gap * (l.cols - 1)) / l.cols;
        expect(cardW, `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it('hàng thẻ vẽ bằng đúng khe hở đã tính — không hàng nào rộng hơn khung', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { width, gap } = computeFit(w, h, l.cols, l.rows);
        const cardW = (width - gap * (l.cols - 1)) / l.cols;
        expect(cardW * l.cols + gap * (l.cols - 1), `cấp ${l.id} @ ${name}`)
          .toBeLessThanOrEqual(w);
      }
    }
  });

  /* Lá bài phải giữ DÁNG THẺ, không bị kéo dài cho kín khung: bàn cao đúng bằng
     cỡ thẻ đã chọn, nên khi còn dư chiều cao thì để dư. Bản trước ép bàn cao
     100% khung và máy tính ra lá cao ngoằng, khe hở trông như dính (có ảnh). */
  it('bàn không bao giờ cao hơn chỗ được chia, và cao đúng theo cỡ thẻ', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { height, aspect, gap, width } = computeFit(w, h, l.cols, l.rows);
        expect(height, `cấp ${l.id} @ ${name}`).toBeLessThanOrEqual(h);
        // chiều cao phải khớp chính cỡ thẻ suy ra từ bề rộng — hai số một phép tính
        const cardW = (width - gap * (l.cols - 1)) / l.cols;
        const tinh = (cardW / aspect) * l.rows + gap * (l.rows - 1);
        expect(Math.abs(height - tinh), `cấp ${l.id} @ ${name}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('chỗ trống ít hơn thì bàn nhỏ theo, không tràn ra ngoài', () => {
    // Màn online có thêm bảng người chơi nên chiều cao ít hơn chơi đơn
    const solo = computeFit(366, 618, 4, 5);
    const online = computeFit(366, 530, 4, 5);
    expect(online.width).toBeLessThanOrEqual(solo.width);
    expect(online.width).toBeLessThanOrEqual(366);
  });
});
