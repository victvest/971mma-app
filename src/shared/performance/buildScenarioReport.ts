import type { PerfSnapshot } from './perfMarks';
import { PERF_SCENARIOS } from './perfScenarios';

export type PerfScenarioTiming = {
  id: string;
  label: string;
  marksFound: string[];
  marksMissing: string[];
  spanMs: number | null;
  queryFetchCountAtLastMark: number;
};

export type PerfScenarioReport = {
  capturedAt: string;
  originMs: number | null;
  scenarios: PerfScenarioTiming[];
  totals: {
    markCount: number;
    queryFetchCount: number;
    edgeInvocationCount: number;
  };
};

function findMarkTime(snapshot: PerfSnapshot, name: string): number | undefined {
  return snapshot.marks.find((entry) => entry.name === name)?.at;
}

function queryFetchCountBefore(snapshot: PerfSnapshot, at: number): number {
  return snapshot.queryFetches.filter((entry) => entry.at <= at).length;
}

export function buildPerfScenarioReport(snapshot: PerfSnapshot): PerfScenarioReport {
  const originMs = findMarkTime(snapshot, 'app:fonts-ready') ?? snapshot.marks[0]?.at ?? null;

  const scenarios = PERF_SCENARIOS.map((scenario) => {
    const markTimes = scenario.marks
      .map((mark) => {
        const at = findMarkTime(snapshot, mark);
        return at === undefined ? null : { mark, at };
      })
      .filter((entry): entry is { mark: (typeof scenario.marks)[number]; at: number } => entry !== null);

    const marksFound = markTimes.map((entry) => entry.mark);
    const marksMissing = scenario.marks.filter((mark) => !marksFound.includes(mark));

    const firstMark = markTimes[0];
    const lastMark = markTimes[markTimes.length - 1];
    const spanMs =
      markTimes.length >= 2 && firstMark && lastMark
        ? lastMark.at - firstMark.at
        : markTimes.length === 1 && originMs !== null && firstMark
          ? firstMark.at - originMs
          : null;

    const lastAt = lastMark?.at ?? originMs ?? 0;

    return {
      id: scenario.id,
      label: scenario.label,
      marksFound,
      marksMissing,
      spanMs,
      queryFetchCountAtLastMark: queryFetchCountBefore(snapshot, lastAt),
    };
  });

  return {
    capturedAt: new Date().toISOString(),
    originMs,
    scenarios,
    totals: {
      markCount: snapshot.marks.length,
      queryFetchCount: snapshot.queryFetchCount,
      edgeInvocationCount: snapshot.edgeInvocationCount,
    },
  };
}
