/** Generate a filesystem-safe slug from a note title. */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'untitled';
}

/** Build the on-disk filename for a note: `<slug>-<shortId>.md`. */
export function noteFilename(title: string, id: string): string {
  const shortId = id.replace(/-/g, '').slice(0, 8);
  return `${slugify(title)}-${shortId}.md`;
}
