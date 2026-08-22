export interface IconProps {
  /** kebab-case Lucide icon name, e.g. "brain", "chevron-left", "volume-2". */
  name: string;
  /** Pixel box; the app uses 12–40 depending on context. */
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
