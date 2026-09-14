import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ĐIỂM PHẢI NẰM TRONG CHIP NGƯỜI CHƠI.
 *
 * Đo trên iPhone 15 Pro Max (VÙNG WEB 430×745, xem bảng trong CLAUDE.md): ván
 * online 3 người, điểm 1280 thì điểm của người đang đi nằm ở x=443 — NGOÀI màn
 * hình 430. Người chơi báo. Nguyên nhân là ba thứ cộng lại: mọi thứ trong chip
 * đều `nowrap`, tên có sàn `min-width` nên không co thêm được, và chip không
 * cắt phần thừa — mà `.pts` có `margin-left: auto` nên nó đứng cuối hàng và
 * chính nó bị đẩy ra.
 *
 * Trần điểm lý thuyết là 5 chữ số: bàn 88 thẻ = 44 cặp × 200 điểm (combo ×2)
 * cộng thưởng thời gian. Thêm huy hiệu mới vào chip thì phải đo lại tới đó.
 */
const FILES = {
  'OnlineGame.vue': readFileSync(resolve(process.cwd(), 'src/components/OnlineGame.vue'), 'utf8'),
  'PlayerStrip.vue': readFileSync(resolve(process.cwd(), 'src/components/PlayerStrip.vue'), 'utf8')
};

describe('điểm nằm trong chip người chơi', () => {
  for (const [ten, src] of Object.entries(FILES)) {
    describe(ten, () => {
      it('điểm không co lại — nó là thứ CUỐI CÙNG bị hy sinh', () => {
        const sel = ten === 'OnlineGame.vue' ? '.pchip .pts {' : '\n.pts {';
        const khoi = src.slice(src.indexOf(sel), src.indexOf(sel) + 260);
        // `flex: none` là dạng gọn của `0 0 auto` — cùng ý: điểm không co.
        expect(khoi, 'điểm co được là nó bị nén rồi bị đẩy ra').toMatch(/flex-shrink:\s*0|flex:\s*none/);
      });

      it('chip cắt phần thừa — lưới an toàn cho mọi huy hiệu thêm sau này', () => {
        const mo = src.indexOf(ten === 'OnlineGame.vue' ? '.pchip {' : '.player {');
        expect(src.slice(mo, mo + 520)).toMatch(/overflow:\s*hidden/);
      });

      it('tên co được, nhưng không biến mất khỏi chip của người đang đi', () => {
        const mo = src.indexOf(ten === 'OnlineGame.vue' ? '.pchip b {' : '.name {');
        const khoi = src.slice(mo, mo + 220);
        expect(khoi, 'tên phải co được').toMatch(/flex:\s*1 1 auto/);
        expect(khoi, 'sàn 3.5em bịt mất chỗ co cuối cùng').not.toMatch(/min-width:\s*3\.5em/);
      });

      it('đồng hồ lượt không tốn bề rộng: nó là thanh absolute ở mép dưới', () => {
        const mo = src.indexOf('.turn-bar {');
        expect(mo, 'thiếu hẳn thanh thời gian').toBeGreaterThan(0);
        expect(src.slice(mo, mo + 220)).toMatch(/position:\s*absolute/);
      });

      it('mạng hiện bằng SỐ, không phải chuỗi trái tim (chuỗi phình theo số mạng)', () => {
        expect(src, "'❤️'.repeat() quay lại là chip lại tràn ở bàn nhiều mạng")
          .not.toMatch(/'❤️'\.repeat/);
      });

      it('chip của người đang đi nở rộng — vừa gây chú ý, vừa là chỗ chứa điểm', () => {
        const mo = src.indexOf(ten === 'OnlineGame.vue' ? '.pchip.active {' : '.player.active {');
        expect(src.slice(mo, mo + 420)).toMatch(/flex-grow:\s*1\.75/);
      });

      it('điểm càng cao càng KHÔNG nhỏ đi — chỗ để hạ lấy từ thứ khác trong chip', () => {
        // Bản đầu làm ngược: ≥1000 tụt thẳng xuống 13px, hoá ra ván càng hay
        // thì điểm càng khó đọc. Nay mỗi chữ số thêm chỉ hạ một nấc nhỏ, và
        // điểm vẫn to hơn mọi chữ khác trong chip (tên 13px).
        const co = (sel: string): number => {
          const mo = src.indexOf(sel);
          const m = /font-size:\s*([\d.]+)px/.exec(src.slice(mo, mo + 200));
          return m ? Number(m[1]) : 0;
        };
        const goc = ten === 'OnlineGame.vue' ? '.pchip .pts {' : '\n.pts {';
        expect(co(goc)).toBeGreaterThanOrEqual(16);
        expect(co(ten === 'OnlineGame.vue' ? '.pchip .pts.dai {' : '\n.pts.dai {')).toBeGreaterThanOrEqual(15);
        expect(co(ten === 'OnlineGame.vue' ? '.pchip .pts.ratdai {' : '\n.pts.ratdai {')).toBeGreaterThanOrEqual(13.5);
      });

      it('thứ tự hy sinh khi chip hẹp dần được khai bằng @container', () => {
        // Ngưỡng là CONTENT-BOX (chip trừ padding 18 + viền 4), không phải bề
        // rộng chip: chip 200px khớp `max-width: 176px`.
        expect(src).toMatch(/@container \(max-width: 176px\)[^}]*turn-clock[^}]*display:\s*none/);
        expect(src).toMatch(/@container \(max-width: 128px\)[^}]*lives[^}]*display:\s*none/);
        // Bàn 4 người: chip CHỜ chỉ còn 61px nội dung — bỏ tên, giữ avatar + điểm.
        expect(src).toMatch(/@container \(max-width: 72px\)/);
      });
    });
  }
});

/**
 * BANNER "ĐẾN LƯỢT …" CHỈ CÒN BÁO LƯỢT CỦA CHÍNH MÌNH (ván online).
 *
 * Chip của người đang đi nay nở rộng và sáng gradient nên "đang tới lượt ai"
 * đã đọc được trên dải; ở bàn 4 người thì ba trên bốn lần banner là nói về
 * người khác. Giữ lại đúng hai thứ chip không thay được: "Đến lượt bạn" và câu
 * "X bị đóng băng, mất lượt".
 */
describe('banner báo lượt', () => {
  const online = readFileSync(resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');
  const local = readFileSync(resolve(process.cwd(), 'src/composables/useGameSession.ts'), 'utf8');

  it('ván online: mặc định KHÔNG báo lượt của người khác', () => {
    expect(online).toMatch(/const BAO_LUOT_NGUOI_KHAC = false;/);
    expect(online, 'công tắc phải nằm trên đường đi của banner, không thì nó là hằng số chết')
      .toMatch(/if \(p && \(BAO_LUOT_NGUOI_KHAC \|\| dangLuotMinh \|\| coDongBang\)\)/);
  });

  it('bàn chơi chung máy vẫn báo MỌI lượt — đó là lời gọi đưa máy cho người kế tiếp', () => {
    expect(local).toMatch(/if \(turnId && \(game\.value\?\.players\.length \?\? 0\) > 1\)/);
    expect(local).not.toMatch(/BAO_LUOT_NGUOI_KHAC/);
  });
});
