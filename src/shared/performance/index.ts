export { PerfMark, PERF_SCENARIOS, type PerfMarkName } from './perfScenarios';
export {
  PERF_ACCEPTANCE_THRESHOLDS,
  PERF_ACCEPTANCE_SCENARIO_IDS,
  type PerfAcceptanceThreshold,
} from './perfThresholds';
import {
  exposePerfSnapshotOnGlobal,
  getPerfSnapshot,
  isPerfInstrumentationEnabled,
} from './perfMarks';
import { buildPerfScenarioReport, type PerfScenarioReport } from './buildScenarioReport';
import {
  evaluatePerfAcceptance,
  type PerfAcceptanceReport,
  type PerfAcceptanceScenarioResult,
} from './evaluatePerfAcceptance';
export {
  exposePerfSnapshotOnGlobal,
  getPerfSnapshot,
  isPerfInstrumentationEnabled,
  perfMark,
  perfMarkOnce,
  perfMeasure,
  recordPerfEdgeInvocation,
  recordPerfQueryFetch,
  resetPerfSnapshot,
  type PerfEdgeInvocationEntry,
  type PerfMarkEntry,
  type PerfMeasureEntry,
  type PerfQueryFetchEntry,
  type PerfSnapshot,
} from './perfMarks';
export {
  buildPerfScenarioReport,
  type PerfScenarioReport,
  type PerfScenarioTiming,
} from './buildScenarioReport';
export {
  evaluatePerfAcceptance,
  type PerfAcceptanceReport,
  type PerfAcceptanceScenarioResult,
} from './evaluatePerfAcceptance';
export { installQueryPerfObserver } from './installQueryPerfObserver';
export { usePerfRouteMount } from './usePerfRouteMount';
export { usePerfOnceReady } from './usePerfOnceReady';

export function exposePerfToolsOnGlobal(): void {
  exposePerfSnapshotOnGlobal();

  if (!isPerfInstrumentationEnabled()) return;

  const globalRef = globalThis as typeof globalThis & {
    __971PerfReport?: () => PerfScenarioReport;
    __971PerfAcceptance?: () => PerfAcceptanceReport;
  };

  globalRef.__971PerfReport = () => buildPerfScenarioReport(getPerfSnapshot());
  globalRef.__971PerfAcceptance = () => evaluatePerfAcceptance(getPerfSnapshot());
}
