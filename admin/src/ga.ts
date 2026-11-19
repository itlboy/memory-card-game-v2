/**
 * Gọi GA4 Data API bằng service account (chỉ quyền Viewer, scope analytics.readonly).
 * Tự ký JWT RS256 bằng WebCrypto — không kéo thư viện Google nào vào Worker.
 *
 * BẪY (19.11.2026): GA4 chỉ cho **10 request đồng thời mỗi thuộc tính** — quá là `429 RESOURCE_EXHAUSTED`.
 * Trước đây trang bắn 29 runReport một lúc (+3 realtime) → hay dính 429. Nay:
 *   - hàng đợi: tối đa `CAU_HINH.toiDa` (4) request GA cùng lúc trong MỘT request (xem bẫy ở Hang);
 *   - 429/503 do ĐỒNG THỜI/chập chờn → thử lại có giãn cách ngẫu nhiên (~0.5s, 1.5s, 4s);
 *   - 429 do HẾT HẠN MỨC token theo giờ/ngày → KHÔNG thử lại (thử chỉ đốt thêm), ném `GaLoi` loại `het_quota`;
 *   - nhiều lời gọi trong một request cùng cần token mới → dùng chung MỘT lần xin token.
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

/* ---------------- Hàng đợi: ≤ toiDa request GA cùng lúc ----------------
 * BẪY WORKERS (19.11.2026, deploy đầu bị 500 cả trang): hàng đợi và "lần xin token đang chạy" TỪNG để ở
 * cấp module, dùng chung giữa các request của cùng isolate. Workers KHÔNG cho request này chờ một promise
 * do request khác tạo/resolve ("A promise was resolved … from a different request context") → request
 * treo, runtime huỷ, trả 500. Nên hàng đợi và token-đang-xin thuộc về TỪNG `Ga` (mỗi request một `Ga`).
 * Chỉ GIÁ TRỊ token đã có (chuỗi) mới được nhớ cấp module. Các ô gọi song song thì trang đã giới hạn ≤3.
 */
export class Hang {
  private dangChay = 0;
  private cho: (() => void)[] = [];
  private async vao(): Promise<void> {
    if (this.dangChay < CAU_HINH.toiDa) { this.dangChay++; return; }
    await new Promise<void>((r) => this.cho.push(r));   // chỗ được nhường lại nguyên (dangChay không giảm)
  }
  private ra(): void {
    const tiep = this.cho.shift();
    if (tiep) tiep(); else this.dangChay--;
  }
  /** Chạy `viec` khi tới lượt. */
  async chay<T>(viec: () => Promise<T>): Promise<T> {
    await this.vao();
    try { return await viec(); } finally { this.ra(); }
  }
  /** Chỉ cho test. */
  trangThai() { return { dangChay: this.dangChay, cho: this.cho.length }; }
}

/* ---------------- Token ---------------- */
let tokenCache: { token: string; het: number; email: string } | null = null;

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

/** Token còn hạn thì dùng lại (giá trị chuỗi, an toàn giữa các request); hết thì xin mới. */
export function tokenCon(email: string): string | null {
  return tokenCache && tokenCache.email === email && tokenCache.het > Date.now() + 60_000 ? tokenCache.token : null;
}
/** Chỉ cho test. */
export const _datLaiToken = () => { tokenCache = null; };

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
  /** Hàng đợi + token-đang-xin RIÊNG của request này (xem bẫy ở trên). */
  readonly hang = new Hang();
  private tokenDangXin: Promise<string> | null = null;
  constructor(sa: KhoaSa, property: string) { this.sa = sa; this.property = property; }

  /** Các lời gọi cùng lúc trong MỘT request dùng chung một lần xin token. */
  private layToken(): Promise<string> {
    const co = tokenCon(this.sa.client_email);
    if (co) return Promise.resolve(co);
    if (!this.tokenDangXin) this.tokenDangXin = xinToken(this.sa).finally(() => { this.tokenDangXin = null; });
    return this.tokenDangXin;
  }

  private async goiMotLan(duoi: string, body: unknown): Promise<TraVe> {
    const token = await this.layToken();
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
        return await this.hang.chay(() => this.goiMotLan(duoi, body));
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
