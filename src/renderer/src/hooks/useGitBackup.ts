import { useCallback, useEffect, useRef, useState } from 'react';
import { mergePushOutcome } from '@shared/git';
import { cleanIpcError } from './cleanIpcError';
import type {
  GitAutoCommitMode,
  GitBackupStatus,
  GitDestinations,
  GitPushResult,
  GitRemoteSetupInput,
  GitRemoteSetupResult,
  GitRepoNameCheck,
} from '@shared/git';

interface UseGitBackupResult {
  status: GitBackupStatus | undefined;
  loaded: boolean;
  error: string | undefined;
  busy: boolean;
  clearError: () => void;
  setEnabled: (enabled: boolean) => Promise<void>;
  setAutoCommit: (mode: GitAutoCommitMode, intervalMinutes?: number) => Promise<void>;
  setAutoPush: (enabled: boolean) => Promise<void>;
  pushNow: () => Promise<GitPushResult | undefined>;
  removeRemote: () => Promise<void>;
  getDestinations: () => Promise<GitDestinations>;
  checkRepoName: (
    host: string | undefined,
    owner: string,
    name: string,
  ) => Promise<GitRepoNameCheck>;
  setupRemote: (input: GitRemoteSetupInput) => Promise<GitRemoteSetupResult>;
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const cleaned = cleanIpcError(err.message);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  return fallback;
}

/**
 * Owns the renderer view of the git backup feature: current status, live status
 * updates pushed from main, and the guarded action calls. All git/fs work runs
 * in main; this hook only orchestrates the typed IPC surface.
 */
export function useGitBackup(): UseGitBackupResult {
  const [status, setStatus] = useState<GitBackupStatus | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    window.api
      .getGitStatus()
      .then((next) => {
        if (activeRef.current) setStatus(next);
      })
      .catch((err: unknown) => {
        if (activeRef.current) setError(describeError(err, 'Could not load backup status'));
      })
      .finally(() => {
        if (activeRef.current) setLoaded(true);
      });
    const unsubscribe = window.api.onGitStatusChanged((next) => {
      if (activeRef.current) setStatus(next);
    });
    return () => {
      activeRef.current = false;
      unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => setError(undefined), []);

  const run = useCallback(async <T>(action: () => Promise<T>, fallback: string): Promise<T> => {
    setBusy(true);
    setError(undefined);
    try {
      return await action();
    } catch (err) {
      if (activeRef.current) setError(describeError(err, fallback));
      throw err;
    } finally {
      if (activeRef.current) setBusy(false);
    }
  }, []);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      const next = await run(
        () => window.api.setGitEnabled(enabled),
        'Could not update version history',
      );
      if (activeRef.current) setStatus(next);
    },
    [run],
  );

  const setAutoCommit = useCallback(
    async (mode: GitAutoCommitMode, intervalMinutes?: number) => {
      const next = await run(
        () => window.api.setGitAutoCommit(mode, intervalMinutes),
        'Could not update auto-commit',
      );
      if (activeRef.current) setStatus(next);
    },
    [run],
  );

  const setAutoPush = useCallback(
    async (enabled: boolean) => {
      const next = await run(
        () => window.api.setGitAutoPush(enabled),
        'Could not update auto-push',
      );
      if (activeRef.current) setStatus(next);
    },
    [run],
  );

  const pushNow = useCallback(async () => {
    return run(async () => {
      const result = await window.api.gitPushNow();
      // status() can't classify a failed push, so fold the push outcome in.
      if (activeRef.current)
        setStatus(mergePushOutcome(result.status, result.state, result.detail));
      return result;
    }, 'Could not push to the backup remote');
  }, [run]);

  const removeRemote = useCallback(async () => {
    const next = await run(
      () => window.api.removeGitRemote(),
      'Could not remove the backup remote',
    );
    if (activeRef.current) setStatus(next);
  }, [run]);

  const getDestinations = useCallback(
    () => run(() => window.api.getGitDestinations(), 'Could not load GitHub destinations'),
    [run],
  );

  const checkRepoName = useCallback(
    (host: string | undefined, owner: string, name: string) =>
      window.api.checkGitRepoName(host, owner, name),
    [],
  );

  const setupRemote = useCallback(
    (input: GitRemoteSetupInput) =>
      run(async () => {
        const result = await window.api.setupGitRemote(input);
        // Surface an initial-push failure instead of masking it as "pending".
        if (activeRef.current)
          setStatus(mergePushOutcome(result.status, result.pushState, result.detail));
        return result;
      }, 'Could not set up the backup remote'),
    [run],
  );

  return {
    status,
    loaded,
    error,
    busy,
    clearError,
    setEnabled,
    setAutoCommit,
    setAutoPush,
    pushNow,
    removeRemote,
    getDestinations,
    checkRepoName,
    setupRemote,
  };
}
