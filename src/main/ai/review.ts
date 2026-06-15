import { ipcMain, type WebContents } from 'electron';
import type {
  AiError,
  AiErrorCode,
  AiReviewApplyResult,
  AiReviewOptions,
  AiReviewResult,
  AiReviewSuggestion,
} from '../../shared/ai';
import { IpcChannels } from '../../shared/ipc';
import type { NotesService } from '../storage/notesService';
import { getAiAvailability } from './availability';
import { buildReviewPrompt } from './prompts';
import { runGeneration } from './runner';
import { applyReviewSuggestionToBody } from './reviewApply';

interface ParsedReviewPayload {
  summary: string;
  suggestions: AiReviewSuggestion[];
}

function classifyErrorType(errorType: string | undefined): AiErrorCode {
  switch (errorType) {
    case 'quota':
    case 'authorization':
      return 'no-entitlement';
    case 'authentication':
      return 'not-authenticated';
    case 'timeout':
      return 'timeout';
    case 'runtime':
      return 'runtime-error';
    default:
      return 'generation-failed';
  }
}

function isCategory(value: unknown): value is AiReviewSuggestion['category'] {
  return value === 'grammar' || value === 'clarity' || value === 'style';
}

function isSeverity(value: unknown): value is AiReviewSuggestion['severity'] {
  return value === 'low' || value === 'medium' || value === 'high';
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function parseReviewResponse(raw: string): ParsedReviewPayload {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const summary = typeof parsed['summary'] === 'string' ? parsed['summary'].trim() : '';
  const sourceSuggestions = Array.isArray(parsed['suggestions']) ? parsed['suggestions'] : [];
  const suggestions: AiReviewSuggestion[] = sourceSuggestions
    .map((item, index): AiReviewSuggestion | undefined => {
      if (typeof item !== 'object' || item === null) return undefined;
      const row = item as Record<string, unknown>;
      const target = row['target'];
      if (typeof target !== 'object' || target === null) return undefined;
      const t = target as Record<string, unknown>;

      const startLine = Number(t['startLine']);
      const endLine = Number(t['endLine']);
      if (
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine
      ) {
        return undefined;
      }

      const replacement = typeof row['replacement'] === 'string' ? row['replacement'] : '';
      if (!replacement.trim()) return undefined;

      const title = typeof row['title'] === 'string' ? row['title'].trim() : '';
      const rationale = typeof row['rationale'] === 'string' ? row['rationale'].trim() : '';

      return {
        id:
          typeof row['id'] === 'string' && row['id'].trim() ? row['id'] : `suggestion-${index + 1}`,
        title: title || `Suggestion ${index + 1}`,
        category: isCategory(row['category']) ? row['category'] : 'clarity',
        severity: isSeverity(row['severity']) ? row['severity'] : 'medium',
        rationale: rationale || 'Suggested by AI review.',
        replacement,
        confidence: clampConfidence(row['confidence']),
        target: {
          startLine,
          endLine,
          anchorText: typeof t['anchorText'] === 'string' ? t['anchorText'] : undefined,
          before: typeof t['before'] === 'string' ? t['before'] : undefined,
        },
      };
    })
    .filter((value): value is AiReviewSuggestion => Boolean(value));

  if (!summary && suggestions.length === 0) {
    throw new Error('Copilot review response was empty.');
  }

  return { summary: summary || 'AI review completed.', suggestions };
}

function asReviewOptions(value: unknown): AiReviewOptions | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null) throw new Error('Invalid review options');
  const row = value as Record<string, unknown>;
  const scope = row['scope'];
  let parsedScope: AiReviewOptions['scope'];
  if (scope !== undefined) {
    if (typeof scope !== 'object' || scope === null) throw new Error('Invalid review scope');
    const s = scope as Record<string, unknown>;
    const startLine = Number(s['startLine']);
    const endLine = Number(s['endLine']);
    if (
      !Number.isInteger(startLine) ||
      !Number.isInteger(endLine) ||
      startLine < 1 ||
      endLine < startLine
    ) {
      throw new Error('Invalid review scope line range');
    }
    parsedScope = {
      startLine,
      endLine,
      suggestionId: typeof s['suggestionId'] === 'string' ? s['suggestionId'] : undefined,
    };
  }
  return {
    instruction: typeof row['instruction'] === 'string' ? row['instruction'] : undefined,
    scope: parsedScope,
  };
}

function asReviewSuggestion(value: unknown): AiReviewSuggestion {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid review suggestion');
  const row = value as Record<string, unknown>;
  const target = row['target'];
  if (typeof target !== 'object' || target === null)
    throw new Error('Invalid review suggestion target');
  const t = target as Record<string, unknown>;
  const startLine = Number(t['startLine']);
  const endLine = Number(t['endLine']);
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  ) {
    throw new Error('Invalid review suggestion line range');
  }
  if (typeof row['id'] !== 'string' || !row['id']) throw new Error('Invalid review suggestion id');
  if (typeof row['replacement'] !== 'string' || !row['replacement'].trim()) {
    throw new Error('Invalid review suggestion replacement');
  }
  if (!isCategory(row['category'])) throw new Error('Invalid review suggestion category');
  if (!isSeverity(row['severity'])) throw new Error('Invalid review suggestion severity');
  return {
    id: row['id'],
    title: typeof row['title'] === 'string' ? row['title'] : 'Suggestion',
    category: row['category'],
    severity: row['severity'],
    rationale: typeof row['rationale'] === 'string' ? row['rationale'] : 'Suggested by AI review.',
    replacement: row['replacement'],
    confidence: clampConfidence(row['confidence']),
    target: {
      startLine,
      endLine,
      anchorText: typeof t['anchorText'] === 'string' ? t['anchorText'] : undefined,
      before: typeof t['before'] === 'string' ? t['before'] : undefined,
    },
  };
}

const activeRequests = new Map<string, () => void>();

async function reviewNote(
  service: NotesService,
  sender: WebContents,
  noteId: string,
  requestId: string,
  options?: AiReviewOptions,
): Promise<AiReviewResult> {
  const availability = await getAiAvailability();
  if (!availability.ready) {
    const error: AiError = {
      code: availability.reason,
      message: availability.message ?? 'Copilot is unavailable.',
    };
    return { ok: false, requestId, error };
  }

  let note: ReturnType<NotesService['getNote']>;
  try {
    note = service.getNote(noteId);
  } catch (err) {
    return {
      ok: false,
      requestId,
      error: {
        code: 'generation-failed',
        message: err instanceof Error ? err.message : 'Could not load note.',
      },
    };
  }
  if (!note.body.trim()) {
    return {
      ok: false,
      requestId,
      error: { code: 'empty-note', message: 'This note has no content to review.' },
    };
  }

  let cancelFn: (() => void) | undefined;
  let canceled = false;
  activeRequests.set(requestId, () => {
    canceled = true;
    cancelFn?.();
  });

  const outcome = await runGeneration({
    prompt: buildReviewPrompt(note.body, options),
    onDelta: (delta) => {
      if (!sender.isDestroyed()) sender.send(IpcChannels.aiStreamDelta, { requestId, delta });
    },
    onStart: (cancel) => {
      cancelFn = cancel;
      if (canceled) cancel();
    },
  }).finally(() => {
    activeRequests.delete(requestId);
  });

  if (!outcome.ok) {
    return {
      ok: false,
      requestId,
      error: { code: classifyErrorType(outcome.errorType), message: outcome.message },
    };
  }

  try {
    const parsed = parseReviewResponse(outcome.content);
    return { ok: true, requestId, summary: parsed.summary, suggestions: parsed.suggestions };
  } catch (err) {
    return {
      ok: false,
      requestId,
      error: {
        code: 'generation-failed',
        message: err instanceof Error ? err.message : 'Could not parse review response.',
      },
    };
  }
}

export function registerReviewHandlers(service: NotesService): void {
  ipcMain.handle(
    IpcChannels.aiReview,
    (event, noteId: unknown, requestId: unknown, options: unknown): Promise<AiReviewResult> => {
      if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
      if (typeof requestId !== 'string') throw new Error('Expected requestId to be a string');
      return reviewNote(service, event.sender, noteId, requestId, asReviewOptions(options));
    },
  );

  ipcMain.handle(IpcChannels.aiReviewCancel, (_event, requestId: unknown) => {
    if (typeof requestId !== 'string') throw new Error('Expected requestId to be a string');
    activeRequests.get(requestId)?.();
    activeRequests.delete(requestId);
  });

  ipcMain.handle(
    IpcChannels.aiApplyReviewSuggestion,
    async (
      _event,
      noteId: unknown,
      suggestionValue: unknown,
    ): Promise<{
      note: ReturnType<NotesService['updateNote']>;
      apply: AiReviewApplyResult;
    }> => {
      if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
      const suggestion = asReviewSuggestion(suggestionValue);
      const note = await service.getNote(noteId);
      const apply = applyReviewSuggestionToBody(note.id, note.body, suggestion);
      if (!apply.ok) {
        return { note, apply };
      }
      const updated = await service.updateNote({ id: note.id, body: apply.updatedBody });
      return { note: updated, apply };
    },
  );
}
