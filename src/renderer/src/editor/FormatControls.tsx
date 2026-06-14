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
  ChevronRightIcon,
  ChevronLeftIcon,
} from '@primer/octicons-react';
import type { Editor } from '@tiptap/react';
import { Separator } from '../components/common/Separator';
import { canIndentList, canOutdentList, indentList, outdentList } from './extensions/listIndent';

interface FormatControlsProps {
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

/** Formatting controls for the Markdown editor. Renders inline (no own bar);
 * the host toolbar provides the surrounding container. */
export function FormatControls({ editor }: FormatControlsProps): JSX.Element {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  const headingLabel = editor?.isActive('heading', { level: 1 })
    ? 'H1'
    : editor?.isActive('heading', { level: 2 })
      ? 'H2'
      : editor?.isActive('heading', { level: 3 })
        ? 'H3'
        : 'Text';

  const openLinkDialog = (): void => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(previous ?? '');
    setLinkOpen(true);
  };

  const applyLink = (): void => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  const disabled = !editor;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <ActionMenu>
        <ActionMenu.Button
          trailingVisual={TriangleDownIcon}
          leadingVisual={HeadingIcon}
          variant="invisible"
          disabled={disabled}
          data-testid="heading-menu"
          onMouseDown={(event) => event.preventDefault()}
        >
          {headingLabel}
        </ActionMenu.Button>
        <ActionMenu.Overlay width="small">
          <ActionList selectionVariant="single">
            <ActionList.Item
              selected={editor?.isActive('paragraph')}
              data-testid="heading-opt-text"
              onSelect={() => editor?.chain().focus().setParagraph().run()}
            >
              Body text
            </ActionList.Item>
            {[1, 2, 3].map((level) => (
              <ActionList.Item
                key={level}
                selected={editor?.isActive('heading', { level })}
                data-testid={`heading-opt-${level}`}
                onSelect={() =>
                  editor
                    ?.chain()
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

      <Separator />

      <ToolbarButton
        icon={BoldIcon}
        label="Bold"
        testid="fmt-bold"
        disabled={disabled}
        active={editor?.isActive('bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic"
        testid="fmt-italic"
        disabled={disabled}
        active={editor?.isActive('italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={CodeIcon}
        label="Inline code"
        testid="fmt-code"
        disabled={disabled}
        active={editor?.isActive('code')}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        icon={LinkIcon}
        label="Link"
        testid="fmt-link"
        disabled={disabled}
        active={editor?.isActive('link')}
        onClick={openLinkDialog}
      />

      <Separator />

      <ToolbarButton
        icon={ListUnorderedIcon}
        label="Bulleted list"
        testid="fmt-bullet"
        disabled={disabled}
        active={editor?.isActive('bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrderedIcon}
        label="Numbered list"
        testid="fmt-ordered"
        disabled={disabled}
        active={editor?.isActive('orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={TasklistIcon}
        label="Task list"
        testid="fmt-task"
        disabled={disabled}
        active={editor?.isActive('taskList')}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      />
      <ToolbarButton
        icon={ChevronLeftIcon}
        label="Decrease indent"
        testid="fmt-outdent"
        disabled={disabled || !editor || !canOutdentList(editor)}
        onClick={() => editor && outdentList(editor)}
      />
      <ToolbarButton
        icon={ChevronRightIcon}
        label="Increase indent"
        testid="fmt-indent"
        disabled={disabled || !editor || !canIndentList(editor)}
        onClick={() => editor && indentList(editor)}
      />

      <Separator />

      <ToolbarButton
        icon={QuoteIcon}
        label="Quote"
        testid="fmt-quote"
        disabled={disabled}
        active={editor?.isActive('blockquote')}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={FileCodeIcon}
        label="Code block"
        testid="fmt-codeblock"
        disabled={disabled}
        active={editor?.isActive('codeBlock')}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        icon={TableIcon}
        label="Insert table"
        testid="fmt-table"
        disabled={disabled}
        onClick={() =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />

      {linkOpen && (
        <Dialog title="Add link" onClose={() => setLinkOpen(false)} data-testid="link-dialog">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextInput
              ref={linkInputRef}
              aria-label="Link URL"
              data-testid="link-url"
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
