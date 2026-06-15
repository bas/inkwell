import type { AiReviewOptions } from '../../shared/ai';

/**
 * Build the prompt that asks Copilot for a concise summary of a note body.
 * Pure and deterministic so it can be unit-tested. The note text is fenced with
 * explicit delimiters so the model treats it as content, not instructions.
 */
export function buildSummarizePrompt(noteBody: string): string {
  const body = noteBody.trim();
  return [
    'You are summarizing a personal Markdown note for its author.',
    'Write a concise TL;DR of the note below in 2-4 sentences of plain prose.',
    'Do not add a heading, preamble, or any information that is not in the note.',
    'Respond with only the summary text.',
    '',
    '--- BEGIN NOTE ---',
    body,
    '--- END NOTE ---',
  ].join('\n');
}

/**
 * Build the prompt for structured note review suggestions.
 * The model must return strict JSON to keep renderer behavior deterministic.
 */
export function buildReviewPrompt(noteBody: string, options?: AiReviewOptions): string {
  const body = noteBody.replace(/\r\n/g, '\n');
  const scope =
    options?.scope !== undefined
      ? `Focus only on lines ${options.scope.startLine}-${options.scope.endLine}.`
      : 'Review the whole note.';
  const instruction = options?.instruction?.trim()
    ? `Extra instruction from user: ${options.instruction.trim()}`
    : '';

  return [
    'You are reviewing a personal Markdown note for quality improvements.',
    'Categories allowed: grammar, clarity, style.',
    'Provide only actionable suggestions that preserve user intent.',
    scope,
    instruction,
    'Return strict JSON with this shape and nothing else:',
    '{"summary":"string","suggestions":[{"id":"string","title":"string","category":"grammar|clarity|style","severity":"low|medium|high","rationale":"string","confidence":0.0,"replacement":"string","target":{"startLine":1,"endLine":1,"anchorText":"string optional","before":"string optional"}}]}',
    'Use 1-based line numbers from the provided note.',
    'Keep suggestions concise and high-signal.',
    '',
    '--- BEGIN NOTE ---',
    body,
    '--- END NOTE ---',
  ]
    .filter(Boolean)
    .join('\n');
}
