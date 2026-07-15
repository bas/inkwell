import type { Ref, UIEvent, WheelEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { Box, Textarea } from '@primer/react';

interface SourceEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/** Shared typography so the gutter rows line up exactly with the textarea rows. */
const lineMetrics = {
  fontFamily: 'mono',
  fontSize: 1,
  lineHeight: 1.5,
} as const;

/** Raw Markdown source view (toggleable alternative to the WYSIWYG editor). */
export function SourceEditor({ value, onChange, textareaRef }: SourceEditorProps): JSX.Element {
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaNodeRef = useRef<HTMLTextAreaElement | null>(null);

  // Merge the internal textarea ref with any forwarded ref so we can drive
  // scrolling from the gutter while still exposing the node to the parent.
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaNodeRef.current = node;
      if (typeof textareaRef === 'function') {
        textareaRef(node);
      } else if (textareaRef) {
        (textareaRef as { current: HTMLTextAreaElement | null }).current = node;
      }
    },
    [textareaRef],
  );

  const lineNumbers = useMemo(() => {
    const lineCount = value.split('\n').length;
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [value]);

  const handleScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const gutter = gutterRef.current;
    if (gutter) {
      gutter.scrollTop = event.currentTarget.scrollTop;
    }
  }, []);

  // The gutter isn't itself scrollable, so forward wheel deltas over it to the
  // textarea to avoid a non-scrollable "dead zone" on the left.
  const handleGutterWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const textarea = textareaNodeRef.current;
    if (textarea) {
      textarea.scrollTop += event.deltaY;
    }
  }, []);

  return (
    <Box
      data-testid="source-editor-container"
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        width: '100%',
      }}
    >
      <Box
        ref={gutterRef}
        data-testid="source-editor-gutter"
        aria-hidden="true"
        onWheel={handleGutterWheel}
        sx={{
          flex: 'none',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          textAlign: 'right',
          whiteSpace: 'pre',
          userSelect: 'none',
          color: 'fg.muted',
          bg: 'canvas.subtle',
          borderRight: '1px solid',
          borderColor: 'border.default',
          py: 2,
          px: 2,
          ...lineMetrics,
        }}
      >
        {lineNumbers.join('\n')}
      </Box>
      <Textarea
        ref={setTextareaRef}
        aria-label="Markdown source"
        data-testid="source-editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        wrap="off"
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          border: 'none',
          borderRadius: 0,
          p: 0,
          '& textarea': {
            height: '100%',
            minHeight: 0,
            py: 2,
            px: 2,
            whiteSpace: 'pre',
            overflowX: 'auto',
            resize: 'none',
            border: 'none',
            ...lineMetrics,
          },
        }}
        block
        resize="none"
      />
    </Box>
  );
}
