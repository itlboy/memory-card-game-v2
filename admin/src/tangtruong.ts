/**
 * Tab "TĂNG TRƯỞNG" (28.11.2026, chủ dự án: "cần công cụ thống kê hiệu quả để đo và tập trung đúng chỗ" — mục tiêu
 * 100 người online thường xuyên). Một gói riêng `/api/tangtruong`, KHÔNG theo bộ chọn khoảng: luôn 28 ngày trọn gần
 * nhất (tới hôm qua) + các nhóm người mới theo tuần. 13 báo cáo GA, đi qua hàng đợi ≤ 4 của `Ga`, nhớ tạm 1 giờ.
 *
 * SỐ ĐO MỤC TIÊU = "online trung bình" = tổng giây chơi (userEngagementDuration) của ngày / 86 400. Đây là số người
 * có mặt cùng lúc tính TRUNG BÌNH cả ngày theo GA (ước lượng: chỉ tính lúc app ở trước mặt, không đếm người chặn GA).
 * "Giờ đỉnh" = giờ có nhiều giây chơi nhất trong ngày / 3 600.
 *
 * NGUỒN người mới: app là webview nên GA ghi "(direct)" — phân theo TRANG VÀO: /app/ios → App Store, /app/android →
 * Google Play, còn lại theo nguồn/kênh GA. Trang ngôn ngữ (/en, /ja…) với 0 phút chơi phần lớn là máy quét/kiểm thử:
 * bảng luôn kèm phút chơi mỗi người để nhìn ra.
 */
import { Ga, GaLoi, loc, type Dong } from './ga.ts';
import { gioTaiCho } from './khoang.ts';
import { thuGon } from './thongke.ts';

export const MUC_TIEU = 100;
const SO_NGAY = 28;
/** Số nhóm tuần đã đủ 7 ngày theo dõi (thêm 1 nhóm "đang chạy" chỉ có ngày 1). */
const SO_NHOM = 5;

const NEN = [
  { id: 'ios', ten: 'iOS', dau: '/app/ios' },
  { id: 'android', ten: 'Android', dau: '/app/android' },
  { id: 'web', ten: 'Web', dau: '' },
  // Bản cổng game web (CrazyGames, itch.io…): game gửi page_location `/cong/<tên cổng>` (apps/web lib/phan-tich.ts)
  { id: 'cong', ten: 'Cổng game', dau: '/cong/' }
] as const;
type NenId = (typeof NEN)[number]['id'];

const dauApp = (dau: string) => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: dau } } });
const locNen = (id: NenId) => (id === 'web'
  ? { notExpression: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'FULL_REGEXP', value: '^/(app|cong)/.*' } } } }
  : dauApp(NEN.find((n) => n.id === id)!.dau));
export const nenCua = (duong: string): NenId => (duong.startsWith('/app/ios') ? 'ios' : duong.startsWith('/app/android') ? 'android' : duong.startsWith('/cong/') ? 'cong' : 'web');
/** Tên cổng từ đường dẫn `/cong/<tên>`. */
export const tenCong = (duong: string): string => duong.split('/')[2] || 'khac';

const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const cong = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
const nhan = (d: Date) => `${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}`;
const tron1 = (x: number) => Math.round(x * 10) / 10;

export interface NhomTuan { id: string; nhan: string; tu: string; den: string; du7: boolean }

/** Các nhóm người mới: SO_NHOM tuần đã đủ 7 ngày theo dõi (cũ → mới) + nhóm đang chạy (2–7 ngày trước, chỉ có ngày 1). */
export function lapNhom(homNay: Date): NhomTuan[] {
  const ds: NhomTuan[] = [];
  for (let k = SO_NHOM - 1; k >= 0; k--) {
    const den = cong(homNay, -(8 + 7 * k)), tu = cong(den, -6);
    ds.push({ id: `t${k}`, nhan: `${nhan(tu)}–${nhan(den)}`, tu: iso(tu), den: iso(den), du7: true });
  }
  const tu = cong(homNay, -7), den = cong(homNay, -2);
  ds.push({ id: 'moi', nhan: `${nhan(tu)}–${nhan(den)}`, tu: iso(tu), den: iso(den), du7: false });
  return ds;
}

export interface GiuChan { id: string; nhan: string; du7: boolean; nen: Record<NenId, { moi: number; n1: number; n7: number | null }> }

export interface GoiTangTruong {
  capNhat: string; mucTieu: number; ky: { startDate: string; endDate: string };
  loi: Record<string, string>;
  /** 28 ngày: online trung bình, giờ đỉnh, người chơi, người mới. */
  ngay?: { k: string; nhan: string; tb: number; dinh: number | null; nguoi: number; moi: number }[];
  tong?: { tb7: number; tb7Truoc: number; dinh7: number | null; nguoi7: number; moi7: number; moi7Truoc: number; gio7: number };
  giuChan?: GiuChan[];
  kichHoat?: { id: NenId; ten: string; moi: number; batDau: number; xong: number }[];
  nguon?: { k: string; moi: number; phut: number }[];
  quocGia?: { k: string; nguoi: number; moi: number; gio: number }[];
  lanTruyen?: { k: string; luot: number; nguoi: number }[];
  /** Từng cổng game: người chơi, người mới, giờ chơi (28 ngày). */
  cong?: { k: string; nguoi: number; moi: number; gio: number }[];
}

const laLoiBan = (e: unknown) => e instanceof GaLoi && e.loai !== 'khac';

/** Gộp nguồn + trang vào thành tên kênh dễ đọc. */
export function tenKenh(nguon: string, kenh: string, trangVao: string): string {
  const nen = nenCua(trangVao);
  if (nen === 'ios') return 'App Store (app iOS)';
  if (nen === 'android') return 'Google Play (app Android)';
  if (nen === 'cong') return `Cổng game · ${tenCong(trangVao)}`;
  if (nguon === '(direct)' || !nguon || nguon === '(not set)') return /^\/[a-z]{2}(-[A-Z]{2})?(\/|$)/.test(trangVao) ? 'Web · trang ngôn ngữ, gõ thẳng' : 'Web · gõ thẳng / không rõ';
  if (/facebook\.com$/.test(nguon)) return 'Facebook';
  if (/instagram\.com$/.test(nguon)) return 'Instagram';
  if (/(^|\.)t\.co$|twitter\.com$|x\.com$/.test(nguon)) return 'X (Twitter)';
  if (/tiktok/.test(nguon)) return 'TikTok';
  if (/zalo/.test(nguon)) return 'Zalo';
  if (/youtube/.test(nguon)) return 'YouTube';
  if (kenh === 'organic') return `Tìm kiếm · ${nguon}`;
  return kenh && kenh !== '(none)' && kenh !== 'referral' ? `${nguon} · ${kenh}` : nguon;
}

export async function tangTruong(ga: Ga, now: Date, tz: string): Promise<GoiTangTruong> {
  const gio = gioTaiCho(now, tz);
  const homNay = new Date(Date.UTC(gio.getUTCFullYear(), gio.getUTCMonth(), gio.getUTCDate()));
  const dau = cong(homNay, -SO_NGAY), cuoi = cong(homNay, -1);
  const ky = { startDate: iso(dau), endDate: iso(cuoi) };
  const g: GoiTangTruong = { capNhat: now.toISOString(), mucTieu: MUC_TIEU, ky, loi: {} };
  const o = <T>(ten: string, p: Promise<T>): Promise<T | null> =>
    p.catch((e) => { if (laLoiBan(e)) throw e; g.loi[ten] ??= thuGon(e); return null; });
  const R = (dims: string[], metrics: string[], loc1?: unknown, them: Record<string, unknown> = {}) => ga.report({
    dateRanges: [ky], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
    ...(loc1 ? { dimensionFilter: loc1 } : {}), ...them
  });
  const nhom = lapNhom(homNay);
  const cohort = (id: NenId) => ga.report({
    dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }], metrics: [{ name: 'cohortActiveUsers' }], dimensionFilter: locNen(id),
    cohortSpec: {
      cohorts: nhom.map((n) => ({ name: n.id, dimension: 'firstSessionDate', dateRange: { startDate: n.tu, endDate: n.den } })),
      cohortsRange: { granularity: 'DAILY', endOffset: 7 }
    }
  });
  const moi = { filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } } };

  const [theoNgay, theoGio, cIos, cAndroid, cWeb, cCong, tungCong, kichHoat, nguon, quocGia, suKien, chucNang, moiQuaLink] = await Promise.all([
    o('ngay', R(['date'], ['userEngagementDuration', 'activeUsers', 'newUsers'])),
    o('dinh', R(['dateHour'], ['userEngagementDuration'])),
    o('giu_chan', cohort('ios')), o('giu_chan', cohort('android')), o('giu_chan', cohort('web')), o('giu_chan', cohort('cong')),
    o('cong', R(['pagePath'], ['activeUsers', 'newUsers', 'userEngagementDuration'], dauApp('/cong/'))),
    o('kich_hoat', R(['eventName', 'pagePath'], ['totalUsers'], loc.va(loc.trong('eventName', ['first_visit', 'van_bat_dau', 'van_ket_thuc']), moi))),
    o('nguon', R(['firstUserSource', 'firstUserMedium', 'landingPage'], ['newUsers', 'userEngagementDuration'])),
    o('quoc_gia', R(['countryId'], ['activeUsers', 'newUsers', 'userEngagementDuration'], undefined,
      { orderBys: [{ metric: { metricName: 'userEngagementDuration' }, desc: true }], limit: 12 })),
    o('lan_truyen', R(['eventName'], ['eventCount', 'totalUsers'], loc.trong('eventName', ['chia_se', 'thong_bao_bat', 'dang_nhap', 'nhac_hoi', 'nhac_bat', 'nhac_mo']))),
    o('lan_truyen', R(['customEvent:chuc_nang'], ['eventCount', 'totalUsers'],
      loc.va(loc.su_kien('mo_chuc_nang'), loc.trong('customEvent:chuc_nang', ['online_moi_ban', 'online_vao_link_moi', 'luu_chia_se_anh', 'tri_nho_chia_se'])))),
    // Người MỚI có vào phòng bằng link mời = người do lời mời kéo về thật. Link mời mở thẳng APP nên utm_* không tới GA
    // (WebView không nhận URL) — phải đếm bằng sự kiện, không đọc được ở bảng nguồn.
    o('lan_truyen', R([], ['eventCount', 'totalUsers'], loc.va(loc.su_kien('mo_chuc_nang'), loc.trong('customEvent:chuc_nang', ['online_vao_link_moi']), moi)))
  ]);

  if (theoNgay) {
    const m = new Map(theoNgay.map((r) => [r.d[0] ?? '', r.m]));
    const dinh = new Map<string, number>();
    for (const r of theoGio ?? []) { const k = (r.d[0] ?? '').slice(0, 8); dinh.set(k, Math.max(dinh.get(k) ?? 0, r.m[0] ?? 0)); }
    g.ngay = Array.from({ length: SO_NGAY }, (_, i) => {
      const d = cong(dau, i), k = iso(d).replace(/-/g, ''), x = m.get(k) ?? [0, 0, 0];
      return { k, nhan: nhan(d), tb: tron1((x[0] ?? 0) / 86400), dinh: theoGio ? tron1((dinh.get(k) ?? 0) / 3600) : null, nguoi: x[1] ?? 0, moi: x[2] ?? 0 };
    });
    const giay = (i: number) => (m.get(g.ngay![i]!.k)?.[0] ?? 0);
    const tbKhoang = (a: number, b: number) => { let s = 0; for (let i = a; i < b; i++) s += giay(i); return s / (b - a) / 86400; };
    const cong7 = (f: (x: NonNullable<GoiTangTruong['ngay']>[number]) => number, a: number, b: number) => g.ngay!.slice(a, b).reduce((s, x) => s + f(x), 0);
    const n = SO_NGAY;
    const dinh7 = theoGio ? g.ngay.slice(n - 7).reduce((s, x) => s + (x.dinh ?? 0), 0) / 7 : null;
    g.tong = {
      tb7: tron1(tbKhoang(n - 7, n)), tb7Truoc: tron1(tbKhoang(n - 14, n - 7)), dinh7: dinh7 == null ? null : tron1(dinh7),
      nguoi7: Math.round(cong7((x) => x.nguoi, n - 7, n) / 7), moi7: cong7((x) => x.moi, n - 7, n), moi7Truoc: cong7((x) => x.moi, n - 14, n - 7),
      gio7: tron1(tbKhoang(n - 7, n) * 24)
    };
  }

  if (cIos || cAndroid || cWeb || cCong) {
    const doc = (d: Dong[] | null) => {
      const m = new Map<string, number>();
      for (const r of d ?? []) m.set(`${r.d[0]}:${Number(r.d[1])}`, r.m[0] ?? 0);
      return m;
    };
    const bang: Record<NenId, Map<string, number>> = { ios: doc(cIos), android: doc(cAndroid), web: doc(cWeb), cong: doc(cCong) };
    g.giuChan = nhom.map((n) => ({
      id: n.id, nhan: n.nhan, du7: n.du7,
      nen: Object.fromEntries(NEN.map((x) => [x.id, {
        moi: bang[x.id].get(`${n.id}:0`) ?? 0, n1: bang[x.id].get(`${n.id}:1`) ?? 0, n7: n.du7 ? (bang[x.id].get(`${n.id}:7`) ?? 0) : null
      }])) as GiuChan['nen']
    })).reverse();
  }

  if (kichHoat) {
    const dem: Record<NenId, Record<string, number>> = { ios: {}, android: {}, web: {}, cong: {} };
    for (const r of kichHoat) { const x = dem[nenCua(r.d[1] ?? '')]; x[r.d[0] ?? ''] = (x[r.d[0] ?? ''] ?? 0) + (r.m[0] ?? 0); }
    g.kichHoat = NEN.map((n) => ({ id: n.id, ten: n.ten, moi: dem[n.id].first_visit ?? 0, batDau: dem[n.id].van_bat_dau ?? 0, xong: dem[n.id].van_ket_thuc ?? 0 }));
  }

  if (nguon) {
    const m = new Map<string, { moi: number; giay: number }>();
    for (const r of nguon) {
      const k = tenKenh(r.d[0] ?? '', r.d[1] ?? '', r.d[2] ?? '');
      const x = m.get(k) ?? { moi: 0, giay: 0 };
      x.moi += r.m[0] ?? 0; x.giay += r.m[1] ?? 0; m.set(k, x);
    }
    g.nguon = [...m].filter(([, x]) => x.moi > 0).map(([k, x]) => ({ k, moi: x.moi, phut: Math.round(x.giay / x.moi / 60) }))
      .sort((a, b) => b.moi - a.moi).slice(0, 12);
  }

  if (quocGia) g.quocGia = quocGia.filter((r) => r.d[0] && r.d[0] !== '(not set)').map((r) => ({ k: r.d[0]!, nguoi: r.m[0] ?? 0, moi: r.m[1] ?? 0, gio: tron1((r.m[2] ?? 0) / 3600) }));

  if (tungCong) {
    const m = new Map<string, { nguoi: number; moi: number; giay: number }>();
    for (const r of tungCong) {
      const k = tenCong(r.d[0] ?? ''), x = m.get(k) ?? { nguoi: 0, moi: 0, giay: 0 };
      x.nguoi += r.m[0] ?? 0; x.moi += r.m[1] ?? 0; x.giay += r.m[2] ?? 0; m.set(k, x);
    }
    g.cong = [...m].map(([k, x]) => ({ k, nguoi: x.nguoi, moi: x.moi, gio: tron1(x.giay / 3600) })).sort((a, b) => b.gio - a.gio);
  }

  if (suKien || chucNang) {
    const m = new Map([...(suKien ?? []), ...(chucNang ?? [])].map((r) => [r.d[0] ?? '', r.m]));
    g.lanTruyen = ['chia_se', 'luu_chia_se_anh', 'tri_nho_chia_se', 'online_moi_ban', 'online_vao_link_moi', 'thong_bao_bat', 'nhac_hoi', 'nhac_bat', 'nhac_mo', 'dang_nhap']
      .map((k) => ({ k, luot: m.get(k)?.[0] ?? 0, nguoi: m.get(k)?.[1] ?? 0 }));
    if (moiQuaLink) g.lanTruyen.splice(5, 0, { k: 'moi_qua_link', luot: moiQuaLink[0]?.m[0] ?? 0, nguoi: moiQuaLink[0]?.m[1] ?? 0 });
  }
  return g;
}
