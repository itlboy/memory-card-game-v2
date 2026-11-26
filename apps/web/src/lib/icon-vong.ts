import type { Component } from 'vue';
import {
  Bug, Check, Crown, Eye, Flame, Hand, HeartCrack, Hourglass, LogOut, Medal, PartyPopper, RotateCcw, RotateCw, SlidersHorizontal,
  Target, TimerOff, TriangleAlert, Trophy, Wifi, WifiOff, BellRing, MailPlus, X, Zap
} from 'lucide-vue-next';

/**
 * ICON VÒNG MÀU DÙNG CHUNG (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 4 —
 * chủ dự án: emoji hệ thống 📡 📴 🚪 ⚠️ 🔔 là "icon kiểu cũ, rất xấu"). Icon Lucide nét trắng trong vòng tròn
 * MÀU THEO NGHĨA: xanh = tốt · do = mạng/lỗi · vang = cần làm · xam = rời đi · tim = gợi ý.
 * LUẬT: KHÔNG dùng emoji hệ thống làm icon giao diện (dải báo, nút, trạng thái). Emoji chỉ còn ở chỗ là
 * NỘI DUNG: mặt người chơi, hình lá bài, chat nhanh, huy hiệu danh hiệu, ô trang chủ (ảnh Noto 3D).
 */
export type MauVong = 'xanh' | 'do' | 'vang' | 'xam' | 'tim';
export const ICON_VONG = {
  matMang: { c: WifiOff, mau: 'do' },
  vaoLai: { c: Wifi, mau: 'xanh' },
  roi: { c: LogOut, mau: 'xam' },
  chuPhong: { c: Crown, mau: 'vang' },
  duNguoi: { c: PartyPopper, mau: 'xanh' },
  nhac: { c: BellRing, mau: 'vang' },
  doiBan: { c: SlidersHorizontal, mau: 'vang' },
  sanSang: { c: Hand, mau: 'xanh' },
  choiLai: { c: RotateCw, mau: 'xanh' },
  canhBao: { c: TriangleAlert, mau: 'vang' },
  hetMang: { c: HeartCrack, mau: 'do' },
  cho: { c: Hourglass, mau: 'vang' },
  choXam: { c: Hourglass, mau: 'xam' },
  danhHieu: { c: Medal, mau: 'vang' },
  goiY: { c: Target, mau: 'tim' },
  xepHang: { c: Trophy, mau: 'vang' },
  lua: { c: Flame, mau: 'do' },
  debug: { c: Bug, mau: 'xam' },
  loiMoi: { c: MailPlus, mau: 'tim' },
  // Tìm Thẻ (26.11.2026): các nhịp của một lượt
  ghiNho: { c: Eye, mau: 'tim' },
  upBai: { c: RotateCcw, mau: 'xam' },
  dungRoi: { c: Check, mau: 'xanh' },
  saiRoi: { c: X, mau: 'do' },
  hetGio: { c: TimerOff, mau: 'xam' },
  nhanhNhat: { c: Zap, mau: 'vang' }
} satisfies Record<string, { c: Component; mau: MauVong }>;
export type TenIcon = keyof typeof ICON_VONG;
