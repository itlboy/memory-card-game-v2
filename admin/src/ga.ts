/**
 * Gọi GA4 Data API bằng service account (chỉ quyền Viewer, scope analytics.readonly).
 * Tự ký JWT RS256 bằng WebCrypto — không kéo thư viện Google nào vào Worker.
 *
 * BẪY (19.11.2026): GA4 chỉ cho **10 request đồng thời mỗi thuộc tính** — quá là `429 RESOURCE_EXHAUSTED`.
 * Trước đây trang bắn 29 runReport một lúc (+3 realtime) → hay dính 429. Nay:
 *   - hàng đợi: tối đa `CAU_HINH.toiDa` (4) request GA cùng lúc trong một isolate;
 *   - 429/503 do ĐỒNG THỜI/chập chờn → thử lại có giãn cách ngẫu nhiên (~0.5s, 1.5s, 4s);
 *   - 429 do HẾT HẠN MỨC token theo giờ/ngày → KHÔNG thử lại (thử chỉ đốt thêm), ném `GaLoi` loại `het_quota`;
 *   - nhiều request cùng cần token mới → dùng chung MỘT lần xin token.
 */

export interface KhoaSa { client_email: string; private_key: string }

/** `ban` = GA đang bận (đồng thời/503) đã thử lại vẫn hỏng · `het_quota` = hết token giờ/ngày · `khac` = lỗi thường (400…). */
export class GaLoi extends Error {
  readonly status: number;
  readonly loai: 'ban' | 'het_quota' | 'khac';
  constructor(message: string, status: number, loai: GaLoi['loai']) { super(message); this.name = 'GaLoi'; this.status = status; this.loai = loai; }
}

/** Cấu hình hàng đợi/thử lại — để test chỉnh được (giãn cách 1ms thay vì giây). */
export const CAU_HINH = {
  toiDa: 4,
  tre: [500, 1500, 4000] as number[],
  ngu: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  ngauNhien: () => Math.random()
};

/* ---------------- Hàng đợi: ≤ toiDa request GA cùng lúc ---------------- */
let dangChay = 0;
const cho: (() => void)[] = [];

async function vaoHang(): Promise<void> {
  if (dangChay < CAU_HINH.toiDa) { dangChay++; return; }
  await new Promise<void>((r) => cho.push(r));          // chỗ được nhường lại nguyên (dangChay không giảm)
}
function raHang(): void {
  const tiep = cho.shift();
  if (tiep) tiep(); else dangChay--;
}
/** Chạy `viec` khi tới lượt trong hàng đợi GA. */
export async function trongHang<T>(viec: () => Promise<T>): Promise<T> {
  await vaoHang();
  try { return await viec(); } finally { raHang(); }
}
/** Chỉ cho test: số request đang chạy / đang chờ. */
export const _hang = () => ({ dangChay, cho: cho.length });

/* ---------------- Token ---------------- */
let tokenCache: { token: string; het: number; email: string } | null = null;
let tokenDangXin: { email: string; p: Promise<string> } | null = null;

const b64u = (b: ArrayBuffer | Uint8Array | string): string => {
  const u = typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function xinToken(sa: KhoaSa): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const dau = `${b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64u(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }))}`;
  const ky = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(dau));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${b64u(ky)}` })
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!j.access_token) throw new Error(`Google token: ${j.error_description ?? r.status}`);
  tokenCache = { token: j.access_token, het: Date.now() + (j.expires_in ?? 3600) * 1000, email: sa.client_email };
  return j.access_token;
}

export async function layToken(sa: KhoaSa): Promise<string> {
  if (tokenCache && tokenCache.email === sa.client_email && tokenCache.het > Date.now() + 60_000) return tokenCache.token;
  if (tokenDangXin && tokenDangXin.email === sa.client_email) return tokenDangXin.p;
  const p = xinToken(sa).finally(() => { if (tokenDangXin?.p === p) tokenDangXin = null; });
  tokenDangXin = { email: sa.client_email, p };
  return p;
}
/** Chỉ cho test. */
export const _datLaiToken = () => { tokenCache = null; tokenDangXin = null; };

/* ---------------- Phân loại lỗi GA ---------------- */
/** 429 vì hết token theo giờ/ngày (thử lại vô ích) — khác 429 vì quá số request đồng thời. */
const HET_QUOTA = /per[ _-]?(hour|day)|hourly|daily|tokensPer(Hour|Day)|tokens per (hour|day)/i;

export function phanLoai(status: number, msg: string): GaLoi['loai'] {
  if (status === 429) return HET_QUOTA.test(msg) && !/concurrent/i.test(msg) ? 'het_quota' : 'ban';
  if (status === 503) return 'ban';
  return 'khac';
}

export interface Dong { d: string[]; m: number[] }
type TraVe = { rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] };

export class Ga {
  private sa: KhoaSa;
  private property: string;
  constructor(sa: KhoaSa, property: string) { this.sa = sa; this.property = property; }

  private async goiMotLan(duoi: string, body: unknown): Promise<TraVe> {
    const token = await layToken(this.sa);
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${this.property}:${duoi}`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text();
      let msg = t.slice(0, 300);
      try { msg = (JSON.parse(t) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* giữ chữ thô */ }
      throw new GaLoi(`GA ${r.status}: ${msg}`, r.status, phanLoai(r.status, msg));
    }
    return r.json();
  }

  /** Mỗi lần thử xếp hàng riêng — lúc chờ giãn cách thì NHƯỜNG chỗ cho request khác. */
  private async goi(duoi: string, body: unknown): Promise<TraVe> {
    for (let lan = 0; ; lan++) {
      try {
        return await trongHang(() => this.goiMotLan(duoi, body));
      } catch (e) {
        if (!(e instanceof GaLoi) || e.loai !== 'ban' || lan >= CAU_HINH.tre.length) throw e;
        const tre = CAU_HINH.tre[lan]!;
        await CAU_HINH.ngu(Math.round(tre * (0.75 + CAU_HINH.ngauNhien() * 0.5)));
      }
    }
  }

  private static dong(j: TraVe): Dong[] {
    return (j.rows ?? []).map((r) => ({
      d: (r.dimensionValues ?? []).map((v) => v.value),
      m: (r.metricValues ?? []).map((v) => Number(v.value) || 0)
    }));
  }

  async report(body: Record<string, unknown>): Promise<Dong[]> {
    return Ga.dong(await this.goi('runReport', { limit: 100000, ...body }));
  }

  async realtime(body: Record<string, unknown>): Promise<Dong[]> {
    return Ga.dong(await this.goi('runRealtimeReport', body));
  }
}

/** Bộ lọc tiện dụng cho Data API. */
export const loc = {
  su_kien: (ten: string) => ({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: ten } } }),
  trong: (truong: string, gia: string[]) => ({ filter: { fieldName: truong, inListFilter: { values: gia } } }),
  va: (...e: unknown[]) => ({ andGroup: { expressions: e } })
};
