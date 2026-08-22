export interface ChipProps {
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  /** Narrow variant used in the online lobby's config row. */
  compact?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Chip(props: ChipProps): JSX.Element;
