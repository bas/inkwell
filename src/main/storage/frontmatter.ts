import matter from 'gray-matter';
import { randomUUID } from 'node:crypto';
import type { Note, NoteFrontmatter } from '../../shared/note';

/** Result of parsing a note file: the (untyped) frontmatter and the markdown body. */
export interface ParsedNoteFile {
  data: Record<string, unknown>;
  body: string;
}

/** Parse a raw `.md` file into frontmatter data and body. Never throws on bad frontmatter. */
export function parseNoteFile(raw: string): ParsedNoteFile {
  try {
    const parsed = matter(raw);
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    return { data, body: parsed.content.replace(/^\n+/, '') };
  } catch {
    // Malformed YAML: treat the whole file as body so content is never lost.
    return { data: {}, body: raw };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asIsoDate(value: unknown, fallback: string): string {
  const str = asString(value) ?? (value instanceof Date ? value.toISOString() : undefined);
  if (str) {
    const time = Date.parse(str);
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return fallback;
}

/**
 * Coerce parsed frontmatter into a complete, valid `NoteFrontmatter`,
 * filling in missing/invalid fields (id, timestamps, labels, pinned).
 */
export function normalizeFrontmatter(
  data: Record<string, unknown>,
  now: string = new Date().toISOString(),
): NoteFrontmatter {
  const id = asString(data['id']) ?? randomUUID();
  const createdAt = asIsoDate(data['createdAt'], now);
  return {
    id,
    title: asString(data['title'])?.trim() || 'Untitled',
    labels: asStringArray(data['labels']),
    pinned: data['pinned'] === true,
    createdAt,
    updatedAt: asIsoDate(data['updatedAt'], createdAt),
  };
}

/** Parse and normalize a raw `.md` file into a full `Note`. */
export function readNote(raw: string, now?: string): Note {
  const { data, body } = parseNoteFile(raw);
  return { ...normalizeFrontmatter(data, now), body };
}

/** Serialize a note to `.md` text with frontmatter in a stable key order. */
export function serializeNote(note: Note): string {
  const frontmatter: NoteFrontmatter = {
    id: note.id,
    title: note.title,
    labels: note.labels,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  const body = note.body.endsWith('\n') ? note.body : `${note.body}\n`;
  return matter.stringify(body, frontmatter);
}
