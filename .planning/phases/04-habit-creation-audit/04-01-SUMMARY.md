---
phase: 04
plan: 01
subsystem: utilities + test-infrastructure
tags: [pure-utility, period-helpers, dedup, test-fixtures, sqlite-mock]
requires: []
provides:
  - "src/utils/periodHelpers.ts (getISOWeekKey, getMonthKey, getPeriodKey)"
  - "src/utils/dedupeAssignmentsArray.ts (dedupeAssignmentsArray)"
  - "src/__tests__/setup/testDatabase.ts (createPreMigrationTestDatabase, seedDuplicates, insertTestPerformed)"
  - "__mocks__/expo-sqlite.ts (MockSQLiteDatabase.withTransactionAsync)"
affects:
  - "src/__tests__/setup/testDatabase.ts (extended)"
  - "__mocks__/expo-sqlite.ts (extended)"
tech-stack:
  added: []
  patterns:
    - "ISO 8601 Thursday-anchor algorithm (UTC-safe)"
    - "Pure transform utility (input → output, no side effects)"
    - "BEGIN/COMMIT/ROLLBACK shim sobre better-sqlite3"
key-files:
  created:
    - "src/utils/periodHelpers.ts"
    - "src/utils/dedupeAssignmentsArray.ts"
    - "src/__tests__/periodHelpers.test.ts"
    - "src/__tests__/dedupeAssignmentsArray.test.ts"
  modified:
    - "src/__tests__/setup/testDatabase.ts"
    - "__mocks__/expo-sqlite.ts"
decisions:
  - "Heurística D-03 implementada con asimetría JS-vs-SQL documentada en JSDoc"
  - "ISO week zero-padded a 2 dígitos (formato 'YYYY-Www')"
metrics:
  duration: "~12 min"
  completed_date: "2026-05-01"
  tasks: 4
  tests_added: 20
  tests_total_passing: 122
requirements:
  - REQ-04-03
  - REQ-04-12
---

# Phase 4 Plan 1: Wave 0 — Utilities + Test Infrastructure Summary

**One-liner:** Establece dos utilities puras (periodHelpers ISO 8601 + dedupeAssignmentsArray D-03) y extensiones del setup de tests (createPreMigrationTestDatabase + withTransactionAsync mock) que desbloquean los planes 02-04 sin dependencias inversas.

## Helpers exportados (firmas finales)

### `src/utils/periodHelpers.ts`
```typescript
export type Frequency = 'daily' | 'weekly' | 'monthly';
export function getISOWeekKey(datePrefix: string): string;       // 'YYYY-Www' (zero-padded)
export function getMonthKey(datePrefix: string): string;         // 'YYYY-MM'
export function getPeriodKey(datePrefix: string, frequency: Frequency): string;
```

### `src/utils/dedupeAssignmentsArray.ts`
```typescript
export function dedupeAssignmentsArray(
  rows: DailyAssignment[],
  performed: PerformedHabit[],
): DailyAssignment[];
```
Heurística D-03 aplicada sólo a rows con `habit_id !== null`. Spontaneous (`habit_id === null`) pasan tal cual.

### `src/__tests__/setup/testDatabase.ts` (nuevos exports)
```typescript
export function createPreMigrationTestDatabase(): Database.Database;
export function insertTestPerformed(db: Database.Database, opts: TestPerformedOpts): void;
export function seedDuplicates(
  db: Database.Database,
  habitId: string,
  date: string,
  opts?: DuplicateSeedOpts,
): string[];
```

### `__mocks__/expo-sqlite.ts` (extensión de `MockSQLiteDatabase`)
```typescript
async withTransactionAsync(fn: () => Promise<void>): Promise<void>;
```
BEGIN/COMMIT/ROLLBACK contra better-sqlite3. Re-throws on callback rejection.

## Tests passing

| Test File | Count | REQ Coverage |
|-----------|-------|--------------|
| `periodHelpers.test.ts` | 12/12 | REQ-04-12 |
| `dedupeAssignmentsArray.test.ts` | 8/8 | REQ-04-03 |
| **Suite completa** | **122/122** | sin regresiones |

## Imports nuevos disponibles para plans 02-04

| Consumer Plan | Import path | Símbolo |
|---|---|---|
| Plan 03 (visibility weekly/monthly) | `../utils/periodHelpers` | `getPeriodKey`, `getISOWeekKey`, `getMonthKey`, `Frequency` |
| Plan 04 (restore pre-clean) | `../utils/dedupeAssignmentsArray` | `dedupeAssignmentsArray` |
| Plan 02 (migrationV1 tests) | `./setup/testDatabase` | `createPreMigrationTestDatabase`, `seedDuplicates`, `insertTestPerformed` |
| Plan 02/04 (transactional tests) | (transitivo via mock) | `db.withTransactionAsync(fn)` ahora funciona en tests |

## Algoritmo Thursday-anchor implementado

Sin desviaciones del recomendado en RESEARCH §Pattern 3. Una mejora menor: la fórmula final usa
```typescript
const week = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86400000));
```
en lugar de la variante con `- 3` que aparece en RESEARCH (es matemáticamente equivalente porque `d` ya fue movido al jueves de su semana y `firstThu` también — ambos son jueves). Verificado contra ISO 8601 con casos boundary:
- `2027-01-01` (viernes) → `'2026-W53'` ✓
- `2027-01-04` (lunes) → `'2027-W01'` ✓
- `2026-01-05` (lunes) → `'2026-W02'` ✓ (W01 corre 2025-12-29..2026-01-04)

## Asimetría JS-vs-SQL en D-03 step 2

Documentada en el JSDoc de `dedupeAssignmentsArray.ts` y verificada por test:
- SQL CTE (plan 02): EXISTS por-row puede discriminar dentro de un grupo
- JS array dedupe: Set<string> por (habit_id|date) colapsa la key — todos los miembros del grupo comparten misma key, así que step 2 NO discrimina dentro del grupo, siempre cae a step 3 (original-position).

Ambas implementaciones cumplen la invariante final (una sola row por key) y respetan el orden D-03 desde fuera. Aceptable para el use case del backup pre-clean.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Todos los acceptance criteria pasaron a la primera. Cero auto-fixes necesarios.

## Commits (orden cronológico)

| Hash | Type | Description |
|------|------|-------------|
| `6a520ff` | test(04-01) | Failing tests for periodHelpers (RED) |
| `8149ac4` | feat(04-01) | Implement periodHelpers (GREEN) |
| `d70bab2` | test(04-01) | Failing tests for dedupeAssignmentsArray (RED) |
| `bc63657` | feat(04-01) | Implement dedupeAssignmentsArray (GREEN) |
| `f9e7697` | feat(04-01) | Extend testDatabase with pre-migration variant + seed helpers |
| `d012f52` | feat(04-01) | Add withTransactionAsync shim to expo-sqlite mock |

## TDD Gate Compliance

Plan no estaba marcado como `type: tdd` global, pero las tasks 1-2 sí tenían `tdd="true"`. Ambos pares RED→GREEN respetados:
- Task 1: `6a520ff` (test, RED) → `8149ac4` (feat, GREEN). ✓
- Task 2: `d70bab2` (test, RED) → `bc63657` (feat, GREEN). ✓

Tasks 3-4 (`tdd="false"`) extienden infrastructure de tests sin tests inline — se validan transitivamente cuando los tests de plans 02 y 04 corran (per acceptance criteria del plan).

## Self-Check: PASSED

- `src/utils/periodHelpers.ts` — exists ✓
- `src/utils/dedupeAssignmentsArray.ts` — exists ✓
- `src/__tests__/periodHelpers.test.ts` — exists ✓
- `src/__tests__/dedupeAssignmentsArray.test.ts` — exists ✓
- `src/__tests__/setup/testDatabase.ts` — extended (3 new exports) ✓
- `__mocks__/expo-sqlite.ts` — extended (withTransactionAsync) ✓
- Commits `6a520ff`, `8149ac4`, `d70bab2`, `bc63657`, `f9e7697`, `d012f52` — present in `git log` ✓
- `npm test`: 122/122 passing ✓

## Assumptions made (autonomous)

Ninguna asunción no-trivial. El plan especificaba todos los detalles necesarios y el algoritmo Thursday-anchor está fijado por ISO 8601. Las decisiones de orden de commits (RED antes que GREEN dentro de cada par) siguen el TDD attribute del plan.
