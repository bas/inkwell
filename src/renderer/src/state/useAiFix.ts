import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiError, AiFixSuggestion } from '@shared/ai';

export type AiFixStatus = 'idle' | 'tidying' | 'done' | 'error';
export type AiFixSuggestionStatus = 'pending' | 'applied' | 'rejected' | 'outdated';

export interface UiFixSuggestion extends AiFixSuggestion {
  status: AiFixSuggestionStatus;
}

export interface AiFixState {
  status: AiFixStatus;
  summary: string;
  /** Suggestions surfaced for user review (auto-applied ones are excluded). */
  suggestions: UiFixSuggestion[];
  /** How many low-risk edits were applied automatically. */
  autoAppliedCount: number;
  selectedSuggestionId?: string;
  streamingText: string;
  error?: string;
}

export interface UseAiFix {
  state: AiFixState;
  begin: () => string;
  fail: (error: string) => void;
  present: (
    requestId: string,
    summary: string,
    reviewSuggestions: AiFixSuggestion[],
    autoAppliedCount: number,
  ) => void;
  cancelFix: () => void;
  reset: () => void;
  selectSuggestion: (id: string) => void;
  markRejected: (id: string) => void;
  markApplied: (id: string) => void;
  markOutdated: (id: string) => void;
  activeRequestId: () => string | undefined;
}

const IDLE: AiFixState = {
  status: 'idle',
  summary: '',
  suggestions: [],
  autoAppliedCount: 0,
  streamingText: '',
};

export function describeFixError(error: AiError): string {
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
      return 'This note has no content to tidy.';
    case 'generation-failed':
    default:
      return error.message || 'Copilot could not tidy this note.';
  }
}

function updateSuggestionStatus(
  suggestions: UiFixSuggestion[],
  id: string,
  status: AiFixSuggestionStatus,
): UiFixSuggestion[] {
  return suggestions.map((s) => (s.id === id ? { ...s, status } : s));
}

/** Pick the next still-pending suggestion after `resolvedId`, wrapping around. */
export function nextFixSelection(
  suggestions: UiFixSuggestion[],
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
  prev: AiFixState,
  id: string,
  status: AiFixSuggestionStatus,
): AiFixState {
  const suggestions = updateSuggestionStatus(prev.suggestions, id, status);
  const selectedSuggestionId =
    prev.selectedSuggestionId === id
      ? nextFixSelection(suggestions, id)
      : prev.selectedSuggestionId;
  return { ...prev, suggestions, selectedSuggestionId };
}

export function useAiFix(): UseAiFix {
  const [state, setState] = useState<AiFixState>(IDLE);
  const requestIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = window.api.onAiStreamDelta((chunk) => {
      if (chunk.requestId !== requestIdRef.current) return;
      setState((prev) =>
        prev.status === 'tidying'
          ? { ...prev, streamingText: prev.streamingText + chunk.delta }
          : prev,
      );
    });
    return () => {
      unsubscribe();
      const requestId = requestIdRef.current;
      if (requestId) void window.api.cancelFix(requestId);
    };
  }, []);

  const begin = useCallback((): string => {
    const previous = requestIdRef.current;
    if (previous) void window.api.cancelFix(previous);
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setState({
      status: 'tidying',
      summary: '',
      suggestions: [],
      autoAppliedCount: 0,
      streamingText: '',
    });
    return requestId;
  }, []);

  const fail = useCallback((error: string) => {
    setState({
      status: 'error',
      summary: '',
      suggestions: [],
      autoAppliedCount: 0,
      streamingText: '',
      error,
    });
  }, []);

  const present = useCallback(
    (
      requestId: string,
      summary: string,
      reviewSuggestions: AiFixSuggestion[],
      autoAppliedCount: number,
    ) => {
      if (requestIdRef.current !== requestId) return;
      const suggestions: UiFixSuggestion[] = reviewSuggestions.map((s) => ({
        ...s,
        status: 'pending',
      }));
      setState({
        status: 'done',
        summary,
        suggestions,
        autoAppliedCount,
        selectedSuggestionId: suggestions[0]?.id,
        streamingText: '',
      });
    },
    [],
  );

  const cancelFix = useCallback(() => {
    const requestId = requestIdRef.current;
    if (requestId) void window.api.cancelFix(requestId);
    requestIdRef.current = undefined;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current = undefined;
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

  const activeRequestId = useCallback(() => requestIdRef.current, []);

  return {
    state,
    begin,
    fail,
    present,
    cancelFix,
    reset,
    selectSuggestion,
    markRejected,
    markApplied,
    markOutdated,
    activeRequestId,
  };
}
