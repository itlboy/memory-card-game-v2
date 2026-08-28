import type { PublicRoom } from '@mm/engine';

/**
 * SỔ PHÒNG CÔNG KHAI (ON-10) — cửa DUY NHẤT để ghi/đọc danh sách phòng đang chờ.
 *
 * Vì sao phải có một cái sổ riêng thay vì "duyệt hết các phòng": trên Cloudflare
 * mỗi phòng là một Durable Object và KHÔNG CÓ cách nào liệt kê các DO đang sống
 * — `getByName(code)` chỉ tra đúng một cái theo tên. Nên phòng phải tự KHAI lên
 * một chỗ chung, và chỗ chung đó là sổ này.
 *
 * Hai bản cài, cùng interface này:
 *  - Cloudflare: một Durable Object singleton (`SoPhongDO` trong sophong-do.ts).
 *  - Node: một Map trong tiến trình (`soPhongTrongRam` bên dưới) — node-server
 *    vốn đã giữ mọi phòng trong RAM của một tiến trình duy nhất (replicas phải
 *    là 1, xem deploy/k8s), nên ở đó liệt kê chỉ là lọc một Map.
 *
 * RoomDO chỉ biết interface này, không biết mình đang chạy ở đâu — y như cách
 * cf-shim thay tầng dưới mà không sửa một dòng luật phòng nào.
 */
export interface SoPhong {
  /** Ghi/cập nhật một phòng. Gọi lại nhiều lần với cùng `code` là ghi đè. */
  khai(phong: PublicRoom): Promise<void>;
  /** Gỡ khỏi sổ: phòng đã vào ván, chuyển sang riêng tư, hoặc đóng hẳn. */
  xoa(code: string): Promise<void>;
  /** Danh sách phòng đang chờ, phòng mới nhất đứng trước. */
  liet(): Promise<PublicRoom[]>;
}

/**
 * Bản ghi quá hạn này thì coi như rác và bị bỏ khi liệt kê.
 *
 * Vì sao cần hạn: sổ là bản SAO của trạng thái phòng, mà mọi bản sao đều có ngày
 * lệch. Phòng bị xoá vì tiến trình chết, worker bị đá giữa chừng, hay đơn giản
 * là một lối thoát nào đó quên gọi `xoa` — thiếu hạn thì cái mã chết đó nằm mãi
 * trong danh sách và ai bấm vào cũng nhận "Phòng không tồn tại".
 *
 * 15 phút: phòng còn sống tự khai lại mỗi lần có người vào/ra hay đổi cấu hình,
 * và alarm dọn phòng rỗng của RoomDO chạy trong vòng 10 phút (EMPTY_LOBBY_MS),
 * nên một phòng thật gần như không bao giờ chạm hạn này. Đây là lưới an toàn,
 * không phải nhịp làm mới.
 */
export const HAN_BAN_GHI_MS = 900_000;

/** Bỏ bản ghi quá hạn và sắp phòng mới lên trước — dùng chung cho cả hai bản cài. */
export function locVaSap(rows: Iterable<PublicRoom>, now: number): PublicRoom[] {
  return [...rows]
    .filter((r) => now - r.luc < HAN_BAN_GHI_MS)
    .sort((a, b) => b.luc - a.luc);
}

/** Bản cài cho Node: mọi phòng nằm trong RAM của đúng một tiến trình. */
export function soPhongTrongRam(): SoPhong {
  const kho = new Map<string, PublicRoom>();
  return {
    async khai(phong) { kho.set(phong.code, phong); },
    async xoa(code) { kho.delete(code); },
    async liet() {
      const now = Date.now();
      // Dọn luôn trong lúc đọc: không có alarm nào chạy nền ở bản này.
      for (const [code, r] of kho) if (now - r.luc >= HAN_BAN_GHI_MS) kho.delete(code);
      return locVaSap(kho.values(), now);
    }
  };
}

/** Cổng vào của một binding Durable Object, hẹp đúng phần sổ phòng dùng tới. */
interface SoPhongBinding {
  getByName(name: string): { fetch(request: Request): Promise<Response> };
}

/**
 * Bọc binding DO thành `SoPhong`.
 *
 * Tên instance cố định — cả worker chỉ có MỘT cái sổ, nên tên phải là hằng chứ
 * không suy từ gì cả; đặt theo request là mỗi request một cái sổ riêng, và danh
 * sách sẽ trống rỗng một cách khó hiểu.
 */
export function soPhongTuBinding(binding: SoPhongBinding): SoPhong {
  const stub = (): { fetch(request: Request): Promise<Response> } => binding.getByName('so-phong');
  return {
    async khai(phong) {
      await stub().fetch(new Request('https://so/khai', {
        method: 'POST', body: JSON.stringify(phong)
      }));
    },
    async xoa(code) {
      await stub().fetch(new Request('https://so/xoa', {
        method: 'POST', body: JSON.stringify({ code })
      }));
    },
    async liet() {
      const res = await stub().fetch(new Request('https://so/liet'));
      return (await res.json()) as PublicRoom[];
    }
  };
}
