export interface CampaignNodeProps {
  /** Level number, 1–20. */
  id: number;
  cols: number;
  rows: number;
  /** 0–3; a cleared level (>0) gets an emerald border. */
  stars?: number;
  locked?: boolean;
  onPlay?: () => void;
}
export declare function CampaignNode(props: CampaignNodeProps): JSX.Element;
