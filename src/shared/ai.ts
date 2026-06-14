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

/** Final result of an AI generation request. */
export type AiResult =
  | { ok: true; requestId: string; content: string }
  | { ok: false; requestId: string; error: AiError };
