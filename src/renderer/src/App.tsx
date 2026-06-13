import { ThemeProvider, BaseStyles, PageLayout, Heading, Box, Flash } from '@primer/react';
import type { ColorModePreference } from '@shared/types';
import { useColorMode, toPrimerColorMode } from './hooks/useColorMode';
import { useNotes } from './state/useNotes';
import { ThemeToggle } from './components/ThemeToggle';
import { Sidebar } from './components/sidebar/Sidebar';
import { EditorPane } from './components/editor/EditorPane';

export function App(): JSX.Element {
  const { preference, loaded, setPreference } = useColorMode();
  const notes = useNotes();

  return (
    <ThemeProvider colorMode={toPrimerColorMode(preference)}>
      <BaseStyles>
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Box
            as="header"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'border.default',
            }}
          >
            <Heading as="h1" sx={{ fontSize: 2 }}>
              Inkwell
            </Heading>
            <ThemeToggle
              key={loaded ? preference : 'loading'}
              preference={preference}
              onChange={(mode: ColorModePreference) => setPreference(mode)}
            />
          </Box>

          {notes.error && (
            <Box sx={{ px: 3, pt: 2 }}>
              <Flash variant="danger" data-testid="app-error">
                {notes.error}
              </Flash>
            </Box>
          )}

          <PageLayout containerWidth="full" padding="none" sx={{ flex: 1, minHeight: 0 }}>
            <PageLayout.Pane position="start" divider="line" width="medium" resizable>
              <Sidebar
                summaries={notes.summaries}
                labels={notes.labels}
                selectedId={notes.selectedId}
                query={notes.query}
                labelFilter={notes.labelFilter}
                loading={notes.loading}
                onQueryChange={notes.setQuery}
                onLabelFilterChange={notes.setLabelFilter}
                onSelect={notes.select}
                onCreateNote={() => void notes.createNote()}
              />
            </PageLayout.Pane>
            <PageLayout.Content>
              <EditorPane
                noteId={notes.selectedId}
                labels={notes.labels}
                onAfterChange={() => void notes.refresh()}
                onAfterDelete={() => {
                  notes.select(undefined);
                  void notes.refresh();
                }}
              />
            </PageLayout.Content>
          </PageLayout>
        </Box>
      </BaseStyles>
    </ThemeProvider>
  );
}
