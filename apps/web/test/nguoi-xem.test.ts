import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * VAI NGƯỜI XEM LÀ LỰA CHỌN ĐƯỢC GIỮ (23.11.2026, chủ dự án): vào xem thì hết ván vẫn là người xem; người ở phòng chờ tự chọn
 * "Chỉ xem"; chỉ thành người chơi khi tự bấm "Vào chơi". Canh ba mắt xích — E2E thật đã chạy tay (bot + trình duyệt).
 */
const room = readFileSync(resolve(process.cwd(), '../server/src/room.ts'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'src/composables/useOnlineRoom.ts'), 'utf8');
const man = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('vai người xem', () => {
  it('server: `?xem=1` vào làm người xem kể cả khi phòng chờ còn chỗ', () => {
    expect(room).toMatch(/const xemChuDong = url\.searchParams\.get\('xem'\) === '1'/);
    expect(room).toMatch(/if \(xemChuDong \|\| this\.room\.status !== 'lobby' \|\| this\.room\.players\.length >= ROOM_LIMITS\.maxPlayers\)/);
  });
  it('client: đã là người xem thì nối lại vẫn khai xem=1, và KHÔNG còn tự nối lại thành người chơi ở phòng chờ', () => {
    expect(client).toMatch(/if \(msg\.spectator\) muonXem = true/);
    expect(client).toMatch(/if \(muonXem && !useToken\) params\.set\('xem', '1'\)/);
    expect(client).not.toMatch(/spectator\.value && msg\.room\.status === 'lobby'\s*\n\s*&& msg\.room\.players\.length < ROOM_LIMITS\.maxPlayers/);
  });
  it('client: vào phòng mới (tạo / nhập mã) thì bỏ vai xem cũ', () => {
    expect(client.match(/muonXem = false; connect\(/g)?.length).toBe(2);
  });
  it('phòng chờ: người xem có thẻ "Bạn đang xem" + nút Vào chơi; người chơi (không phải chủ phòng) có nút Chỉ xem', () => {
    expect(man).toMatch(/class="the-san the-xem"/);
    expect(man).toMatch(/@click="sfx\.select\(\); o\.vaoChoi\(\)"/);
    expect(man.match(/o\.chuyenXem\(\)/g)?.length).toBe(2);
    expect(client).toMatch(/room\.value\?\.status !== 'lobby' \|\| isHost\.value\) return;/);
  });
});

/*
 * NGƯỜI XEM THẢ EMOJI + POPUP CHỌN SỐ THẺ (23.11.2026). Hành vi thật đã thử bằng kết nối thật (server cục bộ); ở đây canh
 * các mắt xích dễ bị gỡ nhầm.
 */
describe('người xem thả emoji, không chat chữ', () => {
  const bar = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
  it('server: khán giả chỉ được gửi emoji, hạn mức riêng, phát kèm tên', () => {
    expect(room).toMatch(/if \(att\?\.xem\) this\.emojiNguoiXem\(att\.xem\.ten, raw\)/);
    expect(room).toMatch(/if \(msg\.t !== 'emoji' \|\| !\(QUICK_EMOJIS as readonly string\[\]\)\.includes\(msg\.emoji\)\) return;/);
    expect(room).toMatch(/ROOM_LIMITS\.xemEmojiBurst, ROOM_LIMITS\.xemEmojiWindowMs/);
  });
  it('client: thanh emoji hiện cho người xem nhưng không có nút nói nhanh; sendSay bỏ qua', () => {
    expect(bar).not.toMatch(/<div v-if="!props\.o\.spectator\.value" ref="goc"/);
    expect(bar).toMatch(/v-if="!props\.o\.spectator\.value"\s*\n\s*class="emoji noi/);
    expect(client).toMatch(/if \(spectator\.value\) return;   \/\/ người xem chỉ thả emoji/);
  });
});

describe('popup chọn số thẻ', () => {
  const popup = readFileSync(resolve(process.cwd(), 'src/components/ChonSoThe.vue'), 'utf8');
  it('server mở lượt chọn ở cả Bắt đầu lẫn Chơi lại, phòng thi đấu bỏ qua', () => {
    expect(room.match(/await this\.moChonThe\(\);/g)?.length).toBe(2);
    expect(room).toMatch(/if \(this\.room\.thiDau\) \{ await this\.batDauDemNguoc\(\); return; \}/);
    expect(room).toMatch(/if \(this\.chon && now >= this\.chon\.het\) await this\.chotChon\(\);/);
  });
  it('popup: ô chỉ có con số, người xem thấy nhưng bị khoá, không dùng @keyframes cho thanh giờ', () => {
    expect(popup).toMatch(/<b>\{\{ the \}\}<\/b>/);
    expect(popup).toMatch(/:disabled="chiXem"/);
    expect(popup).not.toMatch(/@keyframes [\w-]+ \{/);   // chỉ còn chữ "@keyframes" trong chú thích
    expect(man).toMatch(/<ChonSoThe :o="o" \/>/);
  });
});
