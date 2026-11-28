/**
 * Chọn pod giữ phòng mới: CÂN THEO MÁY trước (mỗi máy 1 vCPU — da-2 hai pod mà chia theo pod thì máy đó gánh 2/3), rồi pod ít
 * phòng nhất trên máy đó; hoà thì bốc ngẫu nhiên. Máy = host trong địa chỉ nội bộ của pod. Máy vừa bật lại (0 phòng) tự nhận
 * phòng mới tới khi cân — phòng đang chơi thì KHÔNG dời (dời là người chơi phải nối lại).
 */
export function chonPod<T extends { pod: string; diaChi: string; phong: number }>(ds: T[]): T | undefined {
  if (!ds.length) return undefined;
  const may = new Map<string, T[]>();
  for (const p of ds) {
    let host = p.diaChi;
    try { host = new URL(p.diaChi).hostname; } catch { /* để nguyên */ }
    may.set(host, [...(may.get(host) ?? []), p]);
  }
  const tong = (xs: T[]): number => xs.reduce((n, x) => n + x.phong, 0);
  const itNhat = <U>(xs: U[], f: (x: U) => number): U => {
    const min = Math.min(...xs.map(f));
    const cung = xs.filter((x) => f(x) === min);
    return cung[Math.floor(Math.random() * cung.length)]!;
  };
  return itNhat(itNhat([...may.values()], tong), (p) => p.phong);
}
