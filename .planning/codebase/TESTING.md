# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**
- Jest 30.3.0
- Config: `jest.config.js`
- Transform: ts-jest with TypeScript strict mode disabled during tests (diagnostics: false)

**Test Environment:**
- `testEnvironment: 'node'` — no DOM, direct SQLite testing

**Assertion Library:**
- Jest built-in matchers (expect)

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

## Test File Organization

**Location:**
- Tests co-located in `src/__tests__/` directory
- Setup utilities in `src/__tests__/setup/`
- Mocks in `__mocks__/` at project root

**Naming:**
- Test files: `descriptiveName.test.ts` (e.g., `dailyAssignments.test.ts`)
- Mocks mimic package structure: `__mocks__/expo-sqlite.ts` for `expo-sqlite`

**Matching Pattern:**
- `testMatch: ['<rootDir>/src/__tests__/**/*.test.ts']`
- Only `.test.ts` files in `src/__tests__/` are run
- TypeScript transformed via ts-jest before execution

## Test Structure

**Suite Organization:**
- Single root `describe()` per major function or class
- Multiple nested `describe()` blocks for related behaviors

**Example from `src/__tests__/dailyAssignments.test.ts`:**
```typescript
describe('ensureAssignmentsForDate', () => {
  test('crea asignaciones para todos los hábitos activos en hoy', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar', base_points: 2 });
    insertTestHabit(db, { id: 'h2', name: 'Caminar', base_points: 3 });

    await ensureAssignmentsForDate(TODAY);

    expect(countAssignments(TODAY, 'h1')).toBe(1);
    expect(countAssignments(TODAY, 'h2')).toBe(1);
  });

  test('NO crea asignaciones para fechas futuras', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    await ensureAssignmentsForDate(TOMORROW);
    expect(countAssignments(TOMORROW)).toBe(0);
  });
});
```

**Patterns:**
- Uses `test()` for individual test cases (alias for `it()`)
- Spanish test descriptions matching business requirements
- Arrange-Act-Assert structure implicit in naming

**Setup/Teardown:**
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

- `beforeEach`: Fresh in-memory SQLite database
- `afterEach`: Database closed and mock cleared
- `jest.clearAllMocks()` ensures mock state doesn't leak between tests

## Mocking

**Framework:** Jest manual mocks with better-sqlite3

**Mock Structure:**
- `__mocks__/expo-sqlite.ts`: Wraps better-sqlite3 with async API
- `__mocks__/expo-crypto.ts`: Uses Node.js `crypto.randomUUID()`

**Example — expo-sqlite mock from `__mocks__/expo-sqlite.ts`:**
```typescript
let _mockDb: Database.Database | null = null;

export function setMockDatabase(db: Database.Database): void {
  _mockDb = db;
}

class MockSQLiteDatabase {
  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = getDb().prepare(sql);
    return stmt.all(...params) as T[];
  }
}

export async function openDatabaseAsync(_name: string): Promise<MockSQLiteDatabase> {
  return _sharedInstance;
}
```

**Mock Injection:**
- Test database created via `createTestDatabase()` in `src/__tests__/setup/testDatabase.ts`
- Mock instance injected via `setMockDatabase(_db)`
- Same approach for mocking time-based functions (e.g., `getTodayPrefix`)

**Time-Based Function Mocks:**
From `src/__tests__/dailyAssignments.test.ts`:
```typescript
jest.mock('../services/db', () => {
  const actual = jest.requireActual('../services/db');
  return {
    ...actual,
    getTodayPrefix: jest.fn(() => TODAY),
    getNowTimestamp: jest.fn(() => `${TODAY} 10:00:00`),
    getTimestampForDate: jest.fn((date: string) => `${date} 10:00:00`),
  };
});
```

**What to Mock:**
- Database operations (via better-sqlite3 in-memory)
- Time-based functions (return fixed dates for deterministic tests)
- External services (not yet present in codebase)

**What NOT to Mock:**
- Repository functions (test via actual database)
- Service coordination logic (test actual interaction patterns)
- Type definitions or utility functions

## Fixtures and Factories

**Test Data Creation:**
- Seed functions in `src/__tests__/setup/testDatabase.ts`
- No dedicated factory pattern; direct insertion via SQL helpers

**Example from `testDatabase.ts`:**
```typescript
export interface TestHabitOpts {
  id: string;
  name: string;
  frequency?: string;
  base_points?: number;
  default_categories?: string;
  is_active?: number;
}

export function insertTestHabit(db: Database.Database, opts: TestHabitOpts): void {
  db.prepare(`
    INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.name,
    opts.frequency ?? 'daily',
    opts.base_points ?? 1,
    opts.default_categories ?? '[]',
    opts.is_active ?? 1,
  );
}
```

**Location:**
- `src/__tests__/setup/testDatabase.ts` — Database setup and seed helpers
- Reusable across all test files

**Test Constants:**
- Fixed test dates defined at module level: `const TODAY = '2026-03-11'`
- Ensures deterministic test results

## Coverage

**Requirements:** Not enforced (no minimum threshold configured)

**View Coverage:**
```bash
npm run test:coverage
```

Generates `coverage/` directory with HTML report.

## Test Types

**Unit Tests:**
- Focus: Individual repository and service functions
- Scope: Business logic in isolation (e.g., daily assignment generation)
- Approach: Test all branches, edge cases, and error conditions
- Example: `ensureAssignmentsForDate` tests cover today, future dates, missing habits, idempotence

**Integration Tests:**
- Focus: Service coordination with database
- Scope: Multi-step workflows (e.g., adding assignment, completing it, checking history)
- Approach: Test via full data flow with real schema
- Example: Backfill history test (`checkAndBackfillHistory`) verifies date range handling

**E2E Tests:**
- Status: Not implemented
- Rationale: React Native app; E2E would require device/emulator, adding test complexity

## Common Patterns

**Async Testing:**
```typescript
test('agrega asignación al día de hoy al activar un hábito', async () => {
  insertTestHabit(db, { id: 'h1', name: 'Meditar' });

  await addAssignmentForHabit('h1');

  expect(countAssignments(TODAY, 'h1')).toBe(1);
});
```

- Functions are `async`
- `await` all Promise-returning calls
- Jest automatically waits for promise resolution

**Null/Error Testing:**
```typescript
test('no hace nada si el hábito no existe', async () => {
  await addAssignmentForHabit('inexistente');

  expect(countAssignments(TODAY)).toBe(0);
});
```

- Services return silently on missing dependencies
- Verify side effects don't occur (counts remain unchanged)

**Unique Constraint Testing:**
```typescript
test('el índice UNIQUE impide duplicados a nivel DB para el mismo hábito+fecha', () => {
  insertTestHabit(db, { id: 'h1', name: 'Meditar' });
  insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: TODAY });

  expect(() => {
    insertTestAssignment(db, { id: 'a2', habit_id: 'h1', date: TODAY });
  }).toThrow(/UNIQUE constraint failed/);
});
```

- Synchronous database operations test constraint enforcement
- `expect().toThrow()` matches error message patterns

**Idempotence Testing:**
```typescript
test('es idempotente — doble llamada no genera duplicados', async () => {
  insertTestHabit(db, { id: 'h1', name: 'Meditar' });

  await ensureAssignmentsForDate(TODAY);
  await ensureAssignmentsForDate(TODAY);

  expect(countAssignments(TODAY, 'h1')).toBe(1);
});
```

- Critical for operations like `ensureAssignmentsForDate` that should be safe to call multiple times
- Verify count remains constant after repeated calls

**Database Setup:**
```typescript
const SQL_CREATE_HABITS = `
  CREATE TABLE IF NOT EXISTS habits (...)
`;

export function createTestDatabase(): Database.Database {
  _db = new Database(':memory:');
  _db.pragma('foreign_keys = ON');
  _db.exec(SQL_CREATE_HABITS);
  _db.exec(SQL_UNIQUE_INDEX);
  setMockDatabase(_db);
  return _db;
}
```

- In-memory database (`':memory:'`) isolated per test
- Schema matches production exactly
- Foreign keys and UNIQUE constraints enforced
- No impact on production data

---

*Testing analysis: 2026-03-17*
