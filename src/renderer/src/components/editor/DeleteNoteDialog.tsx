import { ConfirmationDialog } from '@primer/react';

interface DeleteNoteDialogProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteNoteDialog({
  open,
  title,
  onCancel,
  onConfirm,
}: DeleteNoteDialogProps): JSX.Element | null {
  if (!open) return null;
  return (
    <ConfirmationDialog
      title="Delete note?"
      onClose={(gesture) => (gesture === 'confirm' ? onConfirm() : onCancel())}
      confirmButtonContent="Delete"
      confirmButtonType="danger"
      data-testid="delete-note-dialog"
    >
      {`“${title}” will be permanently deleted. This cannot be undone.`}
    </ConfirmationDialog>
  );
}
