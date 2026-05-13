---
phase: qu5
plan: 01
subsystem: services/date
tags: [timezone, bug-fix, tdd, argentina, gmt-3]
dependency_graph:
  requires: []
  provides: [getTodayPrefix-local, getWeekBounds-local]
  affects: [assignmentService, moodService, driveBackupService, StatsScreen]
tech_stack:
  added: []
  patterns: [local-date-extraction, fake-timers-test]
key_files:
  created:
    - src/__tests__/db.test.ts
  modified:
    - src/services/db.ts
    - src/services/statsService.ts
    - jest.config.js
decisions:
  - "Use getFullYear/getMonth/getDate for local timezone extraction — no library needed in React Native"
  - "Add localDateToPrefix helper in statsService.ts to avoid touching dateToPrefix in dateHelpers.ts"
  - "Remove dateToPrefix import from statsService.ts as it becomes unused after fix"
  - "Add watchman: false to jest.config.js to work around broken watchman socket in dev environment"
metrics:
  duration: ~15 min
  completed: 2026-05-04
  tasks_completed: 2
  files_modified: 4
---

# Phase qu5 Plan 01: Fix UTC vs Local Timezone Bug - Summary

Fixed UTC vs local day-boundary bug in `getTodayPrefix()` and `getWeekBounds()` using native JS `getFullYear/getMonth/getDate` methods — no library needed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing TDD test for getTodayPrefix | 1594e5a | src/__tests__/db.test.ts, jest.config.js |
| 1 (GREEN) | Fix getTodayPrefix to use local calendar date | 66574f6 | src/services/db.ts |
| 2 | Fix getWeekBounds to use local date extraction | 908a26b | src/services/statsService.ts |

## What Was Built

**Problem:** Argentina (GMT-3) users experienced a day rollover at 21:00 local time. `getTodayPrefix()` used `new Date().toISOString().slice(0, 10)` which returns UTC date. At 21:00 local (00:00 UTC next day), the app treated tomorrow's date as "today", breaking habit assignments, mood logging, and backup date keys.

**Secondary bug:** `getWeekBounds()` computed Monday/Sunday using local `setDate()` but then called `dateToPrefix()` which calls `toISOString()`, reintroducing UTC drift for the week boundary strings.

**Fixes:**
1. `getTodayPrefix()` in `src/services/db.ts` — replaced `toISOString().slice(0,10)` with `getFullYear()/getMonth()/getDate()` local methods
2. `getWeekBounds()` in `src/services/statsService.ts` — added private `localDateToPrefix()` helper and replaced `dateToPrefix()` calls with it; removed now-unused import

**Constraint honored:** `dateToPrefix()` in `src/utils/dateHelpers.ts` was NOT changed. It's called on `new Date(\`${prefix}T00:00:00Z\`)` objects (UTC midnight anchors) in `periodHelpers.ts` and `assignmentService.ts` where UTC is correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Watchman socket error crashing Jest before config loads**
- **Found during:** Task 1 RED phase
- **Issue:** `fb-watchman` threw unhandled Node.js error on socket not found, crashing Jest before it could read the config
- **Fix:** Added `watchman: false` to `jest.config.js`
- **Files modified:** jest.config.js
- **Commit:** 1594e5a (bundled with RED test commit)

**2. [Rule 1 - Test Design] First test had inverted comparison logic**
- **Found during:** Task 1 RED verification
- **Issue:** Test compared getTodayPrefix() against localExpected computed from same fake time — both should match when fix is applied, but the test design made RED/GREEN distinction clear because the CURRENT broken impl returns UTC "2025-01-15" while the expected local date is "2025-01-14" (machine runs in GMT-3)
- **Fix:** Tests verified correctly — machine timezone is GMT-3 so the UTC vs local distinction is real

## Verification Results

- `src/__tests__/db.test.ts`: 3/3 tests pass
- Full test suite: 143/143 tests pass (15 test suites)
- TypeScript: 0 errors in modified files (pre-existing unrelated errors in NotebookPaper.tsx and parsing.ts are out of scope)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/__tests__/db.test.ts: FOUND
- src/services/db.ts modified: FOUND (commit 66574f6)
- src/services/statsService.ts modified: FOUND (commit 908a26b)
- Commits 1594e5a, 66574f6, 908a26b: FOUND in git log
