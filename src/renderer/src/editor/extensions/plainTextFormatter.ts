import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Normalizes unformatted plain text toward markdown syntax so that
 * tiptap-markdown's `clipboardTextParser` can structure it properly.
 *
 * Runs in the synchronous `transformPastedText` ProseMirror hook — before
 * tiptap-markdown's parser sees the text.
 */
export function heuristicPlainToMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prev = i > 0 ? lines[i - 1].trim() : '';
    const next = i < lines.length - 1 ? lines[i + 1].trim() : '';

    // Blank line — preserve
    if (!trimmed) {
      out.push('');
      continue;
    }

    // Already looks like markdown — pass through untouched
    if (/^#{1,6}\s/.test(trimmed) || /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      out.push(line);
      continue;
    }

    // Unicode bullet characters → markdown bullet
    if (/^[•·◦‣⁃]\s*/.test(trimmed)) {
      out.push(trimmed.replace(/^[•·◦‣⁃]\s*/, '- '));
      continue;
    }

    // En-dash / em-dash bullets (Word/Pages style)
    if (/^[–—]\s+/.test(trimmed)) {
      out.push(trimmed.replace(/^[–—]\s+/, '- '));
      continue;
    }

    // "1)" or "1:" style numbered lists → "1."
    if (/^\d+[):]\s/.test(trimmed)) {
      out.push(trimmed.replace(/^(\d+)[):]\s/, '$1. '));
      continue;
    }

    // Short isolated line without trailing punctuation → heading (h2)
    const isolated = (prev === '' || i === 0) && (next === '' || i === lines.length - 1);
    if (isolated && trimmed.length <= 60 && !/[.!?,;:]$/.test(trimmed)) {
      out.push(`## ${trimmed}`);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * TipTap extension that transforms pasted plain text using heuristics before
 * the markdown parser processes it. Shift+paste bypasses the transform.
 */
export const PlainTextFormatter = Extension.create({
  name: 'plainTextFormatter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('plainTextFormatter'),
        props: {
          transformPastedText: (text: string, plain: boolean) => {
            // plain=true means Shift+paste — user wants raw text, skip transform
            if (plain) return text;
            return heuristicPlainToMarkdown(text);
          },
        },
      }),
    ];
  },
});
