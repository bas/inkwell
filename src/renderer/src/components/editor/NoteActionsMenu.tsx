import { ActionMenu, ActionList, IconButton } from '@primer/react';
import { KebabHorizontalIcon, PinIcon, TrashIcon, CopyIcon } from '@primer/octicons-react';

interface NoteActionsMenuProps {
  pinned: boolean;
  onTogglePin: () => void;
  onCopyMarkdown: () => void;
  onDelete: () => void;
}

/** Overflow menu of actions for the currently open note. */
export function NoteActionsMenu({
  pinned,
  onTogglePin,
  onCopyMarkdown,
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
          <ActionList.Item onSelect={onCopyMarkdown} data-testid="action-copy-markdown">
            <ActionList.LeadingVisual>
              <CopyIcon />
            </ActionList.LeadingVisual>
            Copy as Markdown
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
