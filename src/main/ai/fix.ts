import { ipcMain, type WebContents } from 'electron';
import type {
  AiError,
  AiErrorCode,
  AiFixApplyResult,
  AiFixSuggestion,
  AiFixBodySuggestion,
  AiFixResult,
  AiReviewSuggestion,
} from '../../shared/ai';
import { IpcChannels } from '../../shared/ipc';
import { isBodyFixSuggestion } from '../../shared/aiFix';
import type { NotesService } from '../storage/notesService';
import { getAiAvailability } from './availability';
import { buildFixPrompt } from './prompts';
import { runGeneration } from './runner';
import { applyReviewSuggestionToBody } from './reviewApply';

interface ParsedFixPayload {
  summary: string;
  suggestions: AiFixSuggestion[];
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

function isFixCategory(value: unknown): value is AiFixSuggestion['category'] {
  return (
    value === 'spelling' ||
    value === 'capitalization' ||
    value === 'formatting' ||
    value === 'label' ||
    value === 'other'
  );
}

function isSeverity(value: unknown): value is AiFixSuggestion['severity'] {
  return value === 'low' || value === 'medium' || value === 'high';
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseTarget(value: unknown): AiFixSuggestion['target'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const t = value as Record<string, unknown>;
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
  return {
    startLine,
    endLine,
    anchorText: typeof t['anchorText'] === 'string' ? t['anchorText'] : undefined,
    before: typeof t['before'] === 'string' ? t['before'] : undefined,
  };
}

/**
 * Extract a JSON object from a model response that may wrap it in a Markdown
 * code fence (```json ... ```) or surround it with prose. Falls back to the
 * substring between the first `{` and last `}`.
 */
export function extractJsonPayload(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence && fence[1]) {
    text = fence[1].trim();
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return text;
}

export function parseFixResponse(raw: string): ParsedFixPayload {
  const parsed = JSON.parse(extractJsonPayload(raw)) as Record<string, unknown>;
  const summary = typeof parsed['summary'] === 'string' ? parsed['summary'].trim() : '';
  const sourceSuggestions = Array.isArray(parsed['suggestions']) ? parsed['suggestions'] : [];
  const suggestions: AiFixSuggestion[] = sourceSuggestions
    .map((item, index): AiFixSuggestion | undefined => {
      if (typeof item !== 'object' || item === null) return undefined;
      const row = item as Record<string, unknown>;
      const category = isFixCategory(row['category']) ? row['category'] : 'other';

      const title = typeof row['title'] === 'string' ? row['title'].trim() : '';
      const rationale = typeof row['rationale'] === 'string' ? row['rationale'].trim() : '';
      const base = {
        id: typeof row['id'] === 'string' && row['id'].trim() ? row['id'] : `fix-${index + 1}`,
        title: title || `Suggestion ${index + 1}`,
        category,
        severity: isSeverity(row['severity']) ? row['severity'] : 'medium',
        rationale: rationale || 'Suggested by Copilot tidy.',
        confidence: clampConfidence(row['confidence']),
        autoApplyable: row['autoApplyable'] === true,
      } satisfies Omit<AiFixSuggestion, 'target' | 'replacement' | 'label'>;

      if (category === 'label') {
        const label = typeof row['label'] === 'string' ? row['label'].trim() : '';
        if (!label) return undefined;
        return { ...base, autoApplyable: false, label };
      }

      const target = parseTarget(row['target']);
      if (!target) return undefined;
      const replacement = typeof row['replacement'] === 'string' ? row['replacement'] : '';
      if (!replacement.trim()) return undefined;
      return { ...base, target, replacement };
    })
    .filter((value): value is AiFixSuggestion => Boolean(value));

  if (!summary && suggestions.length === 0) {
    throw new Error('Copilot tidy response was empty.');
  }

  return { summary: summary || 'Copilot tidy completed.', suggestions };
}

function asFixSuggestion(value: unknown): AiFixSuggestion {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid fix suggestion');
  const row = value as Record<string, unknown>;
  if (typeof row['id'] !== 'string' || !row['id']) throw new Error('Invalid fix suggestion id');
  if (!isFixCategory(row['category'])) throw new Error('Invalid fix suggestion category');
  if (row['category'] === 'label') {
    throw new Error('Label suggestions cannot be applied via the body-fix IPC');
  }
  const target = parseTarget(row['target']);
  if (!target) throw new Error('Invalid fix suggestion target');
  if (typeof row['replacement'] !== 'string' || !row['replacement'].trim()) {
    throw new Error('Invalid fix suggestion replacement');
  }
  return {
    id: row['id'],
    title: typeof row['title'] === 'string' ? row['title'] : 'Suggestion',
    category: row['category'],
    severity: isSeverity(row['severity']) ? row['severity'] : 'medium',
    rationale:
      typeof row['rationale'] === 'string' ? row['rationale'] : 'Suggested by Copilot tidy.',
    confidence: clampConfidence(row['confidence']),
    autoApplyable: row['autoApplyable'] === true,
    target,
    replacement: row['replacement'],
  };
}

const activeRequests = new Map<string, () => void>();

async function fixNote(
  service: NotesService,
  sender: WebContents,
  noteId: string,
  requestId: string,
): Promise<AiFixResult> {
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
      error: { code: 'empty-note', message: 'This note has no content to tidy.' },
    };
  }

  let existingLabels: string[] = [];
  try {
    existingLabels = service.listLabels().map((label) => label.name);
  } catch {
    // Labels are only prompt context; if the label store is unavailable,
    // proceed with none rather than failing the whole tidy request.
    existingLabels = [];
  }

  let cancelFn: (() => void) | undefined;
  let canceled = false;
  activeRequests.set(requestId, () => {
    canceled = true;
    cancelFn?.();
  });

  const outcome = await runGeneration({
    prompt: buildFixPrompt(note.body, existingLabels),
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
    const parsed = parseFixResponse(outcome.content);
    return { ok: true, requestId, summary: parsed.summary, suggestions: parsed.suggestions };
  } catch (err) {
    return {
      ok: false,
      requestId,
      error: {
        code: 'generation-failed',
        message: err instanceof Error ? err.message : 'Could not parse tidy response.',
      },
    };
  }
}

/**
 * Adapt a body-editing fix suggestion to the review-suggestion shape so it can
 * reuse the battle-tested line-range + anchor apply logic.
 */
function toReviewShape(suggestion: AiFixBodySuggestion): AiReviewSuggestion {
  return {
    id: suggestion.id,
    title: suggestion.title,
    category: 'clarity',
    severity: suggestion.severity,
    rationale: suggestion.rationale,
    confidence: suggestion.confidence,
    target: suggestion.target,
    replacement: suggestion.replacement,
  };
}

export function registerFixHandlers(service: NotesService): void {
  ipcMain.handle(
    IpcChannels.aiFix,
    (event, noteId: unknown, requestId: unknown): Promise<AiFixResult> => {
      if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
      if (typeof requestId !== 'string') throw new Error('Expected requestId to be a string');
      return fixNote(service, event.sender, noteId, requestId);
    },
  );

  ipcMain.handle(IpcChannels.aiFixCancel, (_event, requestId: unknown) => {
    if (typeof requestId !== 'string') throw new Error('Expected requestId to be a string');
    activeRequests.get(requestId)?.();
    activeRequests.delete(requestId);
  });

  ipcMain.handle(
    IpcChannels.aiApplyFixSuggestion,
    async (
      _event,
      noteId: unknown,
      suggestionValue: unknown,
    ): Promise<{
      note: ReturnType<NotesService['updateNote']>;
      apply: AiFixApplyResult;
    }> => {
      if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
      const suggestion = asFixSuggestion(suggestionValue);
      if (!isBodyFixSuggestion(suggestion)) {
        throw new Error('Expected a body-editing fix suggestion with a target and replacement');
      }
      const note = await service.getNote(noteId);
      const apply = applyReviewSuggestionToBody(note.id, note.body, toReviewShape(suggestion));
      if (!apply.ok) {
        return { note, apply };
      }
      const updated = await service.updateNote({ id: note.id, body: apply.updatedBody });
      return { note: updated, apply };
    },
  );
}
