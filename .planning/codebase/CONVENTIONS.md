# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- Repository files: `camelCaseRepository.ts` (e.g., `habitRepository.ts`, `assignmentRepository.ts`)
- Service files: `camelCaseService.ts` (e.g., `habitService.ts`, `assignmentService.ts`)
- Component files: `PascalCase.tsx` (e.g., `BottomSheet.tsx`, `NotebookPaper.tsx`)
- Style files: `PascalCase.styles.ts` (e.g., `BottomSheet.styles.ts`, `HabitFormModal.styles.ts`)
- Hook files: `useCamelCase.ts` (e.g., `useFeedback.ts`, `useSpeechRecognition.ts`)
- Utility files: `camelCase.ts` (e.g., `dateHelpers.ts`, `statsHelpers.ts`)
- Type files: `index.ts` for main type definitions
- Test files: `descriptiveName.test.ts` (e.g., `dailyAssignments.test.ts`)

**Functions:**
- Regular functions: `camelCase` (e.g., `getItemsForDate`, `ensureAssignmentsForDate`, `buildStats`)
- Async functions: marked with `async` keyword (e.g., `async function completeAssignment`)
- Internal helpers: prefixed with underscore pattern `_name` for truly private utilities
- SQL statement constants: `UPPER_SNAKE_CASE` in groups at top of repository files (e.g., `SQL_BY_DATE`, `SQL_INSERT`)

**Variables:**
- Constants (module-level): `UPPER_SNAKE_CASE` (e.g., `EMPTY_STATS`, `DB_NAME`, `MOOD_DEFAULT_VALUE`)
- Regular variables: `camelCase` (e.g., `viewDate`, `dailyItems`, `translateY`)
- Boolean variables: often prefixed with `is` or `has` (e.g., `isCompleted`, `isSpontaneous`, `hapticsEnabled`)
- React state from Zustand: `camelCase` (e.g., `pendingReflection`, `libraryHabits`)

**Types & Interfaces:**
- Interfaces: `PascalCase` (e.g., `Habit`, `DailyItem`, `BottomSheetProps`, `HabitState`)
- Type unions: `PascalCase` (e.g., `DailyHabit extends Habit`)
- Database rows: match SQLite column names with snake_case (e.g., `habit_id`, `base_points`, `is_completed`)
- View/enriched types use camelCase fields (e.g., `assignmentId`, `habitId`, `performedHabitId`)

## Code Style

**Formatting:**
- Language: TypeScript (strict mode enabled in tsconfig.json)
- Indent: 2 spaces
- Line length: No hard limit enforced, aim for readability
- Quotes: Single quotes for strings (`'string'`)
- Semicolons: Required (enforced implicitly)
- Trailing commas: Use in multi-line objects/arrays

**Linting:**
- No ESLint config file detected — rely on TypeScript strict mode
- No Prettier config file detected — manual formatting according to patterns above
- Jest runs without additional lint passes before tests

## Import Organization

**Order:**
1. External libraries (React, React Native, Expo)
2. Type-only imports (`import type { ... }`)
3. Internal services and repositories (`import * as serviceName from ...`)
4. Internal utilities and helpers (`import { function } from ...`)
5. Constants (`import { CONSTANT } from ...`)
6. Store imports (`import { useStore } from ...`)

**Example pattern from `assignmentService.ts`:**
```typescript
import { getTodayPrefix, getTimestampForDate, getNowTimestamp } from './db';
import * as assignmentRepo from '../repositories/assignmentRepository';
import * as habitRepo from '../repositories/habitRepository';
import type { DailyItem, DailyStats, DailyAssignment } from '../types';
import { buildStats } from '../utils/statsHelpers';
```

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in tsconfig.json)
- Prefer explicit relative paths over aliases in current codebase

## Error Handling

**Patterns:**
- Repositories return `null` for "not found" queries (e.g., `findById` returns `Habit | null`)
- Services handle null gracefully and return early if required entities don't exist
- SQL errors propagate up (no try-catch in repositories)
- Optional values use nullish coalescing: `value ?? defaultValue`

**Example from `assignmentService.ts`:**
```typescript
const habit = await habitRepo.findById(habitId);
if (!habit) return; // Silent failure if habit doesn't exist
```

**Error Recovery:**
- Validation data on import uses try-catch with fallback defaults (e.g., `filterValidIds` returns `'[]'` on JSON parse error)
- No alert/toast shown for data validation failures — logged to console only if needed

## Logging

**Framework:** `console` (no dedicated logger)

**Patterns:**
- Minimal console logging in production code
- Tests use JSDoc comments to document behavior instead
- Database operations log via error propagation (stack traces on failure)

## Comments

**When to Comment:**
- File headers: Always use JSDoc block at top of file describing purpose
- Section dividers: Use visual separators `// ─── Section Name ───────` to organize code into logical blocks
- Complex logic: Inline comments for non-obvious business logic
- Bug fixes: Reference issue numbers when commenting workarounds (e.g., `// Bug 3: never assign to future dates`)

**JSDoc/TSDoc:**
- Function headers: Describe purpose and parameters when non-obvious
- Example from `assignmentService.ts`:
```typescript
/**
 * Agrega una asignación para un hábito en la fecha dada (solo si no existe).
 * Se usa al crear o re-activar un hábito desde la Biblioteca.
 * Solo afecta al día de hoy — nunca toca días pasados.
 */
export async function addAssignmentForHabit(...)
```

## Function Design

**Size:** Keep functions under 25 lines where possible. Refactor complex logic into helpers.

**Parameters:**
- Use optional parameters with defaults (e.g., `datePrefix?: string`)
- Destructure object parameters when accepting multiple options
- Pass `datePrefix` explicitly to functions that need date context

**Return Values:**
- Queries return typed data (e.g., `Promise<Habit[]>`, `Promise<DailyStats>`)
- Mutations return void or the created ID
- Services enrich raw repository data before returning to consumers

**Example pattern:**
```typescript
export async function ensureAssignmentsForDate(datePrefix: string): Promise<void> {
  if (datePrefix > getTodayPrefix()) return; // Guard clause
  // ... implementation
}
```

## Module Design

**Exports:**
- Repositories export all functions as named exports (no default export)
- Services export public functions as named exports
- Stores export single instance via named export: `export const useHabitStore = create<HabitState>(...)`

**Barrel Files:**
- `src/types/index.ts` exports all type definitions
- No other barrel files; prefer explicit imports

**Layer Separation:**
- Repositories: Pure data access (SQL only, no business logic)
- Services: Business logic + coordination + enrichment
- Stores: State management (Zustand), delegates to services
- Components: UI rendering, call store actions
- Utils: Pure functions, no side effects

**Exception — Drive operations:**
Screens (`SettingsScreen`, `RestoreFromDriveScreen`) call `driveBackupService` directly, bypassing the store layer. Drive ops are stateless (no cached state, transient tokens) — adding a store would only duplicate boilerplate. This is an intentional exception documented here.

## Phase 1 v1.1 Conventions (2026-05-13)

The following rules were established during Phase 1 of v1.1.

**Date handling:**
- Para "hoy" usar `getLocalDayKey()` desde `src/utils/date.ts`. NUNCA `new Date().toISOString().slice(0,10)` (eso resuelve en UTC y rompe en zonas con offset negativo cerca de medianoche).
- `src/utils/date.ts` es la SoT para helpers de fecha; no agregar nuevos helpers en `db.ts` ni duplicar lógica en `dateHelpers.ts`.

**Migrations:**
- Versionadas mediante `PRAGMA user_version`. Cada nueva migration vive en `src/services/migrations/migrationVN.ts` siguiendo el template de `migrationV1.ts` (un solo archivo, función async, idempotente).
- Si la migration es schema-breaking, **RETHROW en catch** (vs. silent log) para activar la `MigrationErrorScreen` vía `bootSequence`. El silent-catch deja el DB en estado parcial y oculta el bug al usuario.

**Repositories:**
- SQL constants al tope del archivo (`UPPER_SNAKE_CASE`, e.g., `SQL_INSERT`, `SQL_BY_DATE`).
- **No business logic en repos** — funciones "tontas": thin wrappers sobre `db.getAllAsync` / `getFirstAsync` / `runAsync`. Cualquier validación, enriquecimiento o coordinación va en `services/`.

---

*Convention analysis: 2026-03-17*
*Phase 1 v1.1 addendum: 2026-05-13*
