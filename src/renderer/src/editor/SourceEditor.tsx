import type { Ref, UIEvent } from 'react';
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
        sx={{
          flex: 'none',
          overflow: 'hidden',
          textAlign: 'right',
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
        {lineNumbers.map((lineNumber) => (
          <div key={lineNumber}>{lineNumber}</div>
        ))}
      </Box>
      <Textarea
        ref={textareaRef}
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
