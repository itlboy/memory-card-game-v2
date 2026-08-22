/**
 * @startingPoint section="Core" subtitle="Primary, default, danger and link buttons" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = full-width gradient CTA; default = 44px glass button; danger = solid red; link = quiet text row. */
  variant?: 'default' | 'primary' | 'danger' | 'link';
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
