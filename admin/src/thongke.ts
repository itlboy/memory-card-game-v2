/**
 * Báo cáo GA cho trang, CHIA THEO Ô (19.11.2026). Trang tải từng ô khi cuộn tới (`/api/o/<phan>`), mỗi
 * ô vài báo cáo — không còn bắn 29 runReport một lúc (GA4 chỉ cho 10 request đồng thời mỗi thuộc tính).
 *
 * Trong một ô, hỏng báo cáo nào ghi lỗi báo cáo đó (vd chưa đăng ký custom dimension) — không kéo sập
 * cả ô. RIÊNG lỗi GA BẬN/HẾT HẠN MỨC (`GaLoi` loại `ban`/`het_quota`) thì ném ra cả ô: index.ts trả bản
 * cũ (nếu có) hoặc 429 + Retry-After để trang tự thử lại — đừng nhớ một ô rỗng vì GA đang bận.
 *
 * NỀN TẢNG lấy từ pagePath: app gửi page_location `/app/ios` · `/app/android`, web là mọi đường
 * khác (lib/phan-tich.ts ở apps/web). Không cần custom dimension. Mỗi nền tảng một báo cáo có lọc
 * → số người KHÔNG trùng trong cùng nền tảng (cộng các pagePath lại thì người đổi ngôn ngữ bị đếm 2 lần).
 */
import { Ga, GaLoi, loc, type Dong } from './ga.ts';
import type { KeHoach } from './khoang.ts';
import { themeMoi } from '../../packages/engine/src/theme-gop.ts';   // id theme cũ (72) → 12 theme hiện hành

const NEN_TANG = [
  { id: 'web', ten: 'Web', loc: { notExpression: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/' } } } } },
  { id: 'ios', ten: 'iOS', loc: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/ios' } } } },
  { id: 'android', ten: 'Android', loc: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app/android' } } } }
] as const;

/** Các ô của trang — đúng như trang nhóm khung (trang.ts, thuộc tính data-phan). */
export const PHAN = ['kpi', 'chuoi', 'nen_tang', 'quoc_gia', 'heat', 'choi', 'nguoi_moi', 'online', 'loi_js', 'khac'] as const;
export type Phan = (typeof PHAN)[number];
export const laPhan = (x: string): x is Phan => (PHAN as readonly string[]).includes(x);
/** Ô có số ở chế độ 30 phút (GA Realtime). Ô khác trả `khongCo` mà không gọi GA. */
export const PHAN_REALTIME: readonly Phan[] = ['kpi', 'chuoi', 'quoc_gia'];

export type Kv = { k: string; v: number; luot?: number; phu?: string };

export interface GoiO {
  phan: Phan; khoang: string; hat: string; hatDuocChon: string[]; ky: KeHoach['ky']; capNhat: string;
  loi: Record<string, string>;
  /** Ô không có ở khoảng này (vd nền tảng ở chế độ 30 phút). */
  khongCo?: boolean;
  kpi?: Record<string, { v: number | null; truoc?: number | null }>;
  chuoi?: { cot: KeHoach['cot']; nhom: { id: string; ten: string; gia: number[] }[] };
  nenTang?: { id: string; ten: string; v: number }[];
  quocGia?: Kv[];
  heat?: number[][] | null;
  danhSach?: Record<string, Kv[]>;
  /** Ghi chú nhẹ, không phải lỗi (vd dimension ngan_xep chưa đăng ký). */
  ghiChu?: Record<string, string>;
}

export const thuGon = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const cd = /(customEvent|customUser):(\w+)/.exec(m);
  if (cd && /not a valid|invalid|did not match/i.test(m)) return `Chưa đăng ký custom dimension "${cd[2]}" trong GA (chỉ có số từ ngày đăng ký).`;
  return m.slice(0, 240);
};

/** GA bận/hết hạn mức: phải ném ra cả ô, không ghi thành lỗi một báo cáo. */
const laLoiBan = (e: unknown) => e instanceof GaLoi && e.loai !== 'khac';

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
const ghep = (d: Dong[] | null) => kv(d ? d.map((r) => ({ d: [r.d.filter((x) => x && x !== '(not set)').join(' · ')], m: r.m })) : null);
const tong1 = (d: Dong[] | null, i = 0) => (d ? d.reduce((s, r) => s + (r.m[i] ?? 0), 0) : null);
const demSuKien = (d: Dong[] | null, ten: string) => (d ? (d.find((r) => r.d[0] === ten)?.m[0] ?? 0) : null);
const SU_KIEN = ['van_bat_dau', 'van_ket_thuc'];

function ngCanh(ga: Ga, kh: KeHoach, loi: Record<string, string>) {
  const o = <T>(ten: string, p: Promise<T>): Promise<T | null> =>
    p.catch((e) => { if (laLoiBan(e)) throw e; loi[ten] ??= thuGon(e); return null; });
  // lọc chung: khoảng tính theo giờ thì thêm dateHour ∈ các giờ đó
  const voi = (gio: string[] | null, ...e: unknown[]) => {
    const ds = [...(gio ? [loc.trong('dateHour', gio)] : []), ...e];
    return ds.length === 0 ? undefined : ds.length === 1 ? ds[0] : loc.va(...ds);
  };
  const R = (ky: KeHoach['ky'], gio: string[] | null, dims: string[], metrics: string[], ...f: unknown[]) => ga.report({
    dateRanges: [ky], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
    ...(voi(gio, ...f) ? { dimensionFilter: voi(gio, ...f) } : {})
  });
  const dem = (ten: string, dims: string[], khoa: string) => o(khoa, R(kh.ky, kh.gio, dims, ['eventCount'], loc.su_kien(ten)));
  return { o, voi, R, dem };
}

type Ctx = ReturnType<typeof ngCanh>;
type LamO = (ga: Ga, kh: KeHoach, g: GoiO, c: Ctx) => Promise<void>;

/* ------------------------------ Từng ô ------------------------------ */

const kpi: LamO = async (ga, kh, g, { o, R }) => {
  if (kh.realtime) {
    const [tong, sk] = await Promise.all([
      o('kpi', ga.realtime({ metrics: [{ name: 'activeUsers' }] })),
      o('kpi', ga.realtime({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: loc.trong('eventName', SU_KIEN) }))
    ]);
    g.kpi = {
      nguoi: { v: tong ? (tong[0]?.m[0] ?? 0) : null },
      van: { v: demSuKien(sk, 'van_bat_dau') },
      vanXong: { v: demSuKien(sk, 'van_ket_thuc') }
    };
    return;
  }
  const truoc = kh.kyTruoc;
  const [tong, tongTruoc, sk, skTruoc, quayLai, cheDo, chucNang, dangNhap] = await Promise.all([
    o('kpi', R(kh.ky, kh.gio, [], ['activeUsers', 'newUsers', 'userEngagementDuration'])),
    truoc ? o('kpi', R(truoc, kh.gioTruoc, [], ['activeUsers', 'newUsers'])) : Promise.resolve(null),
    o('kpi', R(kh.ky, kh.gio, ['eventName'], ['eventCount'], loc.trong('eventName', SU_KIEN))),
    truoc ? o('kpi', R(truoc, kh.gioTruoc, ['eventName'], ['eventCount'], loc.trong('eventName', SU_KIEN))) : Promise.resolve(null),
    o('kpi', R(kh.ky, kh.gio, ['newVsReturning'], ['activeUsers'])),
    // Ván online / phòng đã tạo / tài khoản mới: cùng báo cáo với ô danh sách, hỏi lại ở đây cho ô KPI tự đứng được
    o('che_do', R(kh.ky, kh.gio, ['customEvent:che_do'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('chuc_nang', R(kh.ky, kh.gio, ['customEvent:chuc_nang'], ['eventCount'], loc.su_kien('mo_chuc_nang'))),
    o('dang_nhap', R(kh.ky, kh.gio, ['customEvent:ket_qua', 'customEvent:moi'], ['eventCount'], loc.su_kien('dang_nhap')))
  ]);
  const nguoi = tong1(tong, 0);
  const giay = tong1(tong, 2);
  const k: NonNullable<GoiO['kpi']> = {
    nguoi: { v: nguoi, truoc: tong1(tongTruoc, 0) },
    nguoiMoi: { v: tong1(tong, 1), truoc: tong1(tongTruoc, 1) },
    van: { v: demSuKien(sk, 'van_bat_dau'), truoc: demSuKien(skTruoc, 'van_bat_dau') },
    vanXong: { v: demSuKien(sk, 'van_ket_thuc') },
    giayMoiNguoi: { v: nguoi && giay != null ? Math.round(giay / nguoi) : null },
    vanOnline: { v: cheDo ? cheDo.filter((r) => r.d[0] === 'online').reduce((a, r) => a + (r.m[0] ?? 0), 0) : null },
    phongTao: { v: chucNang ? (chucNang.find((r) => r.d[0] === 'online_tao_phong')?.m[0] ?? 0) : null },
    taiKhoanMoi: { v: dangNhap ? dangNhap.filter((r) => r.d[0] === 'ok' && r.d[1] === 'true').reduce((a, r) => a + (r.m[0] ?? 0), 0) : null }
  };
  if (quayLai) {
    const tongNguoi = quayLai.reduce((a, r) => a + (r.m[0] ?? 0), 0);
    const cu = quayLai.find((r) => r.d[0] === 'returning')?.m[0] ?? 0;
    k.quayLai = { v: tongNguoi ? Math.round(cu / tongNguoi * 100) : null };
  } else k.quayLai = { v: null };
  g.kpi = k;
};

const chuoi: LamO = async (ga, kh, g, { o, R }) => {
  if (kh.realtime) {
    const phut = await o('chuoi', ga.realtime({ dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'activeUsers' }] }));
    // minutesAgo "00".."29" → 6 cột 5 phút (cột k = "5" là cũ nhất). Cộng người theo phút là ước lượng trần.
    const gia = kh.cot.map(() => 0);
    for (const r of phut ?? []) {
      const nhom = Math.floor(Number(r.d[0]) / 5);
      const j = kh.cot.findIndex((c) => c.k === String(nhom));
      if (j >= 0) gia[j] = Math.max(gia[j]!, r.m[0] ?? 0);
    }
    g.chuoi = { cot: kh.cot, nhom: [{ id: 'tat_ca', ten: 'Mọi nền tảng', gia }] };
    return;
  }
  const ds = await Promise.all(NEN_TANG.map((n) => o('chuoi', R(kh.ky, kh.gio, [kh.chieu], ['activeUsers'], n.loc))));
  const viTri = new Map(kh.cot.map((c, i) => [c.k, i]));
  g.chuoi = {
    cot: kh.cot,
    nhom: NEN_TANG.map((n, i) => {
      const gia = kh.cot.map(() => 0);
      for (const r of ds[i] ?? []) { const j = viTri.get(r.d[0] ?? ''); if (j != null) gia[j] = r.m[0] ?? 0; }
      return { id: n.id, ten: n.ten, gia };
    })
  };
};

const nenTang: LamO = async (_ga, kh, g, { o, R }) => {
  const ds = await Promise.all(NEN_TANG.map((n) => o('nen_tang', R(kh.ky, kh.gio, [], ['activeUsers'], n.loc))));
  g.nenTang = NEN_TANG.map((n, i) => ({ id: n.id, ten: n.ten, v: tong1(ds[i] ?? null) ?? 0 }));
};

const quocGia: LamO = async (ga, kh, g, { o, voi }) => {
  const than = { dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 };
  const qg = await o('quoc_gia', kh.realtime ? ga.realtime(than)
    : ga.report({ dateRanges: [kh.ky], ...than, ...(voi(kh.gio) ? { dimensionFilter: voi(kh.gio) } : {}) }));
  g.quocGia = (qg ?? []).map((r) => ({ k: r.d[0] ?? '', v: r.m[0] ?? 0 }));
};

const heat: LamO = async (_ga, kh, g, { o, R }) => {
  const d = await o('heat', R(kh.ky, kh.gio, ['dayOfWeek', 'hour'], ['eventCount'], loc.su_kien('van_bat_dau')));
  if (!d) { g.heat = null; return; }
  const h = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of d) { const t = Number(r.d[0]), gi = Number(r.d[1]); if (h[t] && gi >= 0 && gi < 24) h[t]![gi] = r.m[0] ?? 0; }
  g.heat = h;
};

const choi: LamO = async (_ga, kh, g, { o, R }) => {
  const [cheDo, soThe, theme, chucNang, banWeb] = await Promise.all([
    o('che_do', R(kh.ky, kh.gio, ['customEvent:che_do'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('so_the', R(kh.ky, kh.gio, ['customEvent:so_the'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('theme', R(kh.ky, kh.gio, ['customEvent:theme'], ['eventCount'], loc.su_kien('van_bat_dau'))),
    o('chuc_nang', R(kh.ky, kh.gio, ['customEvent:chuc_nang'], ['eventCount'], loc.su_kien('mo_chuc_nang'))),
    o('ban_web', R(kh.ky, kh.gio, ['customUser:ban_web'], ['activeUsers']))
  ]);
  const ds: Record<string, Kv[]> = {};
  if (cheDo) ds.che_do = kv(cheDo, (k) => (k.startsWith('dau_may') ? 'dau_may' : k));
  if (soThe) ds.so_the = kv(soThe).slice(0, 6);
  if (theme) ds.theme = kv(theme, themeMoi).slice(0, 6);           // chuỗi "a,b" → tách đếm từng chủ đề
  if (banWeb) ds.ban_web = kv(banWeb).slice(0, 5);
  if (chucNang) ds.cach_vao = kv(chucNang).filter((x) => ['online_vao_link_moi', 'online_vao_ma', 'online_vao_phong_ds'].includes(x.k));
  g.danhSach = ds;
};

/* 17.11.2026: TÌM VÌ SAO NGƯỜI MỚI BỎ ĐI (CLAUDE.md game, mục GA4) */
const nguoiMoi: LamO = async (_ga, kh, g, { o, R }) => {
  const moi = { filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'new' } } };
  const cheDoCd = { filter: { fieldName: 'customEvent:che_do', stringFilter: { matchType: 'EXACT', value: 'chien_dich' } } };
  const [pheu, manKq, manBo, nguon] = await Promise.all([
    o('pheu', R(kh.ky, kh.gio, ['eventName'], ['totalUsers'], loc.trong('eventName', ['first_visit', 'buoc_menu', 'van_bat_dau', 'van_ket_thuc']), moi)),
    o('man_kho', R(kh.ky, kh.gio, ['customEvent:man', 'customEvent:ket_qua'], ['eventCount'], loc.su_kien('van_ket_thuc'), cheDoCd)),
    o('man_kho', R(kh.ky, kh.gio, ['customEvent:man'], ['eventCount'], loc.su_kien('van_bo_do'), cheDoCd)),
    o('nguon', R(kh.ky, kh.gio, ['sessionSource'], ['activeUsers']))
  ]);
  const ds: Record<string, Kv[]> = {};
  // Phễu người MỚI trong kỳ — giữ đúng thứ tự bước, không xếp theo số
  if (pheu) {
    const so = (ten: string) => pheu.find((r) => r.d[0] === ten)?.m[0] ?? 0;
    ds.pheu = [['first_visit', 'lan_dau'], ['buoc_menu', 'vao_menu'], ['van_bat_dau', 'bat_dau_van'], ['van_ket_thuc', 'choi_xong']]
      .map(([ten, k]) => ({ k: k!, v: so(ten!) }));
  }
  // Màn chiến dịch KHÓ: tỉ lệ (thua + bỏ dở) trên số lượt, chỉ màn có ≥ 3 lượt
  if (manKq || manBo) {
    const m = new Map<string, { luot: number; hong: number }>();
    for (const r of manKq ?? []) {
      const x = m.get(r.d[0] ?? '') ?? { luot: 0, hong: 0 };
      x.luot += r.m[0] ?? 0; if (r.d[1] === 'thua') x.hong += r.m[0] ?? 0;
      m.set(r.d[0] ?? '', x);
    }
    for (const r of manBo ?? []) {
      const x = m.get(r.d[0] ?? '') ?? { luot: 0, hong: 0 };
      x.luot += r.m[0] ?? 0; x.hong += r.m[0] ?? 0;
      m.set(r.d[0] ?? '', x);
    }
    ds.man_kho = [...m].filter(([k, x]) => k && k !== '(not set)' && x.luot >= 3)
      .map(([k, x]) => ({ k, v: Math.round(x.hong / x.luot * 100), luot: x.luot }))
      .sort((a, b) => b.v - a.v || b.luot - a.luot).slice(0, 8);
  }
  if (nguon) ds.nguon = ghep(nguon).slice(0, 8);
  g.danhSach = ds;
};

const online: LamO = async (_ga, _kh, g, { dem }) => {
  const [roiPhong, ketNoi, suCo] = await Promise.all([
    dem('online_roi_phong', ['customEvent:ly_do'], 'roi_phong'),
    dem('online_ket_noi', ['customEvent:ket_qua'], 'ket_noi'),
    // 18.11.2026: lối tự cứu của client (mất nhịp tim, nước đi chưa xác nhận, bàn đứng im) — ghép với log [ws] server
    dem('online_su_co', ['customEvent:ly_do', 'customEvent:giai_doan'], 'su_co')
  ]);
  const ds: Record<string, Kv[]> = {};
  if (roiPhong) ds.roi_phong = kv(roiPhong);
  if (ketNoi) ds.ket_noi = kv(ketNoi);
  if (suCo) ds.su_co = ghep(suCo);
  g.danhSach = ds;
};

/**
 * Lỗi JS + ngăn xếp (`ngan_xep`, 2 khung đầu `tệp:dòng:cột`, web gửi từ 19.11.2026). `ngan_xep` chưa đăng
 * ký custom dimension thì GA báo 400 → hỏi lại chỉ theo thông điệp, ghi chú nhẹ — KHÔNG thành lỗi ô.
 */
const loiJs: LamO = async (_ga, kh, g, { o, R }) => {
  const ds: Record<string, Kv[]> = {};
  let d: Dong[] | null = null, coNganXep = true;
  try {
    d = await R(kh.ky, kh.gio, ['customEvent:thong_diep', 'customEvent:ngan_xep'], ['eventCount'], loc.su_kien('loi_js'));
  } catch (e) {
    if (laLoiBan(e)) throw e;
    if (!(e instanceof GaLoi && /ngan_xep/.test(e.message))) { g.loi.loi_js = thuGon(e); g.danhSach = ds; return; }
    coNganXep = false;
    g.ghiChu = { loi_js: 'Chưa đăng ký custom dimension "ngan_xep" trong GA — chưa hiện được chỗ lỗi trong mã.' };
    d = await o('loi_js', R(kh.ky, kh.gio, ['customEvent:thong_diep'], ['eventCount'], loc.su_kien('loi_js')));
  }
  if (d) {
    const m = new Map<string, { v: number; nx: Map<string, number> }>();
    for (const r of d) {
      const k = (r.d[0] ?? '').trim();
      if (!k || k === '(not set)') continue;
      const x = m.get(k) ?? { v: 0, nx: new Map<string, number>() };
      x.v += r.m[0] ?? 0;
      const nx = coNganXep ? (r.d[1] ?? '').trim() : '';
      if (nx && nx !== '(not set)') x.nx.set(nx, (x.nx.get(nx) ?? 0) + (r.m[0] ?? 0));
      m.set(k, x);
    }
    ds.loi_js = [...m].map(([k, x]) => {
      const nx = [...x.nx].sort((a, b) => b[1] - a[1]);
      const phu = nx.length ? nx[0]![0] + (nx.length > 1 ? ` (+${nx.length - 1} chỗ khác)` : '') : undefined;
      return { k, v: x.v, ...(phu ? { phu } : {}) };
    }).sort((a, b) => b.v - a.v).slice(0, 8);
  }
  g.danhSach = ds;
};

const khac: LamO = async (_ga, _kh, g, { dem }) => {
  const [dangNhap, chiaSe, ota] = await Promise.all([
    dem('dang_nhap', ['customEvent:cach', 'customEvent:ket_qua', 'customEvent:moi'], 'dang_nhap'),
    dem('chia_se', ['customEvent:kenh', 'customEvent:ket_qua'], 'chia_se'),
    dem('cap_nhat_ota', ['customEvent:ket_qua'], 'ota')
  ]);
  const ds: Record<string, Kv[]> = {};
  if (dangNhap) ds.dang_nhap = ghep(dangNhap.map((r) => ({ d: [r.d[0] ?? '', r.d[1] ?? '', r.d[2] === 'true' ? 'moi' : ''], m: r.m })));
  if (chiaSe) ds.chia_se = ghep(chiaSe);
  if (ota) ds.ota = kv(ota);
  g.danhSach = ds;
};

const LAM: Record<Phan, LamO> = {
  kpi, chuoi, nen_tang: nenTang, quoc_gia: quocGia, heat, choi, nguoi_moi: nguoiMoi, online, loi_js: loiJs, khac
};

/** Số liệu của MỘT ô. Ném `GaLoi` (ban/het_quota) khi GA bận — để index.ts trả bản cũ hoặc 429. */
export async function motO(ga: Ga, kh: KeHoach, phan: Phan): Promise<GoiO> {
  const g: GoiO = {
    phan, khoang: kh.khoang, hat: kh.hat, hatDuocChon: kh.hatDuocChon, ky: kh.ky, capNhat: new Date().toISOString(), loi: {}
  };
  if (kh.realtime && !PHAN_REALTIME.includes(phan)) { g.khongCo = true; return g; }
  await LAM[phan](ga, kh, g, ngCanh(ga, kh, g.loi));
  return g;
}

/** 30 phút qua cho dải "đang diễn ra" — gọn, gọi riêng. Hỏng ô nào để trống ô đó; GA bận cả ba thì ném. */
export async function dangDienRa(ga: Ga): Promise<{ nguoi: number | null; van: number | null; quocGia: Kv[] | null; loi: Record<string, string> }> {
  const loi: Record<string, string> = {};
  const ban: unknown[] = [];
  const o = <T>(ten: string, p: Promise<T>): Promise<T | null> =>
    p.catch((e) => { if (laLoiBan(e)) ban.push(e); loi[ten] = thuGon(e); return null; });
  const [t, sk, qg] = await Promise.all([
    o('nguoi', ga.realtime({ metrics: [{ name: 'activeUsers' }] })),
    o('van', ga.realtime({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: loc.su_kien('van_bat_dau') })),
    o('quocGia', ga.realtime({ dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 6 }))
  ]);
  if (!t && !sk && !qg && ban.length) throw ban[0];
  // Danh sách nước (mã ISO + số người) — trang tự đổi mã ra tên tiếng Việt. Chỉ đếm số nước thì
  // "1 quốc gia" không biết là nước nào (chủ dự án hỏi 17.11.2026).
  return {
    nguoi: t ? (t[0]?.m[0] ?? 0) : null,
    van: sk ? (sk[0]?.m[0] ?? 0) : null,
    quocGia: qg ? qg.map((r) => ({ k: r.d[0] ?? '', v: r.m[0] ?? 0 })) : null,
    loi
  };
}
