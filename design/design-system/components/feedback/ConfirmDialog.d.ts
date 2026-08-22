export interface ConfirmDialogProps {
  /** A question, e.g. "Thoát ván đang chơi?" */
  title: string;
  /** The consequence in one sentence. */
  body: string;
  /** The destructive verb, e.g. "Thoát ván", "Huỷ phòng". */
  confirmLabel: string;
  /** Defaults to "Ở lại". */
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}
export declare function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;
