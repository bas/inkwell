import { useMemo, useState } from 'react';
import { Box, Button, Flash, Heading, IconButton, Label, Spinner, Text } from '@primer/react';
import { CheckIcon, SparkleFillIcon, SyncIcon, UndoIcon, XIcon } from '@primer/octicons-react';
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XCircleFillIcon,
  AlertIcon,
  DotFillIcon,
} from '@primer/octicons-react';
import type { AiFixCategory, AiReviewSeverity } from '@shared/ai';
import type { AiFixState, AiFixSuggestionStatus, UiFixSuggestion } from '../../state/useAiFix';

interface AiFixPanelProps {
  state: AiFixState;
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
  onUndo?: () => void;
  undoing?: boolean;
}

const SEVERITY_VARIANT: Record<AiReviewSeverity, 'danger' | 'attention' | 'accent'> = {
  high: 'danger',
  medium: 'attention',
  low: 'accent',
};

const STATUS_VARIANT: Record<
  AiFixSuggestionStatus,
  'default' | 'success' | 'secondary' | 'attention'
> = {
  pending: 'default',
  applied: 'success',
  rejected: 'secondary',
  outdated: 'attention',
};

const STATUS_LABEL: Record<AiFixSuggestionStatus, string> = {
  pending: 'Pending',
  applied: 'Applied',
  rejected: 'Rejected',
  outdated: 'Outdated',
};

const STATUS_ICON_COLOR: Record<AiFixSuggestionStatus, string> = {
  pending: 'fg.muted',
  applied: 'success.fg',
  rejected: 'fg.muted',
  outdated: 'attention.fg',
};

const CATEGORY_LABEL: Record<AiFixCategory, string> = {
  spelling: 'Spelling',
  capitalization: 'Capitalization',
  formatting: 'Formatting',
  label: 'Label',
  other: 'Other',
};

function StatusIcon({ status }: { status: AiFixSuggestionStatus }): JSX.Element {
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

/** Render a before/after block diff for body suggestions using Primer tokens only. */
function SuggestionDiff({ suggestion }: { suggestion: UiFixSuggestion }): JSX.Element | null {
  if (!suggestion.target || typeof suggestion.replacement !== 'string') return null;
  const beforeLines = (suggestion.target.before ?? '').split('\n').filter((l) => l.length > 0);
  const afterLines = suggestion.replacement.split('\n');
  return (
    <Box
      data-testid="fix-diff"
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

/** Preview for a label suggestion (no body diff). */
function LabelPreview({ suggestion }: { suggestion: UiFixSuggestion }): JSX.Element {
  return (
    <Box data-testid="fix-label-preview" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Suggested label:</Text>
      <Label variant="accent">{suggestion.label}</Label>
    </Box>
  );
}

/**
 * "Tidy up with Copilot" suggestions panel. Low-risk spelling/capitalization
 * edits are applied automatically before this opens; the panel surfaces the
 * remaining formatting, label, and other suggestions for review. Declarative —
 * all Copilot/Node work happens in main.
 */
export function AiFixPanel({
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
  onUndo,
  undoing,
}: AiFixPanelProps): JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(new Set());

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

  const subtitle = noteTitle.trim() || 'Start writing';

  const autoBanner =
    state.autoAppliedCount > 0 ? (
      <Flash variant="success" data-testid="fix-auto-applied">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Text>
            {`Applied ${state.autoAppliedCount} low-risk ${
              state.autoAppliedCount === 1 ? 'fix' : 'fixes'
            } automatically.`}
          </Text>
          {onUndo ? (
            <Button
              size="small"
              leadingVisual={UndoIcon}
              disabled={undoing}
              onClick={onUndo}
              data-testid="fix-undo"
            >
              {undoing ? 'Undoing…' : 'Undo'}
            </Button>
          ) : null}
        </Box>
      </Flash>
    ) : null;

  const renderBody = (): JSX.Element => {
    if (state.status === 'tidying') {
      return (
        <Box data-testid="fix-loading" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
          <Spinner size="small" />
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Tidying note…</Text>
        </Box>
      );
    }

    if (state.status === 'error') {
      return (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Flash variant="danger" data-testid="fix-error">
            {state.error}
          </Flash>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button leadingVisual={SyncIcon} onClick={onRetry} data-testid="fix-retry">
              Try again
            </Button>
          </Box>
        </Box>
      );
    }

    if (state.status === 'done' && state.suggestions.length === 0) {
      return (
        <Box
          sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}
          data-testid="fix-empty"
        >
          {autoBanner}
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
            {state.summary || 'Nothing else to tidy — this note looks good.'}
          </Text>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        {autoBanner ? <Box sx={{ px: 3, pt: 3 }}>{autoBanner}</Box> : null}
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
            <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="fix-summary">
              {state.summary}
            </Text>
          ) : (
            <Box />
          )}
          <Text
            sx={{ fontSize: 0, color: 'fg.muted', whiteSpace: 'nowrap', flexShrink: 0 }}
            data-testid="fix-progress"
          >
            {pendingCount > 0
              ? `${pendingCount} pending · ${resolvedCount} reviewed`
              : `All ${state.suggestions.length} reviewed`}
          </Text>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }} data-testid="fix-list">
          {orderedSuggestions.map((s) => {
            const resolved = s.status !== 'pending';
            const expanded = s.id === state.selectedSuggestionId;
            const isLabel = s.category === 'label';
            return (
              <Box
                key={s.id}
                data-testid={`fix-item-${s.id}`}
                sx={{
                  opacity: resolved && !expanded ? 0.55 : 1,
                  boxShadow: 'inset 0 -1px 0 0 var(--borderColor-muted)',
                  bg: expanded ? 'canvas.subtle' : 'transparent',
                }}
              >
                <Box
                  role="button"
                  aria-expanded={expanded}
                  tabIndex={0}
                  onClick={() => onSelect(expanded ? '' : s.id)}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(expanded ? '' : s.id);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    px: 3,
                    py: 2,
                    cursor: 'pointer',
                  }}
                >
                  {resolved ? (
                    <StatusIcon status={s.status} />
                  ) : (
                    <Box
                      as="input"
                      type="checkbox"
                      aria-label={`Select ${s.title}`}
                      data-testid={`fix-check-${s.id}`}
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
                        {CATEGORY_LABEL[s.category]}
                      </Label>
                      <Label
                        size="small"
                        variant={STATUS_VARIANT[s.status]}
                        data-testid={`fix-status-${s.id}`}
                      >
                        {STATUS_LABEL[s.status]}
                      </Label>
                    </Box>
                  </Box>
                  <Box sx={{ color: 'fg.muted', display: 'flex', mt: 1 }} aria-hidden>
                    {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                  </Box>
                </Box>

                {expanded && (
                  <Box
                    data-testid="fix-detail"
                    sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 3, pb: 3, pt: 1 }}
                  >
                    <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{s.rationale}</Text>
                    {isLabel ? <LabelPreview suggestion={s} /> : <SuggestionDiff suggestion={s} />}
                    {s.status === 'pending' ? (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant="primary"
                          leadingVisual={CheckIcon}
                          disabled={applyingId === s.id}
                          onClick={() => onApply(s.id)}
                          data-testid="fix-apply"
                        >
                          {applyingId === s.id ? 'Applying…' : isLabel ? 'Add label' : 'Apply'}
                        </Button>
                        <Button
                          leadingVisual={XIcon}
                          disabled={applyingId === s.id}
                          onClick={() => onReject(s.id)}
                          data-testid="fix-reject"
                        >
                          Reject
                        </Button>
                      </Box>
                    ) : s.status === 'outdated' ? (
                      <Flash variant="warning" data-testid="fix-outdated">
                        This suggestion no longer matches the note. Re-run tidy to refresh it.
                      </Flash>
                    ) : (
                      <Box
                        data-testid="fix-resolved"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          color: s.status === 'applied' ? 'success.fg' : 'fg.muted',
                          fontSize: 1,
                        }}
                      >
                        <StatusIcon status={s.status} />
                        <Text>
                          {s.status === 'applied'
                            ? 'Applied to your note.'
                            : 'Rejected — your note is unchanged.'}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      data-testid="ai-fix-dialog"
      aria-label="Tidy up with Copilot"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        width: 'var(--ink-review-panel-width, 380px)',
        flexShrink: 0,
        bg: 'canvas.default',
        boxShadow: 'inset 1px 0 0 0 var(--borderColor-default)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2,
          bg: 'canvas.subtle',
          boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
        }}
      >
        <Box sx={{ color: 'fg.muted', display: 'flex' }} aria-hidden>
          <SparkleFillIcon size={16} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Heading as="h2" sx={{ fontSize: 1, fontWeight: 'bold' }}>
            Tidy up with Copilot
          </Heading>
          <Text
            sx={{
              fontSize: 0,
              color: 'fg.muted',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </Text>
        </Box>
        <IconButton
          icon={XIcon}
          aria-label="Close tidy"
          variant="invisible"
          onClick={onClose}
          data-testid="fix-close"
        />
      </Box>
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
          data-testid="fix-apply-batch"
        >
          {batchApplying ? 'Applying…' : `Apply selected (${pendingCheckedIds.length})`}
        </Button>
        {state.status === 'tidying' && (
          <Button leadingVisual={XIcon} onClick={onCancel} data-testid="fix-cancel">
            Stop
          </Button>
        )}
      </Box>
    </Box>
  );
}
