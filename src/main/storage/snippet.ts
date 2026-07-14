/** Derive a short, plain-text preview from a markdown body for the notes list. */
export function makeSnippet(body: string, maxLength = 160): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  while (start < lines.length && (lines[start] ?? '').trim().length === 0) start++;
  const leadingLine = lines[start] ?? '';
  if (/^>\s*\*\*TL;DR\*\*/.test(leadingLine)) {
    let i = start;
    while (i < lines.length && (lines[i] ?? '').startsWith('>')) i++;
    while (i < lines.length && (lines[i] ?? '').trim().length === 0) i++;
    start = i;
  }
  if (start < lines.length) {
    start += 1;
    while (start < lines.length && (lines[start] ?? '').trim().length === 0) start++;
  }

  const plain = lines.slice(start).join('\n')
    .replace(/^---\n[\s\S]*?\n---\n/, '') // any stray frontmatter
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/^#{1,6}\s+/gm, '') // heading markers
    .replace(/[*_~>#-]/g, ' ') // remaining markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
