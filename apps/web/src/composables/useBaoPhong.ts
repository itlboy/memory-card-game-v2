import { onScopeDispose, watch } from 'vue';
import type { RoomInfo } from '@mm/engine';
import { baoNoi, boBao, donBao } from '@/lib/dai-bao';
import { t } from '@/lib/i18n';
import type { useOnlineRoom } from './useOnlineRoom';

/**
 * Nghe phòng đổi → đẩy tin lên DẢI BÁO CHUNG (lib/dai-bao.ts). Mọi câu về NGƯỜI trong phòng sinh ở đây,
 * từ chênh lệch giữa hai bản `room` liên tiếp — không thêm tin riêng nào trên dây (trừ `nhac`), nên server
 * cũ vẫn chạy. Chữ thống nhất một cách nói ("đã rời phòng", không còn "Đã thoát"/"đã rời"/"Người chơi kia…").
 * Gọi MỘT lần trong OnlineScreen.
 */
export function useBaoPhong(o: ReturnType<typeof useOnlineRoom>): void {
  const tenCua = (r: RoomInfo, id: string): string => r.players.find((p) => p.id === id)?.name ?? '';

  watch(() => o.room.value, (moi, cu) => {
    if (!moi || !cu || moi.code !== cu.code) return;
    const toi = o.myId.value;
    const cuTheoId = new Map(cu.players.map((p) => [p.id, p]));
    const moiIds = new Set(moi.players.map((p) => p.id));

    for (const p of moi.players) {
      if (p.id === toi) continue;
      const truoc = cuTheoId.get(p.id);
      if (!truoc) {
        if (!p.may) baoNoi({ loai: 'tot', mat: p.avatar, anh: p.anh, chu: t('bao.vao', { ten: p.name }) });
        continue;
      }
      // Mất / có lại kết nối (người thật) — tin mạng ĐỨNG YÊN tới khi họ vào lại
      if (!p.may && truoc.connected && !p.connected) {
        baoNoi({ loai: 'mang', ic: '📡', chu: t('bao.matKetNoi', { ten: p.name }), khoa: `mang:${p.id}`, giu: true });
      } else if (!p.may && !truoc.connected && p.connected) {
        boBao(`mang:${p.id}`);
        baoNoi({ loai: 'tot', ic: '🔌', chu: t('bao.vaoLai', { ten: p.name }) });
      }
      if (moi.status === 'lobby' && !truoc.ready && p.ready && !p.may) {
        baoNoi({ loai: 'tot', ic: 'sanSang', chu: t('bao.sanSang', { ten: p.name }) });
      }
    }

    for (const p of cu.players) {
      if (p.id === toi || moiIds.has(p.id)) continue;
      boBao(`mang:${p.id}`);
      if (!p.may) baoNoi({ loai: 'roi', ic: '🚪', chu: t('bao.roiPhong', { ten: p.name }) });
    }

    if (moi.hostId && cu.hostId && moi.hostId !== cu.hostId && !moiIds.has(cu.hostId)) {
      baoNoi({ loai: 'roi', ic: '👑', chu: moi.hostId === toi ? t('bao.banLamChu') : t('bao.lamChu', { ten: tenCua(moi, moi.hostId) }) });
    }

    // Chủ phòng: vừa đủ người sẵn sàng
    if (moi.status === 'lobby' && moi.hostId === toi) {
      const khac = (r: RoomInfo) => r.players.filter((p) => p.id !== r.hostId && p.connected);
      const du = (r: RoomInfo) => khac(r).length >= 1 && khac(r).every((p) => p.ready);
      if (du(moi) && !du(cu)) baoNoi({ loai: 'tot', ic: '🎉', chu: t('bao.duNguoi') });
    }

    // Muốn chơi lại (màn cuối)
    const phieuCu = new Set(cu.againVotes ?? []);
    for (const id of moi.againVotes ?? []) {
      if (id === toi || phieuCu.has(id)) continue;
      const ten = tenCua(moi, id);
      if (ten) baoNoi({ loai: 'tot', ic: 'choiLai', chu: t('bao.choiLai', { ten }) });
    }

    // Người xem mới (so theo tên + mặt; người xem là CHÍNH MÌNH thì không tự báo)
    const xemCu = new Set((cu.xem ?? []).map((x) => `${x.ten}|${x.mat}`));
    for (const x of moi.xem ?? []) {
      if (xemCu.has(`${x.ten}|${x.mat}`)) continue;
      if (o.spectator.value && x.ten === o.tenCuaToi()) continue;
      baoNoi({ loai: 'xem', mat: x.mat, anh: x.anh, chu: t('bao.dangXem', { ten: x.ten }) });
    }
  });

  // Chủ phòng nhắc mình
  watch(() => o.nhacTu.value?.so, () => {
    const n = o.nhacTu.value;
    if (!n) return;
    baoNoi({ loai: 'can', ic: '🔔', chu: t('bao.nhac', { ten: n.ten }), khoa: 'nhac' });
    try { navigator.vibrate?.([120, 80, 120]); } catch { /* máy không rung được */ }
  });

  // Ra khỏi phòng: dọn sạch dải
  watch(() => o.phase.value, (p) => { if (p === 'idle') donBao(); });
  onScopeDispose(donBao);
}
