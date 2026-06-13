import { ActionList, Box, Text } from '@primer/react';
import { PinIcon } from '@primer/octicons-react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { LabelChip } from '../common/LabelChip';
import { relativeTime } from '../../utils/relativeTime';

interface NoteListProps {
  summaries: NoteSummary[];
  labels: Label[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

function NoteRow({
  summary,
  colorOf,
  selected,
  onSelect,
}: {
  summary: NoteSummary;
  colorOf: (name: string) => string;
  selected: boolean;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <ActionList.Item
      active={selected}
      onSelect={() => onSelect(summary.id)}
      data-testid={`note-item-${summary.id}`}
    >
      {summary.pinned && (
        <ActionList.LeadingVisual>
          <PinIcon />
        </ActionList.LeadingVisual>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}
        >
          <Text
            sx={{
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary.title || 'Untitled'}
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
        {summary.labels.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {summary.labels.map((name) => (
              <LabelChip key={name} name={name} color={colorOf(name)} />
            ))}
          </Box>
        )}
      </Box>
    </ActionList.Item>
  );
}

export function NoteList({ summaries, labels, selectedId, onSelect }: NoteListProps): JSX.Element {
  const colorOf = (name: string): string =>
    labels.find((label) => label.name === name)?.color ?? 'default';

  const pinned = summaries.filter((note) => note.pinned);
  const others = summaries.filter((note) => !note.pinned);

  return (
    <ActionList showDividers data-testid="note-list">
      {pinned.length > 0 && (
        <ActionList.Group>
          <ActionList.GroupHeading>Pinned</ActionList.GroupHeading>
          {pinned.map((summary) => (
            <NoteRow
              key={summary.id}
              summary={summary}
              colorOf={colorOf}
              selected={summary.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ActionList.Group>
      )}
      {others.length > 0 && (
        <ActionList.Group>
          {pinned.length > 0 && <ActionList.GroupHeading>Notes</ActionList.GroupHeading>}
          {others.map((summary) => (
            <NoteRow
              key={summary.id}
              summary={summary}
              colorOf={colorOf}
              selected={summary.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ActionList.Group>
      )}
    </ActionList>
  );
}
