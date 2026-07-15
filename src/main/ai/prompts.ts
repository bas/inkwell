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

/**
 * Build the prompt for "Tidy up with Copilot". Asks the model for structured,
 * line-targeted fix suggestions across spelling, capitalization, formatting,
 * labels, and other categories. Must return strict JSON so parsing stays
 * deterministic. `existingLabels` lets the model prefer reusing known labels.
 * Pure and deterministic for unit testing.
 */
export function buildFixPrompt(noteBody: string, existingLabels: string[]): string {
  const body = noteBody.replace(/\r\n/g, '\n');
  const labelList = existingLabels.filter((name) => name.trim().length > 0);
  const labels =
    labelList.length > 0
      ? `Existing labels you should prefer to reuse: ${labelList.join(', ')}.`
      : 'There are no existing labels yet.';

  return [
    'You are tidying a personal Markdown note for its author.',
    'Propose concrete, high-signal fixes that preserve the author’s meaning and voice.',
    'Categories allowed: spelling, capitalization, formatting, label, other.',
    '- spelling: fix clear misspellings.',
    '- capitalization: fix sentence-start and proper-noun casing.',
    '- formatting: improve structure using only Markdown headings (levels 1-3),',
    '  paragraphs, bullet/numbered lists, task lists, tables, code, and links.',
    '  When the note opens with an obvious title or topic line (for example a',
    '  short first line that names the whole note), suggest promoting it to a',
    '  level-1 heading, and promote clear section starts to level-2/3 headings.',
    '  Never emit raw HTML. Preserve all existing wording and content.',
    '- label: suggest a short topical label to organize the note.',
    '- other: any remaining small improvement.',
    'Set "autoApplyable": true ONLY for low-risk, high-confidence character-level',
    'spelling or capitalization fixes. Everything else must be autoApplyable: false.',
    labels,
    'For spelling, capitalization, formatting, and other suggestions, include a',
    '"target" with 1-based line numbers and a "replacement" string.',
    'For label suggestions, include a "label" string and omit target/replacement.',
    'Return strict JSON with this shape and nothing else:',
    '{"summary":"string","suggestions":[{"id":"string","title":"string","category":"spelling|capitalization|formatting|label|other","severity":"low|medium|high","rationale":"string","confidence":0.0,"autoApplyable":false,"replacement":"string optional","label":"string optional","target":{"startLine":1,"endLine":1,"anchorText":"string optional","before":"string optional"}}]}',
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
