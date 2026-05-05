---
phase: 02-tech-debt
plan: 02
subsystem: services + screens + components + tests
tags: [debt-02, debt-03, parser-migration, sanitize-refactor, wave-1]
requires:
  - parseAndValidateCategories (src/utils/parsing.ts) — provided by plan 02-01
  - VALID_AREA_IDS (src/config/constants.ts)
  - createTestDatabase / resetTestDatabase / insertTestHabit (src/__tests__/setup/testDatabase.ts)
provides:
  - sanitizeHabitDefaultCategories (src/services/db.ts) — exported, static SQL, typed row shape
  - sanitizePerformedCategoriesUsed (src/services/db.ts) — exported, static SQL, typed row shape
  - 4 UI/service call sites consuming the central parser (no remaining parseJsonArray references)
  - 6 real tests covering both sanitizers (replaces the 2 it.todo placeholders from 02-01)
affects:
  - src/services/db.ts (sanitizeTable + filterValidIds removed; 2 named exports added; VALID_AREA_IDS import removed; parseAndValidateCategories import added)
  - src/screens/DailySheetScreen.tsx (import + AreaBadges usage migrated)
  - src/screens/HabitLibraryScreen.tsx (import + formatMeta usage migrated)
  - src/components/modals/HabitFormModal.tsx (import + populateForm usage migrated)
  - src/services/statsService.ts (import + aggregateByCategory migrated; redundant VALID_AREA_IDS.has filter removed; VALID_AREA_IDS import removed; JSDoc updated)
  - src/__tests__/sanitize.test.ts (it.todo placeholders replaced by 6 real tests)
tech-stack:
  added: []
  patterns:
    - Static SQL string literals with explicit per-table generic shapes on getAllAsync (DEBT-03 standard going forward)
    - Sanitizer functions exported for direct unit-tests (Phase 1 testability pattern)
    - Cast `mockDb as unknown as Parameters<typeof fn>[0]` to bridge better-sqlite3 mock to expo-sqlite signature in tests
key-files:
  modified:
    - src/services/db.ts
    - src/screens/DailySheetScreen.tsx
    - src/screens/HabitLibraryScreen.tsx
    - src/components/modals/HabitFormModal.tsx
    - src/services/statsService.ts
    - src/__tests__/sanitize.test.ts
  created:
    - .planning/phases/02-tech-debt/02-02-SUMMARY.md
decisions:
  - VALID_AREA_IDS import removed from both db.ts and statsService.ts after dead-reference audit (the parser owns all whitelist filtering after this plan)
  - statsService JSDoc updated (line 115 mentioned "filtrando categorías que no existan en HABIT_AREAS"); now says the filtering lives inside parseAndValidateCategories — preserves doc accuracy per CLAUDE.md rule 3.4
  - Sanitizer tests use `openDatabaseAsync('test.db')` to obtain the mock singleton MockSQLiteDatabase, then cast it to the expo-sqlite type expected by the function signatures (consistent with the dailyAssignments.test.ts approach)
  - No REFACTOR commit needed — both sanitizers are 14 lines each, mirror each other, and stay below the 20-line threshold from the project's quality rule
metrics:
  duration: ~30 minutes
  completed: 2026-04-27T00:30:00Z
  tasks_completed: 2
  files_changed: 6
requirements:
  - DEBT-02
  - DEBT-03
---

# Phase 2 Plan 02: Call-Site Migration + Sanitize Refactor Summary

Plan 02-02 cierra DEBT-02 y DEBT-03 al migrar los 4 call sites supervivientes de `parseJsonArray` al parser central `parseAndValidateCategories` y reemplazar el sanitizador genérico `sanitizeTable` por dos funciones explícitas exportadas (`sanitizeHabitDefaultCategories`, `sanitizePerformedCategoriesUsed`) con SQL estático y tipos por tabla; los `it.todo` placeholders de Wave 0 son reemplazados por 6 tests reales contra DB in-memory; la suite completa queda en 48 passed + 2 todo (los todos restantes son del plan 02-03).

## What Got Built

### 1. Migración de call sites (DEBT-02 final, Task 1)

`parseJsonArray` ya no existe en `src/` después de este plan. Cuatro archivos cambiaron:

| Archivo | Línea import (post) | Línea uso (post) | Nota |
|---------|--------------------|--------------------|------|
| `src/screens/DailySheetScreen.tsx` | 34 | 102 | `AreaBadges` consume el parser; comportamiento UI idéntico |
| `src/screens/HabitLibraryScreen.tsx` | 19 | 202 | `formatMeta` consume el parser |
| `src/components/modals/HabitFormModal.tsx` | 19 | 178 | `populateForm` consume el parser |
| `src/services/statsService.ts` | 11 | 124 | `aggregateByCategory`: las dos líneas originales (124-125) colapsaron en una sola; el filtro redundante `VALID_AREA_IDS.has(id as never)` fue eliminado porque el parser ya lo aplica |

**Decisiones sobre `VALID_AREA_IDS`:**
- En `statsService.ts`: import eliminado (era solo usado por el filtro redundante eliminado).
- En `db.ts`: import eliminado (era solo usado por `filterValidIds`, eliminada en Task 2).

**Documentación actualizada (CLAUDE.md regla 3.4):** El JSDoc de `aggregateByCategory` (líneas 114-117) fue actualizado para reflejar la nueva realidad — antes decía "filtrando categorías que no existan en HABIT_AREAS"; ahora dice "El filtrado contra VALID_AREA_IDS lo hace `parseAndValidateCategories`".

### 2. Refactor de sanitización (DEBT-03 final, Task 2)

`src/services/db.ts` §Sanitización ahora contiene:

- **Caller `sanitizeCategories(db)`** (interno): invoca las dos funciones explícitas en serie. Sigue corriendo en `initDatabase()` igual que antes.
- **`sanitizeHabitDefaultCategories(db)`** — exportada, 14 líneas de implementación. Lee `habits` con shape explícito `{ id: string; default_categories: string | null }`, filtra cada fila por `parseAndValidateCategories`, hace UPDATE solo si el JSON serializado cambió.
- **`sanitizePerformedCategoriesUsed(db)`** — exportada, 14 líneas, estructura paralela. Lee `performed_habits` con shape `{ id: string; categories_used: string | null }`.

**SQL estático verificado:** ambos `getAllAsync` y `runAsync` reciben string literals (`'SELECT id, default_categories FROM habits ...'`) — sin template strings con interpolación de nombre de tabla/columna. Acceptance criterion `! grep -nE 'FROM \\\${|SET \\\${|UPDATE \\\${' src/services/db.ts` confirma cero coincidencias.

**Funciones eliminadas:** `sanitizeTable` y `filterValidIds` no existen más en `db.ts` (anti-patterns DEBT-03 cerrados).

**Tipo dinámico eliminado:** ya no hay `{ id: string; [key: string]: any }` en `db.ts`.

### 3. Tests reales reemplazan placeholders (Wave 0 follow-up)

`src/__tests__/sanitize.test.ts` pasó de 2 `it.todo` a 6 tests reales (3 por sanitizer):

**`sanitizeHabitDefaultCategories`:**
1. *"elimina IDs inválidos en habits.default_categories"* — seed `'["salud_fisica","fake_id"]'` → assert `'["salud_fisica"]'`. Spy de `console.warn` confirma el side effect del parser.
2. *"no modifica filas con todas las categorías válidas"* — `'["salud_fisica","mental"]'` queda intacto.
3. *"ignora filas con default_categories NULL"* — INSERT con NULL, assert `null` post-llamada.

**`sanitizePerformedCategoriesUsed`:**
4. *"elimina IDs inválidos en performed_habits.categories_used"* — seed `'["mental","invalid"]'` → assert `'["mental"]'`.
5. *"no modifica filas con todas las categorías válidas"* — `'["mental","salud_fisica"]'` intacto.
6. *"ignora filas con categories_used NULL"* — assert `null`.

**Patrón de test:** better-sqlite3 in-memory + mock manual de `expo-sqlite` (singleton `MockSQLiteDatabase`). Las funciones reciben `db` como parámetro, así que los tests obtienen la instancia mock vía `await openDatabaseAsync('test.db')` y la castean a `Parameters<typeof fn>[0]` para satisfacer la firma de expo-sqlite. `performed_habits` tests insertan un `parent` habit en `beforeEach` por el FK constraint.

## Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npx jest --testPathPatterns="sanitize"` | 6 passed | DEBT-03 verified |
| `npx jest` (full suite) | 5 suites passed; 48 passed + 2 todo | The 2 remaining todos are speechRecognition placeholders (plan 02-03) |
| `! grep -rn "parseJsonArray" src/` | OK (zero results) | DEBT-02 reading-side fully closed |
| `grep -c "export async function sanitizeHabitDefaultCategories" src/services/db.ts` | 1 | exported as required |
| `grep -c "export async function sanitizePerformedCategoriesUsed" src/services/db.ts` | 1 | exported as required |
| `! grep -nE "sanitizeTable\b\|filterValidIds\b" src/services/db.ts` | OK (zero results) | DEBT-03 anti-patterns removed |
| `! grep -nE "\[key: string\]: any" src/services/db.ts` | OK (zero results) | type narrowing verified |
| `! grep -nE 'FROM \$\{\|SET \$\{\|UPDATE \$\{' src/services/db.ts` | OK (zero results) | static SQL verified |
| `grep -q "import.*parseAndValidateCategories.*from.*utils/parsing" src/services/db.ts` | OK | parser is the single source of truth |
| `! grep -q "it.todo" src/__tests__/sanitize.test.ts` | OK | placeholders replaced |

## Hand-off

### To plan 02-03 (speech typing + backup parser)

Esta wave es paralela a 02-02 — la rama de 02-03 corre en otro worktree y no comparte archivos con 02-02. Ningún hand-off técnico es requerido. Las únicas señales que 02-03 verá tras el merge:

- `src/__tests__/sanitize.test.ts` ya no tiene `it.todo` — solo quedan los 2 todos de `speechRecognition.test.ts` (que el propio 02-03 reemplaza).
- `src/services/db.ts` ya no importa `VALID_AREA_IDS` — el listado debería seguir siendo importado solo por archivos que lo necesitan (assignmentService, habitService, parser).

### To phase verification (`/gsd-verify-work`)

Tras el merge de 02-02 + 02-03, los success criteria del Phase 2 quedan:
- DEBT-02 cerrado: ✓ todos los call sites consumen el parser central; `parseJsonArray` y `filterValidIds` eliminados.
- DEBT-03 cerrado: ✓ funciones explícitas con SQL estático y tipos por tabla; `[key: string]: any` ausente.
- DEBT-01: pendiente de 02-03.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Non-deviation note: JSDoc actualizado en statsService

El plan no mencionaba el JSDoc de `aggregateByCategory` (líneas 114-117). Tras eliminar el filtro redundante y el import de `VALID_AREA_IDS`, el JSDoc original (*"filtrando categorías que no existan en HABIT_AREAS"*) quedaba desactualizado. CLAUDE.md regla 3.4 obliga a actualizar documentación obsoleta, así que reformulé el comentario para que refleje que el filtrado vive ahora en `parseAndValidateCategories`. No es un cambio de comportamiento; es higiene de documentación.

## TDD Gate Compliance

Plan tiene `type: execute` (no `type: tdd` a nivel plan), pero ambas tasks usan `tdd="true"`. Gate por task:

| Task | RED commit (`test(...)`) | GREEN commit (`refactor/feat(...)`) | REFACTOR | Gate Status |
|------|---|---|---|---|
| Task 1 | (sin RED dedicado — los tests de Wave 0 actuaban como regresión; el verify es grep + suite verde) | `7026578` refactor(02-02): migrate 4 call sites | n/a | OK (no behavior change → no new test required) |
| Task 2 | `6fa602f` test(02-02): add real tests for sanitizeHabit/PerformedCategories functions | `2d693bc` refactor(02-02): replace sanitizeTable with explicit per-table sanitizers | not needed (functions ≤14 lines, mirror each other, no cleanup pending) | RED→GREEN OK |

Task 1 es un refactor mecánico sin cambio de comportamiento — los tests existentes (`parsing.test.ts`, `dailyAssignments.test.ts`, `habitService.test.ts`) actúan como regresión. El acceptance criterion explícito del plan (Task 1's `<verify>`) era `! grep -rn "parseJsonArray" src/ && npx jest` — ambos verdes.

Task 2 honra el ciclo RED→GREEN explícitamente: el commit `6fa602f` introduce los 6 tests fallando con `is not a function`, el commit `2d693bc` los pone en verde al exportar las dos funciones desde `db.ts`.

## Known Stubs

None added or remaining from this plan. The 2 surviving `it.todo` tests in `speechRecognition.test.ts` are tracked by plan 02-03's hand-off (already documented in 02-01-SUMMARY.md).

## Threat Flags

None — no new security-relevant surface introduced. The two threats from the plan's `<threat_model>` are mitigated:

| Threat ID | Mitigation Verified |
|-----------|---------------------|
| T-02-01 (Tampering on sanitization) | Both sanitizers consume `parseAndValidateCategories`; tests 1 & 4 confirm `'["salud_fisica","fake_id"]'` → `'["salud_fisica"]'` and equivalent for performed_habits. |
| T-02-02 (SQL injection in sanitizeTable) | `sanitizeTable` deleted entirely. Acceptance grep `! grep -nE 'FROM \$\{\|SET \$\{\|UPDATE \$\{' src/services/db.ts` returns zero results. |

## Self-Check

- [x] `src/services/db.ts` modified — sanitizeTable/filterValidIds gone; sanitizeHabitDefaultCategories + sanitizePerformedCategoriesUsed exported
- [x] `src/screens/DailySheetScreen.tsx` migrated to parseAndValidateCategories
- [x] `src/screens/HabitLibraryScreen.tsx` migrated to parseAndValidateCategories
- [x] `src/components/modals/HabitFormModal.tsx` migrated to parseAndValidateCategories
- [x] `src/services/statsService.ts` migrated; redundant filter removed; JSDoc updated
- [x] `src/__tests__/sanitize.test.ts` rewritten — 6 real tests, no it.todo
- [x] Commit `7026578` exists (Task 1 — call-site migration)
- [x] Commit `6fa602f` exists (Task 2 — RED gate)
- [x] Commit `2d693bc` exists (Task 2 — GREEN gate)

## Self-Check: PASSED
