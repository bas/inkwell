import { useCallback, useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Box, Button, Text, Textarea } from '@primer/react';
import { getCurrentMermaidColorMode, renderMermaidSvg } from '../mermaidRenderer';

type PreviewState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string };

function getNodeCode(props: NodeViewProps): string {
  const value = props.node.attrs['code'] as unknown;
  return typeof value === 'string' ? value : '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function useColorModeSignal(): 'light' | 'dark' {
  const [mode, setMode] = useState(getCurrentMermaidColorMode);

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(getCurrentMermaidColorMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode'],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function useMermaidPreview(code: string): PreviewState {
  const mode = useColorModeSignal();
  const [preview, setPreview] = useState<PreviewState>(() =>
    code.trim() === '' ? { status: 'empty' } : { status: 'loading' },
  );

  useEffect(() => {
    if (code.trim() === '') {
      setPreview({ status: 'empty' });
      return;
    }

    let active = true;
    setPreview({ status: 'loading' });
    renderMermaidSvg(code, mode)
      .then((svg) => {
        if (active) setPreview({ status: 'ready', svg });
      })
      .catch((error: unknown) => {
        if (active) setPreview({ status: 'error', message: getErrorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [code, mode]);

  return preview;
}

function Preview({ preview }: { preview: PreviewState }): JSX.Element {
  if (preview.status === 'empty') {
    return (
      <Box className="ink-mermaid-empty" data-testid="mermaid-empty">
        <Text sx={{ color: 'fg.muted', fontSize: 1 }}>Add Mermaid source to render a diagram.</Text>
      </Box>
    );
  }

  if (preview.status === 'loading') {
    return (
      <Box className="ink-mermaid-empty" data-testid="mermaid-loading">
        <Text sx={{ color: 'fg.muted', fontSize: 1 }}>Rendering diagram…</Text>
      </Box>
    );
  }

  if (preview.status === 'error') {
    return (
      <Box className="ink-mermaid-error" data-testid="mermaid-error" role="status">
        <Text sx={{ color: 'danger.fg', fontSize: 1 }}>{preview.message}</Text>
      </Box>
    );
  }

  return (
    <Box
      className="ink-mermaid-svg"
      data-testid="mermaid-preview"
      dangerouslySetInnerHTML={{ __html: preview.svg }}
    />
  );
}

export function MermaidBlockView(props: NodeViewProps): JSX.Element {
  const initialCode = getNodeCode(props);
  const [editing, setEditing] = useState(initialCode.trim() === '');
  const [draft, setDraft] = useState(initialCode);
  const preview = useMermaidPreview(editing ? draft : initialCode);

  useEffect(() => {
    if (!editing) setDraft(initialCode);
  }, [editing, initialCode]);

  const canEdit = props.editor.isEditable;

  const startEditing = useCallback((): void => {
    if (canEdit) setEditing(true);
  }, [canEdit]);

  const commit = useCallback((): void => {
    props.updateAttributes({ code: draft });
    setEditing(false);
  }, [draft, props]);

  const cancel = useCallback((): void => {
    setDraft(initialCode);
    setEditing(false);
  }, [initialCode]);

  const selectedClass = props.selected ? ' is-selected' : '';

  const previewLabel = useMemo(
    () => (initialCode.trim() === '' ? 'Empty Mermaid diagram' : 'Mermaid diagram'),
    [initialCode],
  );

  return (
    <NodeViewWrapper
      as="section"
      className={`ink-mermaid-block${selectedClass}`}
      data-testid="mermaid-block"
      contentEditable={false}
      aria-label={previewLabel}
      onDoubleClick={startEditing}
    >
      {editing ? (
        <Box className="ink-mermaid-editor" data-testid="mermaid-inline-editor">
          <Textarea
            aria-label="Mermaid diagram source"
            data-testid="mermaid-source-editor"
            value={draft}
            placeholder={'flowchart LR\n  A[Start] --> B[End]'}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                commit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            }}
            sx={{
              width: '100%',
              '& textarea': {
                fontFamily: 'mono',
                fontSize: 1,
                minHeight: 120,
                resize: 'vertical',
              },
            }}
          />
          <Box className="ink-mermaid-preview-panel" aria-live="polite">
            <Preview preview={preview} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button type="button" onClick={cancel} data-testid="mermaid-cancel">
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={commit} data-testid="mermaid-done">
              Done
            </Button>
          </Box>
        </Box>
      ) : (
        <Box className="ink-mermaid-preview-shell">
          <Box className="ink-mermaid-preview-panel">
            <Preview preview={preview} />
          </Box>
          {canEdit && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                size="small"
                variant="invisible"
                onClick={startEditing}
                data-testid="mermaid-edit"
              >
                Edit diagram
              </Button>
            </Box>
          )}
        </Box>
      )}
    </NodeViewWrapper>
  );
}
