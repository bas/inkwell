import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiError, AiReviewOptions, AiReviewSuggestion } from '@shared/ai';

export type AiReviewStatus = 'idle' | 'reviewing' | 'done' | 'error';
export type AiSuggestionStatus = 'pending' | 'applied' | 'rejected' | 'outdated';

export interface UiReviewSuggestion extends AiReviewSuggestion {
  status: AiSuggestionStatus;
}

export interface AiReviewState {
  status: AiReviewStatus;
  summary: string;
  suggestions: UiReviewSuggestion[];
  selectedSuggestionId?: string;
  streamingText: string;
  error?: string;
}

export interface UseAiReview {
  state: AiReviewState;
  startReview: (noteId: string, options?: AiReviewOptions) => void;
  cancelReview: () => void;
  reset: () => void;
  selectSuggestion: (id: string) => void;
  markRejected: (id: string) => void;
  markApplied: (id: string) => void;
  markOutdated: (id: string) => void;
}

const IDLE: AiReviewState = {
  status: 'idle',
  summary: '',
  suggestions: [],
  streamingText: '',
};

function describeAiError(error: AiError): string {
  switch (error.code) {
    case 'runtime-error':
      return (
        error.message ||
        'Copilot isn’t available. It needs Node.js 22.5+ on your PATH (or set INKWELL_NODE_PATH).'
      );
    case 'not-authenticated':
      return error.message || 'Sign in with `copilot login` to use Copilot AI features.';
    case 'no-entitlement':
      return error.message || 'Your account doesn’t have Copilot access right now.';
    case 'timeout':
      return 'Copilot took too long to respond. Please try again.';
    case 'empty-note':
      return 'This note has no content to review.';
    case 'generation-failed':
    default:
      return error.message || 'Copilot could not review this note.';
  }
}

function updateSuggestionStatus(
  suggestions: UiReviewSuggestion[],
  id: string,
  status: AiSuggestionStatus,
): UiReviewSuggestion[] {
  return suggestions.map((s) => (s.id === id ? { ...s, status } : s));
}

/**
 * Pick the suggestion to focus after `resolvedId` becomes non-pending: prefer
 * the next still-pending suggestion (wrapping around), so the reviewer is moved
 * forward instead of left staring at a resolved item.
 */
export function nextSelection(
  suggestions: UiReviewSuggestion[],
  resolvedId: string,
): string | undefined {
  const order = suggestions.map((s) => s.id);
  const from = order.indexOf(resolvedId);
  for (let i = 1; i <= order.length; i += 1) {
    const candidate = suggestions[(from + i) % suggestions.length];
    if (candidate && candidate.status === 'pending') return candidate.id;
  }
  return resolvedId;
}

function resolveSuggestion(
  prev: AiReviewState,
  id: string,
  status: AiSuggestionStatus,
): AiReviewState {
  const suggestions = updateSuggestionStatus(prev.suggestions, id, status);
  const selectedSuggestionId =
    prev.selectedSuggestionId === id ? nextSelection(suggestions, id) : prev.selectedSuggestionId;
  return { ...prev, suggestions, selectedSuggestionId };
}

export function useAiReview(): UseAiReview {
  const [state, setState] = useState<AiReviewState>(IDLE);
  const activeRequestId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = window.api.onAiStreamDelta((chunk) => {
      if (chunk.requestId !== activeRequestId.current) return;
      setState((prev) =>
        prev.status === 'reviewing'
          ? { ...prev, streamingText: prev.streamingText + chunk.delta }
          : prev,
      );
    });
    return () => {
      unsubscribe();
      const requestId = activeRequestId.current;
      if (requestId) void window.api.cancelReview(requestId);
    };
  }, []);

  const startReview = useCallback((noteId: string, options?: AiReviewOptions) => {
    const previous = activeRequestId.current;
    if (previous) void window.api.cancelReview(previous);

    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;
    setState({ status: 'reviewing', summary: '', suggestions: [], streamingText: '' });

    void window.api
      .reviewNote(noteId, requestId, options)
      .then((result) => {
        if (activeRequestId.current !== requestId) return;
        if (!result.ok) {
          setState({
            status: 'error',
            summary: '',
            suggestions: [],
            streamingText: '',
            error: describeAiError(result.error),
          });
          return;
        }
        const suggestions: UiReviewSuggestion[] = result.suggestions.map((s) => ({
          ...s,
          status: 'pending',
        }));
        setState({
          status: 'done',
          summary: result.summary,
          suggestions,
          selectedSuggestionId: suggestions[0]?.id,
          streamingText: '',
        });
      })
      .catch((err: unknown) => {
        if (activeRequestId.current !== requestId) return;
        setState({
          status: 'error',
          summary: '',
          suggestions: [],
          streamingText: '',
          error: err instanceof Error ? err.message : 'Could not review this note.',
        });
      });
  }, []);

  const cancelReview = useCallback(() => {
    const requestId = activeRequestId.current;
    if (requestId) void window.api.cancelReview(requestId);
    activeRequestId.current = undefined;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => {
    activeRequestId.current = undefined;
    setState(IDLE);
  }, []);

  const selectSuggestion = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedSuggestionId: id }));
  }, []);

  const markRejected = useCallback((id: string) => {
    setState((prev) => resolveSuggestion(prev, id, 'rejected'));
  }, []);

  const markApplied = useCallback((id: string) => {
    setState((prev) => resolveSuggestion(prev, id, 'applied'));
  }, []);

  const markOutdated = useCallback((id: string) => {
    setState((prev) => resolveSuggestion(prev, id, 'outdated'));
  }, []);

  return {
    state,
    startReview,
    cancelReview,
    reset,
    selectSuggestion,
    markRejected,
    markApplied,
    markOutdated,
  };
}
