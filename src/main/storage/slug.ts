/** Build the on-disk filename for a note: `<note-id>.md`. */
export function noteFilename(id: string): string {
  return `${id}.md`;
}
