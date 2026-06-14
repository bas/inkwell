import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';

/** List container node types that contribute one level of nesting. */
const LIST_NODE_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

/** Maximum nesting depth allowed for lists (top level counts as 1). */
export const MAX_LIST_DEPTH = 3;

/** Count how many list containers wrap the current selection (0 when not in a list). */
export function listDepth(editor: Editor): number {
  const { $from } = editor.state.selection;
  let depth = 0;
  for (let level = $from.depth; level > 0; level--) {
    if (LIST_NODE_TYPES.has($from.node(level).type.name)) depth++;
  }
  return depth;
}

/** Resolve the list-item node type at the selection, or null when not in a list. */
export function activeListItemType(editor: Editor): 'listItem' | 'taskItem' | null {
  if (editor.isActive('taskItem')) return 'taskItem';
  if (editor.isActive('listItem')) return 'listItem';
  return null;
}

/** Whether the current selection can be indented one more level. */
export function canIndentList(editor: Editor): boolean {
  const type = activeListItemType(editor);
  if (!type || listDepth(editor) >= MAX_LIST_DEPTH) return false;
  return editor.can().sinkListItem(type);
}

/** Whether the current selection can be outdented one level. */
export function canOutdentList(editor: Editor): boolean {
  const type = activeListItemType(editor);
  if (!type) return false;
  return editor.can().liftListItem(type);
}

/** Indent the current list item by one level, respecting the depth cap. */
export function indentList(editor: Editor): boolean {
  const type = activeListItemType(editor);
  if (!type || listDepth(editor) >= MAX_LIST_DEPTH) return false;
  return editor.chain().focus().sinkListItem(type).run();
}

/** Outdent the current list item by one level. */
export function outdentList(editor: Editor): boolean {
  const type = activeListItemType(editor);
  if (!type) return false;
  return editor.chain().focus().liftListItem(type).run();
}

/**
 * Wires Tab / Shift-Tab to indent / outdent list items while capping nesting at
 * {@link MAX_LIST_DEPTH}. Runs at a higher priority than StarterKit so it owns
 * those keys inside lists, but stays inert (returns false) elsewhere so Tab
 * keeps its default behavior outside lists.
 */
export const ListIndent = Extension.create({
  name: 'listIndent',
  priority: 200,

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const type = activeListItemType(this.editor);
        if (!type) return false;
        // Already at the cap: swallow Tab so it can't nest deeper.
        if (listDepth(this.editor) >= MAX_LIST_DEPTH) return true;
        return this.editor.commands.sinkListItem(type);
      },
      'Shift-Tab': () => {
        const type = activeListItemType(this.editor);
        if (!type) return false;
        return this.editor.commands.liftListItem(type);
      },
    };
  },
});
