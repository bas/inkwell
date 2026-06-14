import { useState } from 'react';
import { Box, Button, Dialog, Flash, Spinner, Text } from '@primer/react';
import { CheckIcon, CopyIcon, SyncIcon } from '@primer/octicons-react';
import type { AiSummaryState } from '../../state/useAiSummary';

interface AiSummaryDialogProps {
  state: AiSummaryState;
  noteTitle: string;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Ephemeral, read-only panel that shows a Copilot-generated summary of the
 * current note. Streams text while running, offers Copy when complete, and
 * surfaces typed error states. It never writes back to the note.
 */
export function AiSummaryDialog({
  state,
  noteTitle,
  onClose,
  onRetry,
}: AiSummaryDialogProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await window.api.writeClipboard(state.text.trimEnd() + '\n');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard failures are non-fatal for an ephemeral panel.
    }
  };

  const subtitle = noteTitle.trim() || 'Untitled';

  return (
    <Dialog title="Summary" subtitle={subtitle} onClose={onClose} data-testid="ai-summary-dialog">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 80 }}>
        {state.status === 'error' ? (
          <Flash variant="danger" data-testid="ai-summary-error">
            {state.error}
          </Flash>
        ) : (
          <Box
            data-testid="ai-summary-text"
            className="markdown-body"
            sx={{
              whiteSpace: 'pre-wrap',
              maxHeight: 320,
              overflowY: 'auto',
              fontSize: 1,
              color: 'fg.default',
            }}
          >
            {state.text}
            {state.status === 'streaming' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: state.text ? 2 : 0 }}>
                <Spinner size="small" data-testid="ai-summary-spinner" />
                <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Summarizing…</Text>
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          {state.status === 'error' ? (
            <Button leadingVisual={SyncIcon} onClick={onRetry} data-testid="ai-summary-retry">
              Try again
            </Button>
          ) : (
            <Button
              leadingVisual={copied ? CheckIcon : CopyIcon}
              onClick={() => void handleCopy()}
              disabled={state.status !== 'done' || !state.text}
              data-testid="ai-summary-copy"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button variant="primary" onClick={onClose} data-testid="ai-summary-close">
            Close
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
