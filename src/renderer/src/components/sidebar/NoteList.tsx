import { ActionList, Box, Text } from '@primer/react';
import { PinIcon, PinSlashIcon } from '@primer/octicons-react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { LabelChip } from '../common/LabelChip';
import { relativeTime } from '../../utils/relativeTime';
import {
  groupNotesByDate,
  groupNotesByLabel,
  type GroupBy,
  type NoteGroup,
} from '../../utils/groupNotes';

interface NoteListProps {
  summaries: NoteSummary[];
  labels: Label[];
  selectedId: string | undefined;
  groupBy: GroupBy;
  /** When set, results are shown as one flat list without date/label sections. */
  searching?: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (summary: NoteSummary) => void;
}

// The pin/unpin action stays hidden until the row is hovered or focused, so the
// list reads calmly; pinned notes still show their leading pin icon regardless.
const revealTrailingActionSx = {
  '& [class*="TrailingAction"]': {
    opacity: 0,
    transition: 'opacity 80ms ease-out',
  },
  '&:hover [class*="TrailingAction"], &:focus-within [class*="TrailingAction"]': {
    opacity: 1,
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& [class*="TrailingAction"]': { transition: 'none' },
  },
} as const;

function NoteRow({
  summary,
  colorOf,
  selected,
  showPin,
  hideLabels,
  onSelect,
  onTogglePin,
}: {
  summary: NoteSummary;
  colorOf: (name: string) => string;
  selected: boolean;
  showPin: boolean;
  hideLabels: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (summary: NoteSummary) => void;
}): JSX.Element {
  return (
    <ActionList.Item
      active={selected}
      onSelect={() => onSelect(summary.id)}
      data-testid={`note-item-${summary.id}`}
      sx={revealTrailingActionSx}
    >
      {showPin && (
        <ActionList.LeadingVisual>
          <PinIcon />
        </ActionList.LeadingVisual>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}
        >
          <Text
            data-testid="note-title"
            sx={{
              fontWeight: 'semibold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary.title || 'Start writing'}
          </Text>
          <Text sx={{ fontSize: 0, color: 'fg.muted', flexShrink: 0 }}>
            {relativeTime(summary.updatedAt)}
          </Text>
        </Box>
        {summary.snippet && (
          <Text
            sx={{
              fontSize: 0,
              color: 'fg.muted',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary.snippet}
          </Text>
        )}
        {!hideLabels && summary.labels.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {summary.labels.map((name) => (
              <LabelChip key={name} name={name} color={colorOf(name)} />
            ))}
          </Box>
        )}
      </Box>
      <ActionList.TrailingAction
        icon={summary.pinned ? PinSlashIcon : PinIcon}
        label={summary.pinned ? 'Unpin note' : 'Pin note'}
        data-testid={`toggle-pin-${summary.id}`}
        onClick={(event: React.MouseEvent) => {
          // Keep the row's own onSelect from firing when the action is clicked.
          event.stopPropagation();
          onTogglePin(summary);
        }}
      />
    </ActionList.Item>
  );
}

export function NoteList({
  summaries,
  labels,
  selectedId,
  groupBy,
  searching = false,
  onSelect,
  onTogglePin,
}: NoteListProps): JSX.Element {
  const colorOf = (name: string): string =>
    labels.find((label) => label.name === name)?.color ?? 'default';

  const renderRow = (summary: NoteSummary, showPin: boolean, hideLabels: boolean): JSX.Element => (
    <NoteRow
      key={summary.id}
      summary={summary}
      colorOf={colorOf}
      selected={summary.id === selectedId}
      showPin={showPin}
      hideLabels={hideLabels}
      onSelect={onSelect}
      onTogglePin={onTogglePin}
    />
  );

  // While searching, matches are ranked by relevance, so grouping would only
  // fragment the results. Show them as a single flat list instead.
  if (searching) {
    return (
      <ActionList data-testid="note-list">
        {summaries.map((summary) => renderRow(summary, summary.pinned, false))}
      </ActionList>
    );
  }

  const pinned = summaries.filter((note) => note.pinned);
  const rest = summaries.filter((note) => !note.pinned);
  const hideLabels = groupBy === 'label';
  const groups: NoteGroup[] =
    groupBy === 'label'
      ? groupNotesByLabel(
          rest,
          labels.map((label) => label.name),
        )
      : groupNotesByDate(rest);

  return (
    <ActionList data-testid="note-list">
      {pinned.length > 0 && (
        <ActionList.Group>
          <ActionList.GroupHeading as="h3">Pinned</ActionList.GroupHeading>
          {pinned.map((summary) => renderRow(summary, true, hideLabels))}
        </ActionList.Group>
      )}
      {groups.map((group) => (
        <ActionList.Group key={group.key}>
          <ActionList.GroupHeading as="h3">{group.heading}</ActionList.GroupHeading>
          {group.notes.map((summary) => renderRow(summary, false, hideLabels))}
        </ActionList.Group>
      ))}
    </ActionList>
  );
}
