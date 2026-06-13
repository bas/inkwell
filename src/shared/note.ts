/**
 * Note domain types shared across processes. No Node/Electron imports.
 *
 * Plain `.md` files (with YAML frontmatter) are the source of truth. These types
 * describe the parsed shape used across the IPC boundary.
 */

/** Frontmatter stored at the top of every note `.md` file. */
export interface NoteFrontmatter {
  /** Stable unique id (uuid). The source of truth for identity, not the filename. */
  id: string;
  title: string;
  labels: string[];
  pinned: boolean;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** A full note: frontmatter plus the markdown body. */
export interface Note extends NoteFrontmatter {
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
  title?: string;
  body?: string;
  labels?: string[];
}

/** Fields a caller may change when updating a note. */
export interface UpdateNoteInput {
  id: string;
  title?: string;
  body?: string;
  labels?: string[];
  pinned?: boolean;
}
