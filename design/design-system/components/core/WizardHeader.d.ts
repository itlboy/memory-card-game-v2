export interface WizardHeaderProps {
  /** The step's question, e.g. "Chọn chế độ". */
  title: string;
  onBack?: () => void;
  steps?: number;
  current?: number;
  /** Right-hand slot — the lobby puts the copy-code button here. */
  trailing?: React.ReactNode;
}
export declare function WizardHeader(props: WizardHeaderProps): JSX.Element;
