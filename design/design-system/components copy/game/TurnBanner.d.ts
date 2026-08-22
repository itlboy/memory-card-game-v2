export interface TurnBannerProps {
  name: string;
  /** Player avatar emoji; falls back to 🎮. */
  avatar?: string;
  /** Set when the previous player lost their turn to a freeze card. */
  frozenName?: string;
}
export declare function TurnBanner(props: TurnBannerProps): JSX.Element;
