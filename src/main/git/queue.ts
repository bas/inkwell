/**
 * A per-vault serialized operation queue. Every worktree-touching git operation
 * funnels through here so note mutations, auto-commits, and pushes never
 * overlap (research R3 §2.3, RD-2/RD-3).
 *
 * - `runExclusive` serializes all work; only one operation runs at a time.
 * - `runSingleFlight` coalesces callers keyed by a tag: a second identical
 *   request while one is in flight returns the same in-flight promise (used so
 *   overlapping "Push now" clicks don't stack).
 */
export class GitOpQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private inFlight = new Map<string, Promise<unknown>>();

  /** Queue `fn` to run after all previously queued work completes. */
  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    // Keep the chain alive regardless of individual failures.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * Run `fn` exclusively, but coalesce concurrent callers sharing `tag`: while a
   * tagged operation is in flight, further calls with the same tag return that
   * same promise instead of queueing another.
   */
  runSingleFlight<T>(tag: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(tag);
    if (existing) return existing as Promise<T>;
    const result = this.runExclusive(fn).finally(() => {
      if (this.inFlight.get(tag) === result) this.inFlight.delete(tag);
    });
    this.inFlight.set(tag, result);
    return result;
  }

  /** Resolve once all currently queued work has drained. */
  async drain(): Promise<void> {
    await this.tail;
  }
}
