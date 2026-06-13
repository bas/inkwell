import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, Spinner, Flash, TextInput, SegmentedControl } from '@primer/react';
import type { Note } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { NoteActionsMenu } from './NoteActionsMenu';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { LabelChip } from '../common/LabelChip';
import { relativeTime } from '../../utils/relativeTime';
import { MarkdownEditor } from '../../editor/MarkdownEditor';
import { SourceEditor } from '../../editor/SourceEditor';

interface EditorPaneProps {
  noteId: string | undefined;
  labels: Label[];
  onAfterChange: () => void;
  onAfterDelete: () => void;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 700;

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Could not open note';
}

export function EditorPane({
  noteId,
  labels,
  onAfterChange,
  onAfterDelete,
}: EditorPaneProps): JSX.Element {
  const [note, setNote] = useState<Note | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [viewSource, setViewSource] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Latest editable data, read by the debounced/flush save without re-binding.
  const dataRef = useRef({ id: '', title: '', markdown: '' });
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    const { id, title: t, markdown: body } = dataRef.current;
    if (!id) return;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      await window.api.updateNote({ id, title: t.trim() || 'Untitled', body });
      setSaveState('saved');
      onAfterChange();
    } catch (err) {
      dirtyRef.current = true;
      setError(describeError(err));
      setSaveState('error');
    }
  }, [onAfterChange]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }, [save]);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dirtyRef.current) void save();
  }, [save]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const loaded = await window.api.getNote(id);
      setNote(loaded);
      setTitle(loaded.title);
      setMarkdown(loaded.body);
      dataRef.current = { id: loaded.id, title: loaded.title, markdown: loaded.body };
      dirtyRef.current = false;
      setSaveState('idle');
      setError(undefined);
    } catch (err) {
      setError(describeError(err));
      setNote(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on selection change; flush pending edits for the previous note first.
  useEffect(() => {
    flush();
    setViewSource(false);
    if (!noteId) {
      setNote(undefined);
      return;
    }
    void load(noteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Flush on unmount.
  useEffect(() => () => flush(), [flush]);

  const colorOf = (name: string): string =>
    labels.find((label) => label.name === name)?.color ?? 'default';

  const handleTitleChange = (value: string): void => {
    setTitle(value);
    dataRef.current = { ...dataRef.current, title: value };
    scheduleSave();
  };

  const handleBodyChange = (value: string): void => {
    setMarkdown(value);
    dataRef.current = { ...dataRef.current, markdown: value };
    scheduleSave();
  };

  const handleTogglePin = useCallback(async () => {
    if (!note) return;
    try {
      await window.api.updateNote({ id: note.id, pinned: !note.pinned });
      setNote({ ...note, pinned: !note.pinned });
      onAfterChange();
    } catch (err) {
      setError(describeError(err));
    }
  }, [note, onAfterChange]);

  const handleCopyMarkdown = useCallback(async () => {
    const { title: t, markdown: body } = dataRef.current;
    const heading = t.trim() ? `# ${t.trim()}\n\n` : '';
    try {
      await window.api.writeClipboard(`${heading}${body}`.trimEnd() + '\n');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!note) return;
    setConfirmDelete(false);
    dirtyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await window.api.deleteNote(note.id);
      onAfterDelete();
    } catch (err) {
      setError(describeError(err));
    }
  }, [note, onAfterDelete]);

  if (!noteId) {
    return (
      <Box
        sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        data-testid="editor-empty"
      >
        <Text sx={{ color: 'fg.muted' }}>Select or create a note to start writing.</Text>
      </Box>
    );
  }

  if (loading && !note) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </Box>
    );
  }

  if (error && !note) {
    return (
      <Box sx={{ p: 4 }}>
        <Flash variant="danger" data-testid="editor-error">
          {error}
        </Flash>
      </Box>
    );
  }

  if (!note) return <Box />;

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Unsaved changes'
        : saveState === 'saved'
          ? 'Saved'
          : saveState === 'error'
            ? 'Save failed'
            : `Updated ${relativeTime(note.updatedAt)}`;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        as="header"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: 4,
          py: 3,
          borderBottom: '1px solid',
          borderColor: 'border.default',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <TextInput
            aria-label="Note title"
            data-testid="editor-title"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            sx={{
              width: '100%',
              border: 'none',
              boxShadow: 'none',
              px: 0,
              '& input': { fontSize: 4, fontWeight: 'bold', px: 0 },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="save-state">
              {copied ? 'Copied to clipboard' : saveLabel}
            </Text>
            {note.labels.map((name) => (
              <LabelChip key={name} name={name} color={colorOf(name)} />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <SegmentedControl aria-label="Editor view" size="small">
            <SegmentedControl.Button
              selected={!viewSource}
              onClick={() => {
                flush();
                setViewSource(false);
              }}
              data-testid="view-wysiwyg"
            >
              Editor
            </SegmentedControl.Button>
            <SegmentedControl.Button
              selected={viewSource}
              onClick={() => setViewSource(true)}
              data-testid="view-source"
            >
              Markdown
            </SegmentedControl.Button>
          </SegmentedControl>
          <NoteActionsMenu
            pinned={note.pinned}
            onTogglePin={handleTogglePin}
            onCopyMarkdown={() => void handleCopyMarkdown()}
            onDelete={() => setConfirmDelete(true)}
          />
        </Box>
      </Box>

      {error && (
        <Box sx={{ px: 4, pt: 3 }}>
          <Flash variant="danger">{error}</Flash>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0 }} data-testid="editor-body">
        {viewSource ? (
          <Box sx={{ height: '100%', p: 4 }}>
            <SourceEditor value={markdown} onChange={handleBodyChange} />
          </Box>
        ) : (
          <MarkdownEditor key={note.id} initialMarkdown={markdown} onChange={handleBodyChange} />
        )}
      </Box>

      <DeleteNoteDialog
        open={confirmDelete}
        title={note.title || 'Untitled'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
