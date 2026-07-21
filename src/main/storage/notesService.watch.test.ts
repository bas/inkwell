import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesService } from './notesService';

interface MockWatcher {
  add: ReturnType<typeof vi.fn<(path: string) => Promise<void>>>;
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
  on: ReturnType<typeof vi.fn<(event: string, handler: (error?: unknown) => void) => MockWatcher>>;
}

const watcherState: {
  rejectAddWith: Error | null;
  created: MockWatcher[];
} = {
  rejectAddWith: null,
  created: [],
};

vi.mock('./db', () => {
  const db = { close: vi.fn() };
  return {
    openDatabase: vi.fn(() => db),
    rebuildIndex: vi.fn(),
    upsertNote: vi.fn(),
    deleteNote: vi.fn(),
    listSummaries: vi.fn(() => []),
    searchSummaries: vi.fn(() => []),
    listLabels: vi.fn(() => []),
    createLabel: vi.fn(),
    setLabelColor: vi.fn(),
    deleteLabel: vi.fn(),
  };
});

vi.mock('chokidar', () => ({
  watch: vi.fn(() => {
    const handlers = new Map<string, Array<(error?: unknown) => void>>();
    const watcher = {} as MockWatcher;
    watcher.on = vi.fn((event: string, handler: (error?: unknown) => void) => {
      const current = handlers.get(event) ?? [];
      current.push(handler);
      handlers.set(event, current);
      return watcher;
    });
    watcher.close = vi.fn(async () => {});
    watcher.add = vi.fn(async () => {
      if (watcherState.rejectAddWith) {
        for (const handler of handlers.get('error') ?? []) handler(watcherState.rejectAddWith);
        throw watcherState.rejectAddWith;
      }
    });
    watcherState.created.push(watcher);
    return watcher;
  }),
}));

let dir: string;
let dbPath: string;

beforeEach(() => {
  watcherState.created.length = 0;
  watcherState.rejectAddWith = null;
  dir = mkdtempSync(join(tmpdir(), 'inkwell-notes-watch-'));
  dbPath = join(dir, 'index.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('NotesService watcher startup', () => {
  it('rejects startup cleanly when chokidar cannot watch the vault', async () => {
    watcherState.rejectAddWith = new Error("EPERM: operation not permitted, watch '/tmp/vault'");
    const service = new NotesService(dir, dbPath);
    try {
      await expect(service.startWatching(() => {})).rejects.toThrow(
        /EPERM: operation not permitted/,
      );
      expect(watcherState.created).toHaveLength(1);
      expect(watcherState.created[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      await service.dispose();
    }
  });
});
