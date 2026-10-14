import { t, type KhoaDich } from './i18n';

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

/** Bốn cảnh. Thua MÁY dùng chung cảnh thua với thua người (chủ dự án 14.10.2026: đấu
 *  máy hiện như đấu người — bỏ cảnh "máy trêu" và câu trêu riêng từng mức máy). */
export type CanhKetCuc = 'thang' | 'ky-luc' | 'thua' | 'hoa';

export const TEN_CANH: Record<CanhKetCuc, string> = {
  thang: 'Chiến thắng', 'ky-luc': 'Kỷ lục mới', thua: 'Thua rồi', hoa: 'Hoà'
};

/**
 * BIẾN THỂ (11.10.2026, chủ dự án: "nhiều hiệu ứng thắng và thua, cái nào cũng
 * nổi bật"). Cảnh thắng/kỷ lục và cảnh thua mỗi cảnh có nhiều biến thể, bốc
 * THEO SEED của ván — F5 hay view online dựng lại vẫn ra đúng một biến thể.
 * Kỷ lục = biến thể thắng + băng vàng KỶ LỤC MỚI phủ lên.
 * Thêm biến thể: một id ở đây + nhánh trong `chayCanh` + khối CSS + template
 * trong KetCucFx + tiếng trong `TIENG_BIEN_THE` của KetCucFx (test canh).
 */
export const BIEN_THE = {
  thang: ['phao-giay', 'phao-hoa-dem', 'vuong-mien'],
  // 'game-over' (màn TV đen + chữ 8-bit) BỎ 14.10.2026: lệch hẳn nét Kẹo, đen sì che bàn
  thua: ['dap-vo', 'tan-tro']
} as const;
export type BienThe = (typeof BIEN_THE)[keyof typeof BIEN_THE][number];
export const TEN_BIEN_THE: Record<BienThe, string> = {
  'phao-giay': 'Pháo giấy', 'phao-hoa-dem': 'Pháo hoa đêm', 'vuong-mien': 'Vương miện',
  'dap-vo': 'Đập vỡ màn', 'tan-tro': 'Tan thành tro'
};

/** Băm seed thành số 32-bit — bốc biến thể tất định theo ván. */
function bam(seed: number): number {
  return Math.imul((seed >>> 0) ^ 0x5bd1e995, 2654435761) >>> 0;
}

/** Biến thể của cảnh theo seed ván; cảnh không có biến thể thì null. */
export function bocBienThe(canh: CanhKetCuc, seed: number): BienThe | null {
  const ds: readonly BienThe[] | null = canh === 'thang' || canh === 'ky-luc' ? BIEN_THE.thang : canh === 'thua' ? BIEN_THE.thua : null;
  return ds ? ds[bam(seed) % ds.length]! : null;
}

export function chonCanh(loai: LoaiKetCuc, o: { kyLuc?: boolean } = {}): CanhKetCuc {
  if (loai === 'hoa') return 'hoa';
  if (loai === 'thang') return o.kyLuc ? 'ky-luc' : 'thang';
  return 'thua';
}

/**
 * Bảng kết quả hiện sau bao lâu. Cảnh chạy XONG phần chính trước mốc này; sau
 * đó bảng nằm đè, hiệu ứng còn lại (hạt rơi nốt) chạy phía sau nó.
 */
export const HIEN_BANG_MS: Record<CanhKetCuc, number> = {
  // Thua 2,9s: cảnh thua nay có cú đập vỡ màn (1,45s) và đám mây đổ mưa (1,6s→)
  // Cảnh có nhiều biến thể thì mốc là của biến thể DÀI nhất (game over 2,9s)
  thang: 2300, 'ky-luc': 2600, thua: 2900, hoa: 2000
};

/** Vết nứt toả từ điểm chữ chạm đất — toạ độ quanh tâm (0,0) của khối chữ. */
export const VET_NUT: readonly string[] = [
  'M0 0 L-18 -10 L-34 -8 L-52 -22 L-70 -20 L-96 -34',
  'M0 0 L-22 6 L-40 2 L-58 16 L-84 14',
  'M0 0 L-8 20 L-20 30 L-26 50',
  'M0 0 L16 -12 L30 -10 L44 -26 L66 -24 L92 -38',
  'M0 0 L20 8 L38 4 L56 18 L78 16 L98 26',
  'M0 0 L10 18 L24 28 L30 48',
  'M-34 -8 L-38 -24', 'M38 4 L42 22', 'M-40 2 L-48 -6'
];


/** Dòng an ủi khi thua MỘT MÌNH (hết giờ/mạng): nói đúng còn thiếu bao nhiêu — lý do
 *  để bấm Chơi lại. Thua người/máy thì KHÔNG hiện: bàn đã sạch, câu đó vô nghĩa. */
export function dongAnUi(capConLai: number): string {
  return capConLai > 0 ? t('fx.conCap', { n: capConLai }) : t('fx.suytNua');
}

/* ---------- hạt: pháo giấy, lấp lánh, bụi — một canvas, tự dừng ---------- */

interface Hat {
  loai: 'giay' | 'sao' | 'bui' | 'giot' | 'xu' | 'tro';
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
  /*
   * KÍCH THƯỚC LẤY TỪ CHÍNH CANVAS, KHÔNG PHẢI CỬA SỔ — lớp hiệu ứng nằm trong
   * cột game (#app), trên máy tính cột hẹp hơn cửa sổ nhiều. Bản cũ dùng
   * innerWidth nên pháo giấy/xu rơi cả ngoài cột (chủ dự án báo 12.10.2026).
   */
  w = 0; h = 0;
  coKhung(): void {
    const k = Math.min(2, globalThis.devicePixelRatio || 1);
    this.w = this.cv.clientWidth || innerWidth; this.h = this.cv.clientHeight || innerHeight;
    this.cv.width = this.w * k; this.cv.height = this.h * k;
    this.c2?.setTransform(k, 0, 0, k, 0, 0);
  }
  get so(): number { return this.hat.length; }
  /** Đổi toạ độ màn hình (getBoundingClientRect) sang toạ độ trong canvas. */
  diem(x: number, y: number): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [x - r.left, y - r.top];
  }
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
      this.them({ loai: 'giay', x: Math.random() * this.w, y: -10, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2,
        trong: 0.05, can: 0.995, q: Math.random() * 6, vq: 0.1, r: 4, mau: mau[i % mau.length]!, song: 220 });
    }
  }
  /** Giọt mưa rơi thẳng từ dải [x0, x1] ở độ cao y. */
  giot(x0: number, x1: number, y: number, so: number): void {
    for (let i = 0; i < so; i++) {
      this.them({ loai: 'giot', x: x0 + Math.random() * (x1 - x0), y, vx: -0.6, vy: 6 + Math.random() * 3,
        trong: 0.25, can: 1, q: 0, vq: 0, r: 7 + Math.random() * 5, mau: 'rgba(150,190,255,.85)', song: 48 });
    }
  }
  /** Đồng xu vàng rơi xoay (vương miện). */
  xu(so: number): void {
    for (let i = 0; i < so; i++) {
      this.them({ loai: 'xu', x: Math.random() * this.w, y: -16 - Math.random() * 60, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3,
        trong: 0.18, can: 0.995, q: Math.random() * 6, vq: 0.15 + Math.random() * 0.15, r: 7 + Math.random() * 4, mau: '#ffd76a', song: 200 });
    }
  }
  /** Tro bay theo gió (tan thành tro): bụi xám lẫn than đỏ, gió thổi sang phải. */
  tro(x: number, y: number, w: number, h: number, so: number): void {
    for (let i = 0; i < so; i++) {
      this.them({ loai: 'tro', x: x + Math.random() * w, y: y + Math.random() * h, vx: 2 + Math.random() * 4, vy: -1.2 + Math.random() * 1.6,
        trong: -0.015, can: 0.985, q: 0, vq: 0, r: 1.2 + Math.random() * 2.4,
        mau: i % 7 === 0 ? 'rgba(255,120,60,.95)' : `rgba(${190 + (i % 3) * 20},${195 + (i % 3) * 20},${215 + (i % 3) * 15},.85)`, song: 70 + Math.random() * 40 });
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
    const w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    this.hat = this.hat.filter((p) => p.song > 0 && p.y < h + 40);
    for (const p of this.hat) {
      p.vy += p.trong; p.vx *= p.can; p.vy *= p.can; p.x += p.vx; p.y += p.vy; p.q += p.vq; p.song--;
      c.save(); c.globalAlpha = Math.min(1, p.song / 30); c.translate(p.x, p.y); c.rotate(p.q); c.fillStyle = p.mau;
      if (p.loai === 'giay') c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9 * Math.abs(Math.cos(p.q * 2)));
      else if (p.loai === 'giot') { c.rotate(-p.q); c.fillRect(-1, -p.r, 2, p.r); }
      else if (p.loai === 'xu') {
        // Đồng xu xoay: ellipse co theo cos góc, mặt sáng/tối đổi khi lật
        const k = Math.max(0.12, Math.abs(Math.cos(p.q)));
        c.rotate(-p.q);
        c.fillStyle = Math.cos(p.q) > 0 ? '#ffd76a' : '#d99a00';
        c.beginPath(); c.ellipse(0, 0, p.r * k, p.r, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.beginPath(); c.ellipse(-p.r * k * 0.3, -p.r * 0.35, p.r * k * 0.25, p.r * 0.25, 0, 0, 7); c.fill();
      }
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
    this.c2?.clearRect(0, 0, this.w, this.h);
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
export function chayCanh(canh: CanhKetCuc, s: SanKhau, bienThe: BienThe | null = null): () => void {
  const hen: ReturnType<typeof setTimeout>[] = [];
  const anim: Animation[] = [];
  const sau = (ms: number, f: () => void) => hen.push(setTimeout(f, s.giamChuyenDong ? Math.min(ms, 60) : ms));
  const gan = (el: Element | null, kf: Keyframe[], o: KeyframeAnimationOptions) => {
    if (!el || typeof (el as HTMLElement).animate !== 'function') return;
    anim.push((el as HTMLElement).animate(kf, s.giamChuyenDong ? { ...o, duration: 1 } : o));
  };
  const W = s.hat.w, H = s.hat.h;
  const giam = s.giamChuyenDong;

  const rungMan = () => { if (!giam) gan(s.man(), [
    { translate: '0 0' }, { translate: '-4px 2px' }, { translate: '6px -3px' }, { translate: '-6px 3px' },
    { translate: '6px -3px' }, { translate: '-3px 1px' }, { translate: '0 0' }], { duration: 500 }); };

  const xam = (muc: number) => gan(s.ban(), [{ filter: 'none' }, { filter: `grayscale(${muc}) brightness(${1 - muc * 0.35})` }],
    { duration: 900, fill: 'forwards' });

  switch (canh) {
    case 'thang':
    case 'ky-luc': {
      // CHUNG mọi biến thể thắng: gợn sóng toả từ tâm bàn, mỗi lá nảy 1,1
      const ban = s.ban()?.getBoundingClientRect();
      if (ban && !giam) {
        const cx = ban.left + ban.width / 2, cy = ban.top + ban.height / 2;
        for (const el of s.la()) {
          const r = el.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
          gan(el, [{ scale: '1' }, { scale: '1.1' }, { scale: '1' }], { duration: 360, delay: d * 0.9, easing: 'ease-out' });
        }
      }
      if (bienThe === 'phao-hoa-dem') {
        // Sáu quả pháo hoa nổ khắp trời, mỗi quả một bảng màu, rải trong ~2 giây
        const BANG = [['#ff5fa8', '#ffd1ea'], ['#7ad7ff', '#e0f7ff'], ['#ffd76a', '#fff3c4'], ['#8b7dff', '#e3deff'], ['#3ddc97', '#d6ffee'], ['#ff7b4a', '#ffe0d1']];
        ([[0.25, 0.22], [0.72, 0.16], [0.5, 0.3], [0.18, 0.42], [0.82, 0.38], [0.5, 0.12]] as const).forEach(([fx, fy], i) =>
          sau(300 + i * 300, () => {
            // Một quả = vòng ngoài to + vòng trong nhỏ + loé trắng ở tâm: một vòng đơn đọc ra thành "lấp lánh", không phải pháo hoa
            const x = W * fx, y = H * fy, mau = BANG[i]!;
            s.hat.long(x, y, giam ? 15 : 80, mau, 10);
            s.hat.long(x, y, giam ? 6 : 34, [mau[1]!, '#ffffff'], 4.5);
            s.hat.long(x, y, giam ? 2 : 8, ['#ffffff'], 1.5);
            if (i % 2 === 0) s.rung(2);
          }));
        sau(450, () => { rungMan(); s.rung(6); });
      } else if (bienThe === 'vuong-mien') {
        // Vương miện (CSS) cắm xuống chữ ở ~1,0s: rung + bùng sao; rồi mưa đồng xu
        sau(1000, () => { rungMan(); s.rung(6); s.hat.long(W / 2, H * 0.3, giam ? 15 : 50, ['#ffd76a', '#ffffff', '#f0a500'], 7); });
        for (let t = 1100; t < 2600; t += 120) sau(t, () => s.hat.xu(giam ? 1 : 4));
      } else {
        // Pháo giấy: hai ống bắn chéo từ hai góc dưới
        sau(350, () => {
          rungMan(); s.rung(6);
          s.hat.phao(0, H, -Math.PI / 3, giam ? 20 : 70, 15);
          s.hat.phao(W, H, -Math.PI * 2 / 3, giam ? 20 : 70, 15);
        });
      }
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
      if (bienThe === 'tan-tro') {
        // Lá chưa ghép hoá tro (mờ + nhoè, KHÔNG đụng transform); chữ vỡ thành bụi bay theo gió
        chua.forEach((el, i) => sau(300 + i * Math.min(60, 500 / Math.max(1, chua.length)), () =>
          gan(el, [{ opacity: '1', filter: 'none' }, { opacity: '0.12', filter: 'grayscale(1) blur(3px)' }], { duration: 700, fill: 'forwards' })));
        sau(1350, () => {
          s.rung(2);
          document.querySelectorAll<HTMLElement>('.ketcuc-fx .fx-ky').forEach((k, i) => sau(i * 70, () => {
            const r = k.getBoundingClientRect();
            if (r.width) s.hat.tro(...s.hat.diem(r.left, r.top), r.width, r.height, giam ? 6 : 34);
          }));
        });
        break;
      }
      // Đập vỡ màn (mặc định)
      // Tổng so le chốt ở 600ms: 90ms mỗi lá thì bàn 88 thẻ mất 8 giây mới rơi xong
      const buoc = Math.min(90, 600 / Math.max(1, chua.length));
      chua.forEach((el, i) => sau(i * buoc, () => {
        const r = el.getBoundingClientRect();
        gan(el, [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -10px', rotate: `${i % 2 ? 6 : -6}deg`, offset: 0.15 },
          { translate: `0 ${H}px`, rotate: `${i % 2 ? 40 : -40}deg` }], { duration: 900, easing: 'cubic-bezier(.55,0,.9,.4)', fill: 'forwards' });
        if (!giam) s.hat.bui(...s.hat.diem(r.left + r.width / 2, r.bottom), 10);
      }));
      // CÚ ĐẬP: chữ chạm đất → rung màn mạnh + rung máy (vết nứt, sóng là CSS)
      sau(1450, () => {
        s.rung(6);
        if (!giam) gan(s.man(), [
          { translate: '0 0' }, { translate: '-9px 5px' }, { translate: '10px -6px' }, { translate: '-8px 4px' },
          { translate: '7px -3px' }, { translate: '-4px 2px' }, { translate: '0 0' }], { duration: 520 });
      });
      // ĐÁM MÂY ĐỔ MƯA: mưa rơi từ chỗ đám mây đang đứng, tới ~3,7s là tạnh
      for (let t = 1900; t < 3700; t += 70) sau(t, () => {
        const may = document.querySelector('.fx-may-mua')?.getBoundingClientRect();
        if (may && may.width) {
          const [x0, y] = s.hat.diem(may.left + may.width * 0.15, may.bottom - 6);
          s.hat.giot(x0, x0 + may.width * 0.7, y, giam ? 1 : 3);
        }
      });
      break;
    }
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
/** Màu của từng bậc. Tên bậc ở từ điển (`fx.bac.<bậc>`). */
export const MAU_BAC: Record<BacDanhHieu, { a: string; b: string; tia: string }> = {
  dong: { a: '#f3b27a', b: '#b56a33', tia: 'rgba(243,178,122,.28)' },
  bac: { a: '#eef2ff', b: '#9aa6c8', tia: 'rgba(220,228,255,.3)' },
  vang: { a: '#ffd76a', b: '#f0a500', tia: 'rgba(255,215,106,.38)' },
  'bi-mat': { a: '#b9f3ff', b: '#7a7dff', tia: 'rgba(185,243,255,.4)' }
};
