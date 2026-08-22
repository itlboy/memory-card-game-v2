export interface CardTileProps {
  /** Emoji (or letter/number) on the face — from data/themes.json. */
  symbol?: string;
  /** Board-wide back art; every card in one game MUST use the same value. */
  back?: 'stars' | 'diamond' | 'aurora';
  faceUp?: boolean;
  matched?: boolean;
  /** Wrong-pair shake. */
  wrong?: boolean;
  /** Special-card badge, shown until it is used. */
  power?: 'bomb' | 'x2' | 'eye' | 'freeze';
  /** Centre hole of an odd grid (3×3, 5×5). */
  blank?: boolean;
  /** Index in the deal animation stagger (28ms per card). */
  dealOrder?: number;
  disabled?: boolean;
  onFlip?: () => void;
  style?: React.CSSProperties;
}
export declare function CardTile(props: CardTileProps): JSX.Element;
