import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  ConfirmationDialog,
  Flash,
  FormControl,
  Heading,
  Label,
  Radio,
  RadioGroup,
  Text,
  TextInput,
  Token,
} from '@primer/react';
import type { GitAutoCommitMode } from '@shared/git';
import { useGitBackup } from '../../hooks/useGitBackup';
import { describeSyncState, type GitStatusTone } from './gitStatusView';
import { RemoteSetupDialog } from './RemoteSetupDialog';

const TONE_TO_LABEL_VARIANT: Record<
  GitStatusTone,
  'default' | 'success' | 'attention' | 'danger' | 'accent'
> = {
  neutral: 'default',
  success: 'success',
  attention: 'attention',
  danger: 'danger',
  accent: 'accent',
};

/** The Settings → Backup & Sync section. Self-contained via {@link useGitBackup}. */
export function BackupSettingsSection(): JSX.Element {
  const git = useGitBackup();
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = git.status;
  const settings = status?.settings;
  const gitUnavailable = status?.available.git === false;
  const enabled = settings?.enabled ?? false;
  const remote = settings?.remote;
  const view = status ? describeSyncState(status.syncState, remote !== undefined) : undefined;

  return (
    <Box as="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Heading as="h2" sx={{ fontSize: 2 }}>
            Backup &amp; Sync
          </Heading>
          {view && (
            <Label variant={TONE_TO_LABEL_VARIANT[view.tone]} data-testid="backup-status-pill">
              {view.label}
            </Label>
          )}
        </Box>
        <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 1, mt: 1 }}>
          Keep a local version history of your notes and, optionally, back them up to a GitHub
          repository. Backup is one-way — Inkwell never overwrites your notes with remote changes.
        </Text>
      </Box>

      {git.error && (
        <Flash variant="danger" data-testid="backup-error" onClick={git.clearError}>
          {git.error}
        </Flash>
      )}

      {gitUnavailable && (
        <Flash variant="warning">
          The <Text sx={{ fontFamily: 'mono' }}>git</Text> command was not found. Install Git to use
          version history and backup.
        </Flash>
      )}

      <FormControl disabled={gitUnavailable || git.busy}>
        <Checkbox
          checked={enabled}
          onChange={(event) => void git.setEnabled(event.currentTarget.checked).catch(() => {})}
          data-testid="backup-enabled-toggle"
        />
        <FormControl.Label>Keep version history</FormControl.Label>
        <FormControl.Caption>
          Records a git commit history of your vault so you can recover past versions.
        </FormControl.Caption>
      </FormControl>

      {enabled && settings && (
        <>
          <RadioGroup
            name="backup-auto-commit"
            onChange={(value) =>
              value &&
              void git
                .setAutoCommit(value as GitAutoCommitMode, settings.intervalMinutes)
                .catch(() => {})
            }
          >
            <RadioGroup.Label>When to record changes</RadioGroup.Label>
            <FormControl disabled={git.busy}>
              <Radio value="onSave" checked={settings.autoCommit === 'onSave'} />
              <FormControl.Label>Automatically as I write (recommended)</FormControl.Label>
            </FormControl>
            <FormControl disabled={git.busy}>
              <Radio value="interval" checked={settings.autoCommit === 'interval'} />
              <FormControl.Label>On a timer</FormControl.Label>
            </FormControl>
            <FormControl disabled={git.busy}>
              <Radio value="manual" checked={settings.autoCommit === 'manual'} />
              <FormControl.Label>Only when I choose “Back up now”</FormControl.Label>
            </FormControl>
          </RadioGroup>

          {settings.autoCommit === 'interval' && (
            <FormControl disabled={git.busy}>
              <FormControl.Label>Every (minutes)</FormControl.Label>
              <TextInput
                type="number"
                min={1}
                max={1440}
                value={String(settings.intervalMinutes)}
                onChange={(event) => {
                  const minutes = Number.parseInt(event.currentTarget.value, 10);
                  if (Number.isFinite(minutes))
                    void git.setAutoCommit('interval', minutes).catch(() => {});
                }}
                data-testid="backup-interval-input"
                sx={{ maxWidth: 120 }}
              />
            </FormControl>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              p: 3,
              borderRadius: 2,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'border.default',
            }}
          >
            {remote ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Text sx={{ fontWeight: 'bold' }}>Backup destination</Text>
                  {remote.visibility !== 'unknown' && <Token text={remote.visibility} />}
                </Box>
                <Text
                  sx={{
                    fontFamily: 'mono',
                    fontSize: 1,
                    color: 'fg.muted',
                    wordBreak: 'break-all',
                  }}
                  data-testid="backup-remote-url"
                >
                  {remote.mode === 'gh' && remote.owner
                    ? `${remote.host}/${remote.owner}/${remote.repo}`
                    : remote.remoteUrl}
                </Text>
                {view && <Text sx={{ fontSize: 1, color: 'fg.muted' }}>{view.description}</Text>}
                {status?.ahead !== undefined && status.ahead > 0 && (
                  <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
                    {status.ahead} change{status.ahead === 1 ? '' : 's'} waiting to back up.
                  </Text>
                )}
                <FormControl disabled={git.busy}>
                  <Checkbox
                    checked={remote.autoPush}
                    onChange={(event) =>
                      void git.setAutoPush(event.currentTarget.checked).catch(() => {})
                    }
                    data-testid="backup-autopush-toggle"
                  />
                  <FormControl.Label>Back up automatically after each change</FormControl.Label>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    onClick={() => void git.pushNow().catch(() => {})}
                    disabled={git.busy}
                    data-testid="backup-push-now"
                  >
                    Back up now
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setConfirmRemove(true)}
                    disabled={git.busy}
                    data-testid="backup-remove-remote"
                  >
                    Remove backup
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
                  No backup repository is configured. Your notes and history stay on this Mac.
                </Text>
                <Box>
                  <Button
                    variant="primary"
                    onClick={() => setSetupOpen(true)}
                    disabled={git.busy}
                    data-testid="backup-setup-open"
                  >
                    Set up backup…
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </>
      )}

      {setupOpen && (
        <RemoteSetupDialog
          busy={git.busy}
          error={git.error}
          getDestinations={git.getDestinations}
          checkRepoName={git.checkRepoName}
          onSubmit={async (input) => {
            await git.setupRemote(input);
            setSetupOpen(false);
          }}
          onCancel={() => {
            git.clearError();
            setSetupOpen(false);
          }}
        />
      )}

      {confirmRemove && (
        <ConfirmationDialog
          title="Remove backup?"
          onClose={(gesture) => {
            setConfirmRemove(false);
            if (gesture === 'confirm') void git.removeRemote().catch(() => {});
          }}
          confirmButtonContent="Remove backup"
          confirmButtonType="danger"
        >
          This disconnects the backup repository. Your notes, local history, and the remote
          repository itself are left untouched.
        </ConfirmationDialog>
      )}
    </Box>
  );
}
