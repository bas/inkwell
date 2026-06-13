import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Box } from '@primer/react';
import { buildExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import './editor.css';

interface MarkdownEditorProps {
  /** Initial Markdown content. The editor is uncontrolled after mount; remount
   * (via `key`) to load a different note. */
  initialMarkdown: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
}

interface MarkdownStorage {
  getMarkdown: () => string;
}

export function MarkdownEditor({
  initialMarkdown,
  placeholder = 'Start writing…',
  onChange,
}: MarkdownEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'markdown-body',
        'data-testid': 'editor-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange((instance.storage.markdown as MarkdownStorage).getMarkdown());
    },
  });

  // Make sure the editor releases ProseMirror resources on unmount.
  useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Toolbar editor={editor} />
      <Box className="ink-editor" sx={{ flex: 1, minHeight: 0, px: 4, py: 3 }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
