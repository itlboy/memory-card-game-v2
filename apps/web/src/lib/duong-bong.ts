/**
 * ĐƯỜNG VIỀN BONG BÓNG — thân + đuôi là MỘT đường khép kín (18.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/BMLcfF8DAuxhuxZ8QjPr65, kiểu B "đuôi cong truyện tranh").
 *
 * Vì sao không dùng border CSS + đuôi riêng: hai hình ghép thì chỗ dán LUÔN lộ mối nối (ô vuông
 * xoay → con thoi; hai tam giác clip-path → viền đuôi mỏng hơn thân; SVG dán vào → gợn ở chỗ
 * nối). Nay cả bong bóng là một <path> có stroke: không có chỗ nối nào để lộ. Chỗ đuôi mọc khỏi
 * thân là đường cong tiếp tuyến với cạnh (không góc gãy).
 *
 * Test `duong-bong.test.ts` giữ luật: đúng MỘT lệnh `M`, kết thúc `Z`.
 */
export type CanhDuoi = 'duoi' | 'tren' | 'trai';

/** Kiểu B: rộng chân đuôi, dài đuôi, đoạn uốn mềm mỗi bên chân. */
export const DUOI = { rong: 16, dai: 12, bo: 5 } as const;

/**
 * `w`,`h`: khung bong bóng (border-box). `day`: độ dày viền. `r`: bo góc mong muốn.
 * `canh`: cạnh mọc đuôi (không có = bong bóng không đuôi). `vt`: tâm chân đuôi tính từ đầu cạnh
 * (trái với duoi/tren, trên với trai); thiếu thì `duoi` = 24px, còn lại = giữa cạnh.
 * Đuôi vẽ RA NGOÀI khung — SVG phải `overflow: visible`.
 */
export function duongBong(w: number, h: number, day: number, r: number, canh?: CanhDuoi, vt?: number): string {
  const s = day / 2;                       // nét vẽ nằm giữa đường: lùi vào nửa nét để viền nằm trọn trong khung
  const X = s, Y = s, W = Math.max(w - day, 1), H = Math.max(h - day, 1);
  const { rong: b, dai: L, bo: f } = DUOI;
  const canhDai = canh === 'trai' ? H : W;
  // Bong bóng nhỏ: bo ít lại để chân đuôi (kể cả phần uốn) đứng trọn trên đoạn THẲNG của cạnh
  let R = Math.min(r, W / 2, H / 2);
  if (canh) R = Math.max(4, Math.min(R, (canhDai - b - 2 * f) / 2));
  let v0 = (vt ?? (canh === 'duoi' ? 24 : (canh === 'trai' ? h : w) / 2)) - s;
  v0 = Math.min(Math.max(v0, R + b / 2 + f), canhDai - R - b / 2 - f);

  const n = (x: number) => +x.toFixed(2);
  const ra = (u: number, v: number): string => {
    const [x, y] = canh === 'duoi' ? [X + v0 + u, Y + H + v] : canh === 'tren' ? [X + v0 - u, Y - v] : [X - v, Y + v0 + u];
    return `${n(x)} ${n(y)}`;
  };
  // Đuôi đi từ u = +(b/2+f) về u = −(b/2+f); mũi lệch về phía −u như lời thoại truyện tranh
  const duoi = (): string =>
    ` L${ra(b / 2 + f, 0)}`
    + ` C${ra(b * 0.4, 0)} ${ra(b * 0.05, L * 0.55)} ${ra(-b * 0.45, L)}`
    + ` C${ra(-b * 0.3, L * 0.5)} ${ra(-b * 0.45, 0)} ${ra(-b / 2 - f, 0)}`;
  const a = (x: number, y: number) => ` A${n(R)} ${n(R)} 0 0 1 ${n(x)} ${n(y)}`;

  let p = `M${n(X + R)} ${n(Y)}`;
  if (canh === 'tren') p += duoi();
  p += ` L${n(X + W - R)} ${n(Y)}` + a(X + W, Y + R) + ` L${n(X + W)} ${n(Y + H - R)}` + a(X + W - R, Y + H);
  if (canh === 'duoi') p += duoi();
  p += ` L${n(X + R)} ${n(Y + H)}` + a(X, Y + H - R);
  if (canh === 'trai') p += duoi();
  p += ` L${n(X)} ${n(Y + R)}` + a(X + R, Y) + ' Z';
  return p;
}
