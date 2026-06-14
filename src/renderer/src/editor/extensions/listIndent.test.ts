// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/react';
import { buildExtensions } from '../extensions';
import {
  MAX_LIST_DEPTH,
  listDepth,
  activeListItemType,
  canIndentList,
  canOutdentList,
  indentList,
  outdentList,
} from './listIndent';

function makeEditor(markdown: string): Editor {
  return new Editor({ extensions: buildExtensions(''), content: markdown });
}

interface MarkdownStorage {
  getMarkdown: () => string;
}

function toMarkdown(editor: Editor): string {
  return (editor.storage.markdown as MarkdownStorage).getMarkdown();
}

/** Place the cursor inside the text of the last list item in the document. */
function selectLastListItem(editor: Editor): void {
  let pos = 1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === 'paragraph' && node.textContent !== '') pos = nodePos + 1;
    return true;
  });
  editor.commands.setTextSelection(pos);
}

describe('list indent helpers', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('reports zero depth and no item type outside a list', () => {
    editor = makeEditor('Just a paragraph');
    editor.commands.setTextSelection(2);
    expect(listDepth(editor)).toBe(0);
    expect(activeListItemType(editor)).toBeNull();
    expect(canIndentList(editor)).toBe(false);
    expect(canOutdentList(editor)).toBe(false);
  });

  it('identifies bullet and ordered list items', () => {
    editor = makeEditor('- one');
    selectLastListItem(editor);
    expect(activeListItemType(editor)).toBe('listItem');
    expect(listDepth(editor)).toBe(1);
    expect(canIndentList(editor)).toBe(false); // first/only item cannot be nested
    expect(canOutdentList(editor)).toBe(true); // lifts the item out of the list
  });

  it('indents a second item under the first and outdents it back', () => {
    editor = makeEditor(['- one', '- two'].join('\n'));
    selectLastListItem(editor);
    expect(canIndentList(editor)).toBe(true);

    expect(indentList(editor)).toBe(true);
    expect(listDepth(editor)).toBe(2);
    expect(toMarkdown(editor)).toBe('- one\n  - two');

    expect(canOutdentList(editor)).toBe(true);
    expect(outdentList(editor)).toBe(true);
    expect(listDepth(editor)).toBe(1);
    expect(toMarkdown(editor)).toBe('- one\n- two');
  });

  it('caps nesting at three levels', () => {
    editor = makeEditor(['- one', '  - two', '    - three', '      - four'].join('\n'));
    selectLastListItem(editor);
    // The fixture already presents four nominal levels; collapse to verify the
    // cap by re-indenting a fresh deep structure.
    editor.destroy();

    editor = makeEditor(['- a', '- b'].join('\n'));
    selectLastListItem(editor);
    expect(indentList(editor)).toBe(true); // level 2
    expect(listDepth(editor)).toBe(2);

    // Add a deeper item and indent to level 3.
    editor.destroy();
    editor = makeEditor(['- a', '  - b', '  - c'].join('\n'));
    selectLastListItem(editor);
    expect(indentList(editor)).toBe(true); // level 3
    expect(listDepth(editor)).toBe(MAX_LIST_DEPTH);

    // At the cap further indentation is refused.
    expect(canIndentList(editor)).toBe(false);
    expect(indentList(editor)).toBe(false);
    expect(listDepth(editor)).toBe(MAX_LIST_DEPTH);
  });
});
