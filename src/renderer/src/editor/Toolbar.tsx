import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, ActionMenu, ActionList, Dialog, TextInput, Button } from '@primer/react';
import {
  BoldIcon,
  ItalicIcon,
  CodeIcon,
  HeadingIcon,
  ListUnorderedIcon,
  ListOrderedIcon,
  TasklistIcon,
  QuoteIcon,
  FileCodeIcon,
  LinkIcon,
  TableIcon,
  TriangleDownIcon,
} from '@primer/octicons-react';
import type { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
}

function ToolbarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
  testid,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testid?: string;
}): JSX.Element {
  return (
    <IconButton
      icon={icon}
      aria-label={label}
      aria-pressed={active}
      variant="invisible"
      disabled={disabled}
      data-testid={testid}
      // Keep the editor selection while clicking toolbar controls.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      sx={active ? { bg: 'accent.subtle', color: 'accent.fg' } : undefined}
    />
  );
}

/** Formatting toolbar for the Markdown editor. */
export function Toolbar({ editor }: ToolbarProps): JSX.Element {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  if (!editor) return <Box sx={{ height: 44 }} />;

  const headingLabel = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
      ? 'H2'
      : editor.isActive('heading', { level: 3 })
        ? 'H3'
        : 'Text';

  const openLinkDialog = (): void => {
    const previous = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(previous ?? '');
    setLinkOpen(true);
  };

  const applyLink = (): void => {
    const url = linkUrl.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  return (
    <Box
      role="toolbar"
      aria-label="Formatting"
      data-testid="editor-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        px: 3,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'border.default',
      }}
    >
      <ActionMenu>
        <ActionMenu.Button
          trailingVisual={TriangleDownIcon}
          leadingVisual={HeadingIcon}
          variant="invisible"
          data-testid="heading-menu"
          onMouseDown={(event) => event.preventDefault()}
        >
          {headingLabel}
        </ActionMenu.Button>
        <ActionMenu.Overlay width="small">
          <ActionList selectionVariant="single">
            <ActionList.Item
              selected={editor.isActive('paragraph')}
              onSelect={() => editor.chain().focus().setParagraph().run()}
            >
              Body text
            </ActionList.Item>
            {[1, 2, 3].map((level) => (
              <ActionList.Item
                key={level}
                selected={editor.isActive('heading', { level })}
                onSelect={() =>
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: level as 1 | 2 | 3 })
                    .run()
                }
              >
                Heading {level}
              </ActionList.Item>
            ))}
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>

      <Box sx={{ width: '1px', height: 20, bg: 'border.default', mx: 1 }} />

      <ToolbarButton
        icon={BoldIcon}
        label="Bold"
        testid="fmt-bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic"
        testid="fmt-italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={CodeIcon}
        label="Inline code"
        testid="fmt-code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        icon={LinkIcon}
        label="Link"
        testid="fmt-link"
        active={editor.isActive('link')}
        onClick={openLinkDialog}
      />

      <Box sx={{ width: '1px', height: 20, bg: 'border.default', mx: 1 }} />

      <ToolbarButton
        icon={ListUnorderedIcon}
        label="Bulleted list"
        testid="fmt-bullet"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrderedIcon}
        label="Numbered list"
        testid="fmt-ordered"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={TasklistIcon}
        label="Task list"
        testid="fmt-task"
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <Box sx={{ width: '1px', height: 20, bg: 'border.default', mx: 1 }} />

      <ToolbarButton
        icon={QuoteIcon}
        label="Quote"
        testid="fmt-quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={FileCodeIcon}
        label="Code block"
        testid="fmt-codeblock"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        icon={TableIcon}
        label="Insert table"
        testid="fmt-table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />

      {linkOpen && (
        <Dialog title="Add link" onClose={() => setLinkOpen(false)} data-testid="link-dialog">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextInput
              ref={linkInputRef}
              aria-label="Link URL"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyLink();
              }}
              sx={{ width: '100%' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={applyLink} data-testid="link-apply">
                Apply
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}
    </Box>
  );
}
