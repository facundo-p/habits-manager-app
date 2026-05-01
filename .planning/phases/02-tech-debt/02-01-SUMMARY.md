---
phase: 02-tech-debt
plan: 01
subsystem: utils + services + tests
tags: [debt-02, debt-03, debt-01, parser, validation, wave-0]
requires:
  - VALID_AREA_IDS (src/config/constants.ts)
  - assignmentService.addSpontaneous BUG-04 pattern (reference)
provides:
  - parseAndValidateCategories (src/utils/parsing.ts) — único punto de parsing+validación de categorías
  - createHabit/updateHabit pre-write category validation (D-15)
  - 4 Wave 0 test stub files (parsing, sanitize, habitService, speechRecognition)
affects:
  - src/utils/parsing.ts (parseJsonArray removed; replaced by parseAndValidateCategories)
  - src/services/habitService.ts (validation block added in createHabit and updateHabit)
  - src/__tests__/parsing.test.ts (new — 5 tests GREEN)
  - src/__tests__/sanitize.test.ts (new — 2 it.todo placeholders, RED until plan 02-02)
  - src/__tests__/habitService.test.ts (new — 4 tests GREEN)
  - src/__tests__/speechRecognition.test.ts (new — 2 it.todo placeholders, RED until plan 02-03)
tech-stack:
  added: []
  patterns:
    - try/catch + Array.isArray guard (preserved from parseJsonArray)
    - VALID_AREA_IDS.has() whitelist filter (D-14)
    - console.warn on discarded data (D-14)
    - filter-then-throw validation block (BUG-04 pattern, em-dash separator)
key-files:
  created:
    - src/__tests__/parsing.test.ts
    - src/__tests__/sanitize.test.ts
    - src/__tests__/habitService.test.ts
    - src/__tests__/speechRecognition.test.ts
    - .planning/phases/02-tech-debt/02-01-SUMMARY.md
  modified:
    - src/utils/parsing.ts
    - src/services/habitService.ts
decisions:
  - parseAndValidateCategories signature is (json: string): string[] — null-check happens at sanitizer call site (per RESOLVED open question 2)
  - Write-time validation lives inline in habitService (per RESOLVED open question 1) — no shared helper exported from parsing.ts
  - parseJsonArray removed entirely (no temporary alias); 4 call sites stay on the old name until plan 02-02 migrates them
metrics:
  duration: ~25 minutes
  completed: 2026-04-27T03:14:21Z
  tasks_completed: 3
  files_changed: 6
requirements:
  - DEBT-02
---

# Phase 2 Plan 01: Wave 0 Tests + Central Category Parser + Write-Time Validation Summary

Parser central de categorías `parseAndValidateCategories` (filter contra `VALID_AREA_IDS` + `console.warn` D-14) reemplaza `parseJsonArray` en `src/utils/parsing.ts`; `createHabit`/`updateHabit` ahora rechazan IDs inválidos antes del INSERT/UPDATE (D-15) replicando el patrón BUG-04; 4 archivos de tests Wave 0 quedan establecidos (2 verdes, 2 con `it.todo` para los planes 02-02/02-03).

## What Got Built

### 1. `parseAndValidateCategories` — parser central (DEBT-02 partial, D-14)

**Ubicación:** `src/utils/parsing.ts`

**Firma final:** `parseAndValidateCategories(json: string): string[]`

**Comportamiento ante inputs:**

| Input | Output | Side effect |
|-------|--------|-------------|
| `'["salud_fisica","mental"]'` | `['salud_fisica','mental']` | — |
| `'["salud_fisica","fake_id"]'` | `['salud_fisica']` | `console.warn('[parseAndValidateCategories] IDs de área inválidos descartados:', ['fake_id'])` |
| `'{not json'` | `[]` | — |
| `'{"foo":1}'` | `[]` | — |
| `'[]'` | `[]` | — |
| Array con items no-string | `valid:[]`, los items se convierten via `String(id)` para el warn | warn si hubo descartes |

- Preserva el orden del array de entrada (filter, no sort).
- No serializa al output — devuelve `string[]`.
- `parseJsonArray` queda eliminada por completo (no alias temporal).

### 2. Validación pre-write en `habitService` (D-15)

**Ubicación:** `src/services/habitService.ts` (en `createHabit` y `updateHabit`)

**Patrón:** copia verbatim del bloque BUG-04 (`assignmentService.addSpontaneous` líneas 91–97), cambia el prefijo del mensaje al nombre de la función actual:

```typescript
const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
if (invalidIds.length > 0) {
  throw new Error(
    `createHabit: categorias invalidas — ${invalidIds.join(', ')}`,
  );
}
```

- Validación corre **antes** de `JSON.stringify(categories)` y antes de cualquier llamada a `habitRepo` — el repo nunca recibe IDs inválidos.
- Mismo formato de mensaje, em-dash `—`, "categorias" sin tilde (consistente con BUG-04).
- Sin helper compartido exportado: la duplicación entre createHabit y updateHabit es de ~6 líneas dentro del mismo archivo, dentro de la regla del proyecto (>20 líneas → refactor).
- Cierra la última puerta abierta para que IDs inválidos lleguen a la DB en habits regulares.

### 3. Wave 0 test stubs (4 archivos)

| Archivo | Estado tras este plan | Qué plan los completa |
|---------|----------------------|----------------------|
| `src/__tests__/parsing.test.ts` | 5 tests GREEN | — (final) |
| `src/__tests__/habitService.test.ts` | 4 tests GREEN | — (final) |
| `src/__tests__/sanitize.test.ts` | 2 `it.todo` (RED placeholder) | plan 02-02 (sanitize refactor) |
| `src/__tests__/speechRecognition.test.ts` | 2 `it.todo` (RED placeholder) | plan 02-03 (speech typing) |

**Patrón de test seguido:** `dailyAssignments.test.ts` — better-sqlite3 in-memory + `jest.mock('../services/db')` con stubs para `getTodayPrefix`/`getNowTimestamp`/`getTimestampForDate`.

## Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npx jest --testPathPatterns="parsing"` | 5 passed | DEBT-02 parser verified |
| `npx jest --testPathPatterns="habitService"` | 4 passed | D-15 verified |
| `npx jest --testPathPatterns="sanitize\|speechRecognition"` | 4 todo (no failures) | Wave 0 placeholders intentional |
| `npx jest --testPathPatterns="dailyAssignments"` | 33 passed | Phase 1 regression GREEN |
| `npx jest` (full suite) | 5 suites passed; 42 passed + 4 todo | All tests passing |
| `! grep -q "parseJsonArray" src/utils/parsing.ts` | OK (gone) | parser swap complete |
| `grep -c "categorias invalidas —" src/services/habitService.ts` | 2 | one per function |

**Note on Phase 1 test count:** the plan referenced 29 dailyAssignments tests; the file now has 33 (likely added between Phase 1 close and Phase 2 start). All still GREEN.

**Note on jest CLI flag:** the plan's `<verify>` blocks used `--testPathPattern` (singular). Current Jest version requires `--testPathPatterns` (plural). Used the plural form to run the verifications. This is a tooling-version-only delta; the test logic itself is exactly what the plan specified.

## Hand-off

### To plan 02-02 (sanitize refactor)
- `parseAndValidateCategories` is the public entry point. The two new sanitize functions in `db.ts` should call:
  ```typescript
  const cleaned = JSON.stringify(parseAndValidateCategories(row.<column>));
  ```
- Null-check at the sanitizer call site: `if (row.<column> == null) continue;` (the parser signature is `(json: string): string[]`, no null tolerance).
- Migrate the 4 surviving call sites of `parseJsonArray` (currently broken at the import level — TypeScript-only, runtime-safe because dailyAssignments tests don't import these files):
  - `src/screens/DailySheetScreen.tsx:19,102`
  - `src/screens/HabitLibraryScreen.tsx:19,202`
  - `src/components/modals/HabitFormModal.tsx:19,178`
  - `src/services/statsService.ts:12,124-125` (also remove the redundant `VALID_AREA_IDS.has(id as never)` filter on line 125)
- Replace the existing 2 `it.todo` placeholders in `sanitize.test.ts` with real tests (better-sqlite3 in-memory, seed habits with mixed valid/invalid IDs, assert post-sanitize state).

### To plan 02-03 (speech typing)
- `speechRecognition.test.ts` has 2 `it.todo` placeholders ready to be replaced with real tests once `useSpeechRecognition.ts` types `SpeechModuleInterface` and `SpeechRecognitionEvent` and removes the 2 `any`s on lines 16 and 41.
- Use `jest.mock('expo-speech-recognition', ...)` to control the require() path (per PATTERNS.md test patterns section).

### Intentional broken state (resolved by 02-02)
`parseJsonArray` no longer exists in `src/utils/parsing.ts`. The 4 call sites listed above will fail TypeScript compilation if anyone runs `tsc` over the whole project right now — **this is intentional and planned**. None of these files are imported by Jest test paths (`src/__tests__/**/*.test.ts`), so the test suite stays green. Plan 02-02 migrates all 4 call sites to `parseAndValidateCategories` in a single wave.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Tooling-only adjustment (not a deviation in spec)

**Jest CLI flag rename:** plan's `<verify>` blocks specified `--testPathPattern` (singular, deprecated in current Jest). Used `--testPathPatterns` (plural, current name). No impact on test logic, file structure, or acceptance criteria — purely a CLI flag spelling. Documented here for transparency.

## TDD Gate Compliance

This plan has `type: execute` (not `type: tdd`) at the plan level, but each task uses `tdd="true"`. Gate sequence per task:

| Task | RED commit (`test(...)`) | GREEN commit (`feat(...)`) | REFACTOR | Gate Status |
|------|---|---|---|---|
| Task 1 | `723bc44` test(02-01): add Wave 0 test stubs | (Tasks 2 and 3 are the GREEN for parsing/habitService) | n/a | RED gate established |
| Task 2 | (covered by Task 1) | `7048133` feat(02-01): replace parseJsonArray with parseAndValidateCategories | not needed | RED→GREEN OK |
| Task 3 | (covered by Task 1) | `502d2ed` feat(02-01): add D-15 write-time category validation | not needed | RED→GREEN OK |

All gates honored. Task 1's failing parsing/habitService tests preceded the implementation in Tasks 2 and 3 (verified RED before implementation).

## Known Stubs

| File | Lines | Reason | Resolved by |
|------|-------|--------|-------------|
| `src/__tests__/sanitize.test.ts` | 9–10 | `it.todo` placeholders for sanitizers that don't exist yet (still inside `sanitizeTable` generic) | Plan 02-02 |
| `src/__tests__/speechRecognition.test.ts` | 9–10 | `it.todo` placeholders for hook that still has `any` types | Plan 02-03 |

These are intentional Wave 0 markers (not silent failures).

## Threat Flags

None — all surface introduced by this plan is covered by the plan's own `<threat_model>`:
- T-02-01 (Tampering on parser) → mitigated by Task 2 + parsing.test.ts test 2
- T-02-03 (Tampering on createHabit/updateHabit) → mitigated by Task 3 + habitService.test.ts tests 1, 2, 4

T-02-02 (SQL injection in sanitizeTable) explicitly deferred to plan 02-02 per the plan's own threat register.

## Self-Check

- [x] `src/__tests__/parsing.test.ts` exists
- [x] `src/__tests__/sanitize.test.ts` exists
- [x] `src/__tests__/habitService.test.ts` exists
- [x] `src/__tests__/speechRecognition.test.ts` exists
- [x] `src/utils/parsing.ts` rewritten (parseAndValidateCategories present, parseJsonArray gone)
- [x] `src/services/habitService.ts` modified (VALID_AREA_IDS imported, 2 validation blocks)
- [x] Commit `723bc44` exists
- [x] Commit `7048133` exists
- [x] Commit `502d2ed` exists

## Self-Check: PASSED
