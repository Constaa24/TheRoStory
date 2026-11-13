/** Ask before an action that can't be taken back: the desk's one confirmation dialog shows it. */
export type DeskConfirm = (c: {
  title: string;
  description: string;
  confirmLabel: string;
  /** "gold" for a deliberate send; the default is the destructive red. */
  tone?: "gold";
  onConfirm: () => void | Promise<void>;
}) => void;
