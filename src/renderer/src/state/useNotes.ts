import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';

export interface NotesState {
  summaries: NoteSummary[];
  labels: Label[];
  selectedId: string | undefined;
  query: string;
  loading: boolean;
  error: string | undefined;
}

export interface NotesActions {
  setQuery: (query: string) => void;
  select: (id: string | undefined) => void;
  createNote: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (summary: NoteSummary) => Promise<void>;
  refresh: () => Promise<void>;
  refreshLabels: () => Promise<void>;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** Central renderer state for the notes list, search, label filter, and selection. */
export function useNotes(labelsEnabled = true): NotesState & NotesActions {
  const [summaries, setSummaries] = useState<NoteSummary[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQueryState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // Always read the latest query inside async callbacks.
  const queryRef = useRef(query);
  queryRef.current = query;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const q = queryRef.current.trim();
      const list = q ? await window.api.searchNotes(q) : await window.api.listNotes();
      setSummaries(list);
      setError(undefined);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLabels = useCallback(async () => {
    if (!labelsEnabled) return;
    try {
      setLabels(await window.api.listLabels());
    } catch (err) {
      setError(describeError(err));
    }
  }, [labelsEnabled]);

  // Initial load + subscribe to external vault changes.
  useEffect(() => {
    void refresh();
    void refreshLabels();
    const unsubscribe = window.api.onNotesChanged(() => {
      void refresh();
      void refreshLabels();
    });
    return unsubscribe;
  }, [refresh, refreshLabels]);

  // Re-query when the search text changes (debounced for search).
  useEffect(() => {
    const handle = setTimeout(() => void refresh(), query ? 200 : 0);
    return () => clearTimeout(handle);
  }, [query, refresh]);

  const setQuery = useCallback((value: string) => setQueryState(value), []);
  const select = useCallback((id: string | undefined) => setSelectedId(id), []);

  const createNote = useCallback(async () => {
    try {
      const note: Note = await window.api.createNote({ body: '' });
      await refresh();
      setSelectedId(note.id);
    } catch (err) {
      setError(describeError(err));
    }
  }, [refresh]);

  // Respond to the File → New Note menu command.
  useEffect(() => window.api.onMenuNewNote(() => void createNote()), [createNote]);

  const deleteNote = useCallback(
    async (id: string) => {
      try {
        await window.api.deleteNote(id);
        setSelectedId((current) => (current === id ? undefined : current));
        await refresh();
      } catch (err) {
        setError(describeError(err));
      }
    },
    [refresh],
  );

  const togglePin = useCallback(
    async (summary: NoteSummary) => {
      try {
        await window.api.updateNote({ id: summary.id, pinned: !summary.pinned });
        await refresh();
      } catch (err) {
        setError(describeError(err));
      }
    },
    [refresh],
  );

  return {
    summaries,
    labels,
    selectedId,
    query,
    loading,
    error,
    setQuery,
    select,
    createNote,
    deleteNote,
    togglePin,
    refresh,
    refreshLabels,
  };
}
