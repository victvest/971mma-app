import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { outputRoot, e2eRoot } from './env.mjs';

export function createReportBuilder() {
  const startedAt = new Date();
  const workflows = [];
  const summary = { pass: 0, fail: 0, skip: 0, note: 0 };

  function record(workflow) {
    workflows.push(workflow);
    const status = workflow.status?.toLowerCase() ?? 'fail';
    if (status in summary) summary[status] += 1;
    else summary.fail += 1;
  }

  function writeReport() {
    const finishedAt = new Date();
    const durationMs = finishedAt - startedAt;
    mkdirSync(resolve(outputRoot, 'reports'), { recursive: true });
    const reportPath = resolve(outputRoot, 'reports/E2E-PRODUCTION-READINESS.md');

    const lines = [
      '# 971 MMA — E2E Production Readiness Report',
      '',
      `Generated: ${finishedAt.toISOString()}`,
      `Duration: ${Math.round(durationMs / 1000)}s`,
      '',
      '## Summary',
      '',
      '| Status | Count |',
      '|--------|-------|',
      `| PASS | ${summary.pass} |`,
      `| FAIL | ${summary.fail} |`,
      `| SKIP | ${summary.skip} |`,
      `| NOTE | ${summary.note} |`,
      '',
      `**Overall:** ${summary.fail === 0 ? 'READY (all automated checks passed)' : 'NOT READY (failures require remediation)'}`,
      '',
      '## Workflows',
      '',
    ];

    for (const wf of workflows) {
      const icon = wf.status === 'PASS' ? '✅' : wf.status === 'FAIL' ? '❌' : wf.status === 'SKIP' ? '⏭️' : 'ℹ️';
      lines.push(`### ${icon} ${wf.id} — ${wf.name}`);
      lines.push('');
      lines.push(`**Status:** ${wf.status}`);
      if (wf.category) lines.push(`**Category:** ${wf.category}`);
      if (wf.durationMs) lines.push(`**Duration:** ${wf.durationMs}ms`);
      lines.push('');
      if (wf.details) lines.push(wf.details);
      if (wf.evidence?.length) {
        lines.push('');
        lines.push('**Evidence:**');
        for (const item of wf.evidence) {
          lines.push(`- ${item}`);
        }
      }
      if (wf.error) {
        lines.push('');
        lines.push('**Error:**');
        lines.push('```');
        lines.push(wf.error);
        lines.push('```');
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## Infrastructure');
    lines.push('');
    lines.push('- **UI automation:** [Maestro](https://maestro.mobile.dev) 2.6.1 — flows in `971mma-app/e2e/maestro/`');
    lines.push('- **DB/API verification:** Node orchestrator + Supabase edge invokes + SQL assertions');
    lines.push('- **Run commands:** `npm run e2e` (full), `npm run e2e:db` (API/DB only), `npm run e2e:ui` (Maestro only)');
    lines.push('- **Personas:** `971mma-app/e2e/config/personas.json` (resolved via `supabase/.env.local`)');
    lines.push('- **Artifacts:** screenshots/logs under `971mma-app/e2e/output/`');
    lines.push('');
    lines.push('Report artifacts: `971mma-app/e2e/output/`');
    lines.push('');

    writeFileSync(reportPath, lines.join('\n'));
    writeFileSync(resolve(outputRoot, 'reports/latest.json'), JSON.stringify({ summary, workflows, startedAt, finishedAt }, null, 2));

    return { reportPath, summary, workflows };
  }

  return { record, writeReport, summary };
}
