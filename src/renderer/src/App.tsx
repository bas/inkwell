import { ThemeProvider, BaseStyles, PageLayout, Heading, Text, Box } from '@primer/react';
import type { ColorModePreference } from '@shared/types';
import { useColorMode, toPrimerColorMode } from './hooks/useColorMode';
import { ThemeToggle } from './components/ThemeToggle';

export function App(): JSX.Element {
  const { preference, loaded, setPreference } = useColorMode();

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

          <PageLayout containerWidth="full" padding="none" sx={{ flex: 1, minHeight: 0 }}>
            <PageLayout.Pane position="start" divider="line" width="medium" resizable>
              <Box sx={{ p: 3 }} data-testid="sidebar-placeholder">
                <Text sx={{ color: 'fg.muted' }}>Notes list (coming next)</Text>
              </Box>
            </PageLayout.Pane>
            <PageLayout.Content>
              <Box
                sx={{
                  p: 4,
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-testid="editor-placeholder"
              >
                <Text sx={{ color: 'fg.muted' }}>Select or create a note to start writing.</Text>
              </Box>
            </PageLayout.Content>
          </PageLayout>
        </Box>
      </BaseStyles>
    </ThemeProvider>
  );
}
