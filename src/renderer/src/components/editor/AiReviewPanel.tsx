import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Flash,
  FormControl,
  Label,
  Spinner,
  Text,
  Textarea,
} from '@primer/react';
import { CheckIcon, SyncIcon, XIcon } from '@primer/octicons-react';
import {
  CheckCircleFillIcon,
  XCircleFillIcon,
  AlertIcon,
  DotFillIcon,
} from '@primer/octicons-react';
import type { AiReviewCategory, AiReviewSeverity } from '@shared/ai';
import type {
  AiReviewState,
  AiSuggestionStatus,
  UiReviewSuggestion,
} from '../../state/useAiReview';

interface AiReviewPanelProps {
  state: AiReviewState;
  noteTitle: string;
  applyingId: string | undefined;
  batchApplying: boolean;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
  onApplyBatch: (ids: string[]) => void;
  onRefine: (instruction: string) => void;
}

const SEVERITY_VARIANT: Record<AiReviewSeverity, 'danger' | 'attention' | 'accent'> = {
  high: 'danger',
  medium: 'attention',
  low: 'accent',
};

const STATUS_VARIANT: Record<
  AiSuggestionStatus,
  'default' | 'success' | 'secondary' | 'attention'
> = {
  pending: 'default',
  applied: 'success',
  rejected: 'secondary',
  outdated: 'attention',
};

const STATUS_LABEL: Record<AiSuggestionStatus, string> = {
  pending: 'Pending',
  applied: 'Applied',
  rejected: 'Rejected',
  outdated: 'Outdated',
};

const STATUS_ICON_COLOR: Record<AiSuggestionStatus, string> = {
  pending: 'fg.muted',
  applied: 'success.fg',
  rejected: 'fg.muted',
  outdated: 'attention.fg',
};

function StatusIcon({ status }: { status: AiSuggestionStatus }): JSX.Element {
  const Icon =
    status === 'applied'
      ? CheckCircleFillIcon
      : status === 'rejected'
        ? XCircleFillIcon
        : status === 'outdated'
          ? AlertIcon
          : DotFillIcon;
  return (
    <Box sx={{ color: STATUS_ICON_COLOR[status], display: 'flex', mt: 1 }} aria-hidden>
      <Icon size={14} />
    </Box>
  );
}

function categoryLabel(category: AiReviewCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Render a simple before/after block diff using Primer tokens only. */
function SuggestionDiff({ suggestion }: { suggestion: UiReviewSuggestion }): JSX.Element {
  const beforeLines = (suggestion.target.before ?? '').split('\n').filter((l) => l.length > 0);
  const afterLines = suggestion.replacement.split('\n');
  return (
    <Box
      data-testid="review-diff"
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        overflow: 'hidden',
        fontFamily: 'mono',
        fontSize: 0,
      }}
    >
      {beforeLines.length > 0 ? (
        beforeLines.map((line, i) => (
          <Box
            key={`before-${i}`}
            sx={{ px: 2, py: 1, bg: 'danger.subtle', color: 'fg.default', whiteSpace: 'pre-wrap' }}
          >
            {`- ${line}`}
          </Box>
        ))
      ) : (
        <Box sx={{ px: 2, py: 1, bg: 'canvas.subtle', color: 'fg.muted' }}>
          {`Lines ${suggestion.target.startLine}–${suggestion.target.endLine}`}
        </Box>
      )}
      {afterLines.map((line, i) => (
        <Box
          key={`after-${i}`}
          sx={{ px: 2, py: 1, bg: 'success.subtle', color: 'fg.default', whiteSpace: 'pre-wrap' }}
        >
          {`+ ${line}`}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Interactive AI review panel: a suggestions list with status, a detail pane
 * with diff + apply/reject controls, multi-select batch apply, and a scoped
 * refinement prompt. All Copilot/Node work happens in main; this is declarative.
 */
export function AiReviewPanel({
  state,
  noteTitle,
  applyingId,
  batchApplying,
  onClose,
  onCancel,
  onRetry,
  onSelect,
  onApply,
  onReject,
  onApplyBatch,
  onRefine,
}: AiReviewPanelProps): JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState('');

  const selected = useMemo(
    () => state.suggestions.find((s) => s.id === state.selectedSuggestionId),
    [state.suggestions, state.selectedSuggestionId],
  );

  // Show unresolved suggestions first; resolved ones sink to the bottom so the
  // active work is always at the top without losing the reviewed history.
  const orderedSuggestions = useMemo(() => {
    const indexed = state.suggestions.map((s, i) => ({ s, i }));
    return indexed
      .sort((a, b) => {
        const ap = a.s.status === 'pending' ? 0 : 1;
        const bp = b.s.status === 'pending' ? 0 : 1;
        return ap - bp || a.i - b.i;
      })
      .map((entry) => entry.s);
  }, [state.suggestions]);

  const pendingCount = useMemo(
    () => state.suggestions.filter((s) => s.status === 'pending').length,
    [state.suggestions],
  );
  const resolvedCount = state.suggestions.length - pendingCount;

  const pendingCheckedIds = useMemo(
    () =>
      state.suggestions.filter((s) => s.status === 'pending' && checked.has(s.id)).map((s) => s.id),
    [state.suggestions, checked],
  );

  const toggleChecked = (id: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const subtitle = noteTitle.trim() || 'Untitled';

  const renderBody = (): JSX.Element => {
    if (state.status === 'reviewing') {
      return (
        <Box
          data-testid="review-loading"
          sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}
        >
          <Spinner size="small" />
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Reviewing note…</Text>
        </Box>
      );
    }

    if (state.status === 'error') {
      return (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Flash variant="danger" data-testid="review-error">
            {state.error}
          </Flash>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button leadingVisual={SyncIcon} onClick={onRetry} data-testid="review-retry">
              Try again
            </Button>
          </Box>
        </Box>
      );
    }

    if (state.status === 'done' && state.suggestions.length === 0) {
      return (
        <Box sx={{ p: 3 }} data-testid="review-empty">
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
            {state.summary || 'No suggestions — this note looks good.'}
          </Text>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 2,
            boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
          }}
        >
          {state.summary ? (
            <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="review-summary">
              {state.summary}
            </Text>
          ) : (
            <Box />
          )}
          <Text
            sx={{ fontSize: 0, color: 'fg.muted', whiteSpace: 'nowrap', flexShrink: 0 }}
            data-testid="review-progress"
          >
            {pendingCount > 0
              ? `${pendingCount} pending · ${resolvedCount} reviewed`
              : `All ${state.suggestions.length} reviewed`}
          </Text>
        </Box>
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Suggestions list */}
          <Box
            sx={{
              width: 240,
              flexShrink: 0,
              overflowY: 'auto',
              boxShadow: 'inset -1px 0 0 0 var(--borderColor-default)',
            }}
            data-testid="review-list"
          >
            {orderedSuggestions.map((s) => {
              const resolved = s.status !== 'pending';
              return (
                <Box
                  key={s.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    px: 2,
                    py: 2,
                    cursor: 'pointer',
                    opacity: resolved ? 0.55 : 1,
                    bg: s.id === state.selectedSuggestionId ? 'accent.subtle' : 'transparent',
                    boxShadow: 'inset 0 -1px 0 0 var(--borderColor-muted)',
                  }}
                  data-testid={`review-item-${s.id}`}
                  onClick={() => onSelect(s.id)}
                >
                  {resolved ? (
                    <StatusIcon status={s.status} />
                  ) : (
                    <Box
                      as="input"
                      type="checkbox"
                      aria-label={`Select ${s.title}`}
                      data-testid={`review-check-${s.id}`}
                      checked={checked.has(s.id)}
                      onClick={(event: React.MouseEvent) => event.stopPropagation()}
                      onChange={() => toggleChecked(s.id)}
                      sx={{ mt: 1 }}
                    />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Text
                      sx={{
                        fontSize: 1,
                        fontWeight: 'bold',
                        display: 'block',
                        textDecoration: resolved ? 'line-through' : 'none',
                        color: resolved ? 'fg.muted' : 'fg.default',
                      }}
                    >
                      {s.title}
                    </Text>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Label size="small" variant={SEVERITY_VARIANT[s.severity]}>
                        {categoryLabel(s.category)}
                      </Label>
                      <Label
                        size="small"
                        variant={STATUS_VARIANT[s.status]}
                        data-testid={`review-status-${s.id}`}
                      >
                        {STATUS_LABEL[s.status]}
                      </Label>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Detail pane */}
          <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: 3 }} data-testid="review-detail">
            {selected ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <Text sx={{ fontSize: 2, fontWeight: 'bold', display: 'block' }}>
                    {selected.title}
                  </Text>
                  <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>
                    {selected.rationale}
                  </Text>
                </Box>
                <SuggestionDiff suggestion={selected} />
                {selected.status === 'pending' ? (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="primary"
                      leadingVisual={CheckIcon}
                      disabled={applyingId === selected.id}
                      onClick={() => onApply(selected.id)}
                      data-testid="review-apply"
                    >
                      {applyingId === selected.id ? 'Applying…' : 'Apply'}
                    </Button>
                    <Button
                      leadingVisual={XIcon}
                      disabled={applyingId === selected.id}
                      onClick={() => onReject(selected.id)}
                      data-testid="review-reject"
                    >
                      Reject
                    </Button>
                  </Box>
                ) : selected.status === 'outdated' ? (
                  <Flash variant="warning" data-testid="review-outdated">
                    This suggestion no longer matches the note. Re-run review to refresh it.
                  </Flash>
                ) : (
                  <Box
                    data-testid="review-resolved"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      color: selected.status === 'applied' ? 'success.fg' : 'fg.muted',
                      fontSize: 1,
                    }}
                  >
                    <StatusIcon status={selected.status} />
                    <Text>
                      {selected.status === 'applied'
                        ? 'Applied to your note.'
                        : 'Rejected — your note is unchanged.'}
                    </Text>
                  </Box>
                )}
                <Box
                  as="form"
                  onSubmit={(event: React.FormEvent) => {
                    event.preventDefault();
                    const trimmed = instruction.trim();
                    if (!trimmed) return;
                    onRefine(trimmed);
                    setInstruction('');
                  }}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    mt: 2,
                    pt: 3,
                    boxShadow: 'inset 0 1px 0 0 var(--borderColor-default)',
                  }}
                >
                  <FormControl>
                    <FormControl.Label>Refine this finding</FormControl.Label>
                    <Textarea
                      value={instruction}
                      onChange={(event) => setInstruction(event.target.value)}
                      placeholder="e.g. only fix grammar, keep my tone"
                      rows={2}
                      data-testid="review-refine-input"
                      sx={{ width: '100%' }}
                    />
                  </FormControl>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      leadingVisual={SyncIcon}
                      disabled={!instruction.trim()}
                      data-testid="review-refine-submit"
                    >
                      Regenerate
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Select a suggestion to review it.</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog title="Review with Copilot" subtitle={subtitle} onClose={onClose} width="xlarge">
      <Box
        data-testid="ai-review-dialog"
        sx={{ display: 'flex', flexDirection: 'column', height: 460, minHeight: 0 }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{renderBody()}</Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 2,
            boxShadow: 'inset 0 1px 0 0 var(--borderColor-default)',
          }}
        >
          <Button
            disabled={pendingCheckedIds.length === 0 || batchApplying}
            onClick={() => onApplyBatch(pendingCheckedIds)}
            data-testid="review-apply-batch"
          >
            {batchApplying ? 'Applying…' : `Apply selected (${pendingCheckedIds.length})`}
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {state.status === 'reviewing' && (
              <Button leadingVisual={XIcon} onClick={onCancel} data-testid="review-cancel">
                Stop
              </Button>
            )}
            <Button variant="primary" onClick={onClose} data-testid="review-close">
              Close
            </Button>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
