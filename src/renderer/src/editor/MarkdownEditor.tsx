import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Box } from '@primer/react';
import { buildExtensions } from './extensions';
import './editor.css';

interface MarkdownEditorProps {
  /** Initial Markdown content. The editor is uncontrolled after mount; remount
   * (via `key`) to load a different note. */
  initialMarkdown: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
  /** Receives the TipTap editor instance when ready, and `null` on teardown,
   * so an external toolbar can drive formatting. */
  onEditorReady?: (editor: Editor | null) => void;
}

interface MarkdownStorage {
  getMarkdown: () => string;
}

export function MarkdownEditor({
  initialMarkdown,
  placeholder = 'Start writing…',
  onChange,
  onEditorReady,
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

  // Publish the editor instance upward; clear it on unmount/remount.
  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  // Make sure the editor releases ProseMirror resources on unmount.
  useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <Box className="ink-editor" sx={{ height: '100%', minHeight: 0 }}>
      <Box sx={{ maxWidth: '720px', minHeight: '100%', mx: 'auto', px: 4, py: 3 }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
