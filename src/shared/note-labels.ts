/** A label as stored in the index. No Node/Electron imports. */
export interface Label {
  id: number;
  name: string;
  /** Primer color-scheme name (e.g. `default`, `blue`, `green`). */
  color: string;
}

/** Primer-aligned label color choices offered in the UI. */
export const LABEL_COLORS = [
  'default',
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'pink',
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];
