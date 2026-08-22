/**
 * @startingPoint section="Core" subtitle="Arcade-neon wizard choice tile" viewport="700x260"
 */
export interface OptionTileProps {
  /** Identity gradient class; omit for configuration tiles (grid size, theme). */
  tone?: 'g-violet' | 'g-pink' | 'g-cyan' | 'g-blue' | 'g-amber' | 'g-red' | 'g-teal';
  selected?: boolean;
  /** stack = square tile, wide = icon + text row. */
  layout?: 'stack' | 'wide';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Big display numeral (player-count step). */
  numeral?: number | string;
  disabled?: boolean;
  /** checkbox for multi-select steps (themes), button for single-select. */
  role?: 'button' | 'checkbox';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function OptionTile(props: OptionTileProps): JSX.Element;
