/**
 * Ô "THI ĐẤU" (23.11.2026, chủ dự án: "dashboard tích hợp vào admin"). KHÁC mọi ô còn lại của trang: số liệu KHÔNG từ GA
 * mà từ MÁY CHỦ GAME — `GET <GAME_API>/api/thongke/thidau?ngay=N` kèm header `x-thongke-key` (bảng `td_events`, server ghi
 * từng bước của thi đấu, ẩn danh). Lý do: máy chủ quyết định mọi bước nên số ở đó mới đủ và đúng; GA không thấy được
 * "đợt gọi không đủ người" hay "tin đẩy đã gửi".
 *
 * Chỉ ĐỌC, mỗi lần mở trang một truy vấn nhẹ (bảng vài trăm dòng); không nhớ tạm. Thiếu khoá → ô báo "chưa cấu hình",
 * các ô GA vẫn chạy. Phần gộp là hàm thuần (`gopThiDau`), có test — cùng cách đếm với tools/thong-ke-thi-dau.mjs.
 */
export type DongTd = [at: number, kind: string, who: string | null, platform: string, lang: string, country: string, data: string];
interface Sk { at: number; kind: string; who: string | null; platform: string; country: string; d: Record<string, unknown> }

const VN = 7 * 3_600_000;
const ngayVN = (at: number): string => new Date(at + VN).toISOString().slice(0, 10);
const so = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function gop(ds: Sk[]) {
  const dem = (f: (x: Sk) => boolean): number => ds.filter(f).length;
  const nguoi = (f: (x: Sk) => boolean): number => new Set(ds.filter(f).map((x) => x.who).filter(Boolean)).size;
  const chia = ds.filter((x) => x.kind === 'td_chia');
  const tran2 = chia.reduce((a, x) => a + so(x.d.tran2), 0), tran3 = chia.reduce((a, x) => a + so(x.d.tran3), 0);
  return {
    dotGoi: dem((x) => x.kind === 'td_dot'),
    hoi: dem((x) => x.kind === 'td_hoi'), nguoiDuocHoi: nguoi((x) => x.kind === 'td_hoi'),
    hoiCoNguoiCho: dem((x) => x.kind === 'td_hoi' && x.d.kenh === 'coNguoiCho'),
    thamGia: dem((x) => x.kind === 'td_tra_loi' && x.d.tra === 'thamGia'),
    deSau: dem((x) => x.kind === 'td_tra_loi' && x.d.tra === 'deSau'),
    boQua: dem((x) => x.kind === 'td_tra_loi' && x.d.tra === 'boQua'),
    dotChia: chia.length, dotDuNguoi: chia.filter((x) => x.d.du === true).length,
    tran2, tran3, nguoiVaoTran: tran2 * 2 + tran3 * 3,
    batDauCho: dem((x) => x.kind === 'td_cho' && x.d.viec === 'batDau'),
    hetGioCho: dem((x) => x.kind === 'td_cho' && x.d.viec === 'hetGio'),
    vanBatDau: dem((x) => x.kind === 'td_van' && x.d.viec === 'batDau'),
    vanXong: dem((x) => x.kind === 'td_van' && x.d.viec === 'xong'),
    vanCoNguoiRoi: dem((x) => x.kind === 'td_van' && x.d.viec === 'xong' && so(x.d.roi) > 0),
    choiLai: dem((x) => x.kind === 'td_choi_lai'),
    tatGoiY: dem((x) => x.kind === 'td_tat'),
    pushGui: ds.filter((x) => x.kind === 'td_push').reduce((a, x) => a + so(x.d.gui), 0)
  };
}

export function gopThiDau(dong: DongTd[], soNgay: number, now = Date.now()) {
  const sk: Sk[] = dong.map(([at, kind, who, platform, , country, data]) => {
    let d: Record<string, unknown> = {};
    try { const v = JSON.parse(data) as unknown; if (v && typeof v === 'object') d = v as Record<string, unknown>; } catch { /* dòng hỏng: giữ sự kiện, bỏ dữ liệu */ }
    return { at: Number(at), kind: String(kind), who: who ? String(who) : null, platform: String(platform || ''), country: String(country || ''), d };
  });
  // Dòng không có mốc giờ hợp lệ thì bỏ hẳn (không xếp được vào ngày nào, và `toISOString` sẽ ném)
  for (let i = sk.length - 1; i >= 0; i--) if (!Number.isFinite(sk[i]!.at)) sk.splice(i, 1);
  const theoNgay = new Map<string, Sk[]>();
  for (const x of sk) { const k = ngayVN(x.at); (theoNgay.get(k) ?? theoNgay.set(k, []).get(k)!).push(x); }
  const nhom = (f: (x: Sk) => string) => {
    const m = new Map<string, Sk[]>();
    for (const x of sk) { const k = f(x); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
    return [...m.entries()].map(([ten, v]) => ({ ten, hoi: v.filter((x) => x.kind === 'td_hoi').length, thamGia: v.filter((x) => x.kind === 'td_tra_loi' && x.d.tra === 'thamGia').length, nguoi: new Set(v.map((x) => x.who).filter(Boolean)).size }))
      .sort((a, b) => b.hoi - a.hoi);
  };
  return {
    soNgay, luc: new Date(now).toISOString(), suKien: sk.length,
    tong: gop(sk),
    // Mới nhất trước — bảng trên trang đọc từ trên xuống
    ngay: [...theoNgay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([ngay, v]) => ({ ngay, ...gop(v) })),
    nenTang: nhom((x) => x.platform), nuoc: nhom((x) => x.country)
  };
}

export async function layThiDau(env: { GAME_API?: string; THONGKE_KEY?: string }, soNgay: number, layFetch: typeof fetch = fetch): Promise<Response> {
  const tra = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.THONGKE_KEY || !env.GAME_API) return tra({ chuaCauHinh: true }, 503);
  const n = Math.min(90, Math.max(1, Math.floor(soNgay) || 30));
  try {
    const r = await layFetch(`${env.GAME_API.replace(/\/$/, '')}/api/thongke/thidau?ngay=${n}`, { headers: { 'x-thongke-key': env.THONGKE_KEY.trim() } });
    if (!r.ok) return tra({ loi: `Máy chủ game trả ${r.status}` }, 502);
    const { ds } = await r.json() as { ds?: DongTd[] };
    return tra(gopThiDau(Array.isArray(ds) ? ds : [], n));
  } catch (e) { return tra({ loi: `Không gọi được máy chủ game: ${e instanceof Error ? e.message : String(e)}` }, 502); }
}
