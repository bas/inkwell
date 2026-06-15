import { ActionMenu, ActionList, IconButton } from '@primer/react';
import {
  KebabHorizontalIcon,
  PinIcon,
  TrashIcon,
  CopyIcon,
  CopilotIcon,
  CommentDiscussionIcon,
} from '@primer/octicons-react';

interface NoteActionsMenuProps {
  pinned: boolean;
  onSummarize: () => void;
  onReview: () => void;
  onTogglePin: () => void;
  onCopyMarkdown: () => void;
  onDelete: () => void;
}

/** Overflow menu of actions for the currently open note. */
export function NoteActionsMenu({
  pinned,
  onSummarize,
  onReview,
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
          <ActionList.Item onSelect={onSummarize} data-testid="action-summarize">
            <ActionList.LeadingVisual>
              <CopilotIcon />
            </ActionList.LeadingVisual>
            Summarize with Copilot
          </ActionList.Item>
          <ActionList.Item onSelect={onReview} data-testid="action-review">
            <ActionList.LeadingVisual>
              <CommentDiscussionIcon />
            </ActionList.LeadingVisual>
            Review with Copilot
          </ActionList.Item>
          <ActionList.Divider />
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
