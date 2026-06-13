import { Label } from '@primer/react';
import { toLabelVariant } from '../../utils/labelColor';

interface LabelChipProps {
  name: string;
  color?: string;
}

/** Renders a label name as a Primer `Label` using a token-based color variant. */
export function LabelChip({ name, color = 'default' }: LabelChipProps): JSX.Element {
  return (
    <Label variant={toLabelVariant(color)} data-testid={`label-chip-${name}`}>
      {name}
    </Label>
  );
}
