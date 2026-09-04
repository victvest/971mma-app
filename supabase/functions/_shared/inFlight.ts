/** Share only unfinished work in this Edge isolate; never retain a completed result. */
export function createInFlightDeduplicator<T>() {
  const pending = new Map<string, Promise<T>>();

  return (key: string, run: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;

    const promise = Promise.resolve().then(run).finally(() => {
      pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
}
