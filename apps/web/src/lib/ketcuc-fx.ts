/**
 * SỔ ĐĂNG KÝ HIỆU ỨNG KẾT VÁN — thêm / sửa / xoá một hiệu ứng chỉ đụng HAI chỗ:
 * một mục trong `HIEU_UNG` dưới đây, và khối CSS cùng tên ở `styles/ketcuc-fx.css`.
 *
 * Trước đây mỗi kết cục là một component Vue riêng (`CelebrationFx`,
 * `DefeatFx`), nên thêm một hình là thêm một file, sửa import ở hai chỗ dùng, và
 * chép lại phần lịch tiếng. Nay `KetCucFx.vue` là component DUY NHẤT: nó đọc sổ
 * này, bốc một hiệu ứng theo seed rồi dựng đúng các lớp mà mục đó khai.
 *
 * Ba luật giữ cho sổ này không mục:
 *  1. Mỗi loại kết cục phải có ÍT NHẤT 4 hiệu ứng (test canh) — ít hơn thì chơi
 *     mấy ván là thấy lặp.
 *  2. Bốc theo SEED của ván, không phải `Math.random()`: cùng một ván thì F5 hay
 *     xem lại vẫn ra đúng hình đó, và bàn online không nhấp nháy đổi hình giữa
 *     hai lần nhận view.
 *  3. Đổi cái người chơi NGẮM, giữ cái người chơi NGHE. Tiếng là thứ người ta
 *     học để nhận ra kết cục (`victory` / `lose` / `defeat` / `win`) nên nó nằm
 *     ngoài sổ này, ở chỗ gọi.
 */

/** Kết cục dưới góc nhìn CỦA NGƯỜI ĐANG NGỒI TRƯỚC MÁY — không phải của bàn. */
export type LoaiKetCuc = 'thang' | 'thua' | 'hoa';

/** Một lớp DOM của hiệu ứng. `con` để lồng (ví dụ chùm pháo hoa và các tia). */
export interface LopFx {
  lop: string;
  style?: Record<string, string>;
  con?: LopFx[];
}

export interface HieuUng {
  id: string;
  /** Tên tiếng Việt, dùng cho aria-label và cho trang mockup. */
  ten: string;
  loai: LoaiKetCuc;
  /** Dựng danh sách lớp. `seed` là seed của ván nên hình tất định theo ván. */
  dung(seed: number): LopFx[];
}

/* ---------- tiện ích nhỏ, tất định theo seed ---------- */

/** Băm seed thành một số 32-bit — cùng cách với `backForSeed` của engine. */
function bam(seed: number, muoi: number): number {
  return Math.imul((seed >>> 0) + muoi * 0x9e3779b9, 2654435761) >>> 0;
}

const MAU_PHAO_HOA = ['#ffd54a', '#ff7b72', '#7ce38b', '#79c0ff', '#d2a8ff', '#ff9ff3'];
const MAU_CONFETTI = ['#6a5cff', '#c44cf0', '#ea8c00', '#0ea371', '#e5484d', '#38bdf8'];

/** 70 hạt confetti — dùng lại ở nhiều hiệu ứng thắng nên tách riêng. */
function confetti(seed: number): LopFx[] {
  return Array.from({ length: 70 }, (_, i) => ({
    lop: 'fx-giay',
    style: {
      left: `${(i * 37 + seed) % 100}%`,
      background: MAU_CONFETTI[i % MAU_CONFETTI.length]!,
      animationDelay: `${(i % 14) * 160}ms`,
      animationDuration: `${2400 + (i % 7) * 300}ms`,
      '--drift': `${((i * 13) % 9) - 4}rem`,
      '--spin': `${420 + (i * 47) % 400}deg`
    }
  }));
}

/** Tro rơi — dùng lại ở cả bốn hiệu ứng thua. */
function tro(seed: number): LopFx[] {
  return Array.from({ length: 60 }, (_, i) => {
    const d = 3 + (i % 6);
    return {
      // Vài hạt là than CÒN ĐỎ: một điểm màu duy nhất trên nền đã bị rút hết màu
      lop: i % 9 === 0 ? 'fx-tan fx-than' : 'fx-tan',
      style: {
        left: `${(i * 29 + seed * 11) % 100}%`,
        width: `${d}px`,
        height: `${d}px`,
        opacity: String(0.34 + (i % 5) * 0.1),
        animationDelay: `${(i % 12) * 190}ms`,
        animationDuration: `${3000 + (i % 6) * 520}ms`,
        '--troi': `${((i * 7) % 9) - 4}rem`
      }
    };
  });
}

/** Ba lớp nền dùng chung của mọi hiệu ứng thua. */
const XAM: LopFx = { lop: 'fx-xam' };
const DAP_DO: LopFx = { lop: 'fx-dap-do' };
const TOI: LopFx = { lop: 'fx-toi' };

/* ---------- SỔ ĐĂNG KÝ ---------- */

export const HIEU_UNG: readonly HieuUng[] = [
  /* ===== THẮNG ===== */
  {
    id: 'phao-hoa',
    ten: 'Pháo hoa',
    loai: 'thang',
    dung: (seed) => [
      ...confetti(seed),
      // 8 vụ rải trong ~5,6 giây — luôn có vụ đang nổ, không bị khoảng lặng
      ...Array.from({ length: 8 }, (_, b) => {
        const treo = 0.15 + b * 0.7;
        const mau = MAU_PHAO_HOA[(b * 2 + seed) % MAU_PHAO_HOA.length]!;
        return {
          lop: 'fx-no',
          style: {
            left: `${10 + ((b * 37 + seed * 13) % 80)}%`,
            top: `${8 + ((b * 23 + seed * 7) % 45)}%`
          },
          con: [
            ...Array.from({ length: 18 }, (_, i) => {
              const goc = (i / 18) * Math.PI * 2;
              const xa = 60 + (i % 3) * 28;
              return {
                lop: 'fx-tia',
                style: {
                  '--dx': `${Math.cos(goc) * xa}px`,
                  '--dy': `${Math.sin(goc) * xa + 30}px`,
                  background: i % 5 === 0 ? '#ffffff' : mau,
                  animationDelay: `${treo}s`,
                  animationDuration: 'var(--fw-cycle)'
                }
              };
            }),
            { lop: 'fx-loe', style: { animationDelay: `${treo}s` } }
          ]
        };
      })
    ]
  },
  {
    id: 'bung-sang',
    ten: 'Bùng sáng',
    loai: 'thang',
    dung: (seed) => [
      { lop: 'fx-tia-quay' },
      { lop: 'fx-loe-trang' },
      ...confetti(seed + 3)
    ]
  },
  {
    id: 'mua-sao',
    ten: 'Mưa sao',
    loai: 'thang',
    dung: (seed) => Array.from({ length: 40 }, (_, i) => {
      const d = 9 + (i % 5) * 3;
      return {
        lop: 'fx-sao',
        style: {
          left: `${(i * 41 + seed * 7) % 100}%`,
          width: `${d}px`,
          height: `${d}px`,
          opacity: String(0.55 + (i % 4) * 0.15),
          animationDelay: `${(i % 14) * 200}ms`,
          animationDuration: `${2600 + (i % 6) * 480}ms`,
          '--troi': `${((i * 11) % 9) - 4}rem`,
          '--xoay': `${180 + (i * 53) % 360}deg`,
          ...(i % 6 === 0 ? { color: '#ffffff' } : {})
        }
      };
    })
  },
  {
    id: 'song-mau',
    ten: 'Sóng màu',
    loai: 'thang',
    dung: (seed) => [
      ...Array.from({ length: 4 }, (_, i) => ({
        lop: 'fx-song',
        style: {
          color: MAU_PHAO_HOA[(i * 2 + seed) % MAU_PHAO_HOA.length]!,
          animationDelay: `${i * 480}ms`
        }
      })),
      ...confetti(seed + 5)
    ]
  },

  /* ===== THUA =====
     Lớp mạnh nhất là RÚT MÀU (`fx-xam`): thắng thì màu bừng lên, thua thì màu bị
     hút sạch — đọc ra trong MỘT khung hình, không cần chờ hạt tro nào rơi. */
  {
    id: 'tro-tan',
    ten: 'Tro tàn',
    loai: 'thua',
    dung: (seed) => [XAM, DAP_DO, TOI, ...tro(seed)]
  },
  {
    id: 'ran-vo',
    ten: 'Rạn vỡ',
    loai: 'thua',
    dung: (seed) => [
      XAM, DAP_DO,
      ...Array.from({ length: 9 }, (_, i) => ({
        lop: 'fx-nut',
        style: {
          transform: `rotate(${(i * 360) / 9 + (seed * 13) % 40}deg)`,
          '--dai': `${34 + ((i * 17 + seed) % 30)}vmax`,
          animationDelay: `${i * 26}ms`
        }
      })),
      TOI,
      ...tro(seed + 5)
    ]
  },
  {
    id: 'tat-den',
    ten: 'Tắt đèn',
    loai: 'thua',
    dung: (seed) => [
      XAM,
      {
        lop: 'fx-tat-den',
        // Tắt từ MÉP vào giữa: hai dải giữa tắt sau cùng và nhạt hơn, nên bàn
        // thẻ vẫn nhìn được — người thua còn muốn xem lại bàn.
        con: [0, 5, 1, 4, 2, 3].map((hang, thu) => ({
          lop: hang === 2 || hang === 3 ? 'fx-dai fx-dai-giua' : 'fx-dai',
          style: { order: String(hang), animationDelay: `${thu * 130}ms` }
        }))
      },
      ...tro(seed + 2)
    ]
  },
  {
    id: 'nhoe-dan',
    ten: 'Nhoè dần',
    loai: 'thua',
    // Mất nét TRƯỚC rồi mới xám — đọc ra "xỉu đi", khác hẳn ba hình kia
    dung: (seed) => [{ lop: 'fx-nhoe' }, DAP_DO, TOI, ...tro(seed + 7)]
  },

  /* ===== HOÀ =====
     Không mừng, không tro. Mọi hình ở đây nói MỘT điều: hai bên bằng nhau. */
  {
    id: 'chia-doi',
    ten: 'Chia đôi',
    loai: 'hoa',
    dung: () => [
      { lop: 'fx-nua fx-nua-trai' },
      { lop: 'fx-nua fx-nua-phai' },
      { lop: 'fx-vach' },
      { lop: 'fx-vong fx-vong-trai' },
      { lop: 'fx-vong fx-vong-phai' }
    ]
  },
  {
    id: 'can-thang-bang',
    ten: 'Cân thăng bằng',
    loai: 'hoa',
    dung: () => [{ lop: 'fx-don', con: [{ lop: 'fx-dia' }, { lop: 'fx-dia' }] }]
  },
  {
    id: 'khoa-vao-nhau',
    ten: 'Khoá vào nhau',
    loai: 'hoa',
    dung: () => [{ lop: 'fx-khoa fx-khoa-trai' }, { lop: 'fx-khoa fx-khoa-phai' }]
  },
  {
    id: 'nhip-doi',
    ten: 'Nhịp đôi',
    loai: 'hoa',
    dung: () => [{ lop: 'fx-nhip fx-nhip-trai' }, { lop: 'fx-nhip fx-nhip-phai' }]
  }
];

/** Số hiệu ứng tối thiểu mỗi loại — dưới mức này là chơi vài ván thấy lặp. */
export const TOI_THIEU_MOI_LOAI = 4;

export function hieuUngCua(loai: LoaiKetCuc): HieuUng[] {
  return HIEU_UNG.filter((h) => h.loai === loai);
}

/**
 * Bốc hiệu ứng cho một ván. Tất định theo seed nên F5 giữa lúc xem kết quả
 * không đổi hình, và mọi lần dựng lại view online cũng ra đúng hình đó.
 */
export function bocHieuUng(loai: LoaiKetCuc, seed: number): HieuUng {
  const ds = hieuUngCua(loai);
  return ds[bam(seed, ds.length) % ds.length]!;
}
