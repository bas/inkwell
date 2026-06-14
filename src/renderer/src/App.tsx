import { ThemeProvider, BaseStyles, SplitPageLayout, Box, Flash } from '@primer/react';
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
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              pl: 'var(--ink-titlebar-inset)',
              pr: 3,
              py: 2,
              bg: 'canvas.subtle',
              // A filled surface plus a single inset bottom edge reads as a
              // contained bar rather than two floating hairlines.
              boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
            }}
          >
            <Box sx={{ ml: 'auto' }} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <ThemeToggle
                key={loaded ? preference : 'loading'}
                preference={preference}
                onChange={(mode: ColorModePreference) => setPreference(mode)}
              />
            </Box>
          </Box>

          {notes.error && (
            <Box sx={{ px: 3, pt: 2 }}>
              <Flash variant="danger" data-testid="app-error">
                {notes.error}
              </Flash>
            </Box>
          )}

          <SplitPageLayout
            sx={{
              flex: 1,
              minHeight: 0,
              // PageLayout is not a full-height shell by default, so the pane
              // divider would otherwise collapse to content height. Stretch the
              // generated wrapper regions, targeting Primer's stable class
              // prefixes instead of fragile positional `> div > div` selectors.
              '& [class*="PageLayoutWrapper"]': { height: '100%' },
              '& [class*="PageLayoutContent"]': { height: '100%' },
            }}
          >
            <SplitPageLayout.Pane
              position="start"
              divider="line"
              width="medium"
              padding="none"
              resizable
              widthStorageKey="inkwell-sidebar-width"
              aria-label="Notes"
              sx={{ height: '100%' }}
            >
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
                onLabelsChanged={() => {
                  void notes.refreshLabels();
                  void notes.refresh();
                }}
              />
            </SplitPageLayout.Pane>
            <SplitPageLayout.Content padding="none" width="full" sx={{ height: '100%' }}>
              <EditorPane
                noteId={notes.selectedId}
                labels={notes.labels}
                onCreateNote={() => void notes.createNote()}
                onAfterChange={() => void notes.refresh()}
                onLabelsChanged={() => {
                  void notes.refreshLabels();
                  void notes.refresh();
                }}
                onAfterDelete={() => {
                  notes.select(undefined);
                  void notes.refresh();
                }}
              />
            </SplitPageLayout.Content>
          </SplitPageLayout>
        </Box>
      </BaseStyles>
    </ThemeProvider>
  );
}
