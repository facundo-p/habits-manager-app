---
phase: 04-habit-creation-audit
plan: 04
subsystem: backup-restore + docs
tags: [restore, dedup, REQ-04-03, docs, phase-close]
requires:
  - dedupeAssignmentsArray (creado en 04-01)
  - partial UNIQUE INDEX idx_unique_habit_date (creado en 04-02)
provides:
  - restoreData con pre-clean (REQ-04-03 integration-level)
  - ARCHITECTURE.md alineado con realidad post-Phase-4
  - 04-VALIDATION.md cerrado (nyquist_compliant: true)
  - 04-RESEARCH.md Open Questions marcadas como (RESOLVED)
affects:
  - src/services/backupService.ts (5 líneas modificadas en restoreData + 1 import)
  - src/services/driveBackupService.ts (sin cambios — hereda fix automático via applyRestore → restoreData)
tech-stack:
  added: []
  patterns: [pre-clean-array-before-bulk-insert]
key-files:
  created:
    - src/__tests__/restorePreClean.test.ts
  modified:
    - src/services/backupService.ts
    - .planning/codebase/ARCHITECTURE.md
    - .planning/phases/04-habit-creation-audit/04-VALIDATION.md
    - .planning/phases/04-habit-creation-audit/04-RESEARCH.md
decisions:
  - "Pre-clean en JS (dedupeAssignmentsArray) antes del bulk insert es suficiente: respeta D-03, mantiene driveBackupService.applyRestore sin cambios, evita re-correr migration v1 post-restore (Open Q2 RESOLVED)"
  - "Mocks inline (jest.mock virtual) para expo-sharing y expo-document-picker en restorePreClean.test.ts — esos módulos sólo se usan en exportBackup/importBackup (path UI), no en restoreData; evita modificar jest.config.js"
metrics:
  duration_seconds: 523
  duration_human: "~9 min"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  tests_added: 4
  tests_total_passing: 140
  completed_date: 2026-05-01
---

# Phase 4 Plan 04: Restore Pre-Clean + Phase Close Summary

Cerró Phase 4 cubriendo el último vector de duplicación (restore desde backup pre-fix) integrando el utility puro `dedupeAssignmentsArray` (creado en 04-01) en `backupService.restoreData`, y alineó la documentación: corrigió el claim falso de UNIQUE constraint en ARCHITECTURE.md, llenó el per-task verification map de 04-VALIDATION.md (12 tasks, nyquist_compliant: true), y marcó las Open Questions de 04-RESEARCH.md como RESUELTAS.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Test failing para REQ-04-03 — 4 escenarios con UNIQUE constraint reproducido | `5e239af` | `src/__tests__/restorePreClean.test.ts` (created, 222 líneas) |
| 1 (GREEN) | restoreData pre-clean integrado | `9f2c651` | `src/services/backupService.ts` (+15/-1 líneas) |
| 2 | Docs phase close: ARCHITECTURE + VALIDATION + RESEARCH | `9573c64` | 3 archivos modificados (+44/-33 líneas) |

---

## Cambio en backupService.restoreData (diff exacto)

**Antes (líneas 126-133):**
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

**Después:**
```typescript
/**
 * Restaura un backup completo. Aplica pre-clean a daily_assignments via
 * dedupeAssignmentsArray (REQ-04-03) para que un backup pre-Phase-4 con
 * duplicados no rompa el partial UNIQUE INDEX (idx_unique_habit_date).
 * ...
 */
export async function restoreData(data: BackupData): Promise<void> {
  const dedupedAssignments = dedupeAssignmentsArray(
    data.daily_assignments,
    data.performed_habits,
  );
  await backupRepo.restoreAllData(
    data.habits,
    data.performed_habits,
    data.mood_entries,
    dedupedAssignments,
  );
}
```

Más el import al tope:
```typescript
import { dedupeAssignmentsArray } from '../utils/dedupeAssignmentsArray';
```

`driveBackupService.applyRestore` (línea 433) sigue llamando `await restoreData(payload.data)` — hereda el pre-clean automáticamente sin cambios.

---

## Test Coverage agregada (restorePreClean.test.ts)

4 tests, todos GREEN tras el fix:

1. **REQ-04-03 happy path:** JSON sin duplicados → 1 row persistida.
2. **REQ-04-03 dedup activo:** 2 rows mismo `(habit_id, date)`, una `is_completed=1` → sobrevive la completed (D-03 step 1), no UNIQUE error.
3. **REQ-04-03 spontaneous passthrough:** 3 rows con `habit_id=null` mismo día → todas las 3 persisten (el INDEX es partial, no las cubre).
4. **REQ-04-03 mixed:** 2 duplicados regulares + 1 spontaneous → 1 regular + 1 spontaneous (2 total).

**RED gate verificado:** antes del fix, 2/4 tests fallaron con `SqliteError: UNIQUE constraint failed: daily_assignments.habit_id, daily_assignments.date` exactamente como predicho por T-04-04-01.

---

## Diff exacto en ARCHITECTURE.md

**Línea 281 antes:**
```
  - Unique constraint on `(habit_id, date)` for daily_assignments (prevents duplicate assignments)
```

**Línea 281 después:**
```
  - **Partial UNIQUE INDEX** `idx_unique_habit_date` ON `daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL` — introducido en Phase 4 (migration v1, `src/services/migrations/migrationV1.ts`). Previene duplicados de hábitos regulares; los spontaneous (habit_id IS NULL) están exentos por design (D-07). Ver `.planning/phases/04-habit-creation-audit/` para detalles de la migración versionada via `PRAGMA user_version`.
```

Cierra la divergencia entre docs y realidad post-Phase-4 (CLAUDE.md Regla 3.4).

---

## Estado final de 04-VALIDATION.md

Frontmatter:
- `status: ready-for-execute` (era `draft`)
- `nyquist_compliant: true` (era `false`)
- `wave_0_complete: true` (era `false`)
- `last_updated: 2026-05-01` (nuevo)

Tabla per-task verification map: 12 filas (4 tasks plan-01 + 3 plan-02 + 3 plan-03 + 2 plan-04). Wave 0 checklist marcada como completa. Sign-off con todos los checks ✓. Approval: `ready-for-execute`.

---

## Estado final de 04-RESEARCH.md

- 2 secciones `Open Questions` renombradas a `Open Questions (RESOLVED)` (líneas 501 nivel `##` y 697 nivel `###`).
- 6 prefijos `**RESOLVED:**` agregados a las Recommendations (3 en cada sección — incluye Q3 spontaneous out-of-scope que fue marcada también para consistencia).

---

## Phase 4 — Coverage Summary (cierre del phase)

| Área | Cobertura |
|------|-----------|
| **REQs cerrados** | REQ-04-01 (dev invariant), REQ-04-02 (frequency-aware visibility), REQ-04-03 (restore pre-clean utility + integration), REQ-04-04..09 (migration v1 atomicity/idempotency/silent-failure), REQ-04-10/11 (period-aware visibility weekly/monthly), REQ-04-12 (period helpers ISO/year/month boundaries) — **12/12** |
| **Plans aprobados** | 04-01 (Wave 0 helpers), 04-02 (Migration v1), 04-03 (Visibility), 04-04 (Restore + close) — **4/4** |
| **Waves** | 4 secuenciales (1→2→3→4) |
| **Tests totales** | 140 passed (incluye 4 nuevos en este plan) |
| **Files nuevos en phase** | 5: `periodHelpers.ts`, `dedupeAssignmentsArray.ts`, `migrations/migrationV1.ts`, `restorePreClean.test.ts` (este plan), + extensions a `testDatabase.ts` y `__mocks__/expo-sqlite.ts` |
| **Files modificados** | `backupService.ts`, `db.ts`, `assignmentService.ts`, `assignmentRepository.ts`, `useHabitStore.ts`, `dailyAssignments.test.ts`, `ARCHITECTURE.md`, `04-VALIDATION.md`, `04-RESEARCH.md` |

---

## Assumptions made (autonomous)

Per `<autonomy_directive>`, decisiones tomadas sin pausar para input:

1. **Inline `jest.mock` para expo-sharing y expo-document-picker en restorePreClean.test.ts** — alternativa (modificar `jest.config.js` o crear nuevos mocks en `__mocks__/`) requería tocar archivos fuera de `files_modified`. La elección scoped es estrictamente más limpia: mocks viven sólo donde se necesitan, no contaminan otros tests.
2. **Q3 (spontaneous out-of-scope) también marcada con `RESOLVED:`** — el plan exigía las 3 Recommendations en cada sección con prefijo, así que se aplicó a Q3 aunque en el plan-stage la respuesta era "skip". Mantiene consistencia visual.
3. **`--testPathPatterns` en lugar de `--testPathPattern`** — Jest 29.x deprecó la versión singular; el comando del plan se actualizó en VALIDATION.md (5 ocurrencias) para reflejar la API actual y evitar fallar al copy-paste.
4. **Watchman desactivado (`--watchman=false`) en runs locales** — el daemon falla con `unable to talk to your watchman socket` en este entorno; sin él la suite corre normal en ~10s. No requiere cambio de config; sólo affecting CLI invocations.

---

## Deviations from Plan

**None directly.** El plan se ejecutó tal como estaba escrito. Las únicas variantes son las 4 assumptions arriba — y todas son operativas (no afectan la lógica del código).

---

## Recomendaciones para `/gsd-verify-work`

1. **Smoke manual del path de restore real** (REQ-04-03 manual table de VALIDATION.md):
   - Generar un JSON sintético con 2+ rows duplicados `(habit_id, date)` mismo día.
   - Reset DB local.
   - Llamar `importBackup` (UI) o `applyRestore` (Drive).
   - Confirmar: post-restore, `SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` retorna 0 filas; la app abre normal.
2. **Smoke manual de migration v1 + idempotencia** (REQ-04-07 manual):
   - APK build local con `build-apk-local` skill.
   - Instalar sobre versión previa con DB poblada con duplicados sembrados.
   - Verificar: no hay UI bloqueante; `adb logcat -s ReactNativeJS` no muestra `[migration v1]` errors; re-abrir → idempotente.
3. **Visibility weekly/monthly en device** (REQ-04-10 manual):
   - Crear hábito weekly desde Biblioteca; verificar visibilidad lunes-domingo; completar miércoles → resto de la semana muestra "completado para período".
4. **Verificación cross-doc:** confirmar que `ARCHITECTURE.md` no tiene otras menciones falsas de constraints (un sweep por `grep -n "constraint" .planning/codebase/ARCHITECTURE.md`).

---

## Self-Check: PASSED

Verificación automática post-write:

- ✅ `src/__tests__/restorePreClean.test.ts` existe (verified)
- ✅ `src/services/backupService.ts` contiene `dedupeAssignmentsArray(` (verified via grep)
- ✅ `.planning/codebase/ARCHITECTURE.md` contiene `idx_unique_habit_date` (verified)
- ✅ `.planning/phases/04-habit-creation-audit/04-VALIDATION.md` contiene `nyquist_compliant: true` (verified)
- ✅ `.planning/phases/04-habit-creation-audit/04-RESEARCH.md` contiene 2 occurrences of `Open Questions (RESOLVED)` y 6 `RESOLVED:` (verified)
- ✅ Commits en git log: `5e239af` (test), `9f2c651` (feat), `9573c64` (docs) (verified via `git log --oneline -5`)
- ✅ `npm test` 140/140 GREEN (verified)
