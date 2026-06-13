import { ActionMenu, ActionList, IconButton } from '@primer/react';
import { KebabHorizontalIcon, PinIcon, TrashIcon } from '@primer/octicons-react';

interface NoteActionsMenuProps {
  pinned: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
}

/** Overflow menu of actions for the currently open note. */
export function NoteActionsMenu({
  pinned,
  onTogglePin,
  onDelete,
}: NoteActionsMenuProps): JSX.Element {
  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <IconButton
          icon={KebabHorizontalIcon}
          aria-label="Note actions"
          data-testid="note-actions"
          variant="invisible"
        />
      </ActionMenu.Anchor>
      <ActionMenu.Overlay width="small">
        <ActionList>
          <ActionList.Item onSelect={onTogglePin} data-testid="action-toggle-pin">
            <ActionList.LeadingVisual>
              <PinIcon />
            </ActionList.LeadingVisual>
            {pinned ? 'Unpin note' : 'Pin note'}
          </ActionList.Item>
          <ActionList.Divider />
          <ActionList.Item variant="danger" onSelect={onDelete} data-testid="action-delete">
            <ActionList.LeadingVisual>
              <TrashIcon />
            </ActionList.LeadingVisual>
            Delete note
          </ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}
