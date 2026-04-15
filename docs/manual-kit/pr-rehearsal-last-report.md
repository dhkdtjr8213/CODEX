# PR Rehearsal Last Report

- generatedAt: 2026-04-15T05:57:23.099Z
- currentBranch: main
- branchIsMain: yes
- changedFilesCount: 29
- ciLikeChecks: PASS

## Checks
- pnpm.cmd typecheck: ok
- pnpm.cmd lint: ok
- npm.cmd run smoke: ok

## Failure Snippets

## Notes
- currently on `main`; create a feature branch before opening PR
- if branch protection is enabled, merge should require PR + required checks

## Git Status (short)
```
M .env.example
 M .gitignore
 M AGENTS.md
 M apps/web/components/ledger-sections.tsx
 M apps/web/components/ledger-workspace.tsx
 M apps/web/components/monthly-calendar-panel.tsx
 M docs/current-progress.md
 M docs/deployment-checklist.md
 M docs/feature-manual.md
 M docs/recurring-batch-scheduler.md
 M package.json
 M packages/supabase/src/ledger.ts
 M packages/types/src/index.ts
 M scripts/ops/check-recurring-batch.mjs
 M scripts/ops/preflight.mjs
 M supabase/migrations/0002_recurring_execution_batch.sql
?? .agents/
?? .github/workflows/ci.yml
?? SESSION_LOG.md
?? docs/github-branch-protection.md
?? docs/manual-kit/pr-rehearsal-last-report.md
?? docs/manual-kit/preflight-last-report.md
?? harness/
?? scripts/ops/apply-branch-protection.mjs
?? scripts/ops/check-harness-runner.mjs
?? scripts/ops/deploy-recurring-function.mjs
?? scripts/ops/pr-rehearsal.mjs
?? supabase/migrations/0003_recurring_execution_failure_details.sql
?? work/
```