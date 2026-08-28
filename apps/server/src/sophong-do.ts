import { DurableObject } from 'cloudflare:workers';
import type { PublicRoom } from '@mm/engine';
import { locVaSap } from './sophong.js';

/**
 * SỔ PHÒNG trên Cloudflare — một Durable Object DUY NHẤT cho cả worker.
 *
 * Vì sao là DO chứ không phải KV: sổ bị ghi mỗi lần có người vào/ra một phòng
 * bất kỳ, và đọc mỗi lần ai đó mở màn online. KV nhất quán CUỐI CÙNG (ghi xong
 * đọc lại có thể vẫn ra bản cũ tới cả phút), nên vừa tạo phòng xong mở danh
 * sách sẽ không thấy phòng của chính mình — đúng thứ người chơi thử đầu tiên.
 * DO thì tuần tự và đọc-sau-ghi luôn đúng.
 *
 * Một DO cho TẤT CẢ phòng nghe như nút thắt cổ chai, nhưng tải ở đây rất mỏng:
 * RoomDO chỉ khai lại khi CHỮ KÝ công khai của phòng đổi (xem `chuKySo` trong
 * room.ts), không phải mỗi nước lật thẻ.
 *
 * Trạng thái nằm trong storage chứ không phải biến trong RAM: DO bị đá khỏi bộ
 * nhớ bất cứ lúc nào, và một cái sổ trống sau khi bị đá nghĩa là mọi phòng đang
 * chờ biến mất khỏi danh sách cho tới khi có người vào/ra.
 */
export class SoPhongDO extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/khai' && request.method === 'POST') {
      const phong = (await request.json()) as PublicRoom;
      await this.ctx.storage.put(`p:${phong.code}`, phong);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/xoa' && request.method === 'POST') {
      const { code } = (await request.json()) as { code: string };
      await this.ctx.storage.delete(`p:${code}`);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/liet') {
      const map = await this.ctx.storage.list<PublicRoom>({ prefix: 'p:' });
      const now = Date.now();
      const song = locVaSap(map.values(), now);
      // Dọn bản ghi quá hạn ngay trong lúc đọc — không có gì khác đánh thức DO
      // này, nên nếu không dọn ở đây thì rác nằm lại vĩnh viễn trong storage.
      const rac = [...map].filter(([, r]) => now - r.luc >= 900_000).map(([k]) => k);
      if (rac.length) await this.ctx.storage.delete(rac);
      return Response.json(song);
    }

    return new Response('Not found', { status: 404 });
  }
}
