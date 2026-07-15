import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { MermaidBlockView } from './mermaidBlockView';

interface MarkdownSerializerState {
  write: (content: string) => void;
  closeBlock: (node: ProseMirrorNode) => void;
}

function getCodeAttribute(node: ProseMirrorNode): string {
  const value = node.attrs['code'] as unknown;
  return typeof value === 'string' ? value : '';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaidDiagram: (attrs?: { code?: string }) => ReturnType;
    };
  }
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  priority: 200,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mermaid') ?? element.textContent ?? '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const code = element.querySelector('code');
          const className = code?.getAttribute('class') ?? '';
          if (!/(^|\s)language-mermaid(\s|$)/.test(className)) return false;
          return { code: (code?.textContent ?? '').replace(/\n$/, '') };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const code = typeof HTMLAttributes['code'] === 'string' ? HTMLAttributes['code'] : '';
    const wrapperAttributes = { ...HTMLAttributes };
    delete wrapperAttributes['code'];
    return [
      'pre',
      mergeAttributes(wrapperAttributes, { 'data-type': 'mermaid' }),
      ['code', { class: 'language-mermaid' }, code],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },

  addCommands() {
    return {
      insertMermaidDiagram:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { code: attrs?.code ?? '' },
          }),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const code = getCodeAttribute(node);
          state.write('```mermaid\n');
          state.write(code);
          if (!code.endsWith('\n')) state.write('\n');
          state.write('```');
          state.closeBlock(node);
        },
      },
    };
  },
});
