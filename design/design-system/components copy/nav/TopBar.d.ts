/**
 * @startingPoint section="Core" subtitle="App header with brand, score and toggles" viewport="700x120"
 */
export interface TopBarProps {
  /** Lifetime accumulated score, shown as "⭐ 1200". */
  totalScore?: number;
  dark?: boolean;
  sound?: boolean;
  onHome?: () => void;
  onToggleDark?: () => void;
  onToggleSound?: () => void;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
