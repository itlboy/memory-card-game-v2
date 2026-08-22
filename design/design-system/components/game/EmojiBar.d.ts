export interface EmojiBarProps {
  /** Defaults to the engine's closed list: 👍 😂 😡 😮 😭 🔥 🎉 🤔 💩 */
  emojis?: string[];
  onSend?: (emoji: string) => void;
}
export declare function EmojiBar(props: EmojiBarProps): JSX.Element;
