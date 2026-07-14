import { useEffect, useState } from 'react';
import { Box, Spinner, SegmentedControl } from '@primer/react';
import { Blankslate } from '@primer/react/experimental';
import { SearchIcon, NoteIcon } from '@primer/octicons-react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { SearchBar } from './SearchBar';
import { NoteList } from './NoteList';
import type { GroupBy } from '../../utils/groupNotes';

const GROUP_BY_KEY = 'inkwell-group-by';

function loadGroupBy(): GroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'label' ? 'label' : 'date';
  } catch {
    return 'date';
  }
}

interface SidebarProps {
  summaries: NoteSummary[];
  labels: Label[];
  selectedId: string | undefined;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreateNote: () => void;
  onTogglePin: (summary: NoteSummary) => void;
}

export function Sidebar({
  summaries,
  labels,
  selectedId,
  query,
  loading,
  onQueryChange,
  onSelect,
  onCreateNote,
  onTogglePin,
}: SidebarProps): JSX.Element {
  const [groupBy, setGroupBy] = useState<GroupBy>(loadGroupBy);
  const searching = query.trim().length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_BY_KEY, groupBy);
    } catch {
      // Persistence is best-effort; grouping still works for this session.
    }
  }, [groupBy]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bg: 'canvas.default',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SearchBar value={query} onChange={onQueryChange} />
          </Box>
        </Box>
        <SegmentedControl aria-label="Group notes by" size="small" fullWidth>
          <SegmentedControl.Button
            selected={groupBy === 'date'}
            onClick={() => setGroupBy('date')}
            data-testid="group-by-date"
          >
            Date
          </SegmentedControl.Button>
          <SegmentedControl.Button
            selected={groupBy === 'label'}
            onClick={() => setGroupBy('label')}
            data-testid="group-by-label"
          >
            Labels
          </SegmentedControl.Button>
        </SegmentedControl>
      </Box>

      <Box
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', bg: 'canvas.default' }}
        data-testid="note-list-scroll"
      >
        {loading && summaries.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Spinner size="small" aria-label="Loading notes" />
          </Box>
        ) : summaries.length === 0 ? (
          <Blankslate spacious={false} narrow>
            <Blankslate.Visual>
              {searching ? <SearchIcon size="medium" /> : <NoteIcon size="medium" />}
            </Blankslate.Visual>
            <Blankslate.Heading as="h3">
              {searching ? 'No matching notes' : 'No notes yet'}
            </Blankslate.Heading>
            <Blankslate.Description>
              {searching ? 'Try a different search.' : 'Create your first note to start writing.'}
            </Blankslate.Description>
            {!searching && (
              <Blankslate.PrimaryAction onClick={onCreateNote} data-testid="empty-new-note">
                New note
              </Blankslate.PrimaryAction>
            )}
          </Blankslate>
        ) : (
          <NoteList
            summaries={summaries}
            labels={labels}
            selectedId={selectedId}
            groupBy={groupBy}
            searching={searching}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
          />
        )}
      </Box>
    </Box>
  );
}
