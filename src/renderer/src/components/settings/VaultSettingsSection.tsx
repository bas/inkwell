import { useEffect, useState } from 'react';
import { Box, Button, Flash, Heading, Text } from '@primer/react';

/**
 * The Settings → Notes vault section. Shows the folder Inkwell reads and writes
 * notes from, and lets the user point Inkwell at a different folder. Changing the
 * location relaunches the app (handled in main) and never moves existing notes.
 */
export function VaultSettingsSection(): JSX.Element {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api
      .getVaultPath()
      .then((path) => {
        if (!cancelled) setVaultPath(path);
      })
      .catch(() => {
        if (!cancelled) setVaultPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.chooseVaultLocation();
      // On success the app relaunches, so we won't render again. If it didn't
      // change (cancelled), just drop the busy state.
      if (!result.changed) setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Box as="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Heading as="h2" sx={{ fontSize: 2 }}>
          Notes vault
        </Heading>
        <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 1, mt: 1 }}>
          Inkwell stores every note as a Markdown file in this folder.
        </Text>
      </Box>

      {error && (
        <Flash variant="danger" data-testid="vault-error">
          {error}
        </Flash>
      )}

      <Box
        sx={{
          borderColor: 'border.default',
          borderStyle: 'solid',
          borderWidth: 1,
          borderRadius: 2,
          bg: 'canvas.subtle',
          px: 3,
          py: 2,
        }}
      >
        <Text
          data-testid="vault-current-path"
          sx={{
            display: 'block',
            fontFamily: 'mono',
            fontSize: 1,
            color: vaultPath ? 'fg.default' : 'fg.muted',
            wordBreak: 'break-all',
          }}
        >
          {vaultPath ?? 'Loading…'}
        </Text>
      </Box>

      <Box>
        <Button
          onClick={() => void handleChange()}
          disabled={busy || vaultPath === null}
          data-testid="vault-change-location"
        >
          Change vault location…
        </Button>
      </Box>

      <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 0 }}>
        Choosing a new folder restarts Inkwell so it can reopen your notes there. Existing notes are
        not moved — copy your Markdown files over first if you want to keep them.
      </Text>
    </Box>
  );
}
