import type { AiFixSuggestion, AiFixBodySuggestion } from './ai';

/** Minimum confidence required before a fix may be auto-applied without review. */
const AUTO_APPLY_MIN_CONFIDENCE = 0.8;

/**
 * Narrow a suggestion to a {@link AiFixBodySuggestion}: a non-`label` edit that
 * carries a concrete body target + non-empty replacement, so it is safe to send
 * to the apply IPC. Pure and deterministic for tests.
 */
export function isBodyFixSuggestion(
  suggestion: AiFixSuggestion,
): suggestion is AiFixBodySuggestion {
  if (suggestion.category === 'label') return false;
  if (!suggestion.target) return false;
  return typeof suggestion.replacement === 'string' && suggestion.replacement.trim().length > 0;
}

export interface PartitionedFixSuggestions {
  /** Low-risk edits safe to apply silently (spelling/capitalization). */
  autoApply: AiFixSuggestion[];
  /** Everything else, surfaced for user review. */
  review: AiFixSuggestion[];
}

/**
 * Decide whether a suggestion is safe to apply automatically. Only low-risk,
 * high-confidence character-level spelling/capitalization edits that carry a
 * concrete body target/replacement qualify. Pure and deterministic for tests.
 */
export function isAutoApplyable(suggestion: AiFixSuggestion): boolean {
  if (!suggestion.autoApplyable) return false;
  if (suggestion.category !== 'spelling' && suggestion.category !== 'capitalization') {
    return false;
  }
  if (suggestion.confidence < AUTO_APPLY_MIN_CONFIDENCE) return false;
  if (!suggestion.target) return false;
  if (typeof suggestion.replacement !== 'string' || suggestion.replacement.trim().length === 0) {
    return false;
  }
  return true;
}

/** Split tidy suggestions into an auto-apply set and a review set. */
export function partitionFixSuggestions(suggestions: AiFixSuggestion[]): PartitionedFixSuggestions {
  const autoApply: AiFixSuggestion[] = [];
  const review: AiFixSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (isAutoApplyable(suggestion)) autoApply.push(suggestion);
    else review.push(suggestion);
  }
  return { autoApply, review };
}
