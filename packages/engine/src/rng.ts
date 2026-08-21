/**
 * PRNG tất định (mulberry32). Engine KHÔNG dùng Math.random để cùng một `seed`
 * luôn sinh ra cùng một bàn thẻ trên client và trên server (yêu cầu ON-06, ON-09).
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Chuẩn hoá seed về uint32 khác 0
    this.s = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  }

  /** Trạng thái nội bộ — dùng cho snapshot/restore. */
  get state(): number { return this.s; }

  static fromState(state: number): Rng {
    const r = new Rng(1);
    r.s = state >>> 0;
    return r;
  }

  /** Số thực trong [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Số nguyên trong [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Fisher–Yates, trả về mảng mới. */
  shuffle<T>(input: readonly T[]): T[] {
    const a = input.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  /** Lấy `count` phần tử khác nhau. */
  sample<T>(input: readonly T[], count: number): T[] {
    return this.shuffle(input).slice(0, count);
  }
}

/** Sinh seed từ nguồn ngoài (UI/server truyền vào), không gọi trong engine. */
export const seedFrom = (n: number): number => (Math.trunc(n) >>> 0) || 1;
