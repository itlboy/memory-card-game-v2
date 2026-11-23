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
