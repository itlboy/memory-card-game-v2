export interface GridPreviewProps {
  cols: number;
  rows: number;
  /** Inside a selected tile the cells turn white. */
  selected?: boolean;
}
export declare function GridPreview(props: GridPreviewProps): JSX.Element;
