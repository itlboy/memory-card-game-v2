import { ROOM_LIMITS } from '@mm/engine';
import { RoomDO } from './room.js';
import type { Env as RoomEnv } from './room.js';
import { SoPhongDO } from './sophong-do.js';
import { soPhongTuBinding } from './sophong.js';

export { RoomDO, SoPhongDO };

/**
 * Env của worker = env của phòng + binding sổ phòng.
 *
 * `SO_PHONG` trong RoomEnv là interface đã BỌC; ở đây `SO_PHONG_DO` là binding
 * Durable Object thô. Hai tên khác nhau có chủ đích: RoomDO không được chạm vào
 * binding thô, nó chỉ biết cái interface — y như cách cf-shim giấu tầng dưới.
 */
export interface Env extends RoomEnv {
  SO_PHONG_DO: DurableObjectNamespace<SoPhongDO>;
  /** File tĩnh của web (Workers Static Assets) — dùng cho /ota/* (xem dưới). */
  ASSETS: Fetcher;
}

/** Mã phòng toàn số — dễ đọc cho nhau qua điện thoại, gõ bằng bàn phím số. */
const CODE_ALPHABET = '0123456789';

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_LIMITS.codeLength));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    /*
     * Danh sách phòng công khai (ON-10) — màn "Chơi online" gọi ngay khi mở.
     *
     * PHẢI đứng TRƯỚC `/api/rooms/:code`: mẫu kia cũng khớp một đoạn 6 ký tự,
     * và tuy "public" không phải 6 chữ số nên hiện chưa đụng nhau, đặt sau là
     * đặt một cái bẫy cho lần đổi mã phòng tiếp theo.
     */
    if (url.pathname === '/api/rooms/public' && request.method === 'GET') {
      const rooms = await soPhongTuBinding(env.SO_PHONG_DO).liet();
      return Response.json({ rooms }, { headers: CORS });
    }

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

    /*
     * GÓI CẬP NHẬT NÓNG (16.10.2026): /ota/* do Worker phục vụ từ chính bản build này
     * (manifest, danh sách file, /ota/f/<sha256>, zip < 24MiB) — không còn phụ thuộc pod
     * Node (503 lúc Keel thay pod). Thiếu file → 404 THẬT: SPA fallback trả index.html 200
     * thì app đọc nhầm trang web thành manifest/file gói (CLAUDE.md "ĐỪNG LÀM HỎNG CẬP NHẬT NÓNG").
     */
    if (url.pathname.startsWith('/ota/')) {
      const r = await env.ASSETS.fetch(request);
      const loai = r.headers.get('content-type') ?? '';
      if (r.status === 404 || (loai.includes('text/html') && !url.pathname.endsWith('.html'))) {
        return new Response('Not found', { status: 404, headers: CORS });
      }
      return r;
    }

    /*
     * THẺ CHIA SẺ RIÊNG CHO LINK MỜI (11.11.2026, mockup https://claude.ai/artifact/MkD66nuGdEmYrYf9wmniWy):
     * `/?room=482193&tu=Kiên&l=vi` → tiêu đề "Kiên mời bạn đấu Lật Thẻ!", mô tả có mã phòng, ảnh
     * og-moi. Tên người mời nằm sẵn trong link (không tra phòng). Ảnh dùng CHUNG mọi phòng vì
     * Zalo/Facebook cache ảnh rất lâu; phần riêng nằm ở chữ. Chỉ "/" đi qua Worker
     * (`run_worker_first`), mọi đường khác vẫn là asset tĩnh.
     */
    if (url.pathname === '/') {
      const r = await env.ASSETS.fetch(request);
      const code = url.searchParams.get('room') ?? '';
      if (!/^\d{6}$/.test(code) || !(r.headers.get('content-type') ?? '').includes('text/html')) return r;
      return theMoi(r, code, url);
    }

    return new Response('Not found', { status: 404, headers: CORS });
  }
} satisfies ExportedHandler<Env>;

/** Chữ thẻ mời: tiếng Việt khi người mời dùng tiếng Việt, còn lại tiếng Anh. */
export function chuTheMoi(code: string, tuTho: string | null, l: string | null): { title: string; desc: string; anh: string } {
  const tu = (tuTho ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  if (l === 'vi' || l === null) {
    return {
      title: tu ? `${tu} mời bạn đấu Lật Thẻ!` : 'Bạn được mời đấu Lật Thẻ!',
      desc: `Phòng ${code} · Bấm để vào chơi ngay, không cần cài app`,
      anh: 'og-moi.jpg',
    };
  }
  return {
    title: tu ? `${tu} challenges you to Flip Match!` : 'You are invited to Flip Match!',
    desc: `Room ${code} · Tap to join and play right away, no install needed`,
    anh: 'og-moi-en.jpg',
  };
}

function theMoi(r: Response, code: string, url: URL): Response {
  const c = chuTheMoi(code, url.searchParams.get('tu'), url.searchParams.get('l'));
  const anh = `${url.origin}/${c.anh}?v=1`;
  const dat = (v: string) => ({ element(e: Element) { e.setAttribute('content', v); } });
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(c.title); } })
    .on('meta[property="og:title"], meta[name="twitter:title"]', dat(c.title))
    .on('meta[property="og:description"], meta[name="twitter:description"], meta[name="description"]', dat(c.desc))
    .on('meta[property="og:image"], meta[name="twitter:image"]', dat(anh))
    .on('meta[property="og:url"]', dat(url.toString()))
    .on('meta[property="og:image:alt"]', dat(c.title))
    .transform(r);
}
