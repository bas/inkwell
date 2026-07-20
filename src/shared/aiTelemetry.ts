export type NoteSizeBucket = 'short' | 'medium' | 'long';

/**
 * Bucket note sizes for latency reporting without logging note content.
 * Thresholds are intentionally coarse to keep telemetry high-level.
 */
export function classifyNoteSize(chars: number): NoteSizeBucket {
  if (chars < 2_000) return 'short';
  if (chars < 8_000) return 'medium';
  return 'long';
}
