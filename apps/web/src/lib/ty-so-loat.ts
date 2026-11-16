/**
 * TỶ SỐ CẢ LOẠT trên chip người chơi (mockup duyệt 16.11.2026,
 * https://claude.ai/artifact/SsTtKopBziDpsoV6huAMfJ).
 *
 * - LUÔN hiện khi có từ 2 người, kể cả ván đầu (0–0) — như tỷ số bóng đá.
 * - Người đang DẪN (nhiều ván thắng nhất, > 0) có `dan` → viên xanh lá. Cả bàn bằng nhau
 *   (0–0, 1–1…) thì không ai dẫn. Không tô đỏ người thua: đỏ hút mắt hơn xanh và trùng nghĩa
 *   với "mạng yếu"/mất mạng (chủ dự án thử rồi bỏ).
 * - Khoá theo TÊN (như `seriesWins`), vì id đổi khi vào lại phòng.
 */
export function tySoLoat(
  players: readonly { name: string }[],
  wins: Readonly<Record<string, number>> | undefined
): Record<string, { n: number; dan: boolean }> | null {
  if (players.length < 2) return null;
  const so = players.map((p) => wins?.[p.name] ?? 0);
  const max = Math.max(...so);
  const bangNhau = so.every((n) => n === max);
  return Object.fromEntries(players.map((p, i) => [p.name, { n: so[i]!, dan: !bangNhau && so[i] === max }]));
}
