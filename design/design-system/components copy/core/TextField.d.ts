export interface TextFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** 6-digit room code: centred display font, wide tracking, digits only. */
  code?: boolean;
  maxLength?: number;
  style?: React.CSSProperties;
}
export declare function TextField(props: TextFieldProps): JSX.Element;
