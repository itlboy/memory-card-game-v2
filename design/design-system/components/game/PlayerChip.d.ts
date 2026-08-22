export interface PlayerChipProps {
  name: string;
  /** Emoji avatar; defaults by seat to 🦊 🐼 🐯 🐸. */
  avatar?: string;
  score?: number;
  /** Seat index, used for the default avatar. */
  index?: number;
  /** Whose turn it is — accent border plus a slow breathing glow. */
  active?: boolean;
  lives?: number | null;
  /** Seconds left in this turn (15s local, 30s online); red and fast-blinking at ≤10. */
  turnLeft?: number | null;
  frozen?: boolean;
  doubleNext?: boolean;
  offline?: boolean;
  /** Floating bonus label, e.g. "+10s". */
  bonus?: string;
  /** Quick-chat emoji bubble above the chip. */
  emoji?: string;
}
export declare function PlayerChip(props: PlayerChipProps): JSX.Element;
