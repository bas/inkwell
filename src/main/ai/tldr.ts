/**
 * Regenerable "TL;DR" block helpers. The summary lives at the top of a note's
 * body between HTML-comment sentinels so it can be detected and replaced on
 * re-summarize, never stacked. Pure and deterministic for unit testing.
 */

const TLDR_START = '<!-- inkwell:tldr -->';
const TLDR_END = '<!-- /inkwell:tldr -->';

/** Matches an existing TL;DR block, including its sentinels (non-greedy). */
const TLDR_BLOCK = /<!-- inkwell:tldr -->[\s\S]*?<!-- \/inkwell:tldr -->/;

/** Render the summary as a sentinel-wrapped Markdown blockquote. */
function formatTldrBlock(summary: string): string {
  const lines = summary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const [first = '', ...rest] = lines;
  const quoted = [`> **TL;DR** — ${first}`, ...rest.map((line) => `> ${line}`)].join('\n');
  return `${TLDR_START}\n${quoted}\n${TLDR_END}`;
}

/**
 * Insert or replace the TL;DR block at the top of `body`.
 *
 * - If a block already exists it is replaced in place (idempotent — calling this
 *   repeatedly never stacks blocks).
 * - Otherwise the block is prepended, separated from existing content by a blank
 *   line.
 */
export function upsertTldrBlock(body: string, summary: string): string {
  const block = formatTldrBlock(summary);
  if (TLDR_BLOCK.test(body)) {
    return body.replace(TLDR_BLOCK, block);
  }
  const rest = body.replace(/^\s+/, '');
  return rest ? `${block}\n\n${rest}` : `${block}\n`;
}
