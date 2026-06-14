/**
 * Regenerable "TL;DR" block helpers. The summary lives at the top of a note's
 * body as a Markdown blockquote led by a bold `**TL;DR**` marker. The marker
 * lets us detect and replace the block on re-summarize (never stacking it)
 * while it renders as an ordinary blockquote in the WYSIWYG editor.
 *
 * We deliberately avoid HTML-comment sentinels: with `html: false` the editor
 * shows them as literal text and escapes them on save (`&lt;!-- … --&gt;`),
 * which both leaks into the WYSIWYG view and breaks re-detection. A bold
 * marker round-trips cleanly through TipTap. Pure and deterministic for tests.
 */

/** First blockquote line of a TL;DR block (bold marker; em dash is optional). */
const TLDR_FIRST_LINE = /^>\s*\*\*TL;DR\*\*/;

/** Legacy HTML-comment-sentinel block, stripped on upsert so old notes heal. */
const LEGACY_BLOCK = /^\s*<!-- inkwell:tldr -->[\s\S]*?<!-- \/inkwell:tldr -->\n*/;

/** Render the summary as a Markdown blockquote led by a bold TL;DR marker. */
function formatTldrBlock(summary: string): string {
  const lines = summary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const [first = '', ...rest] = lines;
  return [`> **TL;DR** — ${first}`, ...rest.map((line) => `> ${line}`)].join('\n');
}

/**
 * Insert or replace the TL;DR block at the top of `body`.
 *
 * - If the body already opens with a TL;DR blockquote (new format) or a legacy
 *   sentinel block, it is replaced in place — idempotent, never stacking.
 *   Detection keys off the leading `> **TL;DR**` marker, so it survives a
 *   WYSIWYG round-trip.
 * - Otherwise the block is prepended, separated from existing content by a
 *   blank line.
 */
export function upsertTldrBlock(body: string, summary: string): string {
  const block = formatTldrBlock(summary);
  const withoutLegacy = body.replace(LEGACY_BLOCK, '');
  const lines = withoutLegacy.split('\n');

  // Skip leading blank lines when detecting an existing TL;DR block, but preserve
  // any leading whitespace/indentation in the original body when prepending.
  let start = 0;
  while (start < lines.length && (lines[start] ?? '').trim() === '') start++;

  let rest: string;
  if (TLDR_FIRST_LINE.test(lines[start] ?? '')) {
    // Consume the contiguous leading blockquote, then any blank separator lines.
    let i = start;
    while (i < lines.length && (lines[i] ?? '').startsWith('>')) i++;
    while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
    rest = [...lines.slice(0, start), ...lines.slice(i)].join('\n');
  } else {
    rest = withoutLegacy;
  }

  return rest ? `${block}\n\n${rest}` : `${block}\n`;
}
