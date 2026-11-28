/**
 * Ô "MÁY CHỦ · TRỰC TIẾP" (28.11.2026, chủ dự án: "thích hợp các thống kê vào admin"). Không qua GA: hỏi thẳng MÁY CHỦ GAME
 * `GET <GAME_API>/api/quantri/tong` + `/api/quantri/phong?boMa=1` kèm header `x-quantri-key` = secret `QUANTRI_KEY`
 * (my-secrets provider `latthe-quantri`, cùng khoá với /opt/latthe/bimat/QUANTRI_KEY trên mọi máy cụm). Khoá chỉ nằm ở
 * Worker — trình duyệt chỉ thấy số đã gộp. Tên người chơi là tên công khai trong phòng (trang sau Cloudflare Access).
 */
export async function layMayChu(env: { GAME_API?: string; QUANTRI_KEY?: string }, layFetch: typeof fetch = fetch): Promise<Response> {
  const tra = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.QUANTRI_KEY || !env.GAME_API) return tra({ chuaCauHinh: true }, 503);
  const goc = env.GAME_API.replace(/\/$/, '');
  const h = { headers: { 'x-quantri-key': env.QUANTRI_KEY.trim() } };
  try {
    const [a, b] = await Promise.all([layFetch(`${goc}/api/quantri/tong`, h), layFetch(`${goc}/api/quantri/phong?boMa=1`, h)]);
    if (!a.ok || !b.ok) return tra({ loi: `Máy chủ game trả ${a.ok ? b.status : a.status}` }, 502);
    return tra({ tong: await a.json(), phong: await b.json() });
  } catch (e) { return tra({ loi: `Không gọi được máy chủ game: ${e instanceof Error ? e.message : String(e)}` }, 502); }
}

/**
 * Ô "BÁO LỖI / GÓP Ý" (28.11.2026): thư người chơi gửi từ app — đọc qua API quản trị của máy chủ game, cùng khoá QUANTRI_KEY.
 * Ảnh đi qua Worker (cùng gốc admin → CSP img-src 'self' cho phép), không lộ khoá.
 */
export async function layBaoLoi(env: { GAME_API?: string; QUANTRI_KEY?: string }, truoc: number | null, layFetch: typeof fetch = fetch): Promise<Response> {
  const tra = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.QUANTRI_KEY || !env.GAME_API) return tra({ chuaCauHinh: true }, 503);
  try {
    const r = await layFetch(`${env.GAME_API.replace(/\/$/, '')}/api/quantri/baoloi${truoc ? `?truoc=${truoc}` : ''}`, { headers: { 'x-quantri-key': env.QUANTRI_KEY.trim() } });
    if (!r.ok) return tra({ loi: `Máy chủ game trả ${r.status}` }, 502);
    return tra(await r.json());
  } catch (e) { return tra({ loi: `Không gọi được máy chủ game: ${e instanceof Error ? e.message : String(e)}` }, 502); }
}

export async function layAnhBaoLoi(env: { GAME_API?: string; QUANTRI_KEY?: string }, id: number, layFetch: typeof fetch = fetch): Promise<Response> {
  if (!env.QUANTRI_KEY || !env.GAME_API) return new Response('', { status: 503 });
  const r = await layFetch(`${env.GAME_API.replace(/\/$/, '')}/api/quantri/baoloi/${id}/anh`, { headers: { 'x-quantri-key': env.QUANTRI_KEY.trim() } });
  if (!r.ok) return new Response('', { status: r.status });
  const loai = r.headers.get('content-type') ?? '';
  if (!/^image\/(jpeg|png|webp)$/.test(loai)) return new Response('', { status: 415 });
  return new Response(r.body, { headers: { 'content-type': loai, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
}

export async function datTrangThaiBaoLoi(env: { GAME_API?: string; QUANTRI_KEY?: string }, id: number, tt: string, layFetch: typeof fetch = fetch): Promise<Response> {
  const tra = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.QUANTRI_KEY || !env.GAME_API) return tra({ chuaCauHinh: true }, 503);
  if (tt !== 'moi' && tt !== 'xem' && tt !== 'xong') return tra({ loi: 'tt sai' }, 400);
  const r = await layFetch(`${env.GAME_API.replace(/\/$/, '')}/api/quantri/baoloi/${id}/trangthai`, {
    method: 'POST', headers: { 'x-quantri-key': env.QUANTRI_KEY.trim(), 'content-type': 'application/json' }, body: JSON.stringify({ tt })
  });
  return tra(await r.json().catch(() => ({ ok: false })), r.ok ? 200 : 502);
}

/**
 * "AI ĐANG ONLINE" (28.11.2026, mockup duyệt https://claude.ai/artifact/3TE9pgPE7keg4BhyMSVj7c): từng người đang mở app (nối sảnh) —
 * tên, nền tảng, đang làm gì, số xu… qua `GET /api/quantri/online` (máy chủ game chuyển về pod giữ sảnh). Cùng khoá QUANTRI_KEY.
 */
export async function layNguoiOnline(env: { GAME_API?: string; QUANTRI_KEY?: string }, layFetch: typeof fetch = fetch): Promise<Response> {
  const tra = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.QUANTRI_KEY || !env.GAME_API) return tra({ chuaCauHinh: true }, 503);
  try {
    const r = await layFetch(`${env.GAME_API.replace(/\/$/, '')}/api/quantri/online`, { headers: { 'x-quantri-key': env.QUANTRI_KEY.trim() } });
    if (!r.ok) return tra({ loi: `Máy chủ game trả ${r.status}` }, 502);
    return tra(await r.json());
  } catch (e) { return tra({ loi: `Không gọi được máy chủ game: ${e instanceof Error ? e.message : String(e)}` }, 502); }
}
