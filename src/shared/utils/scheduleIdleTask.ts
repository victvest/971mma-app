type IdleHandle = { cancel: () => void };
type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type RequestIdleCallback = (
  callback: (deadline: IdleDeadline) => void,
  options?: { timeout?: number },
) => number;
type CancelIdleCallback = (handle: number) => void;

type IdleGlobal = typeof globalThis & {
  requestIdleCallback?: RequestIdleCallback;
  cancelIdleCallback?: CancelIdleCallback;
};

export function scheduleIdleTask(callback: () => void, timeout = 300): IdleHandle {
  const idleGlobal = globalThis as IdleGlobal;

  if (typeof idleGlobal.requestIdleCallback === 'function') {
    const handle = idleGlobal.requestIdleCallback(() => callback(), { timeout });
    return {
      cancel: () => idleGlobal.cancelIdleCallback?.(handle),
    };
  }

  const handle = setTimeout(callback, timeout);
  return {
    cancel: () => clearTimeout(handle),
  };
}
