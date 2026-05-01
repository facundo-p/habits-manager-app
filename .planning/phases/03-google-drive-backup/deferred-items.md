# Phase 03 Deferred Items

Items discovered during execution that are out-of-scope for the current plan and tracked
for a future tech-debt or fix plan.

## Pre-existing TypeScript errors (not introduced by Phase 03 plans)

Detected during Plan 03-01 Task 1 verification (`npx tsc --noEmit`). These errors exist on
the clean tree (verified via `git stash` before installing the SDK) and are unrelated to
this phase's work. Document here so the verifier does not flag them as regressions.

| File | Line | Error | Notes |
|------|------|-------|-------|
| `src/components/layout/NotebookPaper.tsx` | 81 | `string[]` not assignable to `readonly [ColorValue, ColorValue, ...]` (LinearGradient colors prop) | expo-linear-gradient typing — needs tuple cast |
| `src/services/assignmentService.ts` | 92 | `string` not assignable to area-id literal union | missing narrowing of category id |
| `src/services/habitService.ts` | 103, 119 | same as above | same pattern |
| `src/utils/parsing.ts` | 25 | same as above | same pattern |

**Reproduction:** `git stash && npx tsc --noEmit` on `create-daily-assignments` HEAD before Phase 03 work.

**Recommended fix:** Phase 04 tech-debt round, narrow `string` → `AreaId` via `VALID_AREA_IDS`
type guard at the boundary. Not a security or correctness issue — TypeScript-only noise.
