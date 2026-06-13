import { useState } from 'react';
import { Box, Button, Text, Spinner, IconButton } from '@primer/react';
import { PlusIcon, GearIcon } from '@primer/octicons-react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
import { SearchBar } from './SearchBar';
import { LabelFilter } from './LabelFilter';
import { NoteList } from './NoteList';
import { LabelManagerDialog } from '../labels/LabelManagerDialog';

interface SidebarProps {
  summaries: NoteSummary[];
  labels: Label[];
  selectedId: string | undefined;
  query: string;
  labelFilter: string | undefined;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onLabelFilterChange: (value: string | undefined) => void;
  onSelect: (id: string) => void;
  onCreateNote: () => void;
  onLabelsChanged: () => void;
}

export function Sidebar({
  summaries,
  labels,
  selectedId,
  query,
  labelFilter,
  loading,
  onQueryChange,
  onLabelFilterChange,
  onSelect,
  onCreateNote,
  onLabelsChanged,
}: SidebarProps): JSX.Element {
  const [managingLabels, setManagingLabels] = useState(false);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'border.default',
        }}
      >
        <Button
          leadingVisual={PlusIcon}
          variant="primary"
          onClick={onCreateNote}
          data-testid="new-note-button"
          sx={{ width: '100%' }}
        >
          New note
        </Button>
        <SearchBar value={query} onChange={onQueryChange} />
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <LabelFilter labels={labels} selected={labelFilter} onSelect={onLabelFilterChange} />
          </Box>
          <IconButton
            icon={GearIcon}
            aria-label="Manage labels"
            data-testid="manage-labels"
            onClick={() => setManagingLabels(true)}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }} data-testid="note-list-scroll">
        {loading && summaries.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Spinner size="small" />
          </Box>
        ) : summaries.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
              {query || labelFilter ? 'No matching notes.' : 'No notes yet. Create one to start.'}
            </Text>
          </Box>
        ) : (
          <NoteList
            summaries={summaries}
            labels={labels}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </Box>

      {managingLabels && (
        <LabelManagerDialog
          labels={labels}
          onClose={() => setManagingLabels(false)}
          onChanged={onLabelsChanged}
        />
      )}
    </Box>
  );
}
