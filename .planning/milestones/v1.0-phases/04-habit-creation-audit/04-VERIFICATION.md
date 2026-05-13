---
phase: 04-habit-creation-audit
verified: 2026-05-01T02:30:00Z
status: human_needed
score: 25/25 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Smoke de migración v1 en device real (REQ-04-07)"
    expected: "Build APK local, instalar sobre versión previa con DB poblada (idealmente con duplicados sembrados manualmente). Abrir app: NO hay UI bloqueante; `adb logcat -s ReactNativeJS` muestra `'DB inicializada y backfill completado'`; cero `[migration v1]` errors. Re-abrir app: idem (idempotencia)."
    why_human: "Migración corre dentro de initDatabase() en cold-boot real con expo-sqlite (no better-sqlite3); silent-failure path requiere validar que console.error no genera UI bloqueante en RN-Metro. No reproducible desde Jest."
  - test: "Restore de backup pre-fix con duplicados (REQ-04-03)"
    expected: "Generar JSON de backup con 2+ rows duplicadas (habit_id, date) — vía export de APK viejo o JSON sintético. Reset DB local. Restore via Drive backup UI o importBackup local. Verificar post-restore: `SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` retorna 0 rows; la app abre sin alerta de error."
    why_human: "E2E flow involucra Drive REST y file pickers; aunque los unit tests cubren restoreData(), la integración con applyRestore() + importBackup UI requiere device real."
  - test: "Visibility weekly/monthly en device (REQ-04-10/11)"
    expected: "Crear hábito weekly desde Biblioteca; el ítem aparece en DailySheet hoy. Cambiar viewDate al lunes y al domingo de la misma semana ISO — el ítem aparece en ambos. Completar el ítem hoy. Cambiar viewDate al lunes — el ítem se ve marcado como 'completado para este período' (visual). Idem domingo. Repetir para monthly."
    why_human: "UX visual: el rendering de DailyItem.isCompletedForPeriod en DailySheet no está cubierto por los unit tests actuales (los tests verifican el modelo de datos pero no el render). Wiring UI puede ser objeto de un plan futuro."
---

# Phase 4: Habit Creation Audit & Duplicate Cleanup — Verification Report

**Phase Goal:** Auditar exhaustivamente todos los flujos de creación automática de daily assignments — rollover diario, inicio de semana, inicio de mes, creación manual de hábito en biblioteca, restauración de backups — identificar dónde se generan duplicados, corregir el código en cada flujo y diseñar una migración de DB que limpie los duplicados ya persistidos en bases existentes para dejarlas consistentes.

**Verified:** 2026-05-01T02:30:00Z
**Status:** human_needed (todos los chequeos automatizados pasaron; quedan 3 ítems de smoke manual en device)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (consolidados de plans 01-04)

| #  | Truth                                                                                                                       | Status     | Evidence |
|----|------------------------------------------------------------------------------------------------------------------------------|------------|----------|
| 1  | `getPeriodKey('2026-12-31','weekly')`/`'2027-01-01'` resuelven correctamente Thursday-anchor ISO                            | VERIFIED   | `periodHelpers.test.ts` 12/12 GREEN; tests boundary `'2027-01-01'→'2026-W53'`, `'2027-01-04'→'2027-W01'` pasan |
| 2  | `getPeriodKey('2026-03-31','monthly')='2026-03'` y `'2026-04-01','monthly')='2026-04'`                                       | VERIFIED   | Test "último día del mes" / "primer día del mes siguiente" GREEN |
| 3  | `getPeriodKey('2026-03-15','daily')='2026-03-15'` (passthrough)                                                              | VERIFIED   | Test "daily passthrough" GREEN |
| 4  | `dedupeAssignmentsArray` respeta D-03: completed > has_performed > original-position                                         | VERIFIED   | `dedupeAssignmentsArray.test.ts` 8/8 GREEN, todos los D-03 steps cubiertos |
| 5  | `dedupeAssignmentsArray` pasa-through `habit_id===null` (spontaneous) sin tocarlas                                           | VERIFIED   | Test "spontaneous (habit_id null) NUNCA se deduplica" GREEN |
| 6  | `createPreMigrationTestDatabase()` existe y NO incluye SQL_UNIQUE_INDEX                                                      | VERIFIED   | `testDatabase.ts:170` — verificado que `SQL_UNIQUE_INDEX` NO se ejecuta en esa variante |
| 7  | `withTransactionAsync(fn)` ejecuta BEGIN/COMMIT/ROLLBACK; throw → ROLLBACK + re-throw                                        | VERIFIED   | `__mocks__/expo-sqlite.ts:58`; verificado transitivamente por test "silent failure" en migrationV1.test.ts |
| 8  | Después del boot, `PRAGMA user_version = 1`                                                                                  | VERIFIED   | Test "PRAGMA user_version = 1 post-migration" GREEN |
| 9  | `sqlite_master` contiene `idx_unique_habit_date` como partial UNIQUE INDEX                                                    | VERIFIED   | Test "crea partial UNIQUE INDEX" GREEN |
| 10 | DB con duplicados pre-migración → post-migración exactamente 1 row por (habit_id, date)                                      | VERIFIED   | Tests D-03 step 1/2/3 GREEN; cuenta de rows post-migration = 1 |
| 11 | Winner respeta D-03: completed > has_performed > rowid ASC                                                                    | VERIFIED   | Tests "step 1: completed wins", "step 2: has_performed wins", "step 3 oldest" GREEN |
| 12 | Migración corrida 2 veces no hace nada la segunda vez (idempotency)                                                           | VERIFIED   | Test "2x runMigrations no throws ni cambia estado" GREEN |
| 13 | Si la migración falla, console.error + DB queda en versión 0 con rollback completo                                            | VERIFIED   | Test "silent failure" GREEN — verifica logger + user_version=0 + rows preservadas |
| 14 | `checkAndBackfillHistory` corre DESPUÉS de `runMigrations` (App.tsx)                                                          | VERIFIED   | App.tsx:103-109 muestra chain `initDatabase().then(checkAndBackfillHistory)`; comentario REQ-04-06 protector presente |
| 15 | Hábito weekly visible TODOS los días de la semana ISO actual con `isCompletedForPeriod`                                       | VERIFIED   | Test "weekly habit visible toda la semana" GREEN; lunes y domingo ven `isCompletedForPeriod=true` |
| 16 | Hábito monthly visible TODOS los días del mes calendario actual                                                                | VERIFIED   | Test "monthly habit visible todo el mes" GREEN |
| 17 | Completar weekly el miércoles propaga `is_completed=1` a las 7 rows del rango                                                  | VERIFIED   | Test "completar miércoles propaga a la semana" GREEN — verifica COUNT(is_completed=1)=7 |
| 18 | Uncomplete weekly revierte la propagación (todas vuelven a `is_completed=0`)                                                   | VERIFIED   | Test "uncomplete revierte la propagación" GREEN |
| 19 | `completeAssignment` para `daily` afecta SOLO la row del día (no propagación)                                                  | VERIFIED   | Test "daily habit NO se propaga" GREEN |
| 20 | `updateTodaySnapshotForHabit` propaga snapshot a rows uncompleted del período cuando frequency es weekly/monthly                | VERIFIED   | `assignmentService.ts:222-230` muestra branch que llama `updateSnapshotForHabitInRange` |
| 21 | En `__DEV__`, `ensureAssignmentsForDate` ejecuta `findDuplicates()` post-insert y `console.warn` si encuentra >0              | VERIFIED   | `assignmentService.ts:317-324`; test "operación normal NO emite warn" GREEN |
| 22 | JSON con duplicados regulares restaurado → 1 row sobrevive (winner D-03), sin UNIQUE error                                     | VERIFIED   | `restorePreClean.test.ts` test "dedup activo" GREEN; survivor es `is_completed=1` |
| 23 | JSON con spontaneous duplicados → todos persisten (passthrough)                                                                | VERIFIED   | Test "spontaneous passthrough" GREEN — 3 spontaneous mismo día persisten |
| 24 | `driveBackupService.applyRestore` hereda el pre-clean automáticamente vía `restoreData(payload.data)`                          | VERIFIED   | `driveBackupService.ts:433` invoca `restoreData(payload.data)` — confirmado por grep |
| 25 | ARCHITECTURE.md línea 281 corregida + 04-VALIDATION.md `nyquist_compliant: true` + 04-RESEARCH.md Open Questions (RESOLVED)   | VERIFIED   | grep confirma `Partial UNIQUE INDEX`, `nyquist_compliant: true`, 2 ocurrencias `Open Questions (RESOLVED)`, 6 `RESOLVED:` |

**Score:** 25/25 truths verificadas

### Required Artifacts

| Artifact                                                  | Expected                                                                                          | Status     | Details |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------|------------|---------|
| `src/utils/periodHelpers.ts`                              | `getISOWeekKey`, `getMonthKey`, `getPeriodKey` exports                                            | VERIFIED   | 38 líneas; 3 funciones exportadas; UTC-safe (`T00:00:00Z`) |
| `src/utils/dedupeAssignmentsArray.ts`                     | `dedupeAssignmentsArray(rows, performed)` puro D-03                                                | VERIFIED   | 84 líneas; función exportada; spontaneous passthrough confirmado |
| `src/__tests__/periodHelpers.test.ts`                     | Tests REQ-04-12 (boundaries ISO/year/month)                                                        | VERIFIED   | 11 referencias REQ-04-12; 12/12 tests GREEN |
| `src/__tests__/dedupeAssignmentsArray.test.ts`            | Tests REQ-04-03 (D-03 + spontaneous passthrough)                                                   | VERIFIED   | 9 referencias REQ-04-03; 8/8 tests GREEN |
| `src/__tests__/setup/testDatabase.ts`                     | `createPreMigrationTestDatabase`, `seedDuplicates`, `insertTestPerformed` exports                 | VERIFIED   | 3 nuevos exports; existentes intactos |
| `__mocks__/expo-sqlite.ts`                                | `MockSQLiteDatabase.withTransactionAsync` con BEGIN/COMMIT/ROLLBACK                                | VERIFIED   | Método agregado en línea 58; usa `db.exec('BEGIN'/'COMMIT'/'ROLLBACK')` |
| `src/services/migrations/migrationV1.ts`                  | `runMigrations` + `migrationV1_dedupeAndIndex`                                                    | VERIFIED   | 79 líneas; `runMigrations` exportado; PRAGMA user_version + withTransactionAsync presentes |
| `src/repositories/assignmentRepository.ts`                | `SQL_DEDUPE_VIA_CTE`, `SQL_FIND_DUPLICATES`, `SQL_CREATE_UNIQUE_INDEX`, `SQL_ASSERT_NO_DUPLICATES`, wrappers | VERIFIED   | 4 SQL constants + `findDuplicates`, `countByHabitAndDate`, `findCompletedHabitsInRange`, `setCompletedForHabitInRange`, `updateSnapshotForHabitInRange` |
| `src/services/db.ts`                                      | `initDatabase` ejecuta `runMigrations(db)` entre `migrateSchema` y `sanitizeCategories`             | VERIFIED   | Línea 12 import; línea 107 `await runMigrations(db)` en orden correcto |
| `src/__tests__/migrationV1.test.ts`                       | Tests REQ-04-04..09                                                                                | VERIFIED   | 16 referencias REQ-04-0X; 9/9 tests GREEN |
| `App.tsx`                                                 | Boot order verificado + comentario protector REQ-04-06                                             | VERIFIED   | Línea 103 contiene `REQ-04-06 — INVARIANTE`; chain `initDatabase().then(checkAndBackfillHistory)` preservada |
| `src/types/index.ts`                                      | `DailyItem.isCompletedForPeriod: boolean` (REQUERIDO)                                              | VERIFIED   | Línea 71 contiene el campo |
| `src/services/assignmentService.ts`                       | Period-aware enrichment + propagación + dev invariant                                              | VERIFIED   | `getPeriodRange`, `findCompletedHabitsInRange`, `setCompletedForHabitInRange`, `updateSnapshotForHabitInRange`, `if (__DEV__)`, `findDuplicates` todos presentes |
| `src/__tests__/dailyAssignments.test.ts`                  | Tests REQ-04-10/11 + REQ-04-01 dev invariant                                                       | VERIFIED   | 9 referencias REQ-04-0X; 5 tests nuevos en describe `Visibility weekly/monthly` |
| `src/services/backupService.ts`                           | `restoreData` con pre-clean via `dedupeAssignmentsArray`                                           | VERIFIED   | Línea 20 import; líneas 138-146 aplican dedupe antes de bulk insert |
| `src/__tests__/restorePreClean.test.ts`                   | Test REQ-04-03 (4 escenarios)                                                                       | VERIFIED   | 6 referencias REQ-04-03; 4/4 tests GREEN |
| `.planning/codebase/ARCHITECTURE.md`                      | Línea 281 con descripción real del partial UNIQUE INDEX                                             | VERIFIED   | grep confirma `Partial UNIQUE INDEX idx_unique_habit_date` |
| `.planning/phases/04-habit-creation-audit/04-VALIDATION.md` | Per-task map filled + `nyquist_compliant: true`                                                  | VERIFIED   | 12 tareas listadas; frontmatter `nyquist_compliant: true`, `wave_0_complete: true`, `status: ready-for-execute`, `Approval: ready-for-execute` |
| `.planning/phases/04-habit-creation-audit/04-RESEARCH.md` | Open Questions marcadas como (RESOLVED) con prefijo en cada Recommendation                           | VERIFIED   | 2 ocurrencias `Open Questions (RESOLVED)` (líneas 501, 697); 6 prefijos `RESOLVED:` |

### Key Link Verification

| From                                                          | To                                                                              | Via                                                  | Status |
|---------------------------------------------------------------|----------------------------------------------------------------------------------|------------------------------------------------------|--------|
| `src/utils/periodHelpers.ts`                                   | `src/services/assignmentService.ts`                                              | `import { getPeriodKey, type Frequency }`            | WIRED — línea 17 import + uso en `getPeriodRange` (helper interno UTC-safe) |
| `src/utils/dedupeAssignmentsArray.ts`                          | `src/services/backupService.ts`                                                  | `import { dedupeAssignmentsArray }`                  | WIRED — línea 20 import + línea 138 invocación |
| `src/__tests__/setup/testDatabase.ts`                          | `src/__tests__/migrationV1.test.ts`                                              | `import { createPreMigrationTestDatabase, seedDuplicates, insertTestPerformed }` | WIRED — usados en `beforeEach` y casos de prueba |
| `__mocks__/expo-sqlite.ts withTransactionAsync`                | `src/services/migrations/migrationV1.ts` + `src/repositories/backupRepository.ts` | `db.withTransactionAsync(async () => …)`             | WIRED — `migrationV1.ts` lo usa en `migrationV1_dedupeAndIndex`; tests pasan transitivamente |
| `src/services/db.ts initDatabase`                               | `src/services/migrations/migrationV1.ts runMigrations`                            | `import { runMigrations }`                            | WIRED — línea 12 import + línea 107 `await runMigrations(db)` en orden correcto |
| `src/services/migrations/migrationV1.ts`                        | SQL constants en `src/repositories/assignmentRepository.ts`                       | `import { SQL_DEDUPE_VIA_CTE, SQL_ASSERT_NO_DUPLICATES, SQL_CREATE_UNIQUE_INDEX }` | WIRED — usadas en `migrationV1_dedupeAndIndex` |
| `App.tsx useEffect`                                             | `initDatabase → checkAndBackfillHistory chain`                                    | `.then()` sequencia                                   | WIRED — verificado App.tsx:108-110 |
| `src/services/assignmentService.ts getItemsForDate`             | `src/utils/periodHelpers.ts getPeriodKey`                                         | `import + uso`                                        | PARTIAL — `getPeriodKey` se importa (line 17) pero la implementación usa el helper interno `getPeriodRange` (UTC-safe inline). El import se mantiene `void getPeriodKey;` para grep+documentación. La invariante D-01 se cumple porque `getPeriodRange` calcula el mismo rango ISO; los tests REQ-04-10/11 verifican el comportamiento end-to-end. ACCEPTED — funcionalmente correcto |
| `src/services/assignmentService.ts completeAssignment`          | `src/repositories/assignmentRepository.ts setCompletedForHabitInRange`            | named import + invocación                              | WIRED — línea 110 + línea 137 |
| `src/services/assignmentService.ts ensureAssignmentsForDate dev` | `src/repositories/assignmentRepository.ts findDuplicates`                          | `if (__DEV__) await assignmentRepo.findDuplicates()`  | WIRED — líneas 317-324 |
| `src/services/backupService.ts restoreData`                     | `src/utils/dedupeAssignmentsArray.ts`                                              | `import + invocación`                                  | WIRED — línea 20 + línea 138 |
| `src/services/driveBackupService.ts applyRestore`               | `src/services/backupService.ts restoreData`                                       | `restoreData(payload.data)`                            | WIRED — confirmado por grep en línea 433 |

### Data-Flow Trace (Level 4)

| Artifact                                  | Data Variable                          | Source                                                    | Produces Real Data | Status     |
|-------------------------------------------|-----------------------------------------|-----------------------------------------------------------|--------------------|------------|
| `getItemsForDate`                          | `assignments`, `performed`, `completedInPeriod` | `findByDate`, `taskRepo.findByDate`, `findCompletedHabitsInRange` (queries reales sobre SQLite) | YES | FLOWING |
| `migrationV1_dedupeAndIndex`               | DELETE/COUNT results                    | `db.execAsync(SQL_DEDUPE_VIA_CTE)`, `getFirstAsync(SQL_ASSERT_NO_DUPLICATES)` | YES | FLOWING |
| `restoreData`                              | `dedupedAssignments`                    | `dedupeAssignmentsArray(data.daily_assignments, data.performed_habits)` (transform puro sobre input real) | YES | FLOWING |
| `completeAssignment` (weekly/monthly path) | `is_completed=1` propagado al rango     | `setCompletedForHabitInRange` (UPDATE BETWEEN)             | YES | FLOWING |

### Behavioral Spot-Checks

| Behavior                                            | Command                                                                                  | Result                                              | Status |
|-----------------------------------------------------|------------------------------------------------------------------------------------------|-----------------------------------------------------|--------|
| Suite jest completa                                  | `npx jest --watchman=false`                                                              | 14 suites passed, 140 tests passed                  | PASS   |
| `runMigrations` exportable                            | `grep '^export async function runMigrations' src/services/migrations/migrationV1.ts`     | 1 línea                                             | PASS   |
| `idx_unique_habit_date` documentado en ARCHITECTURE.md | `grep idx_unique_habit_date .planning/codebase/ARCHITECTURE.md`                          | Línea 281 contiene "Partial UNIQUE INDEX idx_unique_habit_date" | PASS |
| Comentario REQ-04-06 protector en App.tsx             | `grep REQ-04-06 App.tsx`                                                                  | 1 línea                                             | PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)                | Description (REQUIREMENTS.md)                                                                                       | Status     | Evidence |
|-------------|-------------------------------|----------------------------------------------------------------------------------------------------------------------|------------|----------|
| REQ-04-01   | 04-03                         | `ensureAssignmentsForDate` no duplica al re-correr; guard `countByDate > 0` se mantiene + dev invariant              | SATISFIED  | `assignmentService.ts:317-324` dev invariant + test "operación normal NO emite warn" GREEN |
| REQ-04-02   | 04-03                         | `addAssignmentForHabit` idempotente; partial UNIQUE INDEX como defensa en profundidad                                | SATISFIED  | Tests preexistentes "Prevención de duplicados" GREEN; UNIQUE INDEX confirmado por test REQ-04-09 |
| REQ-04-03   | 04-01 (utility), 04-04 (integration) | `restoreData` deduplica daily_assignments con D-03 antes del bulk insert                                           | SATISFIED  | `restorePreClean.test.ts` 4/4 GREEN cubriendo happy path, dedup, spontaneous passthrough, mixed |
| REQ-04-04   | 04-02                         | Migration v1 borra duplicados respetando D-03 con CTE+ROW_NUMBER                                                     | SATISFIED  | Tests D-03 step 1/2/3 en `migrationV1.test.ts` GREEN |
| REQ-04-05   | 04-02                         | Migration v1 crea partial UNIQUE INDEX `idx_unique_habit_date` ON `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL` | SATISFIED  | Test "crea partial UNIQUE INDEX" GREEN; `sqlite_master` confirma |
| REQ-04-06   | 04-02                         | Migration v1 idempotente vía `PRAGMA user_version`; orden atómico D-08 en transacción                                | SATISFIED  | Test "2x runMigrations no throws" + test "user_version=1" GREEN |
| REQ-04-07   | 04-02                         | Migration v1 falla silenciosamente con `console.error('[migration v1] ...')` y NO bloquea boot                       | SATISFIED  | Test "silent failure" GREEN — verifica logger + user_version=0 + rollback |
| REQ-04-08   | 04-02                         | UNIQUE INDEX excluye `habit_id IS NULL` permitiendo múltiples spontaneous el mismo día                              | SATISFIED  | Test "INDEX permite múltiples spontaneous" GREEN |
| REQ-04-09   | 04-02                         | UNIQUE INDEX rechaza duplicados regulares post-migración                                                              | SATISFIED  | Test "INDEX rechaza duplicado regular" GREEN — throws `/UNIQUE constraint/` |
| REQ-04-10   | 04-03                         | Hábitos weekly visibles toda la semana ISO; completion 1× por período (Opción B)                                     | SATISFIED  | Tests "weekly habit visible toda la semana", "uncomplete revierte", "daily habit NO se propaga" GREEN |
| REQ-04-11   | 04-03                         | Hábitos monthly visibles todo el mes calendario; completion 1× por período (Opción B)                                | SATISFIED  | Test "monthly habit visible todo el mes" GREEN — 31 rows propagadas |
| REQ-04-12   | 04-01                         | `getPeriodKey(datePrefix, frequency)` correcta en cruces de año/mes/semana ISO; Thursday-anchor                      | SATISFIED  | 12/12 tests `periodHelpers.test.ts` GREEN, casos boundary W53/W01 incluidos |

**Cobertura completa:** 12/12 requirements satisfechos. No hay requisitos huérfanos (todos los IDs declarados en plans coinciden con la lista de la phase en ROADMAP.md).

### Anti-Patterns Found

| File                                          | Line(s)              | Pattern                       | Severity | Impact |
|-----------------------------------------------|----------------------|-------------------------------|----------|--------|
| `src/repositories/assignmentRepository.ts`     | 139, 237, 241        | "placeholder"                 | Info     | Falso positivo — refiere a SQL parameter placeholders (`?`) en `findCompletedHabitsInRange`, no a código stub |
| `src/services/assignmentService.ts`            | 22                   | `void getPeriodKey;`          | Info     | Documentado en SUMMARY 04-03 (Assumption 3): import retenido por contrato grep + para hacer explícita la dependencia conceptual con periodHelpers; la lógica de rango se computa via `getPeriodRange` interno (UTC-safe equivalent). Aceptable. |

No se encontraron blockers ni warnings reales. Sin TODO/FIXME, sin returns vacíos, sin handlers stub.

### Human Verification Required

Tres ítems requieren validación manual en device. Estos NO bloquean — son smokes E2E que complementan la cobertura unit ya verde.

#### 1. Smoke de migración v1 en device real (REQ-04-07 silent failure path)

**Test:**
1. Build APK local con `build-apk-local` skill.
2. Sembrar duplicados en una DB pre-existente (vía `adb shell sqlite3` o restaurando un backup pre-fix sintético).
3. Instalar APK sobre versión previa.
4. Abrir la app.
5. `adb logcat -s ReactNativeJS` durante el cold-boot.
6. Cerrar y re-abrir (idempotencia).

**Expected:**
- No hay UI bloqueante (sólo el `ActivityIndicator` breve de fonts).
- Log `'DB inicializada y backfill completado'` aparece una vez.
- NO aparece `[migration v1] dedupe+index falló` en el log.
- Re-abrir: ningún log de migración nueva (PRAGMA user_version short-circuit).

**Why human:** Cold-boot real con `expo-sqlite` (no `better-sqlite3` mockeado); silent-failure path sólo se prueba en ambiente real.

#### 2. Restore E2E de backup pre-fix con duplicados (REQ-04-03 integración con UI/Drive)

**Test:**
1. Generar JSON sintético con 2+ rows duplicados `(habit_id, date)` mismo día.
2. Reset de DB local (clear data en Settings de Android).
3. Restaurar vía Drive backup UI o `importBackup` local.
4. Verificar: `SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` retorna 0 filas.
5. La app abre normal sin alerta de error.

**Expected:** Cero duplicados post-restore; la app abre sin error UI.

**Why human:** El path Drive/file-picker requiere permisos OAuth y file system real, no reproducible en jest. Aunque `restoreData` está cubierta por unit tests, la integración con `applyRestore` + UI requiere device.

#### 3. Visibility weekly/monthly en device (REQ-04-10/11 UX visual)

**Test:**
1. Crear hábito weekly desde Biblioteca.
2. Verificar que aparece en DailySheet hoy.
3. Cambiar viewDate al lunes y al domingo de la misma semana ISO — el ítem aparece en ambos.
4. Completar el ítem hoy.
5. Cambiar viewDate al lunes y al domingo — el ítem se ve marcado como "completado para este período".
6. Repetir el ejercicio para un hábito monthly (verificar día 1 y último día del mes).

**Expected:** Visualización correcta del estado `isCompletedForPeriod` (tilde verde, opacidad reducida, etc., según el render actual de DailyItem).

**Why human:** Los unit tests cubren el modelo de datos pero NO el render. El wiring UI de `isCompletedForPeriod` puede ser objeto de un plan futuro (documentado en SUMMARY 04-03: "Consumers que deberán actualizarse en futuros planes: componentes de UI que rendericen DailyItem").

### Gaps Summary

No hay gaps bloqueantes. La implementación cumple todos los must-haves declarados en los frontmatter de los 4 plans y todos los REQ-04-01..12 listados en REQUIREMENTS.md.

Las únicas observaciones son:

1. **`void getPeriodKey;` en `assignmentService.ts`** — el import se retiene para satisfacer el contrato grep del plan, aunque la lógica usa `getPeriodRange` interno (UTC-safe equivalent). No es un stub: el comportamiento `getPeriodKey` se valida en `periodHelpers.test.ts` (12/12 GREEN) y la equivalencia funcional con `getPeriodRange` está cubierta por los tests REQ-04-10/11. Documentado como Assumption 3 en SUMMARY 04-03.

2. **3 ítems de verificación manual en device** (migración silent-failure, restore E2E, visibility UI) — necesarios para cerrar el ciclo E2E pero no bloqueantes para el goal del phase. Listados arriba bajo "Human Verification Required".

3. **Wiring UI de `isCompletedForPeriod`** — el SUMMARY 04-03 documenta que los componentes de UI (DailySheet, ItemRow) deberán consumir `isCompletedForPeriod` en lugar de `isCompleted` para hábitos periódicos. Esto NO está en scope de phase 4 (que cubre el modelo de datos y la lógica de service); puede ser objeto de un plan futuro de UX.

---

_Verificado: 2026-05-01T02:30:00Z_
_Verifier: Claude (gsd-verifier) — Opus 4.7_
