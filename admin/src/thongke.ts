/**
 * Ghép các báo cáo GA thành MỘT gói cho trang. Mỗi ô một báo cáo riêng, chạy song song, hỏng ô
 * nào ghi lỗi ô đó (vd chưa đăng ký custom dimension) — không kéo sập cả trang.
 *
 * NỀN TẢNG lấy từ pagePath: app gửi page_location `/app/ios` · `/app/android`, web là mọi đường
 * khác (lib/phan-tich.ts ở apps/web). Không cần custom dimension. Mỗi nền tảng một báo cáo có lọc
 * → số người KHÔNG trùng trong cùng nền tảng (cộng các pagePath lại thì người đổi ngôn ngữ bị đếm 2 lần).
 */
import { Ga, loc, type Dong } from './ga.ts';
import type { KeHoach } from './khoang.ts';
import { themeMoi } from '../../packages/engine/src/theme-gop.ts';   // id theme cũ (72) → 12 theme hiện hành

const NEN_TANG = [
  { id: 'web', ten: 'Web', loc: { notExpression: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/' } } } } },
  { id: 'ios', ten: 'iOS', loc: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/ios' } } } },
  { id: 'android', ten: 'Android', loc: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/android' } } } }
] as const;

type Kv = { k: string; v: number };

export interface GoiThongKe {
  khoang: string; hat: string; hatDuocChon: string[]; ky: KeHoach['ky']; capNhat: string;
  kpi: Record<string, { v: number | null; truoc?: number | null }>;
  chuoi: { cot: KeHoach['cot']; nhom: { id: string; ten: string; gia: number[] }[] };
  nenTang: { id: string; ten: string; v: number }[];
  quocGia: Kv[];
  heat: number[][] | null;
  danhSach: Record<string, Kv[]>;
  loi: Record<string, string>;
}

const thuGon = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const cd = /(customEvent|customUser):(\w+)/.exec(m);
  if (cd && /not a valid|invalid|did not match/i.test(m)) return `Chưa đăng ký custom dimension "${cd[2]}" trong GA (chỉ có số từ ngày đăng ký).`;
  return m.slice(0, 240);
};

export async function tongQuan(ga: Ga, kh: KeHoach): Promise<GoiThongKe> {
  const loi: Record<string, string> = {};
  const goi: GoiThongKe = {
    khoang: kh.khoang, hat: kh.hat, hatDuocChon: kh.hatDuocChon, ky: kh.ky, capNhat: new Date().toISOString(),
    kpi: {}, chuoi: { cot: kh.cot, nhom: [] }, nenTang: [], quocGia: [], heat: null, danhSach: {}, loi
  };
  const o = <T>(ten: string, p: Promise<T>): Promise<T | null> => p.catch((e) => { loi[ten] = thuGon(e); return null; });

  if (kh.realtime) return thoiGianThuc(ga, kh, goi, o);

  // lọc chung: khoảng tính theo giờ thì thêm dateHour ∈ các giờ đó
  const voi = (gio: string[] | null, ...e: unknown[]) => {
    const ds = [...(gio ? [loc.trong('dateHour', gio)] : []), ...e];
    return ds.length === 0 ? undefined : ds.length === 1 ? ds[0] : loc.va(...ds);
  };
  const R = (ky: KeHoach['ky'], gio: string[] | null, dims: string[], metrics: string[], ...f: unknown[]) => ga.report({
    dateRanges: [ky], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
    ...(voi(gio, ...f) ? { dimensionFilter: voi(gio, ...f) } : {})
  });
  const tong1 = (d: Dong[] | null, i = 0) => (d ? d.reduce((s, r) => s + (r.m[i] ?? 0), 0) : null);
  const demSuKien = (d: Dong[] | null, ten: string) => (d ? (d.find((r) => r.d[0] === ten)?.m[0] ?? 0) : null);
  const SU_KIEN = ['van_bat_dau', 'van_ket_thuc'];
  const truoc = kh.kyTruoc;

  const [tong, tongTruoc, sk, skTruoc, chuoiNt, ntTong, qg, heat, cheDo, soThe, theme, chucNang, banWeb] = await Promise.all([
    o('kpi', R(kh.ky, kh.gio, [], ['activeUsers', 'newUsers', 'userEngagementDuration'])),
    truoc ? o('kpi', R(truoc, kh.gioTruoc, [], ['activeUsers', 'newUsers'])) : Promise.resolve(null),
    o('kpi', R(kh.ky, kh.gio, ['eventName'], ['eventCount'], loc.trong('eventName', SU_KIEN))),
    truoc ? o('kpi', R(truoc, kh.gioTruoc, ['eventName'], ['eventCount'], loc.trong('eventName', SU_KIEN))) : Promise.resolve(null),
    Promise.all(NEN_TANG.map((n) => o('chuoi', R(kh.ky, kh.gio, [kh.chieu], ['activeUsers'], n.loc)))),
    Promise.all(NEN_TANG.map((n) => o('nenTang', R(kh.ky, kh.gio, [], ['activeUsers'], n.loc)))),
    o('quocGia', ga.report({ dateRanges: [kh.ky], dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8, ...(voi(kh.gio) ? { dimensionFilter: voi(kh.gio) } : {}) })),
    o('heat', R(kh.ky, kh.gio, ['dayOfWeek', 'hour'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('che_do', R(kh.ky, kh.gio, ['customEvent:che_do'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('so_the', R(kh.ky, kh.gio, ['customEvent:so_the'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('theme', R(kh.ky, kh.gio, ['customEvent:theme'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('chuc_nang', R(kh.ky, kh.gio, ['customEvent:chuc_nang'], ['eventCount'], loc.su_kien('mo_chuc_nang'))),
    o('ban_web', R(kh.ky, kh.gio, ['customUser:ban_web'], ['activeUsers']))
  ]);

  const nguoi = tong1(tong, 0);
  goi.kpi.nguoi = { v: nguoi, truoc: tong1(tongTruoc, 0) };
  goi.kpi.nguoiMoi = { v: tong1(tong, 1), truoc: tong1(tongTruoc, 1) };
  goi.kpi.van = { v: demSuKien(sk, 'van_bat_dau'), truoc: demSuKien(skTruoc, 'van_bat_dau') };
  goi.kpi.vanXong = { v: demSuKien(sk, 'van_ket_thuc') };
  const giay = tong1(tong, 2);
  goi.kpi.giayMoiNguoi = { v: nguoi && giay != null ? Math.round(giay / nguoi) : null };

  const viTri = new Map(kh.cot.map((c, i) => [c.k, i]));
  goi.chuoi.nhom = NEN_TANG.map((n, i) => {
    const gia = kh.cot.map(() => 0);
    for (const r of chuoiNt[i] ?? []) { const j = viTri.get(r.d[0] ?? ''); if (j != null) gia[j] = r.m[0] ?? 0; }
    return { id: n.id, ten: n.ten, gia };
  });
  goi.nenTang = NEN_TANG.map((n, i) => ({ id: n.id, ten: n.ten, v: tong1(ntTong[i] ?? null) ?? 0 }));
  goi.quocGia = (qg ?? []).map((r) => ({ k: r.d[0] ?? '', v: r.m[0] ?? 0 }));

  if (heat) {
    const h = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const r of heat) { const d = Number(r.d[0]), g = Number(r.d[1]); if (h[d] && g >= 0 && g < 24) h[d]![g] = r.m[0] ?? 0; }
    goi.heat = h;
  }

  const kv = (d: Dong[] | null, gop?: (k: string) => string | null): Kv[] => {
    const m = new Map<string, number>();
    for (const r of d ?? []) {
      for (const k0 of (r.d[0] ?? '').split(',')) {
        const k = gop ? gop(k0.trim()) : k0.trim();
        if (!k || k === '(not set)') continue;
        m.set(k, (m.get(k) ?? 0) + (r.m[0] ?? 0));
      }
    }
    return [...m].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  };
  if (cheDo) goi.danhSach.che_do = kv(cheDo, (k) => (k.startsWith('dau_may') ? 'dau_may' : k));
  if (soThe) goi.danhSach.so_the = kv(soThe).slice(0, 6);
  if (theme) goi.danhSach.theme = kv(theme, themeMoi).slice(0, 6);           // chuỗi "a,b" → tách đếm từng chủ đề
  if (banWeb) goi.danhSach.ban_web = kv(banWeb).slice(0, 5);
  if (chucNang) {
    const cn = kv(chucNang);
    goi.danhSach.cach_vao = cn.filter((x) => ['online_vao_link_moi', 'online_vao_ma', 'online_vao_phong_ds'].includes(x.k));
    goi.kpi.phongTao = { v: cn.find((x) => x.k === 'online_tao_phong')?.v ?? 0 };
  } else goi.kpi.phongTao = { v: null };
  goi.kpi.vanOnline = { v: cheDo ? (goi.danhSach.che_do?.find((x) => x.k === 'online')?.v ?? 0) : null };
  return goi;
}

async function thoiGianThuc(ga: Ga, kh: KeHoach, goi: GoiThongKe,
  o: <T>(ten: string, p: Promise<T>) => Promise<T | null>): Promise<GoiThongKe> {
  const [tong, sk, qg, phut] = await Promise.all([
    o('kpi', ga.realtime({ metrics: [{ name: 'activeUsers' }] })),
    o('kpi', ga.realtime({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: loc.trong('eventName', ['van_bat_dau', 'van_ket_thuc']) })),
    o('quocGia', ga.realtime({ dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 })),
    o('chuoi', ga.realtime({ dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'activeUsers' }] }))
  ]);
  goi.kpi.nguoi = { v: tong ? (tong[0]?.m[0] ?? 0) : null };
  goi.kpi.van = { v: sk ? (sk.find((r) => r.d[0] === 'van_bat_dau')?.m[0] ?? 0) : null };
  goi.kpi.vanXong = { v: sk ? (sk.find((r) => r.d[0] === 'van_ket_thuc')?.m[0] ?? 0) : null };
  goi.quocGia = (qg ?? []).map((r) => ({ k: r.d[0] ?? '', v: r.m[0] ?? 0 }));
  // minutesAgo "00".."29" → 6 cột 5 phút (cột k = "5" là cũ nhất). Cộng người theo phút là ước lượng trần.
  const gia = kh.cot.map(() => 0);
  for (const r of phut ?? []) {
    const nhom = Math.floor(Number(r.d[0]) / 5);
    const j = kh.cot.findIndex((c) => c.k === String(nhom));
    if (j >= 0) gia[j] = Math.max(gia[j]!, r.m[0] ?? 0);
  }
  goi.chuoi.nhom = [{ id: 'tat_ca', ten: 'Mọi nền tảng', gia }];
  return goi;
}

/** 30 phút qua cho dải "đang diễn ra" — gọn, gọi riêng. */
export async function dangDienRa(ga: Ga): Promise<{ nguoi: number; van: number; quocGia: Kv[] }> {
  const [t, sk, qg] = await Promise.all([
    ga.realtime({ metrics: [{ name: 'activeUsers' }] }),
    ga.realtime({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: loc.su_kien('van_bat_dau') }),
    ga.realtime({ dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 6 })
  ]);
  // Danh sách nước (mã ISO + số người) — trang tự đổi mã ra tên tiếng Việt. Chỉ đếm số nước thì
  // "1 quốc gia" không biết là nước nào (chủ dự án hỏi 17.11.2026).
  return { nguoi: t[0]?.m[0] ?? 0, van: sk[0]?.m[0] ?? 0, quocGia: qg.map((r) => ({ k: r.d[0] ?? '', v: r.m[0] ?? 0 })) };
}
