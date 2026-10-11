/**
 * SỔ CẢNH KẾT VÁN — bộ mới theo mockup chủ dự án duyệt 11.10.2026
 * (https://claude.ai/artifact/YQ6amnuWjzsHQeisNB1iC4), THAY HẲN bộ cũ.
 *
 * Bộ cũ là 4–5 hình nền mỗi kết cục, bốc ngẫu nhiên theo seed, KHÔNG chạm tới
 * bàn thẻ. Bộ mới là MỘT CẢNH CỐ ĐỊNH CHO MỖI TÌNH HUỐNG, và cảnh dùng chính
 * bàn thẻ: thắng thì cả bàn gợn sóng, thua thì lá chưa ghép rơi xuống. Vì thế
 * luật "≥4 hình mỗi kết cục" cũ đã bỏ (quyết định của chủ dự án).
 *
 * Chia việc:
 *  - ở đây: chọn cảnh, mốc thời gian, lời thoại, và phần CHUYỂN ĐỘNG BẰNG JS
 *    (hạt trên canvas, lá bài, rung màn);
 *  - `styles/ketcuc-fx.css`: chữ lớn, băng kỷ lục, máy trêu, hai nửa màn hoà
 *    (CSS animation có delay — dựng được cả trong test DOM);
 *  - `KetCucFx.vue`: component DUY NHẤT, gắn hai phần trên vào màn.
 *  - TIẾNG vẫn ở chỗ gọi (`sfx.victory/lose/defeat/win`, `sfx.kyLuc`), mốc khớp
 *    với mốc hình dưới đây.
 *
 * Không có animation nào chạy vô hạn: bảng kết quả nằm đè lên rất lâu, mà hạt
 * quay mãi là cú chạm "Chơi lại" phải xếp hàng sau nó (đã bị báo). Canvas tự
 * dừng khi hết hạt.
 */

/** Kết cục dưới góc nhìn CỦA NGƯỜI ĐANG NGỒI TRƯỚC MÁY — không phải của bàn. */
export type LoaiKetCuc = 'thang' | 'thua' | 'hoa';

/** Năm cảnh. Thua tách hai: thua đồng hồ/bàn khác thua MÁY (có kẻ trêu mình). */
export type CanhKetCuc = 'thang' | 'ky-luc' | 'thua' | 'thua-may' | 'hoa';

export const TEN_CANH: Record<CanhKetCuc, string> = {
  thang: 'Chiến thắng', 'ky-luc': 'Kỷ lục mới', thua: 'Thua rồi', 'thua-may': 'Máy thắng', hoa: 'Hoà'
};

export function chonCanh(loai: LoaiKetCuc, o: { kyLuc?: boolean; matMay?: string | null } = {}): CanhKetCuc {
  if (loai === 'hoa') return 'hoa';
  if (loai === 'thang') return o.kyLuc ? 'ky-luc' : 'thang';
  return o.matMay ? 'thua-may' : 'thua';
}

/**
 * Bảng kết quả hiện sau bao lâu. Cảnh chạy XONG phần chính trước mốc này; sau
 * đó bảng nằm đè, hiệu ứng còn lại (hạt rơi nốt) chạy phía sau nó.
 */
export const HIEN_BANG_MS: Record<CanhKetCuc, number> = {
  thang: 2200, 'ky-luc': 2600, thua: 2400, 'thua-may': 2400, hoa: 2000
};

/** Câu trêu của từng mức máy, theo MẶT máy (avatar là thứ có sẵn trong ranking). */
export const CAU_TREU: Record<string, string> = {
  '🐣': 'Ơ… mình thắng thật à?',
  '🐥': 'Hên thôi mà, hì!',
  ':bao-den:': 'Nhanh như báo!',
  '🐯': 'Gừ… lần sau nhé!',
  ':rong-vang:': 'Ta là bất bại!'
};
export const cauTreu = (mat: string | null | undefined): string => (mat && CAU_TREU[mat]) || 'Hehe, lần sau nhé!';

/** Dòng an ủi khi thua: nói đúng còn thiếu bao nhiêu — lý do để bấm Chơi lại. */
export function dongAnUi(capConLai: number): string {
  return capConLai > 0 ? `Chỉ còn ${capConLai} cặp nữa thôi. Làm lại nhé?` : 'Suýt nữa thôi. Làm lại nhé?';
}

/* ---------- hạt: pháo giấy, lấp lánh, bụi — một canvas, tự dừng ---------- */

interface Hat {
  loai: 'giay' | 'sao' | 'bui';
  x: number; y: number; vx: number; vy: number;
  trong: number; can: number; q: number; vq: number; r: number; mau: string; song: number;
}

export const MAU_GIAY = ['#ffd76a', '#f0a500', '#8b7dff', '#ff5fa8', '#3ddc97', '#7ad7ff', '#ffffff'];
/** Trần số hạt: điện thoại yếu vẫn giữ được nhịp. */
const TRAN_HAT = 260;

export class BoHat {
  private hat: Hat[] = [];
  private raf = 0;
  private c2: CanvasRenderingContext2D | null;
  constructor(private cv: HTMLCanvasElement) {
    this.c2 = cv.getContext('2d');
    this.coKhung();
  }
  coKhung(): void {
    const k = Math.min(2, globalThis.devicePixelRatio || 1);
    this.cv.width = innerWidth * k; this.cv.height = innerHeight * k;
    this.c2?.setTransform(k, 0, 0, k, 0, 0);
  }
  get so(): number { return this.hat.length; }
  private them(h: Hat): void {
    if (this.hat.length >= TRAN_HAT) return;
    this.hat.push(h);
    if (!this.raf) this.raf = requestAnimationFrame(this.ve);
  }
  phao(x: number, y: number, goc: number, so: number, luc = 13): void {
    for (let i = 0; i < so; i++) {
      const g = goc + (Math.random() - 0.5) * 0.7, v = luc * (0.6 + Math.random() * 0.6);
      this.them({ loai: 'giay', x, y, vx: Math.cos(g) * v, vy: Math.sin(g) * v, trong: 0.32, can: 0.985,
        q: Math.random() * 6, vq: (Math.random() - 0.5) * 0.4, r: 4 + Math.random() * 4, mau: MAU_GIAY[i % MAU_GIAY.length]!, song: 160 + Math.random() * 60 });
    }
  }
  long(x: number, y: number, so: number, mau: readonly string[], luc = 6): void {
    for (let i = 0; i < so; i++) {
      const g = Math.random() * 6.28, v = luc * (0.3 + Math.random());
      this.them({ loai: 'sao', x, y, vx: Math.cos(g) * v, vy: Math.sin(g) * v, trong: 0.05, can: 0.955,
        q: 0, vq: 0.1, r: 3 + Math.random() * 4, mau: mau[i % mau.length]!, song: 50 + Math.random() * 40 });
    }
  }
  mua(so: number, mau: readonly string[]): void {
    for (let i = 0; i < so; i++) {
      this.them({ loai: 'giay', x: Math.random() * innerWidth, y: -10, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2,
        trong: 0.05, can: 0.995, q: Math.random() * 6, vq: 0.1, r: 4, mau: mau[i % mau.length]!, song: 220 });
    }
  }
  bui(x: number, y: number, so: number): void {
    for (let i = 0; i < so; i++) {
      this.them({ loai: 'bui', x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 1.4,
        trong: -0.01, can: 0.99, q: 0, vq: 0, r: 1.5 + Math.random() * 2.5, mau: 'rgba(160,166,200,.7)', song: 90 });
    }
  }
  private ve = (): void => {
    const c = this.c2;
    this.raf = 0;
    if (!c) { this.hat = []; return; }
    const w = innerWidth, h = innerHeight;
    c.clearRect(0, 0, w, h);
    this.hat = this.hat.filter((p) => p.song > 0 && p.y < h + 40);
    for (const p of this.hat) {
      p.vy += p.trong; p.vx *= p.can; p.vy *= p.can; p.x += p.vx; p.y += p.vy; p.q += p.vq; p.song--;
      c.save(); c.globalAlpha = Math.min(1, p.song / 30); c.translate(p.x, p.y); c.rotate(p.q); c.fillStyle = p.mau;
      if (p.loai === 'giay') c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9 * Math.abs(Math.cos(p.q * 2)));
      else if (p.loai === 'sao') {
        c.beginPath();
        for (let i = 0; i < 8; i++) { const rr = i % 2 ? p.r * 0.35 : p.r; c.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); }
        c.fill();
      } else { c.beginPath(); c.arc(0, 0, p.r, 0, 7); c.fill(); }
      c.restore();
    }
    if (this.hat.length) this.raf = requestAnimationFrame(this.ve);
  };
  dung(): void {
    cancelAnimationFrame(this.raf); this.raf = 0; this.hat = [];
    this.c2?.clearRect(0, 0, innerWidth, innerHeight);
  }
}

/* ---------- chạy một cảnh ---------- */

export interface SanKhau {
  hat: BoHat;
  /** Lá bài trên bàn đang chơi (`.board button.card`). */
  la(): HTMLElement[];
  ban(): HTMLElement | null;
  /** Phần tử để rung màn. */
  man(): HTMLElement | null;
  rung(soNhip: number): void;
  giamChuyenDong: boolean;
}

/**
 * Chạy phần JS của cảnh. Trả về hàm dọn: huỷ hẹn giờ, huỷ MỌI animation đã gắn
 * lên lá bài / bàn / màn (lá rơi trả về chỗ cũ trước khi bàn mới dựng lên).
 *
 * Dùng thuộc tính RIÊNG `translate`/`rotate`/`scale` chứ không `transform`:
 * lá bài đang dùng `transform` cho cú lật, ghi đè nó là lá lật ngược lại và lộ
 * mặt (luật "không lộ bài, kể cả trong một khung hình").
 */
export function chayCanh(canh: CanhKetCuc, s: SanKhau): () => void {
  const hen: ReturnType<typeof setTimeout>[] = [];
  const anim: Animation[] = [];
  const sau = (ms: number, f: () => void) => hen.push(setTimeout(f, s.giamChuyenDong ? Math.min(ms, 60) : ms));
  const gan = (el: Element | null, kf: Keyframe[], o: KeyframeAnimationOptions) => {
    if (!el || typeof (el as HTMLElement).animate !== 'function') return;
    anim.push((el as HTMLElement).animate(kf, s.giamChuyenDong ? { ...o, duration: 1 } : o));
  };
  const W = innerWidth, H = innerHeight;
  const giam = s.giamChuyenDong;

  const rungMan = () => { if (!giam) gan(s.man(), [
    { translate: '0 0' }, { translate: '-4px 2px' }, { translate: '6px -3px' }, { translate: '-6px 3px' },
    { translate: '6px -3px' }, { translate: '-3px 1px' }, { translate: '0 0' }], { duration: 500 }); };

  const xam = (muc: number) => gan(s.ban(), [{ filter: 'none' }, { filter: `grayscale(${muc}) brightness(${1 - muc * 0.35})` }],
    { duration: 900, fill: 'forwards' });

  switch (canh) {
    case 'thang':
    case 'ky-luc': {
      // Gợn sóng toả từ tâm bàn: mỗi lá nảy 1,1 theo khoảng cách
      const ban = s.ban()?.getBoundingClientRect();
      if (ban && !giam) {
        const cx = ban.left + ban.width / 2, cy = ban.top + ban.height / 2;
        for (const el of s.la()) {
          const r = el.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
          gan(el, [{ scale: '1' }, { scale: '1.1' }, { scale: '1' }], { duration: 360, delay: d * 0.9, easing: 'ease-out' });
        }
      }
      sau(350, () => {
        rungMan(); s.rung(6);
        s.hat.phao(0, H, -Math.PI / 3, giam ? 20 : 70, 15);
        s.hat.phao(W, H, -Math.PI * 2 / 3, giam ? 20 : 70, 15);
      });
      if (canh === 'ky-luc') sau(1500, () => {
        s.rung(6);
        ([[0.25, 0.3], [0.75, 0.26], [0.5, 0.18]] as const).forEach(([fx, fy], i) =>
          sau(i * 160, () => s.hat.long(W * fx, H * fy, 40, MAU_GIAY, 7)));
      });
      break;
    }
    case 'thua': {
      xam(0.85); s.rung(1);
      const chua = s.la().filter((el) => !el.classList.contains('done'));
      // Tổng so le chốt ở 600ms: 90ms mỗi lá thì bàn 88 thẻ mất 8 giây mới rơi xong
      const buoc = Math.min(90, 600 / Math.max(1, chua.length));
      chua.forEach((el, i) => sau(i * buoc, () => {
        const r = el.getBoundingClientRect();
        gan(el, [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -10px', rotate: `${i % 2 ? 6 : -6}deg`, offset: 0.15 },
          { translate: `0 ${H}px`, rotate: `${i % 2 ? 40 : -40}deg` }], { duration: 900, easing: 'cubic-bezier(.55,0,.9,.4)', fill: 'forwards' });
        if (!giam) s.hat.bui(r.left + r.width / 2, r.bottom, 10);
      }));
      sau(1300, () => s.rung(2));
      break;
    }
    case 'thua-may':
      xam(0.6); s.rung(1);
      break;
    case 'hoa':
      sau(550, () => s.rung(2));
      sau(1200, () => s.hat.mua(giam ? 12 : 40, ['#8b7dff', '#ff5fa8']));
      break;
  }

  return () => {
    hen.forEach(clearTimeout);
    for (const a of anim) { try { a.cancel(); } catch { /* đã gỡ */ } }
    s.hat.dung();
  };
}

/* ---------- huy hiệu danh hiệu theo bậc ---------- */

export type BacDanhHieu = 'dong' | 'bac' | 'vang' | 'bi-mat';
export const MAU_BAC: Record<BacDanhHieu, { ten: string; a: string; b: string; tia: string }> = {
  dong: { ten: 'Đồng', a: '#f3b27a', b: '#b56a33', tia: 'rgba(243,178,122,.28)' },
  bac: { ten: 'Bạc', a: '#eef2ff', b: '#9aa6c8', tia: 'rgba(220,228,255,.3)' },
  vang: { ten: 'Vàng', a: '#ffd76a', b: '#f0a500', tia: 'rgba(255,215,106,.38)' },
  'bi-mat': { ten: 'Bí mật', a: '#b9f3ff', b: '#7a7dff', tia: 'rgba(185,243,255,.4)' }
};
