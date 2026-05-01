# Phase 4: Habit Creation Audit & Duplicate Cleanup — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 13 (5 new + 8 modified)
**Analogs found:** 13/13
**Output consumed by:** `gsd-planner` (next step in `/gsd-plan-phase`)

---

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `src/utils/periodHelpers.ts` | NEW | utility (pure) | transform (date → period key) | `src/utils/dateHelpers.ts` + `assignmentService.ts:255-263` (`nextDay`/`formatDateStr`) | role + flow exact |
| `src/services/migrations/migrationV1.ts` | NEW (or inline in `db.ts`) | service (orchestrator, transactional) | batch (CTE delete + DDL) | `src/services/db.ts:130-140` (`migrateSchema`) + `src/repositories/backupRepository.ts:63-104` (`withTransactionAsync` pattern) | role exact, hybrid analog |
| `src/utils/dedupeAssignmentsArray.ts` | NEW | utility (pure) | transform (array → dedup array) | `src/utils/parsing.ts` (`parseAndValidateCategories`) — pure transform with validation | role exact |
| `src/__tests__/periodHelpers.test.ts` | NEW | test | unit (pure functions) | `src/__tests__/dailyAssignments.test.ts:382-394` (BUG-03 `nextDay` describe block) | role + flow exact |
| `src/__tests__/migrationDedup.test.ts` | NEW | test | snapshot/integration (DB) | `src/__tests__/dailyAssignments.test.ts` whole file + `setup/testDatabase.ts` fixtures | role exact |
| `src/__tests__/dedupeAssignmentsArray.test.ts` | NEW | test | unit (pure) | `src/__tests__/dailyAssignments.test.ts` BUG-04 describe block (`addSpontaneous` validation) | role exact |
| `src/services/db.ts` | MOD | service (init) | request-response (boot sequence) | self — extend pattern of `migrateSchema` + `executeSchema` | self-extension |
| `src/services/assignmentService.ts` | MOD | service (orchestration) | CRUD + read-time enrichment | self — extend `getItemsForDate` pattern (lines 21-33) and `ensureAssignmentsForDate` (207-232) | self-extension |
| `src/repositories/assignmentRepository.ts` | MOD | repository (SQL CRUD) | CRUD | self — extend SQL constants pattern (lines 13-49) | self-extension |
| `src/services/backupService.ts` | MOD | service (orchestration) | request-response (file → DB) | self — extend `restoreData` (lines 126-133) | self-extension |
| `src/services/driveBackupService.ts` | MOD | service (transport) | request-response (network → DB) | self — same restore call site delegating to `backupService.restoreData` | self-extension |
| `src/store/useHabitStore.ts` | MOD | store (Zustand) | request-response (UI action → service) | self — `editHabit`/`addHabit` actions (lines 220-234) already wire `updateTodaySnapshotForHabit` | self-extension |
| `src/__tests__/dailyAssignments.test.ts` | MOD | test | unit (extend "Prevención de duplicados" describe) | self (lines 333-362) | self-extension |
| `.planning/codebase/ARCHITECTURE.md` | MOD | docs | — | self (line 281 — fix the false claim about UNIQUE constraint) | self-extension |

---

## Pattern Assignments

### `src/utils/periodHelpers.ts` (NEW — utility, pure transform)

**Analog:** `src/utils/dateHelpers.ts` + `src/services/assignmentService.ts:255-263` (`nextDay`, `formatDateStr`)

**Why analog:** Same role (pure date helper, no DB, no state, no side effects) and same data flow (string → string transform). The existing `nextDay`/`formatDateStr` already establish UTC-safe date arithmetic on `YYYY-MM-DD` prefix strings — exactly what `getISOWeekKey`/`getMonthKey`/`getPeriodKey` need to copy.

**File header pattern to copy** (from `dateHelpers.ts:1-3`):
```typescript
/**
 * dateHelpers.ts — Helpers de formateo y cálculo de fechas compartidos entre screens.
 */

import { MONTH_NAMES } from '../config/constants';
```
→ New file uses same JSDoc top-of-file pattern, named exports only, no default export.

**Core UTC-safe transform pattern to copy** (from `assignmentService.ts:255-263`):
```typescript
export function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateStr(d);
}

function formatDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```
→ `getISOWeekKey` and `getMonthKey` MUST follow same UTC-construction pattern (`new Date(\`${datePrefix}T00:00:00Z\`)`) per Pitfall #2 in research. JSDoc inline + small focused functions ≤ 20 lines (CONVENTIONS.md function size rule).

**Validation pattern to copy** (from `dateHelpers.ts:21-24`):
```typescript
export function isValidDateString(dateStr: string | null | undefined): dateStr is string {
  if (!dateStr) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
```
→ New helpers can do guard-clause early-return for invalid input.

**What this file diverges from analog:** Adds week/month period computation (Thursday-anchor algorithm for ISO 8601 week, simple slice for month). Exports also `getPeriodKey(datePrefix, frequency)` discriminator. No new dependencies.

---

### `src/services/migrations/migrationV1.ts` (NEW — service, transactional batch)

**Analog (primary, role):** `src/services/db.ts:130-140` (`migrateSchema` — existing ad-hoc migration via `PRAGMA table_info`)
**Analog (secondary, atomicity):** `src/repositories/backupRepository.ts:63-104` (`restoreAllData` — uses `db.withTransactionAsync` for atomic multi-step write)

**Why analog:** `migrateSchema` is the only existing migration in the codebase — same role (DDL/data migration on init). It establishes the convention: take `db: SQLiteDatabase` as parameter, no return value, called from `initDatabase`. `restoreAllData` is the closest analog for atomic transactional pattern with `withTransactionAsync`.

**Migration function signature pattern to copy** (from `db.ts:130-140`):
```typescript
async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(habits)',
  );
  const hasIsActive = cols.some((c) => c.name === 'is_active');
  if (!hasIsActive) {
    await db.execAsync(
      'ALTER TABLE habits ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1',
    );
  }
}
```
→ New `migrationV1` takes same `db: SQLite.SQLiteDatabase` param, returns `Promise<void>`, called from `initDatabase` after `migrateSchema`. The version-check (research Pattern 1: `PRAGMA user_version`) replaces the ad-hoc `PRAGMA table_info` check.

**Transactional atomicity pattern to copy** (from `backupRepository.ts:69-103`):
```typescript
await db.withTransactionAsync(async () => {
  await db.runAsync(SQL_CLEAR_MOODS);
  await db.runAsync(SQL_CLEAR_PERFORMED);
  await db.runAsync(SQL_CLEAR_ASSIGNMENTS);
  await db.runAsync(SQL_CLEAR_HABITS);

  for (const h of habits) {
    await db.runAsync(SQL_INSERT_HABIT, [/* ... */]);
  }
  // ... more inserts ...
});
```
→ Migration v1 wraps `[detect duplicates → DELETE losers → assert 0 remaining → CREATE UNIQUE INDEX → PRAGMA user_version = 1]` in a single `withTransactionAsync`. On throw, full rollback (D-08).

**Silent failure pattern (D-06)** — custom for this phase, no exact analog; closest reference is `useHabitStore` error logging (`useHabitStore.ts:108-111`):
```typescript
} catch (err) {
  console.error('[fetchHabitsForDate]', err);
  set({ isLoading: false });
}
```
→ Migration wraps the full transaction in try/catch with `console.error('[migration v1] ...', err)` and continues boot. Convention: `[function name]` prefix for error logs (CONVENTIONS.md §Logging).

**SQL constants placement pattern to copy** (from `assignmentRepository.ts:11-49`):
```typescript
// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_BY_DATE =
  'SELECT * FROM daily_assignments WHERE date = ? ORDER BY ...';
```
→ New `SQL_DEDUPE_VIA_CTE`, `SQL_ASSERT_NO_DUPS`, `SQL_CREATE_UNIQUE_INDEX`, `SQL_SET_USER_VERSION_1` constants at top of migration module.

**What this file diverges from analog:** First versioned migration (`PRAGMA user_version` introduced as new mechanism per research §Don't Hand-Roll); CTE+ROW_NUMBER raw SQL is novel for this codebase; explicit invariant assertion between DELETE and CREATE INDEX (research Pitfall #1) is not in any prior analog.

**Module location decision (Claude's discretion per CONTEXT §Discretion):** Research recommends `src/services/migrations/migrationV1.ts` for separation. Alternative: inline in `db.ts` as `migrationV1_dedupeAndIndex` (Code Example 2 in research). Either is consistent with conventions — planner decides. If split, follow `services/` naming (`camelCase.ts`).

---

### `src/utils/dedupeAssignmentsArray.ts` (NEW — utility, pure transform)

**Analog:** `src/utils/parsing.ts` (`parseAndValidateCategories`) — pure function used by `db.ts` to clean array input before persistence

**Why analog:** Same role (pure validation/cleanup over array), same data flow (input → cleaned output), used at the same layer (called by service before bulk insert). Both must handle edge cases gracefully (malformed input → safe default).

**Pattern to copy** (from `db.ts:152-178` showing how `parseAndValidateCategories` is consumed pre-write):
```typescript
async function sanitizeCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  await sanitizeHabitDefaultCategories(db);
  await sanitizePerformedCategoriesUsed(db);
}

export async function sanitizeHabitDefaultCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; default_categories: string | null }>(/* ... */);
  for (const row of rows) {
    if (row.default_categories == null) continue;
    const cleaned = JSON.stringify(parseAndValidateCategories(row.default_categories));
    if (cleaned !== row.default_categories) {
      await db.runAsync('UPDATE habits SET default_categories = ? WHERE id = ?', [cleaned, row.id]);
    }
  }
}
```
→ `dedupeAssignmentsArray(rows, performed)` is the pre-clean step before `restoreData`'s call to `restoreAllData` (research Pattern 4). Same defensive philosophy: input may be dirty, output must be clean.

**What this file diverges from analog:** Operates on JS array in memory (not DB rows); implements D-03 priority sort (`is_completed` desc → `has_performed` desc → original order asc). Returns dedup'd array, not a string.

---

### `src/__tests__/periodHelpers.test.ts` (NEW — test)

**Analog:** `src/__tests__/dailyAssignments.test.ts:382-394` (BUG-03 describe block — pure function tests for `nextDay`)

**Why analog:** Same role (Jest tests for pure date utility), same data flow (input → output assertions, no DB needed for these specific tests).

**Pattern to copy** (from `dailyAssignments.test.ts:382-394`):
```typescript
describe('BUG-03: UTC-safe date iteration', () => {
  test('nextDay("2026-03-10") returns "2026-03-11" (no drift)', () => {
    expect(nextDay('2026-03-10')).toBe('2026-03-11');
  });

  test('nextDay works across month boundary', () => {
    expect(nextDay('2026-03-31')).toBe('2026-04-01');
  });

  test('nextDay works across year boundary', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
```
→ New file mirrors structure: `describe('getPeriodKey')` with sub-tests for daily/weekly/monthly + boundary cases (year cross, month cross, ISO week edge cases — week 1 vs week 53). No DB fixture needed since helpers are pure.

**What this file diverges from analog:** No `createTestDatabase` setup — pure functions only. Adds REQ-04-12 coverage from research (`getPeriodKey` correct in cruces de año/mes/semana ISO).

---

### `src/__tests__/migrationDedup.test.ts` (NEW — test, integration with DB fixture)

**Analog (primary):** `src/__tests__/dailyAssignments.test.ts` whole file
**Analog (secondary):** `src/__tests__/setup/testDatabase.ts:82-92` (`createTestDatabase` + mock injection)

**Why analog:** Same role (integration tests against in-memory SQLite via `better-sqlite3` mock), same data flow (seed fixture → run service → assert DB state).

**Setup pattern to copy** (from `dailyAssignments.test.ts:54-63`):
```typescript
let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});
```

**Fixture seeding pattern to copy** (from `dailyAssignments.test.ts:294-299`):
```typescript
insertTestHabit(db, { id: 'h1', name: 'Meditar' });
insertTestAssignment(db, {
  id: 'a-old',
  habit_id: 'h1',
  date: TWO_DAYS_AGO,
  is_completed: 1,
});
```
→ New tests will need a `seedDuplicates(db, count, priority)` helper (research §Wave 0 Gaps line 568) — extension of `setup/testDatabase.ts` adding fixture builder for known-duplicate states. Inserting via `insertTestAssignment` will fail today because `testDatabase.ts:67-72` already has the UNIQUE INDEX. **Critical:** the migration test must seed BEFORE the index exists (test variant of `createTestDatabase` that omits `SQL_UNIQUE_INDEX` for the "pre-migration state" fixture, then run migration, then assert index now exists and dups gone).

**Counting helper pattern to copy** (from `dailyAssignments.test.ts:67-82`):
```typescript
function countAssignments(date: string, habitId?: string): number {
  if (habitId) {
    return (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE date = ? AND habit_id = ?',
    ).get(date, habitId) as { c: number }).c;
  }
  return (db.prepare(
    'SELECT COUNT(*) as c FROM daily_assignments WHERE date = ?',
  ).get(date) as { c: number }).c;
}
```
→ Reuse same pattern; add `getUserVersion()` and `hasUniqueIndex()` helpers for assertions on `PRAGMA user_version` and `sqlite_master`.

**What this file diverges from analog:** Requires a "pre-migration" DB variant (no UNIQUE INDEX, populated with deliberate duplicates) that `setup/testDatabase.ts` does NOT currently expose. Plan must add `createPreMigrationTestDatabase()` or a flag option. Covers REQ-04-04..REQ-04-07.

---

### `src/__tests__/dedupeAssignmentsArray.test.ts` (NEW — test, pure)

**Analog:** `src/__tests__/dailyAssignments.test.ts:398-420` (BUG-04 describe block — pure function tests for `addSpontaneous` validation)

**Why analog:** Same role (pure transform tests, no DB), same data flow (input array → assert output shape).

**Pattern to copy** (from lines 398-420):
```typescript
describe('addSpontaneous — BUG-04: category validation', () => {
  test('BUG-04: throws descriptive error when categories contain invalid ID', async () => {
    await expect(addSpontaneous('Test', ['invalid_area_id']))
      .rejects.toThrow(/invalid_area_id/);
  });
  // ...
});
```
→ Tests for `dedupeAssignmentsArray` follow same describe/test naming, same tagging convention with REQ-ID prefix (`'REQ-04-03: ...'`). No DB fixture, just array literals.

**What this file diverges from analog:** Tests three D-03 priority cases: completed wins; tied completion → has_performed wins; full tie → first-in-array wins. Plus pass-through for spontaneous (`habit_id === null`). Covers REQ-04-03.

---

### `src/services/db.ts` (MOD — service, init orchestrator)

**Self-extension** of existing pattern in same file.

**Init sequence pattern to extend** (lines 102-108):
```typescript
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await executeSchema(db);
  await migrateSchema(db);
  await sanitizeCategories(db);
  await seedHabits(db);
}
```
→ Insert `await runMigrations(db)` between `migrateSchema(db)` and `sanitizeCategories(db)` (D-05 — runs automatically at boot, integrated in init sequence; place AFTER `executeSchema` so tables exist, BEFORE `seedHabits` so seed sees clean schema).

**New `runMigrations` function pattern to mirror** (lines 130-140 — `migrateSchema`):
```typescript
async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habits)');
  const hasIsActive = cols.some((c) => c.name === 'is_active');
  if (!hasIsActive) {
    await db.execAsync('ALTER TABLE habits ADD COLUMN ...');
  }
}
```
→ `runMigrations` follows same shape: takes `db`, no return, idempotent, queries `PRAGMA user_version`, dispatches to `migrationV1` if `version < 1` (research Pattern 1, Code Example 2).

**What diverges:** First versioned migration introduces a NEW mechanism (`PRAGMA user_version`) — research already approved; document the introduction in JSDoc on `runMigrations`.

---

### `src/services/assignmentService.ts` (MOD — service, orchestration)

**Self-extension** of existing patterns in same file.

**`ensureAssignmentsForDate` extension target** (lines 207-232) — must become frequency-aware per Open Q1 / Pitfall #5. Recommendation in research is **Opción B** (one row per day, completion propagates). The function's structure is preserved; only the post-insert step adds completion-propagation logic.

**Existing pattern to keep** (lines 207-220):
```typescript
export async function ensureAssignmentsForDate(datePrefix: string): Promise<void> {
  if (isFutureDate(datePrefix)) return;
  const existing = await assignmentRepo.countByDate(datePrefix);
  if (existing > 0) return;

  const [habits, performed] = await Promise.all([
    habitRepo.findAllActive(),
    taskRepo.findByDate(datePrefix),
  ]);

  const performedSet = new Set(performed.map((p) => p.habit_id));
  // ... insert loop ...
}
```
→ Plan must decide whether the `existing > 0` guard remains the same (BUG-01 said yes). The frequency-aware extension is in `getItemsForDate` enrichment (read-time visibility), NOT in this insertion path — period-based completion propagation runs from `completeAssignment` and reads via `getItemsForDate`.

**`getItemsForDate` extension target** (lines 21-33) — adds period-aware enrichment:
```typescript
export async function getItemsForDate(datePrefix?: string): Promise<DailyItem[]> {
  const day = datePrefix ?? getTodayPrefix();
  await ensureAssignmentsForDate(day);

  const [assignments, performed] = await Promise.all([
    assignmentRepo.findByDate(day),
    taskRepo.findByDate(day),
  ]);

  return enrichAssignments(assignments, performed);
}
```
→ Add a parallel call to a NEW repo function `assignmentRepo.findCompletedInPeriod(weekStart, weekEnd, monthStart, monthEnd)` (research Pattern 3 — single aggregated query, NO N+1). Pass result into `enrichAssignments` to compute `isCompletedForPeriod` (Risk R3 — performance critical; hot path).

**Dev invariant pattern to add** (research Code Example 3):
```typescript
if (__DEV__) {
  const dups = await assignmentRepo.findDuplicates();
  if (dups.length > 0) {
    console.warn('[ensureAssignmentsForDate] duplicates detected post-insert', dups);
  }
}
```
→ Insert at end of `ensureAssignmentsForDate`. No analog in current file but matches CONVENTIONS.md error-logging prefix style.

**What diverges:** Period-aware visibility is new business logic; `findCompletedInPeriod` is a brand-new repo function. The data flow changes for weekly/monthly only — daily flow remains unchanged.

---

### `src/repositories/assignmentRepository.ts` (MOD — repository, SQL CRUD)

**Self-extension** of SQL constants and thin-wrapper pattern.

**SQL constant declaration pattern to extend** (lines 13-49):
```typescript
const SQL_BY_DATE = 'SELECT * FROM daily_assignments WHERE date = ? ORDER BY ...';
const SQL_COUNT_BY_DATE = 'SELECT COUNT(*) as count FROM daily_assignments WHERE date = ?';
const SQL_FIND_BY_HABIT_AND_DATE =
  'SELECT * FROM daily_assignments WHERE habit_id = ? AND date = ? LIMIT 1';
```
→ Add new constants:
- `SQL_FIND_DUPLICATES` (research Code Example 1 — `GROUP BY habit_id, date HAVING COUNT(*) > 1`)
- `SQL_FIND_COMPLETED_IN_PERIOD` (Pattern 3 aggregated query, scoped by date range + habit_id list)
- `SQL_DEDUPE_VIA_CTE` (Pattern 2 — the big DELETE statement; can also live in migration module per Claude's discretion)

**Thin-wrapper function pattern to mirror** (lines 60-64):
```typescript
export async function countByDate(datePrefix: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(SQL_COUNT_BY_DATE, [datePrefix]);
  return row?.count ?? 0;
}
```
→ New `findDuplicates()`, `findCompletedInPeriod(habitIds, periodStart, periodEnd)` follow same shape: get db handle, parameterized query, typed return.

**What diverges:** Multi-row aggregated query (`findCompletedInPeriod`) requires dynamic `?,?,?` placeholder list for `IN (...)` clause — first such query in this repo. Plan must standardize the placeholder-building approach (manually generate `?` repeats from array length). No interpolation per CONVENTIONS.md.

---

### `src/services/backupService.ts` (MOD — service, restore orchestration)

**Self-extension** at single call site.

**Existing pattern to extend** (lines 126-133):
```typescript
export async function restoreData(data: BackupData): Promise<void> {
  await backupRepo.restoreAllData(
    data.habits,
    data.performed_habits,
    data.mood_entries,
    data.daily_assignments,
  );
}
```
→ Insert pre-clean step before the `restoreAllData` call (research Pattern 4):
```typescript
const dedupedAssignments = dedupeAssignmentsArray(
  data.daily_assignments,
  data.performed_habits,
);
await backupRepo.restoreAllData(
  data.habits, data.performed_habits, data.mood_entries, dedupedAssignments,
);
```

**What diverges:** New import from `../utils/dedupeAssignmentsArray`. Function still ≤ 20 lines per CONVENTIONS.md.

---

### `src/services/driveBackupService.ts` (MOD — service, transport)

**Self-extension at single call site.**

**Existing pattern (delegate to `backupService.restoreData`):** `driveBackupService.ts:30` imports `restoreData` from `./backupService`. The Drive-side restore eventually calls the same `restoreData` mutated above — **no separate change needed in driveBackupService** if the dedup is centralized in `backupService.restoreData`.

**What diverges:** Verify with planner that the call path Drive → `backupService.restoreData` does not bypass the new dedup. If it bypasses (e.g., calls `backupRepo.restoreAllData` directly anywhere), the change must apply in both places (DRY violation otherwise — CLAUDE.md Regla 3).

---

### `src/store/useHabitStore.ts` (MOD — store, action wiring)

**Self-extension** at `editHabit` and possibly `addHabit` actions.

**Existing pattern** (lines 220-234):
```typescript
addHabit: async (data) => {
  try {
    const habitId = await createHabit(data.name, data.frequency, data.basePoints, data.categories);
    await addAssignmentForHabit(habitId);
    await refreshAll(set, get);
  } catch (err) { console.error('[addHabit]', err); }
},

editHabit: async (id, data) => {
  try {
    await updateHabit(id, data.name, data.frequency, data.basePoints, data.categories);
    await updateTodaySnapshotForHabit(id);
    await refreshAll(set, get);
  } catch (err) { console.error('[editHabit]', err); }
},
```
→ With D-01 (weekly/monthly visible all days, completion 1x per period), the Opción B approach (research Pitfall #5 recommendation) implies `updateTodaySnapshotForHabit` must propagate snapshot updates to all rows of the current period — not just today. Plan must decide whether:
1. Rename/extend service function to `updateCurrentPeriodSnapshotForHabit` and call from same store action, OR
2. Keep current name and have the service internally branch on `frequency`.

**What diverges:** No structural change to store; the store keeps calling the service. Behavior change is in the service per D-01 lifecycle. CONVENTIONS.md: store delegates to services, no business logic.

---

### `src/__tests__/dailyAssignments.test.ts` (MOD — test extension)

**Self-extension** of existing describe block "Prevención de duplicados" (lines 333-362).

**Existing pattern to extend** (lines 333-362):
```typescript
describe('Prevención de duplicados', () => {
  test('el índice UNIQUE impide duplicados a nivel DB para el mismo hábito+fecha', () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: TODAY });

    expect(() => {
      insertTestAssignment(db, { id: 'a2', habit_id: 'h1', date: TODAY });
    }).toThrow(/UNIQUE constraint failed/);
  });
  // ...
});
```
→ Add new tests in this block for REQ-04-10/11 (weekly/monthly visibility one-completion-per-period semantics) and a regression for the new period-aware `getItemsForDate` enrichment. Frequency in `insertTestAssignment` already supports `snapshot_frequency` per `setup/testDatabase.ts:139`.

**What diverges:** Tests use `snapshot_frequency: 'weekly'` and `'monthly'` (already supported by `TestAssignmentOpts`). Need helper to seed `performed_habits` for in-period completion assertions — `insertTestPerformed` does NOT exist yet in `testDatabase.ts` (Plan stage gap).

---

### `.planning/codebase/ARCHITECTURE.md` (MOD — docs)

**Target line:** 281
> "Unique constraint on `(habit_id, date)` for daily_assignments (prevents duplicate assignments)"

**What diverges:** This claim is **currently FALSE** (research §Sources confirms via inspection of `db.ts:87-100`). At end of phase, replace with accurate description: "Partial UNIQUE INDEX `idx_unique_habit_date` on `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL` (introduced in Phase 4 migration v1; spontaneous habits with `habit_id IS NULL` are exempt by design)."

Per CLAUDE.md Regla 3.4: "Actualizar archivos de documentación .md que hayan quedado desactualizados". This is gate criteria for phase close.

---

## Shared Patterns

### Layer separation (applies to ALL service/repo changes)

**Source:** `STRUCTURE.md:84` + `CONVENTIONS.md:153-158`
```
Repositories: Pure data access (SQL only, no business logic)
Services: Business logic + coordination + enrichment
```
→ All new SQL (CTE dedup, `findDuplicates`, `findCompletedInPeriod`) goes in `assignmentRepository.ts` as SQL constants + thin wrappers. All orchestration (transaction wrapping, version checking, invariant assertions, post-DELETE assertion) goes in `db.ts` / `migrations/migrationV1.ts`. **Do not** put `withTransactionAsync` calls inside the repo.

### File header JSDoc (applies to ALL new files)

**Source:** `assignmentService.ts:1-8`, `db.ts:1-6`, `assignmentRepository.ts:1-6`
```typescript
/**
 * <filename>.ts — <one-line purpose en español>.
 *
 * <2-4 line description en español>.
 *
 * <optional: layer constraint, e.g. "Solo los archivos en src/services/ pueden ejecutar SQL directamente.">
 */
```
→ All new files (`periodHelpers.ts`, `migrationV1.ts`, `dedupeAssignmentsArray.ts`, the 3 test files) start with this format. Spanish prose, English code (CONVENTIONS.md rule).

### Error logging prefix (applies to ALL new functions that catch)

**Source:** `useHabitStore.ts:108-111`, CONVENTIONS.md §Logging
```typescript
console.error('[<functionName>]', err);
```
→ Migration v1 catch: `console.error('[migration v1] dedupe+index falló — la DB queda en versión 0', err);`. Dev invariant warn: `console.warn('[ensureAssignmentsForDate] duplicates detected post-insert', dups);`.

### SQL constants UPPER_SNAKE_CASE at top of repo file (applies to MOD assignmentRepository)

**Source:** `assignmentRepository.ts:11-49`, `backupRepository.ts:11-33`
```typescript
// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_BY_DATE = '...';
const SQL_INSERT = '...';
```
→ All new SQL constants follow same naming and grouping. Section divider comment present.

### Test fixture seeding via helpers, not raw SQL (applies to ALL new tests)

**Source:** `testDatabase.ts:118-160` (`insertTestHabit`, `insertTestAssignment`)
→ Tests do not write raw INSERT SQL; they use the fixture helpers. Plan stage must add: `insertTestPerformed(db, opts)`, `seedDuplicates(db, count, priority)`, and a `createPreMigrationTestDatabase()` variant that omits the UNIQUE INDEX.

### Function ≤ 20-25 lines (applies to ALL new and modified functions)

**Source:** CLAUDE.md Regla 3 + CONVENTIONS.md §Function Design
→ Migration v1 will exceed 25 lines if monolithic. Split into: `runMigrations()`, `migrationV1()`, `dedupeViaCTE(db)`, `assertNoDuplicates(db)`, `createUniqueIndex(db)`, `markVersion(db, n)` — each ≤ 20 lines.

### Bug-numbered inline comments (applies to new invariants)

**Source:** code base convention (`assignmentService.ts:91`: `// BUG-04: validar categorias antes de insertar`)
→ For new invariants from REQ-04-XX, use prefix `// REQ-04-XX: ...` or for newly-discovered defenses use `// Bug N: ...` style. Spanish ok per CONTEXT §code_context.

---

## No Analog Found

| File | Role | Data Flow | Reason / Recommendation |
|---|---|---|---|
| (none) | — | — | All targeted files have at least a "self-extension" or in-codebase analog. Research Pattern 1 (`PRAGMA user_version`), Pattern 2 (CTE dedup), Pattern 3 (period helpers) are NEW mechanisms but the surrounding service/repo wiring follows existing analogs. |

---

## Metadata

**Analog search scope:**
- `src/services/` (db.ts, assignmentService.ts, backupService.ts, driveBackupService.ts)
- `src/repositories/` (assignmentRepository.ts, backupRepository.ts)
- `src/utils/` (dateHelpers.ts, parsing.ts)
- `src/store/useHabitStore.ts`
- `src/__tests__/` (dailyAssignments.test.ts, setup/testDatabase.ts)

**Files scanned (read in full):** 9
**Pattern extraction date:** 2026-05-01
**Source files for excerpts:** all line numbers verified against on-disk content.

---

## PATTERN MAPPING COMPLETE
