import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * HAI CHỖ CHẠY SERVER, MỘT BỘ LUẬT.
 *
 * `apps/server` là bản Cloudflare (Worker + Durable Object); `apps/node-server`
 * là bản dự phòng chạy Node, để đặt được ở Hà Nội những hôm CF lag từ Việt Nam.
 *
 * Luật phòng dùng CHUNG `apps/server/src/room.ts` — bản Node nạp thẳng lớp
 * `RoomDO` và chỉ thay tầng dưới. Nhưng TẦNG HTTP thì có hai bản, và đó là chỗ
 * dễ sửa một bên quên bên kia: thêm một endpoint ở Cloudflare mà quên bản Node
 * thì người chơi đổi sang máy dự phòng là gặp lỗi không ai hiểu.
 *
 * Test đọc nguồn vì hai bản chạy trên hai runtime khác nhau, không dựng chung
 * trong một tiến trình vitest được. Hành vi thật thì đã có bộ smoke E2E chạy
 * được với CẢ HAI (đặt MM_SERVER trỏ vào bản nào cũng chạy).
 */
const cf = readFileSync(resolve(process.cwd(), '../server/src/index.ts'), 'utf8');
const node = readFileSync(resolve(process.cwd(), '../node-server/src/index.ts'), 'utf8');
const room = readFileSync(resolve(process.cwd(), '../server/src/room.ts'), 'utf8');
const shim = readFileSync(resolve(process.cwd(), '../node-server/src/cf-shim.ts'), 'utf8');

describe('luật phòng KHÔNG được nhân bản', () => {
  it('bản Node nạp thẳng RoomDO của bản Cloudflare', () => {
    expect(node, 'phải import RoomDO từ apps/server, không tự viết lại')
      .toMatch(/import \{ RoomDO \} from '\.\.\/\.\.\/server\/src\/room\.js'/);
  });

  it('bản Node không chứa luật chơi nào', () => {
    // Vài dấu hiệu chắc chắn của luật phòng. Thấy chúng ở đây nghĩa là đã có
    // người bắt đầu viết bản thứ hai — chặn ngay từ commit đó.
    for (const dau of ['SILENT_MS', 'reconnectMs', 'againVotes', 'publicView', 'MemoryGame']) {
      expect(node, `node-server không được nhắc tới "${dau}" — đó là việc của room.ts`)
        .not.toMatch(new RegExp(dau));
    }
  });

  it('shim chỉ thay TẦNG DƯỚI: storage, socket, alarm', () => {
    for (const api of ['storage', 'acceptWebSocket', 'getWebSockets', 'setAlarm', 'deleteAlarm']) {
      expect(shim, `shim thiếu ${api} — room.ts gọi nó`).toMatch(new RegExp(api));
    }
  });
});

describe('tầng HTTP: hai bản phải khớp', () => {
  /** Mọi endpoint bản Cloudflare phục vụ. */
  const ENDPOINTS = [
    { ten: 'tạo phòng', cf: /'\/api\/rooms'/, node: /'\/api\/rooms'/ },
    { ten: 'kiểm mã phòng', cf: /\\\/api\\\/rooms\\\/\(\[0-9\]\{6\}\)/, node: /\\\/api\\\/rooms\\\/\(\[0-9\]\{6\}\)/ },
    { ten: 'vào phòng qua WebSocket', cf: /\\\/ws\\\/\(\[0-9\]\{6\}\)/, node: /\\\/ws\\\/\(\[0-9\]\{6\}\)/ },
    { ten: 'health', cf: /'\/health'/, node: /'\/health'/ }
  ];

  for (const e of ENDPOINTS) {
    it(`${e.ten}: có ở CẢ HAI bản`, () => {
      expect(cf, `bản Cloudflare thiếu ${e.ten}`).toMatch(e.cf);
      expect(node, `bản Node thiếu ${e.ten} — đổi endpoint thì phải sửa cả hai`).toMatch(e.node);
    });
  }

  it('mã phòng sinh giống nhau: 6 ký tự, toàn số', () => {
    for (const [ten, src] of [['Cloudflare', cf], ['Node', node]] as const) {
      expect(src, `${ten}: bảng ký tự mã phòng`).toMatch(/CODE_ALPHABET = '0123456789'/);
      expect(src, `${ten}: độ dài lấy từ ROOM_LIMITS, đừng ghi cứng`)
        .toMatch(/ROOM_LIMITS\.codeLength/);
    }
  });

  it('CORS mở như nhau — client có thể trỏ sang máy dự phòng từ tên miền khác', () => {
    for (const [ten, src] of [['Cloudflare', cf], ['Node', node]] as const) {
      expect(src, `${ten}: thiếu Access-Control-Allow-Origin`)
        .toMatch(/'Access-Control-Allow-Origin': '\*'/);
    }
  });

  it('API phải đứng TRƯỚC fallback SPA ở cả hai bản', () => {
    // Bẫy đã có thật ở bản Cloudflare (xem deploy-config.test.ts): bỏ
    // `run_worker_first` thì /api/rooms trả về index.html và `res.json()` ném lỗi.
    // Bản Node dễ mắc lại vì thứ tự ở đây là thứ tự câu lệnh trong hàm.
    const viTriApi = node.indexOf("'/api/rooms'");
    const viTriFallback = node.indexOf('traFileTinh(url, res)');
    expect(viTriApi, 'bản Node: không thấy route API').toBeGreaterThan(-1);
    expect(viTriFallback, 'bản Node: không thấy fallback tĩnh').toBeGreaterThan(-1);
    expect(viTriApi, 'route API phải nằm trước fallback SPA').toBeLessThan(viTriFallback);
  });
});

describe('những chỗ bản Node CỐ Ý khác', () => {
  it('ghi rõ phòng nằm trong RAM — restart là mất phòng đang mở', () => {
    expect(node).toMatch(/RAM/);
  });

  it('room.ts vẫn không hề biết tới Node: chỉ import cloudflare:workers', () => {
    expect(room).toMatch(/from 'cloudflare:workers'/);
    expect(room, 'room.ts không được import gì của node-server').not.toMatch(/node-server/);
  });
});
