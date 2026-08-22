export interface ResultStat { label: string; value: string | number }
export interface ResultRank { name: string; score: number; pairs: number; bestStreak: number }
export interface ResultAchievement { name: string; hint: string }
/**
 * @startingPoint section="Game" subtitle="End-of-game result dialog" viewport="700x420"
 */
export interface ResultDialogProps {
  /** e.g. "Kỷ lục mới! 🏆" · "Hoàn thành! 🎉" · "Chưa xong 😢" */
  title: string;
  /** One-line cause, e.g. "Bạn đã mở hết các cặp!" */
  reason?: string;
  /** Campaign only: 0–3 stars. */
  stars?: number | null;
  /** How many stars have appeared so far (they light one by one, 350ms apart). */
  starsShown?: number;
  stats?: ResultStat[];
  /** Multiplayer: replaces the stat list. */
  ranking?: ResultRank[] | null;
  achievements?: ResultAchievement[];
  primaryLabel?: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTertiary?: () => void;
}
export declare function ResultDialog(props: ResultDialogProps): JSX.Element;
