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
