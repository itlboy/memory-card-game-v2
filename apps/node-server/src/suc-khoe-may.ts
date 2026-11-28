import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { loadavg } from 'node:os';

/**
 * SỨC KHOẺ MÁY cho bảng máy chủ của admin / API quản trị (28.11.2026, chủ dự án: "list các server ra và cho thêm cả
 * cpu/ram/ổ cứng… trên 80% thì warning vàng, trên 95% thì alert đỏ").
 *
 * Số của CẢ MÁY, không phải container: /proc/stat, /proc/meminfo không bị tách theo container (cùng kernel), và statfs('/')
 * của container là ổ overlay nằm trên ổ máy. Riêng `pod` là của tiến trình Node này (RSS so với trần cgroup `mem_limit`).
 * CPU là % trung bình giữa hai lần đo liên tiếp (gọi mỗi nhịp gia hạn 2 s) — lần đầu chưa có thì null.
 */
export interface SucKhoe {
  luc: number;
  /** Tên máy dễ đọc (env MAY_TEN, vd da-2) — không có thì admin hiện địa chỉ nội bộ. */
  ten?: string;
  may: { cpu: number | null; ram: number; ramMB: number; ramTongMB: number; swap: number | null; oDia: number; oDiaTrongMB: number; tai1: number };
  pod: { ramMB: number; tranMB: number | null; ram: number | null; cpu: number | null };
}

const tron = (x: number): number => Math.round(x * 10) / 10;
let cpuTruoc: { tong: number; nhan: number } | null = null;
let podTruoc: { luc: number; dung: NodeJS.CpuUsage } | null = null;

function docStat(): { tong: number; nhan: number } | null {
  try {
    const dong = readFileSync('/proc/stat', 'utf8').split('\n')[0]!.trim().split(/\s+/).slice(1).map(Number);
    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = dong;
    const tong = user + nice + system + idle + iowait + irq + softirq + steal;
    return { tong, nhan: idle + iowait };
  } catch { return null; }
}

function docMem(): Record<string, number> {
  const ra: Record<string, number> = {};
  try {
    for (const d of readFileSync('/proc/meminfo', 'utf8').split('\n')) {
      const m = d.match(/^(\w+):\s+(\d+)/);
      if (m) ra[m[1]!] = Number(m[2]) * 1024;
    }
  } catch { /* không phải Linux */ }
  return ra;
}

function tranCgroup(): number | null {
  for (const f of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const v = readFileSync(f, 'utf8').trim(), n = Number(v);
      if (v !== 'max' && Number.isFinite(n) && n > 0 && n < 2 ** 50) return n;
    } catch { /* không có */ }
  }
  return null;
}

export async function doSucKhoe(now = Date.now()): Promise<SucKhoe> {
  const st = docStat();
  let cpu: number | null = null;
  if (st && cpuTruoc && st.tong > cpuTruoc.tong) cpu = tron(100 * (1 - (st.nhan - cpuTruoc.nhan) / (st.tong - cpuTruoc.tong)));
  if (st) cpuTruoc = st;

  const m = docMem();
  const ramTong = m.MemTotal ?? 0, ramCon = m.MemAvailable ?? m.MemFree ?? 0;
  const swapTong = m.SwapTotal ?? 0, swapCon = m.SwapFree ?? 0;

  let oDia = 0, oDiaTrongMB = 0;
  try {
    const s = await statfs('/');
    const tong = s.blocks * s.bsize, trong = s.bavail * s.bsize;
    oDia = tong ? tron(100 * (1 - trong / tong)) : 0;
    oDiaTrongMB = Math.round(trong / 1048576);
  } catch { /* bỏ */ }

  const rss = process.memoryUsage().rss, tran = tranCgroup();
  const dung = process.cpuUsage();
  let cpuPod: number | null = null;
  if (podTruoc && now > podTruoc.luc) {
    const us = (dung.user - podTruoc.dung.user) + (dung.system - podTruoc.dung.system);
    cpuPod = tron(us / 1000 / (now - podTruoc.luc) * 100);
  }
  podTruoc = { luc: now, dung };

  const ten = (process.env.MAY_TEN ?? '').trim().slice(0, 32);
  return {
    luc: now,
    ...(ten ? { ten } : {}),
    may: {
      cpu, ram: ramTong ? tron(100 * (1 - ramCon / ramTong)) : 0,
      ramMB: Math.round((ramTong - ramCon) / 1048576), ramTongMB: Math.round(ramTong / 1048576),
      swap: swapTong ? tron(100 * (1 - swapCon / swapTong)) : null,
      oDia, oDiaTrongMB, tai1: tron(loadavg()[0] ?? 0)
    },
    pod: { ramMB: Math.round(rss / 1048576), tranMB: tran ? Math.round(tran / 1048576) : null, ram: tran ? tron(100 * rss / tran) : null, cpu: cpuPod }
  };
}

/** Mức cảnh báo của một chỉ số %: ≥ 95 đỏ, ≥ 80 vàng. */
export const mucCanhBao = (pt: number | null | undefined): 'do' | 'vang' | null =>
  pt == null ? null : pt >= 95 ? 'do' : pt >= 80 ? 'vang' : null;
