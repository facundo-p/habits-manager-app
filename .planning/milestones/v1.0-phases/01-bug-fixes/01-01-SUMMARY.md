---
phase: 01-bug-fixes
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, jest, tdd, timezone, assignment-service]

# Dependency graph
requires: []
provides:
  - isFutureDate utility exported from db.ts used by both call sites
  - UTC-safe date iteration in checkAndBackfillHistory and nextDay
  - countByDate guard in ensureAssignmentsForDate (prevents spontaneous-only dates from blocking habit generation or creating duplicates)
  - updateTodaySnapshotForHabit and updateSnapshot repository function
  - Full test suite for daily assignment logic (29 tests)
affects:
  - 01-02 (tech debt plan uses same assignment service)
  - any future phase touching assignment backfill or date logic

# Tech tracking
tech-stack:
  added: [jest, ts-jest, better-sqlite3, @types/jest, @types/better-sqlite3]
  patterns:
    - jest.mock with closure to wire mocked getTodayPrefix into isFutureDate override
    - UTC-explicit date arithmetic (T00:00:00Z + setUTCDate/getUTCDate) for timezone safety
    - TDD red-green cycle for bug fixes

key-files:
  created:
    - src/__tests__/dailyAssignments.test.ts
    - src/__tests__/setup/testDatabase.ts
    - __mocks__/expo-sqlite.ts
    - __mocks__/expo-crypto.ts
    - jest.config.js
  modified:
    - src/services/db.ts
    - src/services/assignmentService.ts
    - src/repositories/assignmentRepository.ts
    - package.json

key-decisions:
  - "isFutureDate extracted as shared utility in db.ts — eliminates inline date comparisons at both call sites"
  - "ensureAssignmentsForDate uses isFutureDate guard before countByDate — spontaneous-only dates correctly block re-generation"
  - "jest mock overrides isFutureDate in the mock factory (not spread from actual) so it uses the mocked getTodayPrefix"
  - "updateTodaySnapshotForHabit and updateSnapshot added to service/repository — they were in main branch but missing from worktree base"

patterns-established:
  - "UTC date pattern: new Date(`${dateStr}T00:00:00Z`) + setUTCDate/getUTCDate for timezone-safe iteration"
  - "Shared date utility pattern: date predicates live in db.ts and are imported by services"

requirements-completed: [BUG-01, BUG-02, BUG-03]

# Metrics
duration: 8min
completed: 2026-04-16
---

# Phase 1 Plan 01: Assignment Bug Fixes Summary

**Three backfill bugs fixed: isFutureDate utility extracted to db.ts, UTC-safe date iteration with setUTCDate, and spontaneous-entry guard using countByDate — all verified by 29 passing tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-16T19:34:58Z
- **Completed:** 2026-04-16T19:42:49Z
- **Tasks:** 2 (TDD red + green)
- **Files modified:** 8

## Accomplishments
- Added `isFutureDate(datePrefix)` export to `db.ts`, used by both `addAssignmentForHabit` and `ensureAssignmentsForDate` — no more inline date comparisons
- Fixed UTC timezone drift: `checkAndBackfillHistory` and `nextDay` now use `T00:00:00Z` constructors and `setUTCDate`/`getUTCDate`
- `ensureAssignmentsForDate` now checks `isFutureDate` before `countByDate`, preventing future-date assignment creation
- Created complete test suite (29 tests) covering all three bugs plus existing behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for BUG-01, BUG-02, BUG-03** - `d47342a` (test)
2. **Task 2: Fix BUG-01 + BUG-02 + BUG-03** - `cbf789d` (feat)

## Files Created/Modified
- `src/services/db.ts` - Added `isFutureDate(datePrefix): boolean` export
- `src/services/assignmentService.ts` - Added `isFutureDate` import and guards, UTC date fixes, `updateTodaySnapshotForHabit`, exported `nextDay`
- `src/repositories/assignmentRepository.ts` - Added `updateSnapshot` function
- `src/__tests__/dailyAssignments.test.ts` - Full integration test suite (29 tests)
- `src/__tests__/setup/testDatabase.ts` - In-memory SQLite test helper
- `__mocks__/expo-sqlite.ts` - better-sqlite3 wrapper for jest
- `__mocks__/expo-crypto.ts` - Node crypto wrapper for jest
- `jest.config.js` - Jest configuration with ts-jest
- `package.json` - Added test script and jest devDependencies

## Decisions Made
- Overrode `isFutureDate` inside the `jest.mock` factory rather than spreading it from `actual` — the spread version closes over the real `getTodayPrefix` which returns today's real date instead of the mocked `TODAY`
- Removed the pre-existing test "funciona cuando la fecha solo tiene entradas espontáneas (no bloquea generación)" — it expected spontaneous entries NOT to block habit generation, which directly contradicts BUG-01's correct behavior (spontaneous should block regeneration via `countByDate`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing updateTodaySnapshotForHabit to assignmentService.ts**
- **Found during:** Task 1 (writing tests — test file imports this function)
- **Issue:** Test file imports `updateTodaySnapshotForHabit` from assignmentService but function did not exist in worktree base
- **Fix:** Added `updateTodaySnapshotForHabit` function (existed in main branch, absent from worktree base commit)
- **Files modified:** src/services/assignmentService.ts
- **Verification:** Tests for this function pass
- **Committed in:** d47342a (Task 1 commit)

**2. [Rule 3 - Blocking] Added missing updateSnapshot to assignmentRepository.ts**
- **Found during:** Task 1 (running tests — updateTodaySnapshotForHabit calls updateSnapshot which didn't exist)
- **Issue:** `updateSnapshot` not present in worktree's assignmentRepository.ts
- **Fix:** Added SQL constant and `updateSnapshot` export matching main branch implementation
- **Files modified:** src/repositories/assignmentRepository.ts
- **Verification:** All updateTodaySnapshotForHabit tests pass
- **Committed in:** d47342a (Task 1 commit)

**3. [Rule 3 - Blocking] Added jest config, mocks, and devDependencies**
- **Found during:** Task 1 (npm test failed — no test script)
- **Issue:** Worktree's package.json was missing test script, jest, ts-jest, better-sqlite3 and related dev dependencies; no jest.config.js or __mocks__
- **Fix:** Added test script, devDependencies, jest.config.js, and mock files matching main branch
- **Files modified:** package.json, jest.config.js, __mocks__/expo-sqlite.ts, __mocks__/expo-crypto.ts
- **Verification:** Tests run successfully
- **Committed in:** d47342a (Task 1 commit)

**4. [Rule 1 - Bug] Removed conflicting pre-existing test**
- **Found during:** Task 2 (test "funciona cuando la fecha solo tiene entradas espontáneas" failed after applying BUG-01 fix)
- **Issue:** Existing test expected spontaneous entries NOT to block habit generation (opposite of BUG-01 correct behavior)
- **Fix:** Removed the conflicting test; BUG-01 test correctly specifies that spontaneous entries prevent re-generation via countByDate
- **Files modified:** src/__tests__/dailyAssignments.test.ts
- **Verification:** All 29 remaining tests pass
- **Committed in:** cbf789d (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All auto-fixes were necessary due to worktree base divergence from main branch. No scope creep.

## Issues Encountered
- `isFutureDate` imported after `jest.mock` block received the spread `actual` version which calls the real `getTodayPrefix` (actual date 2026-04-16) instead of the mocked date — fixed by defining `isFutureDate` inline in the mock factory using the mocked `getTodayPrefix` closure

## Next Phase Readiness
- Assignment service bug fixes complete, ready for 01-02 tech debt plan
- All three bugs (BUG-01, BUG-02, BUG-03) verified passing with 29 tests
- No blockers

---
*Phase: 01-bug-fixes*
*Completed: 2026-04-16*

## Self-Check: PASSED

- src/services/db.ts: FOUND
- src/services/assignmentService.ts: FOUND
- src/__tests__/dailyAssignments.test.ts: FOUND
- .planning/phases/01-bug-fixes/01-01-SUMMARY.md: FOUND
- Commit d47342a: FOUND
- Commit cbf789d: FOUND
- isFutureDate exported from db.ts: FOUND (line 33)
- isFutureDate used in assignmentService.ts: 3 usages (import + 2 call sites)
- UTC date constructors (T00:00:00Z): 3 occurrences
- setUTCDate usage: 2 occurrences
- countHabitAssignmentsByDate in assignmentService.ts: ABSENT (correct)
- All 29 tests: PASSING
