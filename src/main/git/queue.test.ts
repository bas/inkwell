import { describe, expect, it } from 'vitest';
import { GitOpQueue } from './queue';

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('GitOpQueue', () => {
  it('runs exclusive operations one at a time in order', async () => {
    const queue = new GitOpQueue();
    const order: string[] = [];
    const a = queue.runExclusive(async () => {
      await tick(20);
      order.push('a');
    });
    const b = queue.runExclusive(async () => {
      order.push('b');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a', 'b']);
  });

  it('keeps the chain alive after a failing operation', async () => {
    const queue = new GitOpQueue();
    await expect(
      queue.runExclusive(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(queue.runExclusive(async () => 42)).resolves.toBe(42);
  });

  it('coalesces single-flight callers sharing a tag', async () => {
    const queue = new GitOpQueue();
    let runs = 0;
    const fn = async (): Promise<number> => {
      runs += 1;
      await tick(20);
      return runs;
    };
    const first = queue.runSingleFlight('push', fn);
    const second = queue.runSingleFlight('push', fn);
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(runs).toBe(1);
  });

  it('runs a new tagged operation once the previous one settles', async () => {
    const queue = new GitOpQueue();
    let runs = 0;
    const fn = async (): Promise<void> => {
      runs += 1;
    };
    await queue.runSingleFlight('push', fn);
    await queue.runSingleFlight('push', fn);
    expect(runs).toBe(2);
  });
});
