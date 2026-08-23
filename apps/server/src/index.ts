import { ROOM_LIMITS } from '@mm/engine';
import { RoomDO } from './room.js';
import type { Env } from './room.js';

export { RoomDO };

/** Mã phòng toàn số — dễ đọc cho nhau qua điện thoại, gõ bằng bàn phím số. */
const CODE_ALPHABET = '0123456789';

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_LIMITS.codeLength));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Tạo phòng: trả về mã 6 ký tự (ON-01)
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = makeCode();
      // Đánh dấu phòng đã mở. Thiếu bước này thì MỌI mã 6 số đều "vào được"
      // (Durable Object sinh theo tên), nên gõ sai là lập phòng mới trong im
      // lặng thay vì báo lỗi.
      await env.ROOM.getByName(code).open();
      return Response.json({ code }, { headers: CORS });
    }

    // Kiểm mã trước khi mở WebSocket, để báo lỗi rõ ràng thay vì để socket
    // đóng không rõ nguyên nhân
    const check = url.pathname.match(/^\/api\/rooms\/([0-9]{6})$/);
    if (check && request.method === 'GET') {
      const exists = await env.ROOM.getByName(check[1]!).exists();
      return Response.json({ exists }, { headers: CORS });
    }

    // Vào phòng: nâng cấp WebSocket rồi chuyển cho DO của phòng đó
    const match = url.pathname.match(/^\/ws\/([0-9]{6})$/);
    if (match) {
      const code = match[1]!.toUpperCase();
      const stub = env.ROOM.getByName(code);
      const forward = new URL(request.url);
      forward.searchParams.set('code', code);
      return stub.fetch(new Request(forward, request));
    }

    if (url.pathname === '/health') return Response.json({ ok: true }, { headers: CORS });

    return new Response('Not found', { status: 404, headers: CORS });
  }
} satisfies ExportedHandler<Env>;
