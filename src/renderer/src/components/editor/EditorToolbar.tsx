import { Box, SegmentedControl, IconButton } from '@primer/react';
import { SearchIcon } from '@primer/octicons-react';
import type { Editor } from '@tiptap/react';
import type { Label } from '@shared/note-labels';
import { FormatControls } from '../../editor/FormatControls';
import { Separator } from '../common/Separator';
import { LabelPicker } from '../labels/LabelPicker';
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
  onOpenFindReplace: () => void;
  noteLabels: string[];
  allLabels: Label[];
  onLabelsChange: (labels: string[]) => void;
  onCreateAndAssign: (name: string) => void;
}

interface ToolbarGroupProps {
  label: string;
  children: React.ReactNode;
}

function ToolbarGroup({ label, children }: ToolbarGroupProps): JSX.Element {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >
      {children}
    </Box>
  );
}

/** Single muted toolbar with semantic command groups from left to right. */
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
  onOpenFindReplace,
  noteLabels,
  allLabels,
  onLabelsChange,
  onCreateAndAssign,
}: EditorToolbarProps): JSX.Element {
  return (
    <Box
      role="toolbar"
      aria-label="Editor"
      data-testid="editor-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        rowGap: 1,
        flexWrap: 'wrap',
        px: 3,
        py: 2,
        bg: 'canvas.subtle',
        boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
      }}
    >
      <ToolbarGroup label="Editor view">
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
      </ToolbarGroup>

      <Separator />

      {!viewSource && (
        <Box
          role="group"
          aria-label="Writing tools"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            rowGap: 1,
            flex: '1 1 auto',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <FormatControls editor={editor} />
          <Separator />
          <ToolbarGroup label="Note organization">
            <LabelPicker
              noteLabels={noteLabels}
              allLabels={allLabels}
              onChange={onLabelsChange}
              onCreateAndAssign={onCreateAndAssign}
              iconOnly
            />
          </ToolbarGroup>
        </Box>
      )}

      <Separator />

      <Box
        role="group"
        aria-label="Note utilities"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexShrink: 0 }}
      >
        <IconButton
          icon={SearchIcon}
          aria-label="Find and replace"
          variant="invisible"
          onClick={onOpenFindReplace}
          data-testid="open-find-replace"
        />
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
