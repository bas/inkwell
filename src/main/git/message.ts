/**
 * Build an auto-commit message from the note titles that changed. Pure and
 * unit-tested. Keeps commit messages meaningful without exposing git to the
 * user (research R3 §3.2).
 */
export function autoCommitMessage(changedTitles: readonly string[]): string {
  const titles = changedTitles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (titles.length === 0) return 'Update notes';
  if (titles.length === 1) return `Update note: ${titles[0]}`;
  if (titles.length <= 3) return `Update notes: ${titles.join(', ')}`;
  return `Update ${titles.length} notes`;
}
