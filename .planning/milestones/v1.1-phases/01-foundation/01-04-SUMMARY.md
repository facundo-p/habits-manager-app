# Plan 04 — Summary (Wave 3) — ATOMIC

**Phase:** 01-foundation · **Wave:** 3 · **Plan:** 04
**Status:** ✅ executed · **Date:** 2026-05-15 · **Branch:** `feat/v1.1-phase-1-foundation`
**Requirements:** FOUND-03, FOUND-04, FOUND-06 · **Decisions:** D-05, D-06

> ⚠️ **Atomic commit boundary (Pitfall #4):** the schema bump (migration v2) and the backup-version bump are entregadas en **un único commit**. Razón: bumpear `BACKUP_VERSION = 2` sin la migration (o viceversa) dejaría una ventana donde `restoreData` mapea `mood_entries[]` a una tabla droppeada → crash. La excepción al límite estándar de 400 LOC está documentada acá y en el PR description.

---

## Files created

| File | Purpose |
|---|---|
| `src/services/migrations/migrationV2.ts` | Migration v2 atómica: SQL constants + pre-snapshot pre-step + transaction (CREATE tablas + INSERT...SELECT + assert + DROP + PRAGMA) + throw propagation (D-05). |
| `src/services/preV2Snapshot.ts` | `buildV1Snapshot` + `cleanupPreV2Snapshots`. Aislado de backupService para que migrationV2 no arrastre dependencias de expo-sharing en tests. |
| `src/repositories/moodLogRepository.ts` | CRUD sobre `mood_log` (insert + findReflectionByHabitDate + deleteReflectionByHabitDate). Phase 1 sólo expone kind=reflection; Phase 2 ampliará. |
| `src/repositories/textLibraryRepository.ts` | readAll + clear + insertMany. Stubs mínimos para backup; Phase 2 ampliará. |
| `src/repositories/weeklyReviewsRepository.ts` | readAll + clear + insertMany. Stubs mínimos para backup; Phase 4 ampliará. |

## Files modified

| File | Change |
|---|---|
| `src/config/constants.ts` | `BACKUP_VERSION = 2` |
| `src/types/index.ts` | + `MoodLogEntry`, `TextLibraryItem`, `WeeklyReview`, `BackupDataV1`. `BackupData` extendida a shape v2 (`mood_entries?` opcional). |
| `src/services/backupService.ts` | `buildBackupData` lee las 6 tablas (drafts excluidas). `parseAndValidate` despacha v1/v2/v3+ (rechaza futuro con mensaje accionable). `restoreData` mapea `mood_entries[]` → `mood_log[]` kind='reflection' cuando shape es v1. |
| `src/repositories/backupRepository.ts` | Firma `restoreAllData` 4→6 args. Nuevos readers: `readAllMoodLog/TextLibrary/WeeklyReviews`. Legacy `readAllMoods` preservada con guard "tabla inexistente → []" (consumida sólo por `buildV1Snapshot` pre-migration). |
| `src/services/moodService.ts` | Reroute total a `moodLogRepository` con `kind='reflection'` + `MOOD_SCALE_VERSION`. Firma pública preservada. |
| `src/services/migrations/migrationV1.ts` | `runMigrations` dispatcha v2 tras v1: `if (current < 2) await migrationV2_addWellbeingTables(db)`. Doc nota A4 (v1 silent / v2 re-throws). |
| `src/services/db.ts` | `initDatabase` llama `cleanupPreV2Snapshots()` post-`runMigrations` (housekeeping silencioso). |
| `src/services/driveBackupService.ts` | `RestoreCounts.mood_entries` → `mood.` UI muestra count unificado independiente de version. |
| `src/screens/RestoreFromDriveScreen.tsx` | Copy actualizada: `counts.mood`. |
| `src/__tests__/setup/testDatabase.ts` | SQL constants re-importadas desde `migrationV2.ts` (single source of truth — T-01-01 mitigation cerrado). `createTestDatabase` actualizada a v2 baseline (mood_log/text_library/weekly_reviews/drafts presentes; mood_entries removida). |

## Tests populated / updated

| File | Before | After |
|---|---|---|
| `src/__tests__/migrationV2.test.ts` | 12 todos | **15 real tests** — forward (4), idempotency (1), rollback+integrity (2), pre-v2 snapshot (4 + cleanup), habit reflection reroute (2). |
| `src/__tests__/backupV1toV2.test.ts` | 6 todos | **7 real tests** — v1 forward (3), v2 round-trip (2), v3 reject (1), v2 partial tolerance (1). |
| `src/__tests__/migrationV1.test.ts` | — | jest.mock de v2 a no-op para focalizar tests v1. |
| `src/__tests__/driveBackupService.test.ts` · `.restore.test.ts` · `restorePreClean.test.ts` | — | BackupData shape + `counts.mood` actualizados al schema v2. |

## SQL definitivo de migration v2

Constantes exportadas desde `migrationV2.ts` (también consumidas por el fixture de tests):

- `SQL_CREATE_MOOD_LOG` + 4 indexes: `idx_mood_log_one_per_day` (partial UNIQUE kind IN morning/evening), `idx_mood_log_date_key`, `idx_mood_log_kind`, `idx_mood_log_habit_id` (partial WHERE habit_id IS NOT NULL).
- `SQL_CREATE_TEXT_LIBRARY` + `idx_text_library_kind_active`.
- `SQL_CREATE_WEEKLY_REVIEWS` (UNIQUE week_key + columnas mood_avg/sleep_avg/top_habits_json/answers_json).
- `SQL_CREATE_DRAFTS` + `idx_drafts_kind_key` (UNIQUE).
- `SQL_INSERT_SELECT_MOOD_LOG_FROM_MOOD_ENTRIES`: `INSERT INTO mood_log SELECT id, 'reflection', substr(timestamp, 1, 10), timestamp, value, 'v1', NULL, description, habit_id, timestamp, timestamp FROM mood_entries`.
- `SQL_DROP_MOOD_ENTRIES`, `SQL_COUNT_MOOD_ENTRIES`, `SQL_COUNT_MOOD_LOG_REFLECTION`.

## Verification log

- ✅ `npm test -- --testPathPatterns=migrationV2` → 15/15 passing.
- ✅ `npm test -- --testPathPatterns=backupV1toV2` → 7/7 passing.
- ✅ `npm test` (full suite) → 19 suites passed, 186 tests (179 passing + 7 todo). Los 7 todos remanentes son del file `drafts.test.ts`, populated en Plan 05.
- ✅ `npx tsc --noEmit` → 2 errores TS pre-existentes idénticos antes y después (LinearGradient + parsing.ts — fuera de scope).
- ✅ `grep "BACKUP_VERSION\s*=\s*2" src/config/constants.ts` → 1 match.
- ✅ `grep -rn "mood_entries" src/` → apariciones controladas: (a) `backupService.ts` v1 mapping, (b) `backupRepository.ts` legacy reader con guard, (c) `types/index.ts` BackupDataV1, (d) `migrationV2.ts` INSERT...SELECT + DROP, (e) `preV2Snapshot.ts` shape, (f) tests. No hay queries de runtime regular.

## Threat dispositions

| Threat | Disposition | Verificación |
|---|---|---|
| T-04-01 (PII en console.error) | mitigated | Test 6 verifica que `console.error` callargs no contienen ni `desc-m1` ni el valor `5` — sólo `[migration v2]` + err.message. |
| T-04-02 (timestamp malformados → date_key garbage) | accepted | Datos provienen de la propia app v1.0 (no input externo). Documentado. |
| T-04-03 (FK habit_id dangling post-migration) | mitigated | `FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL` en CREATE TABLE mood_log. |
| T-04-04 (snapshot sin encryption) | accepted | CONTEXT D-CD difiere encryption a milestone futuro. |
| T-04-05 (backup futuro inscrutable) | mitigated | parseAndValidate throws `'Backup más nuevo que la app — actualizá la app para restaurar.'` cuando version > BACKUP_VERSION; cubierto por test "v3+ reject". |

## Deferred items (visibilidad para Plan 06 y futuras phases)

- **`MigrationErrorScreen`** — D-05 establece que v2 re-throws para que App.tsx muestre un screen bloqueante con Restore + Retry. Esa pantalla se construye en **Plan 06 / Wave 5**. Hasta que Plan 06 cierre, una v2 fail crashea la app en lugar de mostrar UI; **no shipear v1.1 a usuarios hasta el merge de Plan 06**.
- **Encryption at rest** del pre-v2 snapshot — diferido a milestone futuro (CONTEXT D-CD).
- **Glosario v1/v2** en docs — Plan 08 (Wave 7) actualiza ARCHITECTURE.md con el shape final.

## Downstream contracts unlocked

- **Wave 4 / Plan 05** puede usar la tabla `drafts` (creada acá) + `moodLogRepository` patterns.
- **Wave 5 / Plan 06** consume el throw de migrationV2 + el snapshot pre-v2 para el Restore button del MigrationErrorScreen.
- **Phase 2** consume `mood_log` directamente para morning/evening/note via futuras funciones de `moodLogRepository`.
