import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiError } from '@shared/ai';

export type AiSummaryStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface AiSummaryState {
  status: AiSummaryStatus;
  /** Accumulated summary text (streamed while running, final when done). */
  text: string;
  error?: string;
}

export interface UseAiSummary {
  state: AiSummaryState;
  /** Start summarizing the given note. Replaces any in-flight summary. */
  summarize: (noteId: string) => void;
  /** Cancel any in-flight summary and return to idle. */
  cancel: () => void;
  /** Return to the idle state and clear any text/error. */
  reset: () => void;
}

const IDLE: AiSummaryState = { status: 'idle', text: '' };

/** Turn a typed AI error into a friendly, actionable message for the panel. */
function describeAiError(error: AiError): string {
  switch (error.code) {
    case 'runtime-error':
      return (
        error.message ||
        'Copilot isn’t available. Make sure the Copilot CLI is installed and try again.'
      );
    case 'not-authenticated':
    case 'no-entitlement':
      return 'Your account doesn’t have Copilot access right now (no license or quota exhausted).';
    case 'timeout':
      return 'Copilot took too long to respond. Please try again.';
    case 'empty-note':
      return 'This note has no content to summarize.';
    case 'generation-failed':
    default:
      return error.message || 'Copilot could not summarize this note. Please try again.';
  }
}

/**
 * Orchestrates a single note summarization: generates a request id, streams
 * deltas from main, and resolves to a final result or a typed error state. All
 * IPC for the AI summary feature lives here so components stay declarative.
 */
export function useAiSummary(): UseAiSummary {
  const [state, setState] = useState<AiSummaryState>(IDLE);
  // The request currently owning the panel; stale deltas are ignored.
  const activeRequestId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = window.api.onAiStreamDelta((chunk) => {
      if (chunk.requestId !== activeRequestId.current) return;
      setState((prev) =>
        prev.status === 'streaming' ? { ...prev, text: prev.text + chunk.delta } : prev,
      );
    });
    return () => {
      unsubscribe();
      const requestId = activeRequestId.current;
      if (requestId) void window.api.cancelSummarize(requestId);
    };
  }, []);

  const summarize = useCallback((noteId: string) => {
    const previous = activeRequestId.current;
    if (previous) void window.api.cancelSummarize(previous);

    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;
    setState({ status: 'streaming', text: '' });

    void window.api
      .summarizeNote(noteId, requestId)
      .then((result) => {
        if (activeRequestId.current !== requestId) return;
        if (result.ok) {
          setState({ status: 'done', text: result.content });
        } else {
          setState({ status: 'error', text: '', error: describeAiError(result.error) });
        }
      })
      .catch((err: unknown) => {
        if (activeRequestId.current !== requestId) return;
        setState({
          status: 'error',
          text: '',
          error: err instanceof Error ? err.message : 'Could not summarize this note.',
        });
      });
  }, []);

  const cancel = useCallback(() => {
    const requestId = activeRequestId.current;
    if (requestId) void window.api.cancelSummarize(requestId);
    activeRequestId.current = undefined;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => {
    activeRequestId.current = undefined;
    setState(IDLE);
  }, []);

  return { state, summarize, cancel, reset };
}
