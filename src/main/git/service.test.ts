import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService } from './service';

/**
 * Integration coverage for {@link GitService} against a real temp vault and a
 * local bare remote. Exercises the hardened runner, preflight, queue, commit,
 * and push without touching the network or creating GitHub repos.
 */
const hasGit = ((): boolean => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const suite = hasGit ? describe : describe.skip;

suite('GitService (integration)', () => {
  let root: string;
  let vault: string;
  let bare: string;
  let service: GitService;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'inkwell-git-'));
    vault = join(root, 'vault');
    bare = join(root, 'remote.git');
    await mkdir(vault, { recursive: true });
    execFileSync('git', ['init', '--bare', '-b', 'main', bare]);
    service = new GitService(vault);
  });

  afterAll(async () => {
    await service.drain();
    rmSync(root, { recursive: true, force: true });
  });

  it('initializes a repo and makes an initial commit', async () => {
    await service.initialize();
    const log = execFileSync('git', ['-C', vault, 'log', '--oneline'], { encoding: 'utf8' });
    expect(log).toContain('Initialize Inkwell vault backup');
  });

  it('commits changed notes and is a no-op when nothing changed', async () => {
    writeFileSync(join(vault, 'note.md'), '---\ntitle: Groceries\n---\nMilk\n');
    const first = await service.commit(['Groceries']);
    expect(first.committed).toBe(true);

    const second = await service.commit(['Groceries']);
    expect(second.committed).toBe(false);

    const message = execFileSync('git', ['-C', vault, 'log', '-1', '--pretty=%s'], {
      encoding: 'utf8',
    }).trim();
    expect(message).toBe('Update note: Groceries');
  });

  it('never stages ignored index files', async () => {
    writeFileSync(join(vault, 'index.sqlite'), 'binary-cache');
    await service.commit([]);
    const tracked = execFileSync('git', ['-C', vault, 'ls-files'], { encoding: 'utf8' });
    expect(tracked).not.toContain('index.sqlite');
    expect(tracked).toContain('note.md');
  });

  it('pushes to a configured remote and reports a clean state', async () => {
    execFileSync('git', ['-C', vault, 'remote', 'add', 'origin', bare]);
    const push = await service.pushNow();
    expect(push.state).toBe('clean');

    const remoteLog = execFileSync('git', ['--git-dir', bare, 'log', '--oneline'], {
      encoding: 'utf8',
    });
    expect(remoteLog).toContain('Update note: Groceries');
  });

  it('reports a clean sync state once everything is pushed', async () => {
    const status = await service.status({
      enabled: true,
      autoCommit: 'onSave',
      intervalMinutes: 5,
      remote: {
        mode: 'url',
        host: '',
        owner: '',
        repo: '',
        visibility: 'unknown',
        remoteUrl: bare,
        autoPush: true,
      },
    });
    expect(status.syncState).toBe('clean');
    expect(status.dirty).toBe(false);
  });

  it('surfaces committed-not-pushed after a new local commit', async () => {
    writeFileSync(join(vault, 'note.md'), '---\ntitle: Groceries\n---\nMilk\nEggs\n');
    await service.commit(['Groceries']);
    const status = await service.status({
      enabled: true,
      autoCommit: 'onSave',
      intervalMinutes: 5,
      remote: {
        mode: 'url',
        host: '',
        owner: '',
        repo: '',
        visibility: 'unknown',
        remoteUrl: bare,
        autoPush: false,
      },
    });
    expect(status.syncState).toBe('committed-not-pushed');
    expect(readFileSync(join(vault, 'note.md'), 'utf8')).toContain('Eggs');
  });
});

suite('GitService without an origin remote', () => {
  let root: string;
  let vault: string;
  let service: GitService;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'inkwell-git-noremote-'));
    vault = join(root, 'vault');
    await mkdir(vault, { recursive: true });
    service = new GitService(vault);
    await service.initialize();
    writeFileSync(join(vault, 'note.md'), '---\ntitle: Solo\n---\nBody\n');
    await service.commit(['Solo']);
  });

  afterAll(async () => {
    await service.drain();
    rmSync(root, { recursive: true, force: true });
  });

  it('never reports "clean" from pushNow when no origin is configured', async () => {
    const push = await service.pushNow();
    expect(push.state).toBe('not-ready');
  });

  it('reports not-ready when settings expect a remote the repo does not have', async () => {
    const status = await service.status({
      enabled: true,
      autoCommit: 'onSave',
      intervalMinutes: 5,
      remote: {
        mode: 'url',
        host: '',
        owner: '',
        repo: '',
        visibility: 'unknown',
        remoteUrl: 'https://example.com/x/y.git',
        autoPush: false,
      },
    });
    expect(status.syncState).toBe('not-ready');
  });

  it('reports clean history when no remote is configured at all', async () => {
    const status = await service.status({
      enabled: true,
      autoCommit: 'onSave',
      intervalMinutes: 5,
    });
    expect(status.syncState).toBe('clean');
  });
});
