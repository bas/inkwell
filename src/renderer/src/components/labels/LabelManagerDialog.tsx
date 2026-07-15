import { Dialog } from '@primer/react';
import type { Label } from '@shared/note-labels';
import { LabelManagerPanel } from './LabelManagerPanel';

interface LabelManagerDialogProps {
  labels: Label[];
  onClose: () => void;
  onChanged: () => void;
}

export function LabelManagerDialog({
  labels,
  onClose,
  onChanged,
}: LabelManagerDialogProps): JSX.Element {
  return (
    <Dialog title="Manage labels" onClose={onClose}>
      <LabelManagerPanel labels={labels} onChanged={onChanged} />
    </Dialog>
  );
}
