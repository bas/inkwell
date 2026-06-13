/** Derive a short, plain-text preview from a markdown body for the notes list. */
export function makeSnippet(body: string, maxLength = 160): string {
  const plain = body
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
