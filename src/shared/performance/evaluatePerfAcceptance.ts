import { buildPerfScenarioReport, type PerfScenarioReport } from './buildScenarioReport';
import type { PerfSnapshot } from './perfMarks';
import {
  PERF_ACCEPTANCE_THRESHOLDS,
  type PerfAcceptanceThreshold,
} from './perfThresholds';

export type PerfAcceptanceScenarioResult = {
  id: string;
  label: string;
  passed: boolean;
  exercised: boolean;
  failures: string[];
  actual: {
    spanMs: number | null;
    queryFetchCountAtLastMark: number;
    edgeInvocationCount: number;
    marksFound: string[];
    marksMissing: string[];
    forbiddenMarksPresent: string[];
  };
};

export type PerfAcceptanceReport = {
  evaluatedAt: string;
  passed: boolean;
  exercisedCount: number;
  scenarios: PerfAcceptanceScenarioResult[];
  totals: PerfScenarioReport['totals'];
};

function findMarkTime(snapshot: PerfSnapshot, name: string): number | undefined {
  return snapshot.marks.find((entry) => entry.name === name)?.at;
}

function edgeInvocationCountBefore(snapshot: PerfSnapshot, at: number): number {
  return snapshot.edgeInvocations.filter((entry) => entry.at <= at).length;
}

function evaluateThreshold(
  threshold: PerfAcceptanceThreshold,
  report: PerfScenarioReport,
  snapshot: PerfSnapshot,
): PerfAcceptanceScenarioResult {
  const scenario = report.scenarios.find((entry) => entry.id === threshold.id);
  const marksFound = scenario?.marksFound ?? [];
  const marksMissing = threshold.requiredMarks.filter((mark) => !marksFound.includes(mark));
  const exercised = marksMissing.length === 0;

  const forbiddenMarksPresent =
    threshold.forbiddenMarks?.filter((mark) => findMarkTime(snapshot, mark) !== undefined) ?? [];

  const lastMarkName = threshold.requiredMarks[threshold.requiredMarks.length - 1];
  const lastMarkAt = lastMarkName ? findMarkTime(snapshot, lastMarkName) : undefined;
  const edgeInvocationCount =
    lastMarkAt === undefined
      ? snapshot.edgeInvocationCount
      : edgeInvocationCountBefore(snapshot, lastMarkAt);

  const actual = {
    spanMs: scenario?.spanMs ?? null,
    queryFetchCountAtLastMark: scenario?.queryFetchCountAtLastMark ?? snapshot.queryFetchCount,
    edgeInvocationCount,
    marksFound,
    marksMissing,
    forbiddenMarksPresent,
  };

  const failures: string[] = [];

  if (!exercised) {
    failures.push(`missing required marks: ${marksMissing.join(', ')}`);
  }

  if (forbiddenMarksPresent.length > 0) {
    failures.push(`forbidden marks present: ${forbiddenMarksPresent.join(', ')}`);
  }

  if (exercised && threshold.maxSpanMs !== null && actual.spanMs !== null) {
    if (actual.spanMs > threshold.maxSpanMs) {
      failures.push(`span ${actual.spanMs.toFixed(0)}ms exceeds ${threshold.maxSpanMs}ms`);
    }
  }

  if (exercised && threshold.maxQueryFetches !== null) {
    if (actual.queryFetchCountAtLastMark > threshold.maxQueryFetches) {
      failures.push(
        `query fetches ${actual.queryFetchCountAtLastMark} exceed ${threshold.maxQueryFetches}`,
      );
    }
  }

  if (exercised && threshold.maxEdgeInvocations !== null) {
    if (actual.edgeInvocationCount > threshold.maxEdgeInvocations) {
      failures.push(
        `edge invocations ${actual.edgeInvocationCount} exceed ${threshold.maxEdgeInvocations}`,
      );
    }
  }

  return {
    id: threshold.id,
    label: threshold.label,
    passed: failures.length === 0,
    exercised,
    failures,
    actual,
  };
}

export function evaluatePerfAcceptance(snapshot: PerfSnapshot): PerfAcceptanceReport {
  const report = buildPerfScenarioReport(snapshot);
  const scenarios = PERF_ACCEPTANCE_THRESHOLDS.map((threshold) =>
    evaluateThreshold(threshold, report, snapshot),
  );
  const exercisedCount = scenarios.filter((entry) => entry.exercised).length;

  return {
    evaluatedAt: new Date().toISOString(),
    passed: scenarios.every((entry) => entry.passed),
    exercisedCount,
    scenarios,
    totals: report.totals,
  };
}
