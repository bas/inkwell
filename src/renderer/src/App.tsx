import { useEffect, useState } from 'react';
import { ThemeProvider, BaseStyles, SplitPageLayout, Box, Flash, IconButton } from '@primer/react';
import { SidebarCollapseIcon, SidebarExpandIcon, PlusIcon, GearIcon } from '@primer/octicons-react';
import type { ColorModePreference, FeatureKey } from '@shared/types';
import { useAppSettings, toPrimerColorMode } from './hooks/useAppSettings';
import { useNotes } from './state/useNotes';
import { ThemeToggle } from './components/ThemeToggle';
import { Sidebar } from './components/sidebar/Sidebar';
import { EditorPane } from './components/editor/EditorPane';
import { SettingsDialog } from './components/settings/SettingsDialog';

const SIDEBAR_VISIBLE_KEY = 'inkwell-sidebar-visible';
const NARROW_LAYOUT_BREAKPOINT = 768;

export function App(): JSX.Element {
  const {
    settings,
    preference,
    resolvedMode,
    loaded,
    error: settingsError,
    setPreference,
    setFeatureEnabled,
  } = useAppSettings();
  const labelsEnabled = loaded && settings.features.labels;
  const mermaidEnabled = settings.features.mermaid;
  const notes = useNotes();
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < NARROW_LAYOUT_BREAKPOINT;
  });
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [narrowSidebarVisible, setNarrowSidebarVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const effectiveSidebarVisible = isNarrowViewport ? narrowSidebarVisible : sidebarVisible;

  const toggleSidebar = (): void => {
    if (isNarrowViewport) {
      setNarrowSidebarVisible((prev) => !prev);
      return;
    }
    setSidebarVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(next));
      } catch {
        // Ignore persistence failures; visibility still toggles for this session.
      }
      return next;
    });
  };

  useEffect(() => {
    const applyThemeAttrs = (element: HTMLElement): void => {
      element.setAttribute('data-color-mode', resolvedMode);
      element.setAttribute('data-light-theme', 'light');
      element.setAttribute('data-dark-theme', 'dark');
    };
    applyThemeAttrs(document.documentElement);
    applyThemeAttrs(document.body);
  }, [resolvedMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = (): void => {
      setIsNarrowViewport(window.innerWidth < NARROW_LAYOUT_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isNarrowViewport) setNarrowSidebarVisible(false);
  }, [isNarrowViewport]);

  return (
    <ThemeProvider colorMode={toPrimerColorMode(resolvedMode)}>
      <BaseStyles>
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bg: 'canvas.default',
            color: 'fg.default',
          }}
        >
          <Box
            as="header"
            data-testid="app-header"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              pl: 'var(--ink-titlebar-inset)',
              pr: 3,
              // The macOS traffic lights sit near the window top in the
              // `hiddenInset` title bar. A small top padding aligns the first
              // toolbar control's center with the lights' center without
              // pushing it down into a floating position.
              pt: 1,
              pb: 2,
              bg: 'canvas.subtle',
              // A filled surface plus a single inset bottom edge reads as a
              // contained bar rather than two floating hairlines.
              boxShadow: 'inset 0 -1px 0 0 var(--borderColor-default)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                transform: 'translateY(var(--base-size-2))',
              }}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <IconButton
                icon={effectiveSidebarVisible ? SidebarCollapseIcon : SidebarExpandIcon}
                aria-label={effectiveSidebarVisible ? 'Hide notes list' : 'Show notes list'}
                aria-pressed={effectiveSidebarVisible}
                variant="invisible"
                size="small"
                onClick={toggleSidebar}
                data-testid="toggle-sidebar"
              />
              <IconButton
                icon={GearIcon}
                aria-label="Settings"
                variant="invisible"
                size="small"
                data-testid="app-header-menu"
                disabled={!loaded}
                onClick={() => setSettingsOpen(true)}
              />
              <IconButton
                icon={PlusIcon}
                aria-label="New note"
                variant="invisible"
                size="small"
                onClick={() => void notes.createNote()}
                data-testid="new-note-button"
              />
            </Box>
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
              // The inner content region (`PageLayout-ContentWrapper` and its
              // `PageLayout-Content` child) defaults to `min-height: auto`, so a
              // tall note makes it grow past the viewport instead of letting the
              // editor's own scroll container take over — which scrolls the whole
              // pane and hides the toolbar. Bound it to the available height so
              // the editor body scrolls internally and the toolbar stays put.
              '& [class*="PageLayout-Content"]': { height: '100%', minHeight: 0 },
              bg: 'canvas.default',
            }}
          >
            {effectiveSidebarVisible && (
              <SplitPageLayout.Pane
                position={{ regular: 'start', narrow: 'end' }}
                divider="line"
                width="medium"
                padding="none"
                resizable
                widthStorageKey="inkwell-sidebar-width"
                aria-label="Notes"
                sx={{ height: '100%', bg: 'canvas.default' }}
              >
                <Sidebar
                  summaries={notes.summaries}
                  labels={notes.labels}
                  labelsEnabled={labelsEnabled}
                  selectedId={notes.selectedId}
                  query={notes.query}
                  loading={notes.loading}
                  onQueryChange={notes.setQuery}
                  onSelect={notes.select}
                  onCreateNote={() => void notes.createNote()}
                  onTogglePin={(summary) => void notes.togglePin(summary)}
                />
              </SplitPageLayout.Pane>
            )}
            <SplitPageLayout.Content
              padding="none"
              width="full"
              sx={{ height: '100%', bg: 'canvas.default' }}
            >
              <EditorPane
                noteId={notes.selectedId}
                labels={notes.labels}
                labelsEnabled={labelsEnabled}
                mermaidEnabled={mermaidEnabled}
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

        {settingsOpen && (
          <SettingsDialog
            settings={settings}
            labels={notes.labels}
            error={settingsError}
            onClose={() => setSettingsOpen(false)}
            onFeatureChange={(feature: FeatureKey, enabled: boolean) => {
              setFeatureEnabled(feature, enabled);
              if (feature === 'labels' && enabled) void notes.refreshLabels();
            }}
            onLabelsChanged={() => {
              void notes.refreshLabels();
              void notes.refresh();
            }}
          />
        )}
      </BaseStyles>
    </ThemeProvider>
  );
}
