---
status: issues_found
phase: 01
phase_name: bug-fixes
depth: standard
files_reviewed: 9
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
reviewed: 2026-04-21
---

# Phase 01: Bug Fixes — Code Review

## Summary

The four targeted bugs (BUG-01 through BUG-04) are correctly fixed. The test infrastructure (better-sqlite3 mock, in-memory DB, jest config) is well designed and tests cover the intended scenarios. One critical finding: the UNIQUE index that prevents duplicate habit+date assignments exists only in the test schema, not in the production schema — meaning the duplicate-prevention test passes in CI but the constraint does not protect real user data. Three warnings around SQL injection surface in sanitization, missing error handling for spontaneous actions in the store, and a `getTodayPrefix` timezone concern. Two informational items.

## Findings

### CR-01: UNIQUE index missing from production schema
**Severity:** critical
**File:** `src/services/db.ts` (SQL_CREATE_ASSIGNMENTS, ~line 86)
**Description:** The test database (`src/__tests__/setup/testDatabase.ts:68-72`) creates `idx_unique_habit_date` on `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL`. This index does **not** exist in the production schema in `db.ts`. The test at line 334 of `dailyAssignments.test.ts` ("UNIQUE constraint failed") passes only because of the test-only index. In production, nothing prevents two rows with the same `(habit_id, date)`, so concurrent calls or race conditions could create duplicate assignments.
**Suggestion:** Add the same `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_habit_date ON daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL` to `executeSchema()` in `db.ts`, right after the table creation. Also add it to `migrateSchema()` so existing installations gain the index on upgrade.

### WR-01: SQL injection surface in sanitizeTable
**Severity:** warning
**File:** `src/services/db.ts`:152-169
**Description:** `sanitizeTable()` interpolates `table` and `column` directly into SQL strings (`SELECT id, ${column} FROM ${table}`). These values are currently hardcoded internal constants (`'habits'`, `'default_categories'`, etc.), so there is no exploit today. However, this pattern is fragile — if a future caller passes user-controlled input, it becomes a SQL injection vector.
**Suggestion:** Either add a comment documenting that these must remain internal-only, or validate `table`/`column` against an allowlist before interpolation.

### WR-02: getTodayPrefix uses local timezone, isFutureDate uses string comparison
**Severity:** warning
**File:** `src/services/db.ts`:29-35
**Description:** `getTodayPrefix()` calls `new Date().toISOString().slice(0,10)` which returns the UTC date, not the user's local date. A user at UTC-5 completing a habit at 11 PM local time would see it recorded under "tomorrow" (UTC). Meanwhile, `isFutureDate` compares date strings lexicographically, which is correct for YYYY-MM-DD but depends on both sides using the same timezone convention. The backfill loop in `assignmentService.ts` correctly uses UTC (`T00:00:00Z`), but the "today" anchor may not match the user's intent.
**Suggestion:** Evaluate whether the app should use local date or UTC consistently. If UTC is intentional, document it prominently. If local date is desired, change `getTodayPrefix` to derive from local time (e.g., using `toLocaleDateString` with zero-padded formatting or a date library).

### WR-03: addSpontaneous error not surfaced to user in store
**Severity:** warning
**File:** `src/store/useHabitStore.ts`:192-195
**Description:** `addSpontaneous` in the store calls `addSpontaneousSvc` which now throws on invalid categories (BUG-04 fix). But the store action has no try/catch — the error propagates unhandled to the component. Other store actions (e.g., `toggleItem`, `addHabit`) wrap their calls in try/catch with `console.error`.
**Suggestion:** Wrap the `addSpontaneous` store action in try/catch, either logging the error or setting an error state that the UI can display to the user.

### IR-01: Duplicated schema SQL between db.ts and testDatabase.ts
**Severity:** info
**File:** `src/__tests__/setup/testDatabase.ts`:18-65 vs `src/services/db.ts`:52-99
**Description:** The four CREATE TABLE statements are copy-pasted between production and test setup. If the schema evolves, they can drift (as already happened with the UNIQUE index — present in test but not production).
**Suggestion:** Extract the raw SQL strings from `db.ts` and export them (or move to a shared `schema.ts`), then import them in `testDatabase.ts`. This ensures both environments always use the same DDL.

### IR-02: ts-jest version may be incompatible with Jest 30
**Severity:** info
**File:** `package.json`:56
**Description:** `jest` is at `^30.3.0` while `ts-jest` is at `^29.4.6`. ts-jest v29 officially supports Jest 29. While it may work today, a future minor release of either could break compatibility. The ts-jest team typically releases a matching major version for each Jest major.
**Suggestion:** Monitor for a ts-jest v30 release and upgrade when available, or pin Jest to v29 to stay within supported pairings.

## Files Reviewed

| File | Notes |
|------|-------|
| `src/services/assignmentService.ts` | BUG-01 through BUG-04 fixes present and correct. Logic is clean, functions are well-scoped. `nextDay` and `formatDateStr` helpers are solid. |
| `src/services/db.ts` | Schema creation, migrations, sanitization. Missing UNIQUE index (CR-01). Timezone concern (WR-02). SQL interpolation note (WR-01). |
| `src/repositories/assignmentRepository.ts` | Pure CRUD, well-structured. SQL constants are clear. No issues found. |
| `src/__tests__/dailyAssignments.test.ts` | Good coverage of all 4 bugs plus idempotency, future-date guard, and edge cases. UNIQUE index test only works due to test-only schema (CR-01). |
| `src/__tests__/setup/testDatabase.ts` | Clean test DB setup. Contains UNIQUE index not in production (CR-01). Schema duplication (IR-01). |
| `__mocks__/expo-sqlite.ts` | Solid mock wrapping better-sqlite3 sync API as async. Correct error messaging. |
| `__mocks__/expo-crypto.ts` | Minimal, correct — delegates to Node crypto. |
| `jest.config.js` | Appropriate config. `diagnostics: false` is reasonable for integration tests. |
| `package.json` | Dependencies look correct. ts-jest/Jest version mismatch noted (IR-02). |
| `src/store/useHabitStore.ts` | Store consuming the service layer. Missing error handling for spontaneous action (WR-03). |
