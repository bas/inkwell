import type { LabelProps } from '@primer/react';

/** Map an Inkwell label color name to a Primer `Label` variant (token-based). */
export function toLabelVariant(color: string): LabelProps['variant'] {
  switch (color) {
    case 'blue':
      return 'accent';
    case 'green':
      return 'success';
    case 'yellow':
      return 'attention';
    case 'orange':
      return 'severe';
    case 'red':
      return 'danger';
    case 'purple':
      return 'done';
    case 'pink':
      return 'sponsors';
    default:
      return 'secondary';
  }
}
