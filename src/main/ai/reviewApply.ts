import type { AiReviewApplyResult, AiReviewSuggestion } from '../../shared/ai';

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function joinLines(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Apply a review suggestion to markdown source using line-range targeting with
 * anchor fallback. Returns stale/invalid status instead of silently mutating.
 */
export function applyReviewSuggestionToBody(
  noteId: string,
  body: string,
  suggestion: AiReviewSuggestion,
): AiReviewApplyResult {
  const lines = splitLines(body);
  const { startLine, endLine, anchorText, before } = suggestion.target;
  const replacement = suggestion.replacement.replace(/\r\n/g, '\n');

  const hasValidRange =
    Number.isInteger(startLine) &&
    Number.isInteger(endLine) &&
    startLine >= 1 &&
    endLine >= startLine &&
    endLine <= lines.length;

  if (hasValidRange) {
    const start = startLine - 1;
    const end = endLine;
    const current = joinLines(lines.slice(start, end));
    if (before && current !== before) {
      if (!anchorText) {
        return { ok: false, noteId, suggestionId: suggestion.id, reason: 'outdated' };
      }
    } else {
      const next = [...lines.slice(0, start), ...splitLines(replacement), ...lines.slice(end)];
      return {
        ok: true,
        noteId,
        suggestionId: suggestion.id,
        updatedBody: joinLines(next),
      };
    }
  }

  if (anchorText && anchorText.length > 0) {
    const anchorAt = body.indexOf(anchorText);
    if (anchorAt < 0) {
      return { ok: false, noteId, suggestionId: suggestion.id, reason: 'outdated' };
    }
    return {
      ok: true,
      noteId,
      suggestionId: suggestion.id,
      updatedBody: `${body.slice(0, anchorAt)}${replacement}${body.slice(anchorAt + anchorText.length)}`,
    };
  }

  return { ok: false, noteId, suggestionId: suggestion.id, reason: 'invalid-target' };
}
