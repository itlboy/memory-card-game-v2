export interface HudBarProps {
  score?: number;
  moves?: number;
  matched?: number;
  totalPairs?: number;
  /** 1 | 1.2 | 1.5 | 2 — amber at 1.5, gold with glow at 2. */
  combo?: number;
  elapsed?: number;
  /** Countdown modes only; blinks red at ≤10s. */
  timeLeft?: number | null;
  movesLeft?: number | null;
  lives?: number | null;
  /** Campaign level number. */
  levelId?: number;
  /** Hides score/moves/combo — those live in the player chips instead. */
  multiplayer?: boolean;
  onQuit?: () => void;
}
export declare function HudBar(props: HudBarProps): JSX.Element;
