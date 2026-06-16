import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, Heading, Button, Spinner, Flash, TextInput } from '@primer/react';
import { NoteIcon } from '@primer/octicons-react';
import type { Editor } from '@tiptap/react';
import type { Note } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { EditorToolbar } from './EditorToolbar';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { AiSummaryDialog } from './AiSummaryDialog';
import { AiReviewPanel } from './AiReviewPanel';
import { LabelChip } from '../common/LabelChip';
import { LabelPicker } from '../labels/LabelPicker';
import { relativeTime } from '../../utils/relativeTime';
import { MarkdownEditor } from '../../editor/MarkdownEditor';
import { SourceEditor } from '../../editor/SourceEditor';
import { useAiSummary } from '../../state/useAiSummary';
import { useAiReview, type UiReviewSuggestion } from '../../state/useAiReview';

interface EditorPaneProps {
  noteId: string | undefined;
  labels: Label[];
  onCreateNote?: () => void;
  onAfterChange: () => void;
  onLabelsChanged: () => void;
  onAfterDelete: () => void;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 700;

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Could not open note';
}

interface SourceMatch {
  start: number;
  end: number;
}

interface WysiwygMatch {
  from: number;
  to: number;
}

interface DocTextSegment {
  from: number;
  to: number;
  start: number;
  end: number;
}

interface MarkdownStorage {
  getMarkdown: () => string;
}

function findExactMatches(text: string, query: string): SourceMatch[] {
  if (!query) return [];
  const matches: SourceMatch[] = [];
  let index = 0;
  while (index <= text.length - query.length) {
    const found = text.indexOf(query, index);
    if (found < 0) break;
    matches.push({ start: found, end: found + query.length });
    index = found + query.length;
  }
  return matches;
}

function collectDocTextSegments(editor: Editor): { fullText: string; segments: DocTextSegment[] } {
  const segments: DocTextSegment[] = [];
  const parts: string[] = [];
  let start = 0;
  let lastTextblockPos: number | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text || node.text.length === 0) return;
    const textblockPos = editor.state.doc.resolve(pos).start();
    if (lastTextblockPos !== undefined && textblockPos !== lastTextblockPos) {
      parts.push('\n');
      start += 1;
    }
    lastTextblockPos = textblockPos;
    const text = node.text;
    const end = start + text.length;
    segments.push({ from: pos, to: pos + text.length, start, end });
    parts.push(text);
    start = end;
  });
  return { fullText: parts.join(''), segments };
}

function locateDocPosition(segments: DocTextSegment[], index: number): number | undefined {
  const segment = segments.find((item) => index >= item.start && index < item.end);
  if (!segment) return undefined;
  return segment.from + (index - segment.start);
}

function findWysiwygMatches(editor: Editor, query: string): WysiwygMatch[] {
  if (!query) return [];
  const { fullText, segments } = collectDocTextSegments(editor);
  if (segments.length === 0) return [];
  const matches = findExactMatches(fullText, query);
  const mapped: WysiwygMatch[] = [];
  for (const match of matches) {
    const start = locateDocPosition(segments, match.start);
    const end = locateDocPosition(segments, match.end - 1);
    if (start === undefined || end === undefined) continue;
    mapped.push({ from: start, to: end + 1 });
  }
  return mapped;
}

function replaceAtRange(value: string, start: number, end: number, replacement: string): string {
  return value.slice(0, start) + replacement + value.slice(end);
}

function isExactDocRangeMatch(editor: Editor, match: WysiwygMatch, query: string): boolean {
  return editor.state.doc.textBetween(match.from, match.to, '', '') === query;
}

export function EditorPane({
  noteId,
  labels,
  onCreateNote,
  onAfterChange,
  onLabelsChanged,
  onAfterDelete,
}: EditorPaneProps): JSX.Element {
  const [note, setNote] = useState<Note | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [viewSource, setViewSource] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryNoteId, setSummaryNoteId] = useState('');
  const [summaryNoteTitle, setSummaryNoteTitle] = useState('');
  const [inserting, setInserting] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const {
    state: summaryState,
    summarize: runSummarize,
    cancel: cancelSummary,
    stop: stopSummary,
    reset: resetSummary,
  } = useAiSummary();
  const {
    state: reviewState,
    startReview,
    cancelReview,
    reset: resetReview,
    selectSuggestion,
    markRejected,
    markApplied,
    markOutdated,
  } = useAiReview();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNoteId, setReviewNoteId] = useState('');
  const [reviewNoteTitle, setReviewNoteTitle] = useState('');
  const [applyingId, setApplyingId] = useState<string | undefined>(undefined);
  const [batchApplying, setBatchApplying] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(-1);
  const [matchRefreshNonce, setMatchRefreshNonce] = useState(0);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement | null>(null);

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
    setSummaryOpen(false);
    cancelSummary();
    setReviewOpen(false);
    cancelReview();
    setViewSource(false);
    setFindOpen(false);
    setFindQuery('');
    setReplaceQuery('');
    setSelectedMatchIndex(-1);
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

  const handleBodyChange = useCallback(
    (value: string): void => {
      setMarkdown(value);
      dataRef.current = { ...dataRef.current, markdown: value };
      scheduleSave();
    },
    [scheduleSave],
  );

  const sourceMatches = useMemo(() => findExactMatches(markdown, findQuery), [markdown, findQuery]);
  const clearSelection = useCallback(() => {
    requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
  }, []);
  const refreshMatches = useCallback(() => {
    requestAnimationFrame(() => setMatchRefreshNonce((value) => value + 1));
  }, []);
  const syncMarkdownFromEditor = useCallback(
    (instance: Editor) => {
      requestAnimationFrame(() => {
        handleBodyChange((instance.storage.markdown as MarkdownStorage).getMarkdown());
        refreshMatches();
        clearSelection();
      });
    },
    [clearSelection, handleBodyChange, refreshMatches],
  );
  const validWysiwygMatches = useMemo(() => {
    // Force refresh after programmatic editor mutations where React state may lag.
    void matchRefreshNonce;
    if (viewSource || !editor || !findQuery) return [];
    return findWysiwygMatches(editor, findQuery).filter((match) =>
      isExactDocRangeMatch(editor, match, findQuery),
    );
  }, [editor, findQuery, matchRefreshNonce, viewSource]);
  const activeMatches = useMemo(
    () => (viewSource ? sourceMatches : validWysiwygMatches),
    [sourceMatches, viewSource, validWysiwygMatches],
  );
  const hasMatches = activeMatches.length > 0;
  const activeIndex = hasMatches
    ? selectedMatchIndex < 0
      ? 0
      : Math.min(selectedMatchIndex, activeMatches.length - 1)
    : 0;

  const focusFindInput = useCallback(() => {
    setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 0);
  }, []);
  const openFindReplace = useCallback(() => {
    setFindOpen(true);
    focusFindInput();
  }, [focusFindInput]);

  const closeFindReplace = useCallback(() => {
    setFindOpen(false);
    setSelectedMatchIndex(-1);
  }, []);

  const selectMatch = useCallback(
    (index: number) => {
      if (viewSource) {
        if (sourceMatches.length === 0) return;
        const normalized =
          ((index % sourceMatches.length) + sourceMatches.length) % sourceMatches.length;
        setSelectedMatchIndex(normalized);
        const match = sourceMatches[normalized];
        if (!match) return;
        const element = sourceEditorRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(match.start, match.end);
        return;
      }
      if (validWysiwygMatches.length === 0 || !editor) return;
      const normalized =
        ((index % validWysiwygMatches.length) + validWysiwygMatches.length) %
        validWysiwygMatches.length;
      setSelectedMatchIndex(normalized);
      const match = validWysiwygMatches[normalized];
      if (!match) return;
      editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
    },
    [editor, sourceMatches, validWysiwygMatches, viewSource],
  );

  const handleFindNext = useCallback(() => {
    if (!hasMatches) return;
    selectMatch(selectedMatchIndex < 0 ? 0 : activeIndex + 1);
  }, [activeIndex, hasMatches, selectMatch, selectedMatchIndex]);

  const handleFindPrevious = useCallback(() => {
    if (!hasMatches) return;
    selectMatch(selectedMatchIndex < 0 ? activeMatches.length - 1 : activeIndex - 1);
  }, [activeIndex, activeMatches.length, hasMatches, selectMatch, selectedMatchIndex]);

  const handleReplaceOne = useCallback(() => {
    if (!findQuery || !hasMatches) return;
    if (viewSource) {
      const match = sourceMatches[activeIndex];
      if (!match) return;
      const next = replaceAtRange(markdown, match.start, match.end, replaceQuery);
      handleBodyChange(next);
      const cursor = match.start + replaceQuery.length;
      setTimeout(() => {
        const element = sourceEditorRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(cursor, cursor);
      }, 0);
      setSelectedMatchIndex(-1);
      focusFindInput();
      clearSelection();
      return;
    }
    if (!editor) return;
    const match = validWysiwygMatches[activeIndex];
    if (!match) return;
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replaceQuery).run();
    syncMarkdownFromEditor(editor);
    setSelectedMatchIndex(-1);
    focusFindInput();
    clearSelection();
  }, [
    activeIndex,
    editor,
    findQuery,
    handleBodyChange,
    hasMatches,
    markdown,
    replaceQuery,
    sourceMatches,
    validWysiwygMatches,
    syncMarkdownFromEditor,
    focusFindInput,
    clearSelection,
    viewSource,
  ]);

  const handleReplaceAll = useCallback(() => {
    if (!findQuery || !hasMatches) return;
    if (viewSource) {
      handleBodyChange(markdown.split(findQuery).join(replaceQuery));
      setSelectedMatchIndex(-1);
      focusFindInput();
      clearSelection();
      return;
    }
    if (!editor) return;
    for (let index = validWysiwygMatches.length - 1; index >= 0; index -= 1) {
      const match = validWysiwygMatches[index];
      if (!match) continue;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: match.from, to: match.to }, replaceQuery)
        .run();
    }
    syncMarkdownFromEditor(editor);
    setSelectedMatchIndex(-1);
    focusFindInput();
    clearSelection();
  }, [
    editor,
    findQuery,
    handleBodyChange,
    hasMatches,
    markdown,
    replaceQuery,
    validWysiwygMatches,
    syncMarkdownFromEditor,
    focusFindInput,
    clearSelection,
    viewSource,
  ]);

  useEffect(() => {
    if (!findOpen) return;
    setSelectedMatchIndex(-1);
  }, [findOpen, findQuery, viewSource, noteId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openFindReplace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openFindReplace]);

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

  const handleSummarize = useCallback(() => {
    const { id, title } = dataRef.current;
    if (!id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    resetSummary();
    setSummaryNoteId(id);
    setSummaryNoteTitle(title);
    setSummaryOpen(true);
    void (async () => {
      await save();
      if (dirtyRef.current) {
        // Couldn't reach a clean on-disk state; don't summarize stale content.
        setSummaryOpen(false);
        setError('Could not save the note before summarizing. Please try again.');
        return;
      }
      runSummarize(id);
    })();
  }, [save, runSummarize, resetSummary]);

  const handleCloseSummary = useCallback(() => {
    setSummaryOpen(false);
    cancelSummary();
  }, [cancelSummary]);

  const handleInsertTldr = useCallback(async () => {
    if (!summaryNoteId || !summaryState.text) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await save();
    if (dirtyRef.current) return;
    setInserting(true);
    try {
      const updated = await window.api.insertTldr(summaryNoteId, summaryState.text);
      setNote(updated);
      setTitle(updated.title);
      setMarkdown(updated.body);
      dataRef.current = { id: updated.id, title: updated.title, markdown: updated.body };
      dirtyRef.current = false;
      setSaveState('saved');
      setReloadNonce((nonce) => nonce + 1);
      setSummaryOpen(false);
      resetSummary();
      onAfterChange();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setInserting(false);
    }
  }, [summaryNoteId, summaryState.text, save, resetSummary, onAfterChange]);

  const handleReview = useCallback(() => {
    const { id, title: currentTitle } = dataRef.current;
    if (!id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    resetReview();
    setReviewNoteId(id);
    setReviewNoteTitle(currentTitle);
    setReviewOpen(true);
    void (async () => {
      await save();
      if (dirtyRef.current) {
        setReviewOpen(false);
        setError('Could not save the note before reviewing. Please try again.');
        return;
      }
      startReview(id);
    })();
  }, [save, startReview, resetReview]);

  const handleCloseReview = useCallback(() => {
    setReviewOpen(false);
    cancelReview();
  }, [cancelReview]);

  const applySuggestion = useCallback(
    async (suggestion: UiReviewSuggestion): Promise<boolean> => {
      let result: Awaited<ReturnType<typeof window.api.applyReviewSuggestion>>;
      try {
        result = await window.api.applyReviewSuggestion(reviewNoteId, suggestion);
      } catch (err) {
        setError(describeError(err));
        return false;
      }
      if (!result.apply.ok) {
        markOutdated(suggestion.id);
        return false;
      }
      const updated = result.note;
      setNote(updated);
      setTitle(updated.title);
      setMarkdown(updated.body);
      dataRef.current = { id: updated.id, title: updated.title, markdown: updated.body };
      dirtyRef.current = false;
      setSaveState('saved');
      setReloadNonce((nonce) => nonce + 1);
      markApplied(suggestion.id);
      onAfterChange();
      return true;
    },
    [reviewNoteId, markApplied, markOutdated, onAfterChange],
  );

  const handleApply = useCallback(
    (id: string) => {
      const suggestion = reviewState.suggestions.find((s) => s.id === id);
      if (!suggestion) return;
      setApplyingId(id);
      void applySuggestion(suggestion).finally(() => setApplyingId(undefined));
    },
    [reviewState.suggestions, applySuggestion],
  );

  const handleApplyBatch = useCallback(
    (ids: string[]) => {
      // Apply bottom-up so earlier edits don't shift the line targets of later ones.
      const ordered = reviewState.suggestions
        .filter((s) => ids.includes(s.id))
        .sort((a, b) => b.target.startLine - a.target.startLine);
      if (ordered.length === 0) return;
      setBatchApplying(true);
      void (async () => {
        for (const suggestion of ordered) {
          await applySuggestion(suggestion);
        }
      })().finally(() => setBatchApplying(false));
    },
    [reviewState.suggestions, applySuggestion],
  );

  const handleRefine = useCallback(
    (instruction: string) => {
      if (!reviewNoteId) return;
      const selected = reviewState.suggestions.find(
        (s) => s.id === reviewState.selectedSuggestionId,
      );
      const scope = selected
        ? {
            startLine: selected.target.startLine,
            endLine: selected.target.endLine,
            suggestionId: selected.id,
          }
        : undefined;
      startReview(reviewNoteId, { instruction, scope });
    },
    [reviewNoteId, reviewState.suggestions, reviewState.selectedSuggestionId, startReview],
  );

  const applyLabels = useCallback(
    async (nextLabels: string[]) => {
      if (!note) return;
      try {
        await window.api.updateNote({ id: note.id, labels: nextLabels });
        setNote({ ...note, labels: nextLabels });
        onAfterChange();
        onLabelsChanged();
      } catch (err) {
        setError(describeError(err));
      }
    },
    [note, onAfterChange, onLabelsChanged],
  );

  const createAndAssign = useCallback(
    async (name: string) => {
      if (!note) return;
      try {
        await window.api.createLabel(name);
        await applyLabels([...note.labels, name]);
      } catch (err) {
        setError(describeError(err));
      }
    },
    [note, applyLabels],
  );

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
        sx={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          px: 4,
        }}
        data-testid="editor-empty"
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            width: '100%',
            maxWidth: 360,
            px: 4,
          }}
        >
          <Box sx={{ color: 'fg.muted', mb: 3 }}>
            <NoteIcon size={32} />
          </Box>
          <Heading as="h2" sx={{ fontSize: 4, mb: 2 }}>
            No note selected
          </Heading>
          <Text sx={{ color: 'fg.muted', mb: 4 }}>
            Select a note from the list, or create a new one to start writing.
          </Text>
          {onCreateNote && (
            <Button variant="primary" onClick={onCreateNote} data-testid="editor-empty-new-note">
              New note
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  if (loading && !note) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner aria-label="Loading note" />
      </Box>
    );
  }

  if (error && !note) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bg: 'canvas.default',
      }}
    >
      <Box
        as="header"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: 4,
          py: 3,
          bg: 'canvas.default',
          boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
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
          <LabelPicker
            noteLabels={note.labels}
            allLabels={labels}
            onChange={(next) => void applyLabels(next)}
            onCreateAndAssign={(name) => void createAndAssign(name)}
          />
        </Box>
      </Box>

      {error && (
        <Box sx={{ px: 4, pt: 3 }}>
          <Flash variant="danger">{error}</Flash>
        </Box>
      )}

      <Box
        sx={{ flex: 1, minHeight: 0, display: 'flex', minWidth: 0 }}
        data-testid="editor-content-row"
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            justifyContent: 'center',
            px: 4,
            py: 4,
            overflow: 'hidden',
          }}
        >
          <Box
            data-testid="editor-card"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              width: '100%',
              maxWidth: 'var(--ink-editor-column-max-width)',
              bg: 'canvas.default',
              border: '1px solid',
              borderColor: 'border.default',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <EditorToolbar
              editor={editor}
              viewSource={viewSource}
              onSelectEditor={() => {
                flush();
                setViewSource(false);
              }}
              onSelectSource={() => setViewSource(true)}
              pinned={note.pinned}
              onSummarize={handleSummarize}
              onReview={handleReview}
              onTogglePin={handleTogglePin}
              onCopyMarkdown={() => void handleCopyMarkdown()}
              onDelete={() => setConfirmDelete(true)}
              onOpenFindReplace={openFindReplace}
            />

            {findOpen && (
              <Box
                role="group"
                aria-label="Find and replace"
                data-testid="find-replace-bar"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                  px: 3,
                  py: 2,
                  bg: 'canvas.default',
                  boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
                }}
              >
                <TextInput
                  aria-label="Find text"
                  data-testid="find-input"
                  value={findQuery}
                  onChange={(event) => setFindQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (event.shiftKey) handleFindPrevious();
                      else handleFindNext();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      closeFindReplace();
                    }
                  }}
                  ref={findInputRef}
                  placeholder="Find"
                  sx={{ minWidth: 180, flexGrow: 1, maxWidth: 360 }}
                />
                <TextInput
                  aria-label="Replace with"
                  data-testid="replace-input"
                  value={replaceQuery}
                  onChange={(event) => setReplaceQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeFindReplace();
                    }
                  }}
                  placeholder="Replace"
                  sx={{ minWidth: 180, flexGrow: 1, maxWidth: 360 }}
                />
                <Button data-testid="find-prev" onClick={handleFindPrevious} disabled={!hasMatches}>
                  Prev
                </Button>
                <Button data-testid="find-next" onClick={handleFindNext} disabled={!hasMatches}>
                  Next
                </Button>
                <Button data-testid="replace-one" onClick={handleReplaceOne} disabled={!hasMatches}>
                  Replace
                </Button>
                <Button data-testid="replace-all" onClick={handleReplaceAll} disabled={!hasMatches}>
                  Replace all
                </Button>
                <Button data-testid="find-close" onClick={closeFindReplace}>
                  Close
                </Button>
                <Text
                  data-testid="find-match-count"
                  sx={{ fontSize: 0, color: 'fg.muted', minWidth: 90, textAlign: 'right' }}
                >
                  {findQuery
                    ? hasMatches
                      ? `${activeIndex + 1} of ${activeMatches.length}`
                      : '0 matches'
                    : 'Enter text'}
                </Text>
              </Box>
            )}

            <Box
              sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}
              data-testid="editor-body"
            >
              {viewSource ? (
                <Box
                  sx={{
                    display: 'flex',
                    height: '100%',
                    minHeight: 0,
                    width: '100%',
                    px: 4,
                    py: 3,
                  }}
                >
                  <SourceEditor
                    value={markdown}
                    onChange={handleBodyChange}
                    textareaRef={sourceEditorRef}
                  />
                </Box>
              ) : (
                <MarkdownEditor
                  key={`${note.id}:${reloadNonce}`}
                  initialMarkdown={markdown}
                  onChange={handleBodyChange}
                  onEditorReady={setEditor}
                />
              )}
            </Box>
          </Box>
        </Box>

        {reviewOpen && (
          <AiReviewPanel
            state={reviewState}
            noteTitle={reviewNoteTitle}
            applyingId={applyingId}
            batchApplying={batchApplying}
            onClose={handleCloseReview}
            onCancel={cancelReview}
            onRetry={() => startReview(reviewNoteId)}
            onSelect={selectSuggestion}
            onApply={handleApply}
            onReject={markRejected}
            onApplyBatch={handleApplyBatch}
            onRefine={handleRefine}
          />
        )}
      </Box>

      <DeleteNoteDialog
        open={confirmDelete}
        title={note.title || 'Untitled'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
      />

      {summaryOpen && (
        <AiSummaryDialog
          state={summaryState}
          noteTitle={summaryNoteTitle}
          inserting={inserting}
          onClose={handleCloseSummary}
          onStop={stopSummary}
          onRetry={() => runSummarize(summaryNoteId)}
          onInsert={() => void handleInsertTldr()}
        />
      )}
    </Box>
  );
}
