---
phase: 04
plan: 02
subsystem: db-migrations + dedup
tags: [migration, sqlite, user_version, partial-unique-index, dedup, atomicity]
requires:
  - "04-01 (createPreMigrationTestDatabase, seedDuplicates, insertTestPerformed, withTransactionAsync mock)"
provides:
  - "src/services/migrations/migrationV1.ts (runMigrations, migrationV1_dedupeAndIndex)"
  - "src/repositories/assignmentRepository.ts SQL constants exportados"
  - "PRAGMA user_version = 1 como nuevo mecanismo de versionado"
affects:
  - "src/services/db.ts (initDatabase ahora ejecuta runMigrations)"
  - "App.tsx (comentario protector boot order REQ-04-06)"
tech-stack:
  added: []
  patterns:
    - "Versioned migration via PRAGMA user_version (RESEARCH §Pattern 1)"
    - "Single-statement DELETE con CTE+ROW_NUMBER (RESEARCH §Pattern 2)"
    - "Partial UNIQUE INDEX con WHERE habit_id IS NOT NULL (D-07)"
    - "Atomic withTransactionAsync con rollback automático en throw (D-08)"
    - "Silent failure con console.error prefix [migration v1] (D-06)"
    - "Invariante post-DELETE assertNoDuplicatesRemain (Pitfall #1)"
key-files:
  created:
    - "src/services/migrations/migrationV1.ts"
    - "src/__tests__/migrationV1.test.ts"
  modified:
    - "src/repositories/assignmentRepository.ts"
    - "src/services/db.ts"
    - "App.tsx"
decisions:
  - "PRAGMA user_version (no schema_version table) — built-in atómico, sin overhead"
  - "CTE+ROW_NUMBER en single SQL statement (no JS-loop) — 10-50x más rápido en C nativo"
  - "Comentario en App.tsx evita cualquier mención a `assignmentRepo.` o `assignmentService.` para que el verify command de boot order siga pasando (Rule 1 - Bug del plan corregido)"
metrics:
  duration: "~10 min"
  completed_date: "2026-05-01"
  tasks: 3
  tests_added: 9
  tests_total_passing: 131
requirements:
  - REQ-04-04
  - REQ-04-05
  - REQ-04-06
  - REQ-04-07
  - REQ-04-08
  - REQ-04-09
---

# Phase 4 Plan 2: Wave 2 — Migration v1 Dedupe + Partial UNIQUE INDEX Summary

**One-liner:** Migración versionada v1 que aplica D-03 priority dedup + crea partial UNIQUE INDEX `idx_unique_habit_date` + marca `PRAGMA user_version = 1`, todo en una transacción atómica con rollback en falla y silent error logging — cierra REQ-04-04..09.

## API exportada

### `src/services/migrations/migrationV1.ts`
```typescript
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void>;
```
Lee `PRAGMA user_version` y dispatcha a las migraciones pendientes en orden creciente. Idempotente: si `current >= 1`, skip inmediatamente (un solo SELECT en el hot path post-primer-boot).

Internas (no exportadas):
- `migrationV1_dedupeAndIndex(db)` — orquesta los 4 pasos D-08 dentro de `withTransactionAsync`.
- `assertNoDuplicatesRemain(db)` — invariante post-DELETE (RESEARCH §Pitfall #1).

### `src/repositories/assignmentRepository.ts` — nuevos exports
```typescript
export const SQL_DEDUPE_VIA_CTE: string;
export const SQL_FIND_DUPLICATES: string;
export const SQL_ASSERT_NO_DUPLICATES: string;
export const SQL_CREATE_UNIQUE_INDEX: string;
export async function countByHabitAndDate(habitId, datePrefix): Promise<number>;
export async function findDuplicates(): Promise<{ habit_id, date, count }[]>;
```
- `SQL_DEDUPE_VIA_CTE` aplica orden D-03 vía `ROW_NUMBER() OVER (PARTITION BY habit_id, date ORDER BY is_completed DESC, EXISTS(performed_link) DESC, rowid ASC)`.
- `SQL_CREATE_UNIQUE_INDEX` usa `IF NOT EXISTS` para ser idempotente entre re-runs.
- Constantes `export`-adas para que `migrationV1.ts` las consuma; las wrappers cumplen REQ-04-02 (invariantes runtime).

## Tests passing

| Test File | Count | REQ Coverage |
|-----------|-------|--------------|
| `migrationV1.test.ts` (NEW) | 9/9 | REQ-04-04, REQ-04-05, REQ-04-06, REQ-04-07, REQ-04-08, REQ-04-09 |
| **Suite completa** | **131/131** | sin regresiones |

Detalle de los 9 tests:

| Test | REQ | Verifica |
|------|-----|----------|
| `D-03 step 1: completed wins` | REQ-04-04 | Si una row tiene `is_completed=1`, sobrevive |
| `D-03 step 2: has_performed wins on completion tie` | REQ-04-04 | El `EXISTS(performed_habit)` discrimina entre grupos |
| `D-03 step 3 oldest: rowid ASC en full tie` | REQ-04-04 | Sin completed ni performed, sobrevive la primera-rowid |
| `crea partial UNIQUE INDEX idx_unique_habit_date` | REQ-04-05 | `sqlite_master` contiene el index post-migration |
| `INDEX rechaza duplicado regular` | REQ-04-05/09 | Insert duplicado throws `/UNIQUE constraint/` |
| `INDEX permite múltiples spontaneous (habit_id=null)` | REQ-04-08 | 2 spontaneous misma fecha persisten |
| `PRAGMA user_version = 1 post-migration` | REQ-04-06 | Versión bump correcto |
| `2x runMigrations no throws ni cambia estado` | REQ-04-06 | Idempotencia |
| `error en migration → console.error + DB queda en v0` | REQ-04-07 | Spy sobre `execAsync` fuerza throw; verifica rollback + silent log |

## Boot Order Verification

**App.tsx líneas 102-110** — chain preservada:
```typescript
useEffect(() => {
  // REQ-04-06 — INVARIANTE: El orden initDatabase -> checkAndBackfillHistory es crítico.
  initDatabase()
    .then(() => checkAndBackfillHistory())
    .then(() => console.log('DB inicializada y backfill completado'))
    .catch((err) => console.error('Error inicializando DB:', err));
}, []);
```

**Verificación:**
- Solo el primer useEffect toca daily_assignments (vía `checkAndBackfillHistory`).
- El segundo useEffect (`silentSignInIfPossible`) no toca daily_assignments.
- `grep -E "assignmentRepo\.|assignmentService\." App.tsx` retorna 0 matches (verificado).

## Init sequence final (src/services/db.ts:103-110)

```typescript
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await executeSchema(db);          // CREATE TABLE IF NOT EXISTS (idempotent)
  await migrateSchema(db);          // legacy ad-hoc PRAGMA table_info migration
  await runMigrations(db);          // ← NEW: REQ-04-06 versioned migrations
  await sanitizeCategories(db);     // limpia category IDs inválidos
  await seedHabits(db);             // seed inicial si no hay habits
}
```

Orden D-08 respetado: schema → legacy → versioned → sanitize → seed.

## Atomicidad (D-08)

`migrationV1_dedupeAndIndex` envuelve los 4 pasos en `db.withTransactionAsync`:

1. `execAsync(SQL_DEDUPE_VIA_CTE)` — DELETE losers según D-03
2. `assertNoDuplicatesRemain(db)` — verifica que no queden grupos con count>1; throws si quedan
3. `execAsync(SQL_CREATE_UNIQUE_INDEX)` — CREATE UNIQUE INDEX IF NOT EXISTS
4. `execAsync('PRAGMA user_version = 1')` — bump version

Si cualquier paso throws:
- `withTransactionAsync` ejecuta ROLLBACK automático (verificado por test "silent failure": post-rollback la tabla mantiene los duplicados originales).
- El catch externo loguea `console.error('[migration v1] dedupe+index falló — la DB queda en versión 0', err)` y NO re-throws.
- El boot continúa normalmente.
- En el próximo arranque, `user_version` sigue en 0 → la migración se reintenta.

## Threat Model — disposiciones aplicadas

| Threat ID | Mitigación implementada |
|-----------|-------------------------|
| T-04-02-01 (Data Loss en hard-delete) | `withTransactionAsync` rollback completo + `assertNoDuplicatesRemain` impide CREATE INDEX si quedan dups (verificado por test) |
| T-04-02-02 (DoS en cold boot) | `PRAGMA user_version` short-circuit: si current ≥ 1, un solo SELECT y return |
| T-04-02-03 (timestamp format) | Aceptado: si formato inesperado, paso 2 cae a paso 3 (oldest); migración no rompe |
| T-04-02-04 (silent failure repudiation) | Aceptado: console.error con prefix `[migration v1]` queda en logs |
| T-04-02-05 (EoP) | n/a — app local-first |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentario protector en App.tsx contradecía el verify command del plan**
- **Found during:** Task 3 — primer intento de comentario
- **Issue:** El plan pedía agregar un comentario que mencione `assignmentRepo.*` y `assignmentService.*` (con backticks). Pero el plan también especificaba `verify automated: ! grep -E "assignmentRepo\.|assignmentService\." App.tsx` — que falla si esos patterns aparecen en cualquier parte del archivo, incluso comentarios.
- **Fix:** Reformulé el comentario para que mencione "funciones del subsistema de assignments (repository o service de daily_assignments)" sin disparar el regex. La intención protectora se preserva textualmente.
- **Files modified:** `App.tsx`
- **Commit:** `87d01e1` (incluye el fix dentro del mismo commit del comentario)

## Commits (orden cronológico)

| Hash | Type | Description |
|------|------|-------------|
| `7209421` | feat(04-02) | Add SQL constants + wrappers for dedup migration |
| `56ffc9c` | test(04-02) | Add failing tests for migration v1 (REQ-04-04..09) — RED |
| `f5413a0` | feat(04-02) | Implement migration v1 (dedupe + UNIQUE INDEX + user_version) — GREEN |
| `87d01e1` | feat(04-02) | Integrate runMigrations into initDatabase + boot order guard |

## TDD Gate Compliance

Plan no estaba marcado como `type: tdd` global. Solo task 2 marcaba `tdd="true"`:
- Task 2 RED: `56ffc9c` (test, falla por módulo inexistente) → GREEN: `f5413a0` (feat, 9/9 tests pasan). ✓

Task 1 marcaba `tdd="true"` pero el plan textualmente decía "La verificación de las wrappers nuevas sucede en task 3 (vía tests de migration)" — la cobertura de las nuevas SQL constants y wrappers viene de los 9 tests de migrationV1.test.ts (que importan `SQL_DEDUPE_VIA_CTE`, `SQL_ASSERT_NO_DUPLICATES`, `SQL_CREATE_UNIQUE_INDEX` indirectamente y validan su comportamiento end-to-end). Task 1 se commiteó como `feat` único porque añadir tests aislados para las constantes hubiera sido redundante.

Task 3 marcaba `tdd="false"` — integración + comentario, validado por suite completa.

## Imports nuevos disponibles para plans 03-04

| Consumer Plan | Import path | Símbolo |
|---|---|---|
| Plan 03 (visibility) | `../repositories/assignmentRepository` | `countByHabitAndDate`, `findDuplicates` (invariantes runtime REQ-04-02) |
| Plan 04 (restore pre-clean) | `../repositories/assignmentRepository` | `findDuplicates` (verificación post-restore opcional) |
| Future migration v2 | `./migrations/migrationV1` | Patrón a copiar: `if (current < 2) await migrationV2_*(db)` |

## Self-Check: PASSED

- `src/services/migrations/migrationV1.ts` — exists ✓
- `src/__tests__/migrationV1.test.ts` — exists ✓
- `src/repositories/assignmentRepository.ts` — modified, 4 new SQL constants + 2 wrappers exported ✓
- `src/services/db.ts` — modified, runMigrations integrado en initDatabase ✓
- `App.tsx` — modified, comentario protector REQ-04-06 ✓
- Commits `7209421`, `56ffc9c`, `f5413a0`, `87d01e1` — all present in `git log` ✓
- `npm test`: 131/131 passing (suite previa 122 + 9 nuevos) ✓
- Función ≤ 25 líneas (CONVENTIONS.md): runMigrations 9, migrationV1_dedupeAndIndex 14, assertNoDuplicatesRemain 7 ✓

## Assumptions made (autonomous)

1. **TDD Gate de Task 1 cubierto transitivamente.** El plan task 1 es `tdd="true"` pero textualmente acepta que la verificación de las nuevas SQL constants y wrappers sucede en task 2/3 vía tests de migration. No agregué un test file específico para Task 1 porque hubiera duplicado cobertura sin agregar valor — los 9 tests de `migrationV1.test.ts` ejercen `SQL_DEDUPE_VIA_CTE`, `SQL_ASSERT_NO_DUPLICATES` y `SQL_CREATE_UNIQUE_INDEX` end-to-end, y las wrappers `findDuplicates`/`countByHabitAndDate` quedan disponibles para REQ-04-02 (invariantes runtime) que se cubre en plan 03/04. Justificación adicional: CLAUDE.md Regla 4 (eficiencia) — minimizar consumo de contexto evitando tests redundantes.

2. **Comentario en App.tsx reformulado.** El plan especificaba un comentario que contiene literalmente `assignmentRepo.*` y `assignmentService.*` con backticks. Pero el `verify automated` del mismo plan checkea `! grep -E "assignmentRepo\.|assignmentService\." App.tsx` — que matchea esos backticks en comentarios. Detecté la inconsistencia (Rule 1 - Bug del plan) y reformulé el comentario manteniendo la intención protectora: la línea ahora dice "funciones del subsistema de assignments (repository o service de daily_assignments)" — semántica equivalente, regex 0 matches. Esto preserva ambos invariantes: el comentario protege el boot order Y la verificación automatizada sigue siendo válida.

3. **No instalé dependencias nuevas.** El plan especificaba "NO instalar nuevas dependencias". Aceptado — todos los SQL features (CTE, ROW_NUMBER, partial UNIQUE INDEX, PRAGMA user_version) están disponibles en SQLite ≥3.25 que viene bundled con expo-sqlite 16.0.10 y better-sqlite3 (in-memory tests verificados con SQLite 3.53).

4. **El warning "A worker process has failed to exit gracefully"** que aparece al correr `npx jest` es benigno (jest force-exit con tests asyncronos sin teardown explícito de timers). No afecta el resultado 131/131. No es regresión introducida por este plan — aparece sin código nuevo. Out of scope per scope boundary (logged as informational).
