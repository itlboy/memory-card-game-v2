/**
 * Gọi GA4 Data API bằng service account (chỉ quyền Viewer, scope analytics.readonly).
 * Tự ký JWT RS256 bằng WebCrypto — không kéo thư viện Google nào vào Worker.
 */

export interface KhoaSa { client_email: string; private_key: string }

let tokenCache: { token: string; het: number; email: string } | null = null;

const b64u = (b: ArrayBuffer | Uint8Array | string): string => {
  const u = typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function layToken(sa: KhoaSa): Promise<string> {
  if (tokenCache && tokenCache.email === sa.client_email && tokenCache.het > Date.now() + 60_000) return tokenCache.token;
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

export interface Dong { d: string[]; m: number[] }

export class Ga {
  constructor(private sa: KhoaSa, private property: string) {}

  private async goi(duoi: string, body: unknown): Promise<{ rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] }> {
    const token = await layToken(this.sa);
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${this.property}:${duoi}`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text();
      let msg = t.slice(0, 300);
      try { msg = (JSON.parse(t) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* giữ chữ thô */ }
      throw new Error(`GA ${r.status}: ${msg}`);
    }
    return r.json();
  }

  private static dong(j: Awaited<ReturnType<Ga['goi']>>): Dong[] {
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
