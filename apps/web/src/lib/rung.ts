import { laApp } from './native';

/**
 * RUNG KHI GHÉP THẺ — theo SỐ NHỊP, không theo độ dài (chủ dự án chốt 10.10.2026).
 *
 * Vì sao nhịp: Taptic Engine của iPhone chỉ phát cú chạm RỜI (nhẹ/vừa/mạnh),
 * không có "rung dài"; thiết kế theo số nhịp thì iPhone và Android cảm giống
 * nhau. Rung dài còn đọc thành báo lỗi/cuộc gọi và đè lên cú bấm tiếp theo.
 *
 *   lật sai          1 chạm rất nhẹ
 *   chuỗi 1          1 chạm vừa
 *   chuỗi 2–3        2 chạm vừa
 *   chuỗi 4–5        3 chạm, chạm cuối mạnh
 *   chuỗi 6+         4 chạm, mạnh dần (chốt ở 4 cho đỡ ồn)
 *
 * Hai đường ra:
 *  - APP (Capacitor): plugin Haptics — đường DUY NHẤT rung được trên iPhone.
 *  - WEB: `navigator.vibrate` — có ở Android; Safari iOS (và mọi trình duyệt
 *    trên iPhone) KHÔNG có, nên ở đó im lặng, không lỗi.
 *
 * Chỉ rung theo nước của CHÍNH MÌNH — người gọi tự lọc (đấu máy, online).
 */

export type Muc = 'nhe' | 'vua' | 'manh';
export interface Nhip { muc: Muc }

/** Khoảng giữa hai nhịp, ms. Đủ thưa để tách được thành từng cú. */
export const KHOANG_MS = 70;
/** Hai cú "tách" khi cuộn dải chọn cách nhau ít nhất chừng này. */
export const CACH_TACH_MS = 45;
/** Độ dài một nhịp trên web (Android) theo mức. */
export const WEB_MS: Record<Muc, number> = { nhe: 12, vua: 25, manh: 45 };

/** Chuỗi nhịp cho một lần ghép đúng ở chuỗi `streak` (≥1). */
export function nhipGhep(streak: number): Nhip[] {
  const s = Math.max(1, Math.floor(streak));
  if (s <= 1) return [{ muc: 'vua' }];
  if (s <= 3) return [{ muc: 'vua' }, { muc: 'vua' }];
  if (s <= 5) return [{ muc: 'vua' }, { muc: 'vua' }, { muc: 'manh' }];
  return [{ muc: 'vua' }, { muc: 'vua' }, { muc: 'manh' }, { muc: 'manh' }];
}

export const NHIP_SAI: Nhip[] = [{ muc: 'nhe' }];

/** Đổi chuỗi nhịp thành mẫu của `navigator.vibrate`: [bật, nghỉ, bật, …]. */
export function mauWeb(nhip: Nhip[]): number[] {
  const out: number[] = [];
  nhip.forEach((n, i) => {
    if (i) out.push(KHOANG_MS);
    out.push(WEB_MS[n.muc]);
  });
  return out;
}

type Haptics = typeof import('@capacitor/haptics');
let napHaptics: Promise<Haptics | null> | null = null;
function layHaptics(): Promise<Haptics | null> {
  // Nạp lười: bản web không tải một byte nào của plugin
  napHaptics ??= import('@capacitor/haptics').catch(() => null);
  return napHaptics;
}

class Rung {
  /** Công tắc người chơi (prefs.rung). */
  bat = true;

  private phat(nhip: Nhip[]): void {
    if (!this.bat || !nhip.length) return;
    if (laApp) { void this.phatApp(nhip); return; }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(mauWeb(nhip));
      }
    } catch { /* trình duyệt chặn (chưa có cử chỉ người dùng…) — bỏ qua */ }
  }

  private async phatApp(nhip: Nhip[]): Promise<void> {
    const h = await layHaptics();
    if (!h) return;
    const STYLE = { nhe: h.ImpactStyle.Light, vua: h.ImpactStyle.Medium, manh: h.ImpactStyle.Heavy };
    nhip.forEach((n, i) => {
      setTimeout(() => { void h.Haptics.impact({ style: STYLE[n.muc] }).catch(() => {}); }, i * KHOANG_MS);
    });
  }

  ghep(streak: number): void { this.phat(nhipGhep(streak)); }
  sai(): void { this.phat(NHIP_SAI); }
  /** Một chạm nhẹ khi vuốt lùi qua ngưỡng (lib/nut-back.ts) — như cử chỉ Back của Android. */
  moc(): void { this.phat(NHIP_SAI); }

  /**
   * TÁCH KHI CUỘN QUA MỘT Ô (19.11.2026, chủ dự án: dải chọn số thẻ "làm hiệu ứng rung rung"): kiểu rung CHỌN của
   * hệ thống (`selectionChanged` — như bánh xe chọn giờ iPhone), nhẹ hơn mọi `impact`. Web Android: 8ms. Giới hạn
   * `CACH_TACH_MS` để vuốt nhanh qua nhiều ô không thành rè rè.
   */
  private lucTach = 0;
  tach(): void {
    if (!this.bat) return;
    const now = Date.now();
    if (now - this.lucTach < CACH_TACH_MS) return;
    this.lucTach = now;
    if (laApp) {
      // Plugin chỉ rung `selectionChanged` SAU `selectionStart` (iOS tạo UISelectionFeedbackGenerator ở start,
      // Android có cờ selectionStarted) — thiếu là im lặng không báo lỗi. Bắt đầu lười ở cú tách đầu tiên.
      void layHaptics().then(async (h) => {
        if (!h) return;
        try {
          if (!this.dangTach) { this.dangTach = true; await h.Haptics.selectionStart(); }
          await h.Haptics.selectionChanged();
        } catch { /* bỏ qua */ }
      });
      return;
    }
    try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(8); } catch { /* bỏ qua */ }
  }

  private dangTach = false;
  /** Dải đứng yên: đóng phiên rung chọn (giải phóng bộ rung của iOS). */
  xongTach(): void {
    if (!this.dangTach) return;
    this.dangTach = false;
    if (laApp) void layHaptics().then((h) => h?.Haptics.selectionEnd().catch(() => {}));
  }

  /** Có đường rung nào trên máy này không — để giấu công tắc khi vô ích. */
  coTheRung(): boolean {
    return laApp || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
  }
}

export const rung = new Rung();
