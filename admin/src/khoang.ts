/**
 * KHOẢNG XEM + HẠT (độ mịn mỗi cột) → những gì cần hỏi GA. Hàm thuần, không gọi mạng — test được.
 *
 * Mọi mốc tính theo LỊCH Ở MÚI GIỜ CỦA THUỘC TÍNH GA (dateHour/date GA trả theo múi đó). Ngày-giờ
 * "tại chỗ" được giữ trong Date dạng UTC (Date.UTC(y, m, d, h)) để cộng trừ không dính DST/múi máy.
 */

export type Khoang = '30m' | '6h' | '24h' | 'today' | 'yday' | '7' | '30' | '90' | 'all' | 'custom';
export type Hat = '5m' | '1h' | '1d' | '1w';

export const KHOANG: readonly Khoang[] = ['30m', '6h', '24h', 'today', 'yday', '7', '30', '90', 'all', 'custom'];

export interface Cot { k: string; nhan: string; moc?: boolean }

export interface KeHoach {
  khoang: Khoang;
  realtime: boolean;
  hat: Hat;
  hatDuocChon: Hat[];
  /** dateRange GA (YYYY-MM-DD) của kỳ này / kỳ trước (null = không so). */
  ky: { startDate: string; endDate: string };
  kyTruoc: { startDate: string; endDate: string } | null;
  /** Khoảng tính theo GIỜ (6h, 24h): lọc thêm dateHour trong các giờ này. */
  gio: string[] | null;
  gioTruoc: string[] | null;
  /** Tên chiều thời gian của GA cho hạt này. */
  chieu: 'dateHour' | 'date' | 'isoYearIsoWeek' | 'minutesAgo';
  cot: Cot[];
  /** Kỳ có chứa giờ đang chạy — số còn đổi, nhớ tạm ngắn. */
  dangChay: boolean;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const ngay = (d: Date) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const keyNgay = (d: Date) => ngay(d).replace(/-/g, '');
const keyGio = (d: Date) => keyNgay(d) + p2(d.getUTCHours());
const congGio = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
const congNgay = (d: Date, n: number) => congGio(d, n * 24);

/** Giờ tại chỗ (múi tz) của thời điểm `now`, cắt về đầu giờ. */
export function gioTaiCho(now: Date, tz: string): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!));
}

export function tuanIso(d: Date): { y: number; w: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const thu = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - thu);
  const dau = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { y: t.getUTCFullYear(), w: Math.ceil(((t.getTime() - dau.getTime()) / 86400_000 + 1) / 7) };
}
const keyTuan = (d: Date) => { const { y, w } = tuanIso(d); return `${y}${p2(w)}`; };

const docNgay = (s: string | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return Number.isNaN(d.getTime()) ? null : d;
};

export interface DauVao { khoang?: string; hat?: string; tu?: string; den?: string }

export function lapKeHoach(v: DauVao, now: Date, tz: string, ngayCongKhai: string): KeHoach {
  const khoang = (KHOANG as readonly string[]).includes(v.khoang ?? '') ? (v.khoang as Khoang) : '24h';
  const gio = gioTaiCho(now, tz);
  const homNay = new Date(Date.UTC(gio.getUTCFullYear(), gio.getUTCMonth(), gio.getUTCDate()));

  if (khoang === '30m') {
    const phutNay = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, minute: '2-digit' }).format(now));
    const cot: Cot[] = [];
    for (let i = 5; i >= 0; i--) {                       // 6 cột × 5 phút, cũ → mới
      const m = new Date(gio.getTime() + (phutNay - i * 5) * 60_000);
      cot.push({ k: String(i), nhan: `${p2(m.getUTCHours())}:${p2(m.getUTCMinutes())}` });
    }
    return { khoang, realtime: true, hat: '5m', hatDuocChon: ['5m'], ky: { startDate: ngay(homNay), endDate: ngay(homNay) },
      kyTruoc: null, gio: null, gioTruoc: null, chieu: 'minutesAgo', cot, dangChay: true };
  }

  // [đầu, cuối] tính bằng NGÀY tại chỗ (bao gồm cả hai đầu)
  let dau = homNay, cuoi = homNay;
  let gioCua: Date[] | null = null;                       // khoảng theo giờ (6h/24h)
  if (khoang === '6h' || khoang === '24h') {
    const n = khoang === '6h' ? 6 : 24;
    gioCua = Array.from({ length: n }, (_, i) => congGio(gio, i - n + 1));
    dau = new Date(Date.UTC(gioCua[0]!.getUTCFullYear(), gioCua[0]!.getUTCMonth(), gioCua[0]!.getUTCDate()));
  } else if (khoang === 'yday') { dau = cuoi = congNgay(homNay, -1); }
  else if (khoang === '7' || khoang === '30' || khoang === '90') { dau = congNgay(homNay, -(Number(khoang) - 1)); }
  else if (khoang === 'all') { dau = docNgay(ngayCongKhai) ?? congNgay(homNay, -90); }
  else if (khoang === 'custom') {
    const a = docNgay(v.tu), b = docNgay(v.den);
    dau = a ?? congNgay(homNay, -6); cuoi = b ?? homNay;
    if (dau > cuoi) [dau, cuoi] = [cuoi, dau];
    if (cuoi > homNay) cuoi = homNay;
    if (dau > cuoi) dau = cuoi;
  }
  const soNgay = Math.round((cuoi.getTime() - dau.getTime()) / 86400_000) + 1;

  const duoc: Hat[] = gioCua ? ['1h'] : soNgay <= 14 ? (soNgay <= 1 ? ['1h'] : ['1h', '1d']) : soNgay <= 120 ? ['1d', '1w'] : ['1d', '1w'];
  const tuDong: Hat = gioCua || soNgay <= 2 ? '1h' : soNgay <= 62 ? '1d' : '1w';
  const hat: Hat = duoc.includes(v.hat as Hat) ? (v.hat as Hat) : tuDong;

  // Cột
  const cot: Cot[] = [];
  if (hat === '1h') {
    const ds = gioCua ?? (() => {
      const ra: Date[] = []; const het = cuoi.getTime() === homNay.getTime() ? gio : congGio(cuoi, 23);
      for (let t = dau; t <= het; t = congGio(t, 1)) ra.push(t);
      return ra;
    })();
    ds.forEach((t, i) => cot.push({ k: keyGio(t), nhan: `${p2(t.getUTCHours())}h`, moc: i === 0 || t.getUTCHours() === 0 }));
  } else if (hat === '1d') {
    for (let t = dau; t <= cuoi; t = congNgay(t, 1)) cot.push({ k: keyNgay(t), nhan: `${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)}` });
  } else {
    const thay = new Set<string>();
    for (let t = dau; t <= cuoi; t = congNgay(t, 1)) {
      const k = keyTuan(t);
      if (!thay.has(k)) { thay.add(k); cot.push({ k, nhan: `${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)}` }); }
    }
  }

  // Kỳ trước (cùng độ dài, liền trước) — không so cho "Hôm nay" (ngày chưa hết, so là thiệt) và "Từ khi công khai".
  let kyTruoc: KeHoach['kyTruoc'] = null;
  let gioTruoc: string[] | null = null;
  if (gioCua) {
    const n = gioCua.length;
    const ds = gioCua.map((t) => congGio(t, -n));
    gioTruoc = ds.map(keyGio);
    kyTruoc = { startDate: ngay(ds[0]!), endDate: ngay(ds[n - 1]!) };
  } else if (khoang !== 'today' && khoang !== 'all') {
    kyTruoc = { startDate: ngay(congNgay(dau, -soNgay)), endDate: ngay(congNgay(dau, -1)) };
  }

  return {
    khoang, realtime: false, hat, hatDuocChon: duoc,
    ky: { startDate: ngay(dau), endDate: ngay(cuoi) }, kyTruoc,
    gio: gioCua ? gioCua.map(keyGio) : null, gioTruoc,
    chieu: hat === '1h' ? 'dateHour' : hat === '1d' ? 'date' : 'isoYearIsoWeek',
    cot, dangChay: cuoi.getTime() === homNay.getTime()
  };
}
