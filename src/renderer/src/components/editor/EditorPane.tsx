import { useCallback, useEffect, useState } from 'react';
import { Box, Heading, Text, Spinner, Flash } from '@primer/react';
import type { Note } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { NoteActionsMenu } from './NoteActionsMenu';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { LabelChip } from '../common/LabelChip';
import { relativeTime } from '../../utils/relativeTime';

interface EditorPaneProps {
  noteId: string | undefined;
  labels: Label[];
  onAfterChange: () => void;
  onAfterDelete: () => void;
}

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const loaded = await window.api.getNote(id);
      setNote(loaded);
      setError(undefined);
    } catch (err) {
      setError(describeError(err));
      setNote(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!noteId) {
      setNote(undefined);
      return;
    }
    void load(noteId);
  }, [noteId, load]);

  const colorOf = (name: string): string =>
    labels.find((label) => label.name === name)?.color ?? 'default';

  const handleTogglePin = useCallback(async () => {
    if (!note) return;
    try {
      await window.api.updateNote({ id: note.id, pinned: !note.pinned });
      await load(note.id);
      onAfterChange();
    } catch (err) {
      setError(describeError(err));
    }
  }, [note, load, onAfterChange]);

  const handleConfirmDelete = useCallback(async () => {
    if (!note) return;
    setConfirmDelete(false);
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
        <Box sx={{ minWidth: 0 }}>
          <Heading as="h2" sx={{ fontSize: 3 }} data-testid="editor-title">
            {note.title || 'Untitled'}
          </Heading>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
              Updated {relativeTime(note.updatedAt)}
            </Text>
            {note.labels.map((name) => (
              <LabelChip key={name} name={name} color={colorOf(name)} />
            ))}
          </Box>
        </Box>
        <NoteActionsMenu
          pinned={note.pinned}
          onTogglePin={handleTogglePin}
          onDelete={() => setConfirmDelete(true)}
        />
      </Box>

      {error && (
        <Box sx={{ px: 4, pt: 3 }}>
          <Flash variant="danger">{error}</Flash>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 4 }} data-testid="editor-body">
        <Box
          as="pre"
          sx={{
            m: 0,
            fontFamily: 'mono',
            fontSize: 1,
            color: note.body ? 'fg.default' : 'fg.muted',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {note.body || 'This note is empty. The rich editor arrives in the next step.'}
        </Box>
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
