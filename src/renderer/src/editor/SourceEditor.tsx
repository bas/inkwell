import type { Ref } from 'react';
import { Textarea } from '@primer/react';

interface SourceEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/** Raw Markdown source view (toggleable alternative to the WYSIWYG editor). */
export function SourceEditor({ value, onChange, textareaRef }: SourceEditorProps): JSX.Element {
  return (
    <Textarea
      ref={textareaRef}
      aria-label="Markdown source"
      data-testid="source-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{
        height: '100%',
        minHeight: 0,
        width: '100%',
        '& textarea': {
          height: '100%',
          minHeight: 0,
          fontFamily: 'mono',
          fontSize: 1,
          resize: 'none',
          border: 'none',
        },
      }}
      block
      resize="none"
    />
  );
}
