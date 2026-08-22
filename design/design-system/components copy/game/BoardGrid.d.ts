export interface BoardCard {
  symbol?: string;
  faceUp?: boolean;
  matched?: boolean;
  wrong?: boolean;
  power?: 'bomb' | 'x2' | 'eye' | 'freeze';
  blank?: boolean;
}
/**
 * @startingPoint section="Game" subtitle="Card board, any grid from 2×2 to 8×8" viewport="700x400"
 */
export interface BoardGridProps {
  cards: BoardCard[];
  cols: number;
  back?: 'stars' | 'diamond' | 'aurora';
  /** Not this player's turn / animation in flight. */
  locked?: boolean;
  onFlip?: (index: number) => void;
  style?: React.CSSProperties;
}
export declare function BoardGrid(props: BoardGridProps): JSX.Element;
