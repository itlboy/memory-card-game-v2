import { randomBytes } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import { Redis } from 'ioredis';
import type { PublicRoom } from '@mm/engine';
import { HAN_BAN_GHI_MS, locVaSap, type SoPhong } from '../../server/src/sophong.js';

/**
 * CỤM NHIỀU POD (28.11.2026, chủ dự án chọn "mức 3": nhiều pod chạy cùng lúc, Redis điều phối).
 *
 * LUẬT GỐC: mỗi phòng có ĐÚNG MỘT pod chủ tại một thời điểm — pod đó giữ RoomDO trong RAM, chạy đồng hồ, ghi MySQL.
 * Các pod khác nhận request của phòng đó thì CHUYỂN TIẾP sang pod chủ (index.ts `chuyenHttp` / `chuyenWs`). Luật chơi
 * (room.ts) không biết gì về chuyện này — y như cách cf-shim thay tầng dưới.
 *
 *  - `lt:chu:<mã>` = id pod chủ, hạn `HAN_GIU_MS`, pod chủ gia hạn mỗi `NHIP_GIU_MS`. Hết hạn (pod chết) thì pod nào
 *    gặp phòng trước (request của người chơi, hoặc lượt quét mồ côi) GIÀNH lấy và nạp lại từ MySQL.
 *  - `lt:pod:<id>` = địa chỉ nội bộ của pod, cùng nhịp. Không còn khoá này = pod đã chết → được giành NGAY, khỏi chờ
 *    khoá phòng hết hạn.
 *  - Gia hạn thất bại (khoá đã thuộc pod khác — pod này bị treo quá hạn) → pod PHẢI nhả phòng ngay: hai pod cùng
 *    chạy một phòng là hai ván lệch nhau ghi đè lên nhau.
 *  - Sảnh (mời người online, thi đấu, trạng thái online của BXH) cũng là "một phòng" tên `sanh`: một pod giữ.
 *
 * Không có REDIS_URL thì không dựng cụm: server chạy một pod y như trước (index.ts giữ nguyên đường cũ).
 */
/*
 * 28.11.2026 (chủ dự án duyệt): 15 s → 6 s. Pod chết đột ngột thì người chơi chờ tới khi khoá hết hạn — 15 s là quá lâu.
 * Gia hạn 2 s một lần: lỡ hai nhịp (Redis chậm, GC) vẫn còn khoá. Giá: mỗi pod ~1 lệnh Redis / 2 s, không đáng kể.
 */
export const HAN_GIU_MS = 6_000;
export const NHIP_GIU_MS = 2_000;
const TIEN_TO = 'lt:';

/** Gia hạn hàng loạt: trả về những mã KHÔNG còn là của pod này. */
const LUA_GIU = `
local mat = {}
for i, k in ipairs(KEYS) do
  if redis.call('GET', k) == ARGV[1] then redis.call('PEXPIRE', k, ARGV[2]) else table.insert(mat, k) end
end
return mat`;
/** Xoá khoá nếu còn là của mình. */
const LUA_NHA = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
/** Giành khoá của pod ĐÃ CHẾT: chỉ khi khoá vẫn mang đúng id pod chết đó. */
const LUA_CUOP = `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3]) return 1 else return 0 end`;

export interface Cum {
  /** Id pod này (tên máy + ngẫu nhiên: khởi động lại là pod MỚI, không nhận nhầm khoá của đời trước). */
  pod: string;
  diaChi: string;
  /** Ai đang giữ `ma`: 'toi' · địa chỉ pod khác · null (chưa ai / pod giữ đã chết — gọi `gianh`). */
  chuCua(ma: string): Promise<'toi' | { diaChi: string } | null>;
  /** Giành quyền giữ `ma` (chưa ai giữ, hoặc pod giữ đã chết). true = giờ là của mình. */
  gianh(ma: string): Promise<boolean>;
  /**
   * Các pod đang sống (id + địa chỉ). Dùng để CHIA phòng mới đều cả cụm: Cloudflare không chia đều giữa các tunnel
   * (ưu tiên một kết nối), cloudflared lại giữ kết nối lâu tới một pod — để mặc thì mọi phòng dồn vào một pod.
   */
  podSong(): Promise<{ pod: string; diaChi: string; phong: number; sk?: unknown }[]>;
  /** Ghi số đo sức khoẻ máy/pod (suc-khoe-may.ts) — hạn như khoá pod: pod chết thì số biến theo. */
  ghiSucKhoe(sk: unknown): Promise<void>;
  /** Vừa giao một phòng mới cho `id` — cộng tạm vào số phòng của nó tới nhịp gia hạn sau (nhiều phòng tạo cùng lúc không dồn một pod). */
  daGiao(id: string): Promise<void>;
  /** Thôi giữ `ma` (phòng đã đóng / nhả khi tắt). */
  nha(ma: string): Promise<void>;
  /** Đăng ký nhịp gia hạn: `dangGiu()` trả các mã đang giữ, `mat(ma)` gọi khi mất quyền. */
  chayNhip(dangGiu: () => string[], mat: (ma: string) => void, moiNhip?: () => void): void;
  /** Sổ phòng công khai chung cả cụm. */
  soPhong: SoPhong;
  /** true đúng MỘT lần cho mỗi mã trong cả cụm — chống bắn thông báo "phòng mới" lần hai khi phòng đổi pod. */
  lanDau(viec: string, ma: string, giay: number): Promise<boolean>;
  /** Đánh dấu / hỏi phòng thử (không lên sổ, không báo). */
  datThu(ma: string): Promise<void>;
  laThu(ma: string): Promise<boolean>;
  /** Số người đang nối sảnh (pod giữ sảnh ghi, pod khác đọc). */
  ghiOnline(n: number): Promise<void>;
  docOnline(): Promise<number>;
  /** Quản trị (quantri.ts): pod chủ của từng mã + pod giữ sảnh + độ trễ Redis + cỡ sổ phòng + số online. */
  soLieu(maDs: string[]): Promise<{ chu: (string | null)[]; sanh: string | null; treMs: number; soPhongCongKhai: number; online: number }>;
  dong(): Promise<void>;
}

function ipNoiBo(): string {
  for (const ds of Object.values(networkInterfaces())) {
    for (const a of ds ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return '127.0.0.1';
}

export async function moCum(url: string | undefined, port: number): Promise<Cum | null> {
  if (!url) return null;
  const r = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: true, lazyConnect: true });
  r.on('error', (e) => console.error('[cum] redis lỗi:', e.message));
  await r.connect();
  const pod = `${hostname().slice(0, 12)}-${randomBytes(3).toString('hex')}`;
  const diaChi = process.env.POD_ADDR ?? `http://${ipNoiBo()}:${port}`;
  const kChu = (ma: string): string => `${TIEN_TO}chu:${ma}`;
  const kPod = (id: string): string => `${TIEN_TO}pod:${id}`;
  const K_SO = `${TIEN_TO}sophong`;
  await r.set(kPod(pod), diaChi, 'PX', HAN_GIU_MS);
  let nhip: ReturnType<typeof setInterval> | undefined;

  const cum: Cum = {
    pod, diaChi,
    async chuCua(ma) {
      const chu = await r.get(kChu(ma));
      if (!chu) return null;
      if (chu === pod) return 'toi';
      const dc = await r.get(kPod(chu));
      return dc ? { diaChi: dc } : null;
    },
    async gianh(ma) {
      if (await r.set(kChu(ma), pod, 'PX', HAN_GIU_MS, 'NX')) return true;
      const chu = await r.get(kChu(ma));
      if (chu === pod) return true;
      if (!chu || await r.exists(kPod(chu))) return false;
      // Pod giữ đã chết (không còn khoá pod) — giành ngay, không chờ khoá phòng hết hạn
      return (await r.eval(LUA_CUOP, 1, kChu(ma), chu, pod, HAN_GIU_MS)) === 1;
    },
    async nha(ma) { await r.eval(LUA_NHA, 1, kChu(ma), pod); },
    async podSong() {
      const khoa: string[] = [];
      let con = '0';
      do {
        const [tiep, ds] = await r.scan(con, 'MATCH', `${TIEN_TO}pod:*`, 'COUNT', 100);
        con = tiep; khoa.push(...ds);
      } while (con !== '0');
      if (!khoa.length) return [{ pod, diaChi, phong: 0 }];
      const ids = khoa.map((k) => k.slice(`${TIEN_TO}pod:`.length));
      const [dc, sl, moi, sk] = await Promise.all([
        r.mget(...khoa), r.mget(...ids.map((id) => `${TIEN_TO}sl:${id}`)), r.mget(...ids.map((id) => `${TIEN_TO}moi:${id}`)),
        r.mget(...ids.map((id) => `${TIEN_TO}sk:${id}`))
      ]);
      const docSk = (v: string | null | undefined): unknown => { try { return v ? JSON.parse(v) : undefined; } catch { return undefined; } };
      return ids.map((id, i) => ({ pod: id, diaChi: dc[i] ?? '', phong: (Number(sl[i]) || 0) + (Number(moi[i]) || 0), sk: docSk(sk[i]) }))
        .filter((x) => x.diaChi);
    },
    async ghiSucKhoe(sk) { await r.set(`${TIEN_TO}sk:${pod}`, JSON.stringify(sk), 'PX', HAN_GIU_MS); },
    async daGiao(id) {
      await r.multi().incr(`${TIEN_TO}moi:${id}`).pexpire(`${TIEN_TO}moi:${id}`, NHIP_GIU_MS + 1000).exec();
    },
    chayNhip(dangGiu, mat, moiNhip) {
      nhip = setInterval(() => {
        void (async () => {
          const ds = dangGiu();
          // Số phòng đang giữ (cho việc chia phòng mới) — số thật thay cho phần cộng tạm `moi:`
          await r.multi().set(kPod(pod), diaChi, 'PX', HAN_GIU_MS).set(`${TIEN_TO}sl:${pod}`, String(ds.length), 'PX', HAN_GIU_MS)
            .del(`${TIEN_TO}moi:${pod}`).exec();
          if (ds.length) {
            const kq = (await r.eval(LUA_GIU, ds.length, ...ds.map(kChu), pod, HAN_GIU_MS)) as string[];
            for (const k of kq) mat(k.slice(`${TIEN_TO}chu:`.length));
          }
          moiNhip?.();
        })().catch((e) => console.error('[cum] gia hạn lỗi:', (e as Error).message));
      }, NHIP_GIU_MS);
      nhip.unref?.();
    },
    soPhong: {
      async khai(phong: PublicRoom) { await r.hset(K_SO, phong.code, JSON.stringify(phong)); },
      async xoa(code: string) { await r.hdel(K_SO, code); },
      async liet() {
        const now = Date.now();
        const tat = await r.hgetall(K_SO);
        const ds: PublicRoom[] = [];
        const cu: string[] = [];
        for (const [code, s] of Object.entries(tat)) {
          try {
            const p = JSON.parse(s) as PublicRoom;
            if (now - p.luc >= HAN_BAN_GHI_MS) cu.push(code); else ds.push(p);
          } catch { cu.push(code); }
        }
        if (cu.length) await r.hdel(K_SO, ...cu);
        return locVaSap(ds, now);
      }
    },
    async lanDau(viec, ma, giay) { return (await r.set(`${TIEN_TO}${viec}:${ma}`, '1', 'EX', giay, 'NX')) === 'OK'; },
    async datThu(ma) { await r.set(`${TIEN_TO}thu:${ma}`, '1', 'EX', 7200); },
    async laThu(ma) { return (await r.exists(`${TIEN_TO}thu:${ma}`)) === 1; },
    async ghiOnline(n) { await r.set(`${TIEN_TO}online`, String(n), 'PX', HAN_GIU_MS * 2); },
    async docOnline() { return Number(await r.get(`${TIEN_TO}online`)) || 0; },
    async soLieu(maDs) {
      const t0 = Date.now();
      await r.ping();
      const treMs = Date.now() - t0;
      const [chu, sanh, so, onl] = await Promise.all([
        maDs.length ? r.mget(...maDs.map(kChu)) : Promise.resolve([] as (string | null)[]),
        r.get(kChu('sanh')), r.hlen(K_SO), r.get(`${TIEN_TO}online`)
      ]);
      return { chu, sanh, treMs, soPhongCongKhai: so, online: Number(onl) || 0 };
    },
    async dong() {
      clearInterval(nhip);
      try { await r.del(kPod(pod)); } catch { /* đang tắt */ }
      r.disconnect();
    }
  };
  console.log(`[cum] BẬT — pod ${pod} @ ${diaChi}`);
  return cum;
}
