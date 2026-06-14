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
