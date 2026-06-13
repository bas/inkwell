import { useState } from 'react';
import { Box, Button, Spinner, IconButton } from '@primer/react';
import { Blankslate } from '@primer/react/experimental';
import { PlusIcon, GearIcon, SearchIcon, NoteIcon } from '@primer/octicons-react';
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
          bg: 'canvas.subtle',
          boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
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
            <Spinner size="small" aria-label="Loading notes" />
          </Box>
        ) : summaries.length === 0 ? (
          <Blankslate spacious={false} narrow>
            <Blankslate.Visual>
              {query || labelFilter ? <SearchIcon size="medium" /> : <NoteIcon size="medium" />}
            </Blankslate.Visual>
            <Blankslate.Heading as="h3">
              {query || labelFilter ? 'No matching notes' : 'No notes yet'}
            </Blankslate.Heading>
            <Blankslate.Description>
              {query || labelFilter
                ? 'Try a different search or label filter.'
                : 'Create your first note to start writing.'}
            </Blankslate.Description>
            {!query && !labelFilter && (
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
