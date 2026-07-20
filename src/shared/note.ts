/**
 * Note domain types shared across processes. No Node/Electron imports.
 *
 * Plain `.md` files (with YAML frontmatter) are the source of truth. These types
 * describe the parsed shape used across the IPC boundary.
 */

/** Frontmatter stored at the top of every note `.md` file. */
export interface NoteFrontmatter {
  /** Stable unique id string. The source of truth for identity, not the filename. */
  id: string;
  labels: string[];
  pinned: boolean;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** A full note: frontmatter plus the derived title and markdown body. */
export interface Note extends NoteFrontmatter {
  title: string;
  body: string;
}

/** Lightweight projection used to render the notes list. */
export interface NoteSummary {
  id: string;
  title: string;
  /** Short plain-text preview of the body. */
  snippet: string;
  labels: string[];
  pinned: boolean;
  updatedAt: string;
}

/** Fields a caller may set when creating a note. */
export interface CreateNoteInput {
  body?: string;
  labels?: string[];
}

/** Fields a caller may change when updating a note. */
export interface UpdateNoteInput {
  id: string;
  body?: string;
  labels?: string[];
  pinned?: boolean;
  /**
   * Optimistic concurrency guard: the `updatedAt` the caller last observed. When
   * present and it no longer matches what is on disk, the write is rejected with
   * a stale-write error so the caller can reload and resolve rather than blindly
   * overwriting. Reconciliation policy (retry, prompt, discard) is up to the
   * caller; this field only gates the write.
   */
  baseUpdatedAt?: string;
}
