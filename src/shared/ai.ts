/**
 * AI feature types shared across the main, preload, and renderer processes.
 * This module must not import any Node or Electron runtime APIs.
 *
 * The AI features are powered by the Copilot SDK running in the main process.
 * All SDK/child-process work stays in `src/main/ai/**`; the renderer only ever
 * learns the runtime/auth state through these serializable types.
 */

/** Why the Copilot AI runtime is not usable, mapped to a renderer-facing message. */
export type AiUnavailableReason = 'runtime-error' | 'not-authenticated';
/**
 * Whether the Copilot runtime is reachable and the user is authenticated.
 *
 * `ready: true` means a summarize/translate/review request can be attempted.
 * License/entitlement problems are not detectable from auth status alone; they
 * surface when a request actually runs and are reported at that point.
 */
export type AiAvailability =
  | {
      ready: true;
      /** How the runtime authenticated, e.g. `user` (OAuth/Keychain) or `gh-cli`. */
      authType?: string;
      /** The authenticated GitHub login, when known. */
      login?: string;
    }
  | {
      ready: false;
      reason: AiUnavailableReason;
      /** Human-readable detail for diagnostics and the UI. */
      message?: string;
    };

/**
 * Why an AI generation request failed. Extends {@link AiUnavailableReason} with
 * codes that only surface once a request actually runs.
 */
export type AiErrorCode =
  | AiUnavailableReason
  | 'no-entitlement'
  | 'generation-failed'
  | 'timeout'
  | 'empty-note';

/** A typed AI failure carried back to the renderer for first-class error states. */
export interface AiError {
  code: AiErrorCode;
  message: string;
}

/** Streamed chunk of an in-progress AI response, correlated by `requestId`. */
export interface AiStreamChunk {
  requestId: string;
  delta: string;
}

export type AiCreditsSource = 'exact' | 'estimated' | 'unavailable';

/** Structured usage details for a single AI request. */
export interface AiUsage {
  /** How the displayed AI Credits value was derived. */
  creditsSource: AiCreditsSource;
  /** AI Credits consumed for this request (when known). */
  aiCredits?: number;
  /** Model used for this request, when reported by the runtime. */
  model?: string;
  /** Input tokens consumed by this request. */
  inputTokens?: number;
  /** Output tokens produced by this request. */
  outputTokens?: number;
  /** Prompt-cache read tokens, when applicable. */
  cacheReadTokens?: number;
  /** Prompt-cache write tokens, when applicable. */
  cacheWriteTokens?: number;
  /** Reasoning tokens, when reported by the model/runtime. */
  reasoningTokens?: number;
  /** End-to-end model call duration (ms), when available. */
  durationMs?: number;
  /** Current context window token usage after this request, when reported. */
  contextTokens?: number;
  /** Maximum context window tokens for the active model, when reported. */
  contextTokenLimit?: number;
  /** Context message count after this request, when reported. */
  contextMessageCount?: number;
}

/** Final result of an AI generation request. */
export type AiResult =
  | { ok: true; requestId: string; content: string; usage?: AiUsage }
  | { ok: false; requestId: string; error: AiError; usage?: AiUsage };

/** Categories supported by the first AI review release. */
export type AiReviewCategory = 'grammar' | 'clarity' | 'style';

/** Severity hint used to order and label review findings. */
export type AiReviewSeverity = 'low' | 'medium' | 'high';

/** Stable target for a suggested edit. */
export interface AiReviewTarget {
  /** 1-based inclusive start line in the markdown source. */
  startLine: number;
  /** 1-based inclusive end line in the markdown source. */
  endLine: number;
  /** Optional exact anchor fallback when line ranges drift after edits. */
  anchorText?: string;
  /** Optional expected preimage for stale-target detection. */
  before?: string;
}

/** One actionable review suggestion. */
export interface AiReviewSuggestion {
  id: string;
  title: string;
  category: AiReviewCategory;
  severity: AiReviewSeverity;
  rationale: string;
  target: AiReviewTarget;
  replacement: string;
  /** 0..1 confidence hint shown to users. */
  confidence: number;
}

/** Optional scope/instruction for scoped refinement regeneration. */
export interface AiReviewOptions {
  instruction?: string;
  scope?: {
    startLine: number;
    endLine: number;
    suggestionId?: string;
  };
}

/** Structured output from a review request. */
export type AiReviewResult =
  | {
      ok: true;
      requestId: string;
      summary: string;
      suggestions: AiReviewSuggestion[];
    }
  | { ok: false; requestId: string; error: AiError };

/** Outcome of applying a single suggestion to a note body. */
export type AiReviewApplyResult =
  | { ok: true; noteId: string; suggestionId: string; updatedBody: string }
  | { ok: false; noteId: string; suggestionId: string; reason: 'outdated' | 'invalid-target' };
