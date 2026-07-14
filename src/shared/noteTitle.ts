/**
 * Derive a human-readable title from a markdown note body.
 *
 * The first non-empty line is treated as the visible title. Common markdown
 * prefixes are stripped so a line like `# Shopping list` or `- Grocery` still
 * yields a clean title projection.
 */
function splitBodyLines(body: string): string[] {
  return body.split(/\r?\n/);
}

function getTitleStartIndex(lines: string[]): number {
  let start = 0;
  while (start < lines.length && (lines[start] ?? '').trim().length === 0) start++;

  const leadingLine = lines[start] ?? '';
  if (/^>\s*\*\*TL;DR\*\*/.test(leadingLine)) {
    let i = start;
    while (i < lines.length && (lines[i] ?? '').startsWith('>')) i++;
    while (i < lines.length && (lines[i] ?? '').trim().length === 0) i++;
    start = i;
  }

  return start;
}

export function getTitleSourceLine(body: string): string | undefined {
  const lines = splitBodyLines(body);
  const start = getTitleStartIndex(lines);

  return lines
    .slice(start)
    .map((value) => value.trim())
    .find((value) => value.length > 0);
}

/** Return the body with the first visible title line removed. */
export function getBodyAfterTitle(body: string): string {
  const lines = splitBodyLines(body);
  let start = getTitleStartIndex(lines);

  if (start < lines.length) {
    start += 1;
    while (start < lines.length && (lines[start] ?? '').trim().length === 0) start++;
  }

  return lines.slice(start).join('\n');
}

export function deriveNoteTitle(body: string): string {
  const line = getTitleSourceLine(body);

  if (!line) return 'Untitled';

  const plain = line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^(?:[-*+]\s*|\d+[.)]\s*)/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain || 'Untitled';
}
