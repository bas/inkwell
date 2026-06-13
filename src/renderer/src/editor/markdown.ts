import { Editor } from '@tiptap/react';
import { buildExtensions } from './extensions';

interface MarkdownStorage {
  getMarkdown: () => string;
}

/**
 * Parse Markdown into the editor schema and serialize it back to Markdown.
 * Runs the editor headlessly. Used to normalize note content and to verify
 * round-trip fidelity in tests (the `.md` file is the source of truth).
 */
export function normalizeMarkdown(markdown: string): string {
  const editor = new Editor({
    extensions: buildExtensions(''),
    content: markdown,
  });
  try {
    return (editor.storage.markdown as MarkdownStorage).getMarkdown();
  } finally {
    editor.destroy();
  }
}
