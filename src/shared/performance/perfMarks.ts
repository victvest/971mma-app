import type { PerfMarkName } from './perfScenarios';

export type PerfMarkEntry = {
  name: PerfMarkName | string;
  at: number;
  meta?: Record<string, unknown>;
};

export type PerfMeasureEntry = {
  name: string;
  startMark: string;
  endMark: string;
  durationMs: number;
};

export type PerfQueryFetchEntry = {
  queryKey: string;
  at: number;
  state: string;
};

export type PerfEdgeInvocationEntry = {
  name: string;
  at: number;
};

export type PerfSnapshot = {
  marks: PerfMarkEntry[];
  measures: PerfMeasureEntry[];
  queryFetches: PerfQueryFetchEntry[];
  queryFetchCount: number;
  edgeInvocations: PerfEdgeInvocationEntry[];
  edgeInvocationCount: number;
};

const marks: PerfMarkEntry[] = [];
const measures: PerfMeasureEntry[] = [];
const queryFetches: PerfQueryFetchEntry[] = [];
const edgeInvocations: PerfEdgeInvocationEntry[] = [];
const onceMarks = new Set<string>();

let queryFetchCount = 0;
let edgeInvocationCount = 0;

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function isPerfInstrumentationEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_PERF_INSTRUMENTATION === 'true';
}

export function perfMark(name: PerfMarkName | string, meta?: Record<string, unknown>): void {
  if (!isPerfInstrumentationEnabled()) return;

  const entry: PerfMarkEntry = { name, at: now(), meta };
  marks.push(entry);

  if (__DEV__) {
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[perf] mark ${name}${suffix}`);
  }
}

export function perfMarkOnce(name: PerfMarkName | string, meta?: Record<string, unknown>): void {
  if (onceMarks.has(name)) return;
  onceMarks.add(name);
  perfMark(name, meta);
}

export function perfMeasure(
  name: string,
  startMark: PerfMarkName | string,
  endMark: PerfMarkName | string = `${startMark}:end`,
): number | null {
  if (!isPerfInstrumentationEnabled()) return null;

  const start = [...marks].reverse().find((entry) => entry.name === startMark);
  const end = [...marks].reverse().find((entry) => entry.name === endMark);
  if (!start || !end) return null;

  const durationMs = end.at - start.at;
  const entry: PerfMeasureEntry = {
    name,
    startMark,
    endMark,
    durationMs,
  };
  measures.push(entry);

  if (__DEV__) {
    console.log(`[perf] measure ${name} ${durationMs.toFixed(1)}ms (${startMark} → ${endMark})`);
  }

  return durationMs;
}

export function recordPerfQueryFetch(queryKey: unknown, state: string): void {
  if (!isPerfInstrumentationEnabled()) return;

  queryFetchCount += 1;
  const entry: PerfQueryFetchEntry = {
    queryKey: JSON.stringify(queryKey),
    at: now(),
    state,
  };
  queryFetches.push(entry);

  if (__DEV__) {
    console.log(`[perf] query-fetch #${queryFetchCount} ${state} ${entry.queryKey}`);
  }
}

export function recordPerfEdgeInvocation(name: string): void {
  if (!isPerfInstrumentationEnabled()) return;

  edgeInvocationCount += 1;
  const entry: PerfEdgeInvocationEntry = { name, at: now() };
  edgeInvocations.push(entry);

  if (__DEV__) {
    console.log(`[perf] edge-invoke #${edgeInvocationCount} ${name}`);
  }
}

export function getPerfSnapshot(): PerfSnapshot {
  return {
    marks: [...marks],
    measures: [...measures],
    queryFetches: [...queryFetches],
    queryFetchCount,
    edgeInvocations: [...edgeInvocations],
    edgeInvocationCount,
  };
}

export function resetPerfSnapshot(): void {
  marks.length = 0;
  measures.length = 0;
  queryFetches.length = 0;
  edgeInvocations.length = 0;
  onceMarks.clear();
  queryFetchCount = 0;
  edgeInvocationCount = 0;
}

/** Dev helper — attach to global for Metro console access. */
export function exposePerfSnapshotOnGlobal(): void {
  if (!isPerfInstrumentationEnabled() || !__DEV__) return;

  const globalRef = globalThis as typeof globalThis & {
    __971PerfSnapshot?: () => PerfSnapshot;
    __971PerfReset?: () => void;
  };

  globalRef.__971PerfSnapshot = getPerfSnapshot;
  globalRef.__971PerfReset = resetPerfSnapshot;
}
