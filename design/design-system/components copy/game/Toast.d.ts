export interface ToastProps {
  /** info = accent tint, peek = amber, alert = red, soft = accent-soft. */
  tone?: 'info' | 'peek' | 'alert' | 'soft';
  children?: React.ReactNode;
}
export declare function Toast(props: ToastProps): JSX.Element;
