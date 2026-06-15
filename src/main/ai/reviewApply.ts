import type { AiReviewApplyResult, AiReviewSuggestion } from '../../shared/ai';

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function splitLines(text: string): string[] {
  return text.split('\n');
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
  const normalizedBody = normalizeLineEndings(body);
  const lines = splitLines(normalizedBody);
  const { startLine, endLine, anchorText, before } = suggestion.target;
  const normalizedAnchorText = anchorText ? normalizeLineEndings(anchorText) : undefined;
  const normalizedBefore = before ? normalizeLineEndings(before) : undefined;
  const replacement = normalizeLineEndings(suggestion.replacement);

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
    if (normalizedBefore && current !== normalizedBefore) {
      if (!normalizedAnchorText) {
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

  if (normalizedAnchorText && normalizedAnchorText.length > 0) {
    const anchorAt = normalizedBody.indexOf(normalizedAnchorText);
    if (anchorAt < 0) {
      return { ok: false, noteId, suggestionId: suggestion.id, reason: 'invalid-target' };
    }
    if (normalizedBody.indexOf(normalizedAnchorText, anchorAt + normalizedAnchorText.length) >= 0) {
      return { ok: false, noteId, suggestionId: suggestion.id, reason: 'invalid-target' };
    }
    return {
      ok: true,
      noteId,
      suggestionId: suggestion.id,
      updatedBody: `${normalizedBody.slice(0, anchorAt)}${replacement}${normalizedBody.slice(anchorAt + normalizedAnchorText.length)}`,
    };
  }

  return { ok: false, noteId, suggestionId: suggestion.id, reason: 'invalid-target' };
}
