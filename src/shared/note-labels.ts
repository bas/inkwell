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

const LABEL_COLOR_SET = new Set<string>(LABEL_COLORS);

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && LABEL_COLOR_SET.has(value);
}

export function normalizeLabelName(value: string): string {
  const name = value.trim();
  if (name.length === 0) throw new Error('Label name cannot be empty');
  return name;
}
