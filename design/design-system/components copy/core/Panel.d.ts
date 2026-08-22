/**
 * @startingPoint section="Core" subtitle="Glass surface every screen sits on" viewport="700x320"
 */
export interface PanelProps {
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Panel(props: PanelProps): JSX.Element;
