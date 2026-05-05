# Phase 02: Tech Debt - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 12 (8 modified source files + 4 new test files)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/parsing.ts` | utility | transform | `src/utils/parsing.ts` itself (`parseJsonArray`) | exact — in-place replacement |
| `src/services/db.ts` | service | CRUD | `src/services/db.ts` itself (`sanitizeTable`/`filterValidIds`) | exact — in-place replacement |
| `src/services/habitService.ts` | service | CRUD | `src/services/assignmentService.ts` (`addSpontaneous` BUG-04 block) | exact — same validation-before-write pattern |
| `src/services/backupService.ts` | service | file-I/O | `src/services/backupService.ts` itself (`parseAndValidate`) | exact — in-place refactor |
| `src/hooks/useSpeechRecognition.ts` | hook | event-driven | `src/hooks/useSpeechRecognition.ts` itself | exact — add interfaces, keep structure |
| `src/screens/DailySheetScreen.tsx` | component | request-response | `src/screens/DailySheetScreen.tsx` itself (line 102) | exact — import swap only |
| `src/screens/HabitLibraryScreen.tsx` | component | request-response | `src/screens/HabitLibraryScreen.tsx` itself (line 202) | exact — import swap only |
| `src/components/modals/HabitFormModal.tsx` | component | request-response | `src/components/modals/HabitFormModal.tsx` itself (line 178) | exact — import swap only |
| `src/services/statsService.ts` | service | transform | `src/services/statsService.ts` itself (lines 124-125) | exact — import swap + remove redundant filter |
| `src/__tests__/parsing.test.ts` | test | — | `src/__tests__/dailyAssignments.test.ts` | role-match |
| `src/__tests__/sanitize.test.ts` | test | — | `src/__tests__/dailyAssignments.test.ts` | role-match |
| `src/__tests__/habitService.test.ts` | test | — | `src/__tests__/dailyAssignments.test.ts` (BUG-04 section, lines 397-420) | exact — same error-throw test pattern |
| `src/__tests__/speechRecognition.test.ts` | test | — | `src/__tests__/dailyAssignments.test.ts` (jest.mock pattern, lines 25-35) | role-match — requires require() mock instead of DB mock |

---

## Pattern Assignments

### `src/utils/parsing.ts` (utility, transform)

**Analog:** `src/utils/parsing.ts` (same file — in-place replacement)

**Existing function to replace** (lines 1-13):
```typescript
/**
 * parsing.ts — Utilidades de parseo compartidas entre services, screens y componentes.
 */

/** Parsea un JSON de array de strings de forma segura. Devuelve [] ante cualquier error. */
export function parseJsonArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
```

**Pattern to keep:** `try/catch` + `Array.isArray` guard + return `[]` on failure.

**What to add:** import `VALID_AREA_IDS` from constants, add `for...of` loop splitting valid/invalid, emit `console.warn` with invalid IDs.

**New import** (add at top of file):
```typescript
import { VALID_AREA_IDS } from '../config/constants';
```

**New JSDoc pattern** (follows project convention — descriptions in Spanish):
```typescript
/**
 * Parsea un JSON de array de categorías de forma segura.
 * Filtra IDs inválidos silenciosamente y emite console.warn con los descartados.
 * Retorna [] ante cualquier error de parsing.
 */
```

---

### `src/services/db.ts` — `sanitizeHabitDefaultCategories` + `sanitizePerformedCategoriesUsed` (service, CRUD)

**Analog:** `src/services/db.ts` itself — `sanitizeTable` (lines 152-170) + `filterValidIds` (lines 172-181) are the patterns being replaced.

**Existing caller to preserve** (line 147-149):
```typescript
async function sanitizeCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  await sanitizeTable(db, 'habits', 'default_categories');
  await sanitizeTable(db, 'performed_habits', 'categories_used');
}
```

**Pattern to extract from `sanitizeTable`** (lines 152-170):
- `db.getAllAsync<ExplicitShape>(STATIC_SQL)` — copy the `getAllAsync` + `for...of` + `db.runAsync` structure
- Replace `{ id: string; [key: string]: any }` with the per-table explicit shape
- Replace `filterValidIds(row[column])` with `JSON.stringify(parseAndValidateCategories(row.X))`
- Replace dynamic template SQL strings with static string literals

**Existing `filterValidIds` core logic** (lines 172-181) — moves into `parseAndValidateCategories`:
```typescript
function filterValidIds(json: string): string {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return '[]';
    const filtered = arr.filter((id: string) => VALID_AREA_IDS.has(id));
    return JSON.stringify(filtered);
  } catch {
    return '[]';
  }
}
```
Note: this function is **deleted entirely**. Its logic is absorbed by the new parser.

**Import needed** (add to existing db.ts imports):
```typescript
import { parseAndValidateCategories } from '../utils/parsing';
```

**Existing `getAllAsync` typed pattern in db.ts** (line 130-133 — migrateSchema, same style to copy):
```typescript
const cols = await db.getAllAsync<{ name: string }>(
  'PRAGMA table_info(habits)',
);
```

---

### `src/services/habitService.ts` — `createHabit` + `updateHabit` (service, CRUD)

**Analog:** `src/services/assignmentService.ts` — `addSpontaneous` function, BUG-04 block (lines 91-97).

**BUG-04 pattern to copy verbatim** (lines 91-97):
```typescript
// BUG-04: validar categorias antes de insertar
const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
if (invalidIds.length > 0) {
  throw new Error(
    `addSpontaneous: categorias invalidas — ${invalidIds.join(', ')}`,
  );
}
```

**What to adapt:** Change the error prefix from `addSpontaneous:` to the calling function name (`createHabit:` or `updateHabit:`). Keep the em-dash `—` and the same `invalidIds.join(', ')` format.

**Existing `createHabit` signature** (lines 96-103):
```typescript
export async function createHabit(
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<string> {
  return habitRepo.insert(name, frequency, basePoints, JSON.stringify(categories));
}
```
Insert validation block immediately before the `return habitRepo.insert(...)` line. Same for `updateHabit` (lines 105-113) before `return habitRepo.update(...)`.

**Import needed** (add to existing habitService.ts imports):
```typescript
import { VALID_AREA_IDS } from '../config/constants';
```

---

### `src/services/backupService.ts` — `parseAndValidate` (service, file-I/O)

**Analog:** `src/services/backupService.ts` itself — `parseAndValidate` (lines 80-99) is the function being refactored in-place.

**Existing function with the two `as` casts to eliminate** (lines 80-99):
```typescript
function parseAndValidate(json: string): BackupData {
  const data = JSON.parse(json) as Partial<BackupData>;  // ← cast #1 to remove

  if (!data.version || !Array.isArray(data.habits)) {
    throw new Error('Formato de respaldo inválido');
  }
  if (!Array.isArray(data.performed_habits)) {
    throw new Error('Falta performed_habits en el respaldo');
  }
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo');
  }
  return {
    ...data,
    daily_assignments: Array.isArray(data.daily_assignments) ? data.daily_assignments : [],
  } as BackupData;  // ← cast #2 to remove
}
```

**Pattern to introduce:** Parse to `unknown`, narrow to `Record<string, unknown>` with inline type guard, then shape-check each field before final return (no `as` at the return site).

**`BackupData` interface shape** (from `src/types/index.ts`):
```typescript
export interface BackupData {
  version: number;
  exportedAt: string;
  habits: Habit[];
  performed_habits: PerformedHabit[];
  mood_entries: MoodEntry[];
  daily_assignments: DailyAssignment[];
}
```

**Note:** The existing `throw new Error('Formato de respaldo inválido')` message strings are the project's established Spanish error strings — preserve them exactly. The signature `function parseAndValidate(json: string): BackupData` stays the same.

---

### `src/hooks/useSpeechRecognition.ts` (hook, event-driven)

**Analog:** `src/hooks/useSpeechRecognition.ts` itself — the file structure is preserved, two interfaces are added above the module-level `let SpeechModule` declaration.

**Existing `any` occurrences to eliminate:**

Line 16 — module declaration:
```typescript
let SpeechModule: any = null;
```

Line 41 — event callback:
```typescript
const sub = SpeechModule.addResultListener?.((event: any) => {
```

**Pattern for `require()` + try/catch** (lines 17-22) — keep exactly, only change the type annotation on line 16:
```typescript
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SpeechModule = require('expo-speech-recognition');
} catch {
  // Módulo no disponible
}
```

**Interfaces to insert before the `let SpeechModule` declaration:**
- `SpeechRecognitionEvent` with `results?: Array<{ transcript: string }>`
- `SpeechModuleInterface` with `addResultListener` and `ExpoSpeechRecognitionModule` typed to the exact surface already used in the hook body

**Verification:** After edit, `grep -n "any" src/hooks/useSpeechRecognition.ts` must return 0 results.

---

### Call-site migrations (4 files — import swap only)

All four files follow the identical pattern: single import line change + function name change at usage site.

**`src/screens/DailySheetScreen.tsx` (line 34 + line 102)**

Existing import (line 34):
```typescript
import { parseJsonArray } from '../utils/parsing';
```
Usage (line 102):
```typescript
const ids = parseJsonArray(categories);
```

**`src/screens/HabitLibraryScreen.tsx` (line 19 + line 202)**

Existing import (line 19):
```typescript
import { parseJsonArray } from '../utils/parsing';
```
Usage (line 202):
```typescript
const cats = parseJsonArray(habit.default_categories);
```

**`src/components/modals/HabitFormModal.tsx` (line 19 + line 178)**

Existing import (line 19):
```typescript
import { parseJsonArray } from '../../utils/parsing';
```
Usage (line 178):
```typescript
setCats(parseJsonArray(habit.default_categories));
```

**`src/services/statsService.ts` (line 12 + lines 124-125)**

Existing imports (lines 11-12):
```typescript
import { VALID_AREA_IDS } from '../config/constants';
import { parseJsonArray } from '../utils/parsing';
```
Existing usage (lines 124-125):
```typescript
const rawCats = parseJsonArray(row.categories_used);
const cats = [...new Set(rawCats)].filter((id) => VALID_AREA_IDS.has(id as never));
```

**Note for statsService.ts only:** Remove the `import { VALID_AREA_IDS }` line if it is no longer used after the migration (the parser centralizes the filter). Also collapse lines 124-125 into one line. The `VALID_AREA_IDS` import may still be needed if used elsewhere in the file — verify before removing.

---

## Shared Patterns

### Error throw style for invalid category IDs
**Source:** `src/services/assignmentService.ts` lines 91-97 (BUG-04)
**Apply to:** `habitService.ts` — `createHabit` and `updateHabit`
```typescript
const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
if (invalidIds.length > 0) {
  throw new Error(
    `createHabit: categorias invalidas — ${invalidIds.join(', ')}`,
  );
}
```

### `getAllAsync<ExplicitShape>` typed SQL pattern
**Source:** `src/services/db.ts` lines 130-133 (`migrateSchema`)
**Apply to:** both new sanitize functions in `db.ts`
```typescript
const cols = await db.getAllAsync<{ name: string }>(
  'PRAGMA table_info(habits)',
);
```

### JSDoc in Spanish with standard params format
**Source:** `src/services/db.ts` lines 143-146 (`sanitizeCategories` JSDoc)
**Apply to:** all new functions in `parsing.ts`, `db.ts`, `habitService.ts`
```typescript
/**
 * Descripción funcional en español.
 * Segunda línea con detalle si aplica.
 */
```

### `console.warn` for discarded data (D-14)
**Source:** No existing analog — new pattern introduced in `parseAndValidateCategories`.
**Apply to:** `parsing.ts` only — single `console.warn` inside the parser for invalid IDs.

---

## Test File Patterns

### Test boilerplate from `src/__tests__/dailyAssignments.test.ts`

**`src/__tests__/parsing.test.ts`**

No DB needed (pure function tests). Pattern to follow: direct import of the function, no mocks.

```typescript
import { parseAndValidateCategories } from '../utils/parsing';

describe('parseAndValidateCategories', () => {
  test('retorna solo IDs válidos de un array bien formado', () => { ... });
  test('retorna [] para JSON malformado', () => { ... });
  test('retorna [] para JSON que no es array', () => { ... });
  test('filtra IDs inválidos y emite console.warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // ...
    warnSpy.mockRestore();
  });
  test('retorna [] para array vacío', () => { ... });
});
```

**`src/__tests__/sanitize.test.ts`**

Requires in-memory DB. Use full `testDatabase` setup.

**Setup boilerplate to copy from `dailyAssignments.test.ts` lines 16-63:**
```typescript
import type Database from 'better-sqlite3';
import { createTestDatabase, resetTestDatabase, insertTestHabit } from './setup/testDatabase';

jest.mock('../services/db', () => {
  const actual = jest.requireActual('../services/db');
  return { ...actual };
  // Note: sanitize functions take a db parameter — no date mocking needed
});

import { sanitizeHabitDefaultCategories, sanitizePerformedCategoriesUsed } from '../services/db';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});
```

Note: `sanitizeHabitDefaultCategories` and `sanitizePerformedCategoriesUsed` are currently private (not exported). They will need to be exported from `db.ts` for test purposes, or the test must call them indirectly via `initDatabase` (verify during planning which approach is preferred given the "layer separation" convention).

**`src/__tests__/habitService.test.ts`**

Requires in-memory DB (validates that service throws before repo is called). Closest pattern: BUG-04 tests in `dailyAssignments.test.ts` lines 397-420.

```typescript
// BUG-04 test pattern — copy structure exactly:
describe('addSpontaneous — BUG-04: category validation', () => {
  test('BUG-04: throws descriptive error when categories contain invalid ID', async () => {
    await expect(addSpontaneous('Test', ['invalid_area_id']))
      .rejects.toThrow(/invalid_area_id/);
  });
  test('BUG-04: throws error listing ALL invalid IDs', async () => {
    await expect(addSpontaneous('Test', ['salud_fisica', 'fake_id']))
      .rejects.toThrow(/fake_id/);
  });
  test('BUG-04: succeeds with all valid categories', async () => {
    await expect(addSpontaneous('Logro', ['salud_fisica', 'mental']))
      .resolves.toBeUndefined();
  });
  test('BUG-04: succeeds with empty categories array', async () => {
    await expect(addSpontaneous('Logro', []))
      .resolves.toBeUndefined();
  });
});
```
Adapt: replace `addSpontaneous` with `createHabit`/`updateHabit`, adjust `rejects.toThrow` regex to match the new error message prefix.

**`src/__tests__/speechRecognition.test.ts`**

No DB needed. Uses `jest.mock` to control the `require('expo-speech-recognition')` call.

**`jest.mock` pattern to adapt from `dailyAssignments.test.ts` lines 25-35:**
```typescript
jest.mock('../services/db', () => {
  const actual = jest.requireActual('../services/db');
  const mockGetTodayPrefix = jest.fn(() => TODAY);
  return { ...actual, getTodayPrefix: mockGetTodayPrefix, ... };
});
```

For `speechRecognition.test.ts`, the mock target is `expo-speech-recognition` (a native module), not `services/db`. Pattern:
```typescript
jest.mock('expo-speech-recognition', () => ({
  addResultListener: jest.fn(() => ({ remove: jest.fn() })),
  ExpoSpeechRecognitionModule: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));
```
For the "module unavailable" path, use `jest.mock('expo-speech-recognition', () => { throw new Error('not available'); })` — but note this needs to be in a separate `describe` block since jest.mock is hoisted. Consider using `jest.doMock` for the per-test case.

---

## Data Factory Patterns (from `testDatabase.ts`)

**`TestHabitOpts` interface** (lines 108-115) — copy verbatim for any test that seeds habits:
```typescript
export interface TestHabitOpts {
  id: string;
  name: string;
  frequency?: string;
  base_points?: number;
  default_categories?: string;  // JSON string, e.g. '["salud_fisica"]'
  is_active?: number;
}
```

**`insertTestHabit`** (lines 118-130) — use directly from `./setup/testDatabase` import. For sanitize tests, seed habits with invalid category JSON in `default_categories` to test the cleanup:
```typescript
insertTestHabit(db, {
  id: 'h1',
  name: 'Test',
  default_categories: '["salud_fisica","invalid_id"]',
});
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/utils/`, `src/services/`, `src/hooks/`, `src/screens/`, `src/components/`, `src/__tests__/`, `__mocks__/`
**Files scanned:** 14
**Pattern extraction date:** 2026-04-26
