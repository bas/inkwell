import { Box, SegmentedControl } from '@primer/react';
import type { Editor } from '@tiptap/react';
import { FormatControls } from '../../editor/FormatControls';
import { Separator } from '../common/Separator';
import { NoteActionsMenu } from './NoteActionsMenu';

interface EditorToolbarProps {
  editor: Editor | null;
  viewSource: boolean;
  onSelectEditor: () => void;
  onSelectSource: () => void;
  pinned: boolean;
  onSummarize: () => void;
  onReview: () => void;
  onTogglePin: () => void;
  onCopyMarkdown: () => void;
  onDelete: () => void;
}

/**
 * Single muted toolbar combining the Editor/Markdown view tabs (left),
 * formatting controls (centre, WYSIWYG only), and the note actions menu (right).
 */
export function EditorToolbar({
  editor,
  viewSource,
  onSelectEditor,
  onSelectSource,
  pinned,
  onSummarize,
  onReview,
  onTogglePin,
  onCopyMarkdown,
  onDelete,
}: EditorToolbarProps): JSX.Element {
  return (
    <Box
      role="toolbar"
      aria-label="Editor"
      data-testid="editor-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        px: 3,
        py: 2,
        bg: 'canvas.subtle',
        boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
      }}
    >
      <SegmentedControl aria-label="Editor view" size="small">
        <SegmentedControl.Button
          selected={!viewSource}
          onClick={onSelectEditor}
          data-testid="view-wysiwyg"
        >
          Editor
        </SegmentedControl.Button>
        <SegmentedControl.Button
          selected={viewSource}
          onClick={onSelectSource}
          data-testid="view-source"
        >
          Source
        </SegmentedControl.Button>
      </SegmentedControl>

      {!viewSource && (
        <>
          <Separator />
          <FormatControls editor={editor} />
        </>
      )}

      <Box sx={{ ml: 'auto' }}>
        <NoteActionsMenu
          pinned={pinned}
          onSummarize={onSummarize}
          onReview={onReview}
          onTogglePin={onTogglePin}
          onCopyMarkdown={onCopyMarkdown}
          onDelete={onDelete}
        />
      </Box>
    </Box>
  );
}
