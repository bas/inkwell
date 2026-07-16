import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flash,
  FormControl,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Text,
  TextInput,
} from '@primer/react';
import type {
  GitDestinations,
  GitRemoteSetupInput,
  GitRepoNameCheck,
  GitVisibility,
} from '@shared/git';
import { isValidRemoteUrl, validateRepoName } from '@shared/git';

/** The three ways a user can point Inkwell at a backup repository. */
type SetupMode = 'create' | 'existing' | 'url';

const DEFAULT_REPO_NAME = 'inkwell-notes';
const NAME_CHECK_DEBOUNCE_MS = 500;

interface RemoteSetupDialogProps {
  busy: boolean;
  error?: string;
  getDestinations: () => Promise<GitDestinations>;
  checkRepoName: (
    host: string | undefined,
    owner: string,
    name: string,
  ) => Promise<GitRepoNameCheck>;
  onSubmit: (input: GitRemoteSetupInput) => Promise<unknown>;
  onCancel: () => void;
}

export function RemoteSetupDialog({
  busy,
  error,
  getDestinations,
  checkRepoName,
  onSubmit,
  onCancel,
}: RemoteSetupDialogProps): JSX.Element {
  const [mode, setMode] = useState<SetupMode>('create');
  const [destinations, setDestinations] = useState<GitDestinations | undefined>(undefined);
  const [destinationsError, setDestinationsError] = useState<string | undefined>(undefined);
  const [host, setHost] = useState<string>('');
  const [owner, setOwner] = useState<string>('');
  const [repo, setRepo] = useState<string>(DEFAULT_REPO_NAME);
  const [visibility, setVisibility] = useState<GitVisibility>('private');
  const [acknowledgePublic, setAcknowledgePublic] = useState(false);
  const [autoPush, setAutoPush] = useState(true);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [nameCheck, setNameCheck] = useState<GitRepoNameCheck | undefined>(undefined);
  const [checkingName, setCheckingName] = useState(false);
  const checkSeq = useRef(0);

  useEffect(() => {
    let active = true;
    getDestinations()
      .then((next) => {
        if (!active) return;
        setDestinations(next);
        setHost(next.hosts[0] ?? 'github.com');
        setOwner(next.login ?? next.owners[0] ?? '');
      })
      .catch((err: unknown) => {
        if (active) {
          setDestinationsError(
            err instanceof Error ? err.message : 'Could not load GitHub destinations',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [getDestinations]);

  const validation = useMemo(() => validateRepoName(repo), [repo]);
  const isOrgOwner = destinations?.orgOwners.includes(owner) ?? false;
  const ghReady = (destinations?.owners.length ?? 0) > 0 || destinations?.login !== undefined;

  // Public/internal cannot survive an owner that no longer supports it.
  useEffect(() => {
    if (visibility === 'internal' && !isOrgOwner) setVisibility('private');
  }, [isOrgOwner, visibility]);

  useEffect(() => {
    if (visibility !== 'public') setAcknowledgePublic(false);
  }, [visibility]);

  // Debounced availability check for the create/existing flows.
  useEffect(() => {
    if (mode === 'url' || !owner || !validation.valid) {
      setNameCheck(undefined);
      setCheckingName(false);
      return;
    }
    const seq = ++checkSeq.current;
    setCheckingName(true);
    const timer = setTimeout(() => {
      checkRepoName(host || undefined, owner, validation.normalized)
        .then((result) => {
          if (seq === checkSeq.current) setNameCheck(result);
        })
        .catch(() => {
          if (seq === checkSeq.current) setNameCheck(undefined);
        })
        .finally(() => {
          if (seq === checkSeq.current) setCheckingName(false);
        });
    }, NAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mode, host, owner, validation.valid, validation.normalized, checkRepoName]);

  const urlValid = mode !== 'url' || isValidRemoteUrl(remoteUrl);
  const nameConflict = mode === 'create' && nameCheck !== undefined && !nameCheck.available;
  const existingMissing = mode === 'existing' && nameCheck !== undefined && nameCheck.available;

  const canSubmit = ((): boolean => {
    if (busy) return false;
    if (mode === 'url') return isValidRemoteUrl(remoteUrl);
    if (!ghReady || !owner || !validation.valid) return false;
    if (visibility === 'public' && !acknowledgePublic) return false;
    if (mode === 'create' && nameConflict) return false;
    if (mode === 'existing' && existingMissing) return false;
    return true;
  })();

  const submit = (): void => {
    if (!canSubmit) return;
    const input: GitRemoteSetupInput =
      mode === 'url'
        ? { mode: 'url', remoteUrl: remoteUrl.trim(), autoPush }
        : {
            mode: 'gh',
            ghAction: mode,
            host: host || undefined,
            owner,
            repo: validation.normalized,
            visibility,
            autoPush,
            ...(visibility === 'public' ? { acknowledgePublic } : {}),
          };
    void onSubmit(input);
  };

  return (
    <Dialog title="Set up backup repository" onClose={onCancel}>
      <Box
        data-testid="backup-setup-dialog"
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {(error ?? destinationsError) && (
          <Flash variant="danger" data-testid="backup-setup-error">
            {error ?? destinationsError}
          </Flash>
        )}

        <RadioGroup name="backup-mode" onChange={(value) => value && setMode(value as SetupMode)}>
          <RadioGroup.Label>How do you want to connect a backup?</RadioGroup.Label>
          <FormControl>
            <Radio value="create" checked={mode === 'create'} data-testid="backup-mode-create" />
            <FormControl.Label>Create a new GitHub repository</FormControl.Label>
          </FormControl>
          <FormControl>
            <Radio
              value="existing"
              checked={mode === 'existing'}
              data-testid="backup-mode-existing"
            />
            <FormControl.Label>Use an existing GitHub repository</FormControl.Label>
          </FormControl>
          <FormControl>
            <Radio value="url" checked={mode === 'url'} data-testid="backup-mode-url" />
            <FormControl.Label>Paste a git remote URL</FormControl.Label>
          </FormControl>
        </RadioGroup>

        {mode === 'url' ? (
          <FormControl>
            <FormControl.Label>Remote URL</FormControl.Label>
            <TextInput
              block
              value={remoteUrl}
              placeholder="git@github.com:owner/repo.git"
              onChange={(event) => setRemoteUrl(event.currentTarget.value)}
              data-testid="backup-url-input"
            />
            {!urlValid && remoteUrl.length > 0 && (
              <FormControl.Validation variant="error">
                Enter a valid HTTPS or SSH git remote URL.
              </FormControl.Validation>
            )}
            <FormControl.Caption>
              Inkwell will push your notes here. Bidirectional sync is not performed.
            </FormControl.Caption>
          </FormControl>
        ) : (
          <>
            {!ghReady && (
              <Flash variant="warning">
                No GitHub account was found. Run{' '}
                <Text sx={{ fontFamily: 'mono' }}>gh auth login</Text> in a terminal, then reopen
                this dialog.
              </Flash>
            )}
            {destinations && destinations.hosts.length > 1 && (
              <FormControl>
                <FormControl.Label>Host</FormControl.Label>
                <Select value={host} onChange={(event) => setHost(event.currentTarget.value)}>
                  {destinations.hosts.map((h) => (
                    <Select.Option key={h} value={h}>
                      {h}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl>
              <FormControl.Label>Owner</FormControl.Label>
              <Select
                value={owner}
                onChange={(event) => setOwner(event.currentTarget.value)}
                data-testid="backup-owner-select"
              >
                {(destinations?.owners ?? []).map((o) => (
                  <Select.Option key={o} value={o}>
                    {o}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormControl.Label>Repository name</FormControl.Label>
              <TextInput
                block
                value={repo}
                onChange={(event) => setRepo(event.currentTarget.value)}
                data-testid="backup-repo-input"
              />
              {!validation.valid && repo.length > 0 && (
                <FormControl.Validation variant="error">{validation.error}</FormControl.Validation>
              )}
              {validation.valid && validation.changed && (
                <FormControl.Caption>
                  Will be created as{' '}
                  <Text sx={{ fontFamily: 'mono' }}>{validation.normalized}</Text>.
                </FormControl.Caption>
              )}
              {validation.valid && checkingName && (
                <FormControl.Caption>Checking availability…</FormControl.Caption>
              )}
              {nameConflict && (
                <FormControl.Validation variant="error">
                  A repository named{' '}
                  <Text sx={{ fontFamily: 'mono' }}>{validation.normalized}</Text> already exists
                  under {owner}.
                </FormControl.Validation>
              )}
              {existingMissing && (
                <FormControl.Validation variant="error">
                  No repository named{' '}
                  <Text sx={{ fontFamily: 'mono' }}>{validation.normalized}</Text> exists under{' '}
                  {owner}.
                </FormControl.Validation>
              )}
            </FormControl>

            {mode === 'create' && (
              <RadioGroup
                name="backup-visibility"
                onChange={(value) => value && setVisibility(value as GitVisibility)}
              >
                <RadioGroup.Label>Visibility</RadioGroup.Label>
                <FormControl>
                  <Radio value="private" checked={visibility === 'private'} />
                  <FormControl.Label>Private (recommended)</FormControl.Label>
                  <FormControl.Caption>
                    Only you and collaborators can see your notes.
                  </FormControl.Caption>
                </FormControl>
                {isOrgOwner && (
                  <FormControl>
                    <Radio value="internal" checked={visibility === 'internal'} />
                    <FormControl.Label>Internal</FormControl.Label>
                    <FormControl.Caption>
                      Visible to members of the organization.
                    </FormControl.Caption>
                  </FormControl>
                )}
                <FormControl>
                  <Radio value="public" checked={visibility === 'public'} />
                  <FormControl.Label>Public</FormControl.Label>
                  <FormControl.Caption>
                    Anyone on the internet can read your notes.
                  </FormControl.Caption>
                </FormControl>
              </RadioGroup>
            )}

            {mode === 'create' && visibility === 'public' && (
              <Flash variant="warning">
                <FormControl>
                  <Checkbox
                    checked={acknowledgePublic}
                    onChange={(event) => setAcknowledgePublic(event.currentTarget.checked)}
                    data-testid="backup-ack-public"
                  />
                  <FormControl.Label>
                    I understand this repository and all my notes will be public.
                  </FormControl.Label>
                </FormControl>
              </Flash>
            )}
          </>
        )}

        <FormControl>
          <Checkbox
            checked={autoPush}
            onChange={(event) => setAutoPush(event.currentTarget.checked)}
            data-testid="backup-autopush"
          />
          <FormControl.Label>Back up automatically after each change</FormControl.Label>
          <FormControl.Caption>When off, use “Back up now” to push on demand.</FormControl.Caption>
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!canSubmit}
            data-testid="backup-setup-submit"
            leadingVisual={busy ? () => <Spinner size="small" /> : undefined}
          >
            {mode === 'create' ? 'Create & back up' : 'Connect & back up'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
