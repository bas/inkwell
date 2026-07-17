import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, Button, Spinner, Flash, TextInput } from '@primer/react';
import type { Editor } from '@tiptap/react';
import type { Note } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { EditorToolbar } from './EditorToolbar';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { AiSummaryDialog } from './AiSummaryDialog';
import { AiReviewPanel } from './AiReviewPanel';
import { AiFixPanel } from './AiFixPanel';
import { LabelChip } from '../common/LabelChip';
import { relativeTime } from '../../utils/relativeTime';
import { MarkdownEditor } from '../../editor/MarkdownEditor';
import { SourceEditor } from '../../editor/SourceEditor';
import { useAiSummary } from '../../state/useAiSummary';
import { useAiReview, type UiReviewSuggestion } from '../../state/useAiReview';
import { useAiFix, type UiFixSuggestion, describeFixError } from '../../state/useAiFix';
import { partitionFixSuggestions, isBodyFixSuggestion } from '@shared/aiFix';
import { deriveNoteTitle } from '@shared/noteTitle';

interface EditorPaneProps {
  noteId: string | undefined;
  labels: Label[];
  labelsEnabled: boolean;
  mermaidEnabled: boolean;
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

/**
 * Detect a rejected write caused by optimistic-concurrency staleness. Prefer the
 * error name set by the main process (`StaleNoteError`) and fall back to the
 * message text so small wording changes — or a name lost crossing the IPC
 * boundary — don't break stale-write handling.
 */
function isStaleWriteError(err: unknown): boolean {
  return (
    err instanceof Error && (err.name === 'StaleNoteError' || /changed on disk/i.test(err.message))
  );
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
  labelsEnabled,
  mermaidEnabled,
  onCreateNote,
  onAfterChange,
  onLabelsChanged,
  onAfterDelete,
}: EditorPaneProps): JSX.Element {
  const [note, setNote] = useState<Note | undefined>(undefined);
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
  const {
    state: fixState,
    begin: beginFix,
    fail: failFix,
    present: presentFix,
    cancelFix,
    reset: resetFix,
    selectSuggestion: selectFixSuggestion,
    markRejected: markFixRejected,
    markApplied: markFixApplied,
    markOutdated: markFixOutdated,
    activeRequestId: activeFixRequestId,
  } = useAiFix();
  const [fixOpen, setFixOpen] = useState(false);
  const [fixNoteId, setFixNoteId] = useState('');
  const [fixNoteTitle, setFixNoteTitle] = useState('');
  const [fixApplyingId, setFixApplyingId] = useState<string | undefined>(undefined);
  const [fixBatchApplying, setFixBatchApplying] = useState(false);
  const [preTidyBody, setPreTidyBody] = useState<string | undefined>(undefined);
  const [undoing, setUndoing] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(-1);
  const [matchRefreshNonce, setMatchRefreshNonce] = useState(0);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement | null>(null);

  // Latest editable data, read by the debounced/flush save without re-binding.
  const dataRef = useRef({ id: '', markdown: '', baseUpdatedAt: '' });
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(
    async (retryOnStale = true): Promise<void> => {
      if (!dirtyRef.current) return;
      const { id, markdown: body, baseUpdatedAt } = dataRef.current;
      if (!id) return;
      dirtyRef.current = false;
      setSaveState('saving');
      try {
        const saved = await window.api.updateNote({ id, body, baseUpdatedAt });
        // Track the latest persisted version for the next optimistic write.
        if (dataRef.current.id === id) dataRef.current.baseUpdatedAt = saved.updatedAt;
        setSaveState('saved');
        onAfterChange();
      } catch (err) {
        dirtyRef.current = true;
        // A stale write means the note changed on disk since we last read it.
        // Refresh our base to the on-disk version and let the active editor win
        // by retrying once, rather than silently discarding the user's edits.
        if (retryOnStale && isStaleWriteError(err)) {
          try {
            const latest = await window.api.getNote(id);
            if (dataRef.current.id === id) {
              dataRef.current.baseUpdatedAt = latest.updatedAt;
              await save(false);
              return;
            }
          } catch {
            // Fall through to surfacing the original error.
          }
        }
        setError(describeError(err));
        setSaveState('error');
      }
    },
    [onAfterChange],
  );

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
      setMarkdown(loaded.body);
      dataRef.current = { id: loaded.id, markdown: loaded.body, baseUpdatedAt: loaded.updatedAt };
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

  const handleBodyChange = useCallback(
    (value: string): void => {
      setMarkdown(value);
      dataRef.current = { ...dataRef.current, markdown: value };
      scheduleSave();
    },
    [scheduleSave],
  );

  const draftTitle = useMemo(() => deriveNoteTitle(markdown), [markdown]);

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
    const { markdown: body } = dataRef.current;
    try {
      await window.api.writeClipboard(body.trimEnd() + '\n');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  const handleSummarize = useCallback(() => {
    const { id, markdown: body } = dataRef.current;
    if (!id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    resetSummary();
    setSummaryNoteId(id);
    setSummaryNoteTitle(deriveNoteTitle(body));
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
      setMarkdown(updated.body);
      dataRef.current = {
        id: updated.id,
        markdown: updated.body,
        baseUpdatedAt: updated.updatedAt,
      };
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
    const { id, markdown: body } = dataRef.current;
    if (!id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only one AI panel at a time.
    setFixOpen(false);
    cancelFix();
    resetReview();
    setReviewNoteId(id);
    setReviewNoteTitle(deriveNoteTitle(body));
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
  }, [save, startReview, resetReview, cancelFix]);

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
      setMarkdown(updated.body);
      dataRef.current = {
        id: updated.id,
        markdown: updated.body,
        baseUpdatedAt: updated.updatedAt,
      };
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
      if (!note || !labelsEnabled) return;
      try {
        await window.api.updateNote({ id: note.id, labels: nextLabels });
        setNote({ ...note, labels: nextLabels });
        onAfterChange();
        onLabelsChanged();
      } catch (err) {
        setError(describeError(err));
      }
    },
    [labelsEnabled, note, onAfterChange, onLabelsChanged],
  );

  const createAndAssign = useCallback(
    async (name: string) => {
      if (!note || !labelsEnabled) return;
      try {
        await window.api.createLabel(name);
        await applyLabels([...note.labels, name]);
      } catch (err) {
        setError(describeError(err));
      }
    },
    [labelsEnabled, note, applyLabels],
  );

  const commitUpdatedNote = useCallback((updated: Note) => {
    setNote(updated);
    setMarkdown(updated.body);
    dataRef.current = { id: updated.id, markdown: updated.body, baseUpdatedAt: updated.updatedAt };
    dirtyRef.current = false;
    setSaveState('saved');
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  const applyFixSuggestion = useCallback(
    async (suggestion: UiFixSuggestion): Promise<boolean> => {
      if (suggestion.category === 'label') {
        const label = suggestion.label?.trim();
        // Guard against the user switching notes while the panel is open: only
        // mutate labels when the loaded note is still the tidy target.
        if (!label || !note || !labelsEnabled || note.id !== fixNoteId) {
          markFixOutdated(suggestion.id);
          return false;
        }
        try {
          if (!note.labels.includes(label)) {
            // createLabel is idempotent (INSERT OR IGNORE), so a real failure
            // here is worth surfacing via the outer catch rather than swallowing.
            await window.api.createLabel(label);
            const updated = await window.api.updateNote({
              id: note.id,
              labels: [...note.labels, label],
            });
            setNote(updated);
            onAfterChange();
            onLabelsChanged();
          }
          markFixApplied(suggestion.id);
          return true;
        } catch (err) {
          setError(describeError(err));
          return false;
        }
      }

      if (!isBodyFixSuggestion(suggestion)) {
        markFixOutdated(suggestion.id);
        return false;
      }

      let result: Awaited<ReturnType<typeof window.api.applyFixSuggestion>>;
      try {
        result = await window.api.applyFixSuggestion(fixNoteId, suggestion);
      } catch (err) {
        setError(describeError(err));
        return false;
      }
      if (!result.apply.ok) {
        markFixOutdated(suggestion.id);
        return false;
      }
      commitUpdatedNote(result.note);
      markFixApplied(suggestion.id);
      onAfterChange();
      return true;
    },
    [
      fixNoteId,
      note,
      labelsEnabled,
      commitUpdatedNote,
      markFixApplied,
      markFixOutdated,
      onAfterChange,
      onLabelsChanged,
    ],
  );

  const handleTidy = useCallback(() => {
    const { id, markdown: body } = dataRef.current;
    if (!id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only one AI panel at a time.
    setReviewOpen(false);
    cancelReview();
    setPreTidyBody(undefined);
    setFixNoteId(id);
    setFixNoteTitle(deriveNoteTitle(body));
    setFixOpen(true);
    // beginFix() resets prior fix state and cancels any in-flight request, so
    // an explicit resetFix() here would only clear the request id and prevent
    // that cancellation.
    const requestId = beginFix();
    void (async () => {
      // Block edits while tidy generates and auto-applies so background
      // mutations can't race with or clobber the user's keystrokes.
      editor?.setEditable(false, false);
      try {
        await save();
        if (dirtyRef.current) {
          setFixOpen(false);
          resetFix();
          setError('Could not save the note before tidying. Please try again.');
          return;
        }
        // The pre-tidy save is async; if the user cancelled/closed the panel while
        // it was in flight, don't start a generation that main can't yet cancel.
        if (activeFixRequestId() !== requestId) return;
        let result: Awaited<ReturnType<typeof window.api.fixNote>>;
        try {
          result = await window.api.fixNote(id, requestId);
        } catch (err) {
          failFix(describeError(err));
          return;
        }
        if (activeFixRequestId() !== requestId) return;
        if (!result.ok) {
          failFix(describeFixError(result.error));
          return;
        }
        // If the user edited while Copilot was generating, the suggestions are
        // stale and auto-applying them would clobber the in-progress edits.
        if (dirtyRef.current) {
          failFix(
            'You edited the note while Copilot was tidying. Save your changes and run Tidy again.',
          );
          return;
        }
        const { autoApply, review } = partitionFixSuggestions(result.suggestions);
        const reviewSet = labelsEnabled ? review : review.filter((s) => s.category !== 'label');
        const snapshot = dataRef.current.markdown;
        let appliedCount = 0;
        // Auto-apply only ever contains body edits; narrow the type and apply
        // bottom-up so earlier edits don't shift the line targets of later ones.
        const ordered = autoApply
          .filter(isBodyFixSuggestion)
          .sort((a, b) => b.target.startLine - a.target.startLine);
        for (const suggestion of ordered) {
          try {
            const applied = await window.api.applyFixSuggestion(id, suggestion);
            if (applied.apply.ok) {
              commitUpdatedNote(applied.note);
              appliedCount += 1;
            }
          } catch {
            // Skip an individual auto-fix that no longer matches; others still apply.
          }
        }
        if (activeFixRequestId() !== requestId) return;
        if (appliedCount > 0) {
          setPreTidyBody(snapshot);
          onAfterChange();
        }
        presentFix(requestId, result.summary, reviewSet, appliedCount);
      } finally {
        editor?.setEditable(true, false);
      }
    })();
  }, [
    save,
    beginFix,
    failFix,
    presentFix,
    resetFix,
    cancelReview,
    labelsEnabled,
    commitUpdatedNote,
    activeFixRequestId,
    onAfterChange,
    editor,
  ]);

  const handleApplyFix = useCallback(
    (id: string) => {
      const suggestion = fixState.suggestions.find((s) => s.id === id);
      if (!suggestion) return;
      setFixApplyingId(id);
      void applyFixSuggestion(suggestion).finally(() => setFixApplyingId(undefined));
    },
    [fixState.suggestions, applyFixSuggestion],
  );

  const handleApplyFixBatch = useCallback(
    (ids: string[]) => {
      // Body edits apply bottom-up; label suggestions (no target) sort last.
      const ordered = fixState.suggestions
        .filter((s) => ids.includes(s.id))
        .sort((a, b) => (b.target?.startLine ?? 0) - (a.target?.startLine ?? 0));
      if (ordered.length === 0) return;
      setFixBatchApplying(true);
      void (async () => {
        for (const suggestion of ordered) {
          await applyFixSuggestion(suggestion);
        }
      })().finally(() => setFixBatchApplying(false));
    },
    [fixState.suggestions, applyFixSuggestion],
  );

  const handleCloseFix = useCallback(() => {
    setFixOpen(false);
    setPreTidyBody(undefined);
    cancelFix();
  }, [cancelFix]);

  const handleUndoTidy = useCallback(() => {
    const snapshot = preTidyBody;
    if (snapshot === undefined || !fixNoteId) return;
    // Undo overwrites the note body on disk; refuse if the user has typed since
    // tidying so their unsaved edits aren't silently discarded.
    if (dirtyRef.current) {
      setError('Save or discard your current edits before undoing the tidy.');
      return;
    }
    setUndoing(true);
    void (async () => {
      try {
        // Enforce optimistic concurrency so undo never clobbers a change made on
        // disk since the tidy. dataRef holds the base for the loaded note, which
        // is always the tidy target while the undo affordance is visible.
        const base = dataRef.current.id === fixNoteId ? dataRef.current.baseUpdatedAt : undefined;
        const updated = await window.api.updateNote({
          id: fixNoteId,
          body: snapshot,
          ...(base ? { baseUpdatedAt: base } : {}),
        });
        commitUpdatedNote(updated);
        onAfterChange();
        setPreTidyBody(undefined);
        setFixOpen(false);
        resetFix();
      } catch (err) {
        if (isStaleWriteError(err)) {
          setError(
            'This note changed on disk since it was tidied, so the tidy was not undone. Reload the note and try again.',
          );
        } else {
          setError(describeError(err));
        }
      } finally {
        setUndoing(false);
      }
    })();
  }, [preTidyBody, fixNoteId, commitUpdatedNote, onAfterChange, resetFix]);

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
          <Text as="h2" sx={{ fontSize: 4, fontWeight: 'bold', mb: 2 }}>
            No note selected
          </Text>
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
      {labelsEnabled && note.labels.length > 0 && (
        <Box
          as="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 4,
            py: 2,
            bg: 'canvas.default',
            boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {note.labels.map((name) => (
              <LabelChip key={name} name={name} color={colorOf(name)} />
            ))}
          </Box>
        </Box>
      )}

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
            pt: 3,
            pb: 4,
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
              labelsEnabled={labelsEnabled}
              mermaidEnabled={mermaidEnabled}
              onSummarize={handleSummarize}
              onReview={handleReview}
              onTidy={handleTidy}
              onTogglePin={handleTogglePin}
              onCopyMarkdown={() => void handleCopyMarkdown()}
              onDelete={() => setConfirmDelete(true)}
              onOpenFindReplace={openFindReplace}
              noteLabels={note.labels}
              allLabels={labels}
              onLabelsChange={(next) => void applyLabels(next)}
              onCreateAndAssign={(name) => void createAndAssign(name)}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                px: 3,
                py: 2,
                bg: 'canvas.default',
              }}
              data-testid="editor-status-row"
            >
              <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="save-state">
                {copied ? 'Copied to clipboard' : saveLabel}
              </Text>
            </Box>

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
                  key={`${note.id}:${reloadNonce}:${mermaidEnabled ? 'mermaid' : 'plain'}`}
                  initialMarkdown={markdown}
                  mermaidEnabled={mermaidEnabled}
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

        {fixOpen && (
          <AiFixPanel
            state={fixState}
            noteTitle={fixNoteTitle}
            applyingId={fixApplyingId}
            batchApplying={fixBatchApplying}
            onClose={handleCloseFix}
            onCancel={handleCloseFix}
            onRetry={handleTidy}
            onSelect={selectFixSuggestion}
            onApply={handleApplyFix}
            onReject={markFixRejected}
            onApplyBatch={handleApplyFixBatch}
            onUndo={preTidyBody !== undefined ? handleUndoTidy : undefined}
            undoing={undoing}
          />
        )}
      </Box>

      <DeleteNoteDialog
        open={confirmDelete}
        title={draftTitle}
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
