# Plan 02 — Summary (Wave 1)

**Phase:** 01-foundation · **Wave:** 1 · **Plan:** 02 — date helpers codemod
**Status:** ✅ executed · **Date:** 2026-05-14 · **Branch:** `feat/v1.1-phase-1-foundation`
**Requirements:** FOUND-01 · **Decisions applied:** D-01

---

## Files created

| File | LOC | Purpose |
|---|---|---|
| `src/utils/date.ts` | 60 | Único módulo de date helpers del proyecto. Exporta `getLocalDayKey`, `isFutureDate`, `nextDay`, `formatDateStr`, `getNowTimestamp`, `getTimestampForDate`. |

## Files modified

| File | Lines deleted | Lines added | Change |
|---|---|---|---|
| `src/services/db.ts` | 24 | 0 | Removed 4 date helpers — db.ts queda como bootstrap + migrations puros |
| `src/utils/dateHelpers.ts` | 4 | 0 | Removed `dateToPrefix` (era el último call site de `toISOString().slice(0,10)`). UI formatters (`formatTodayDate`, `formatHistoricDate`, `isValidDateString`) permanecen |
| `src/services/assignmentService.ts` | 11 | 1 | Removed local `nextDay`, switched imports to `../utils/date`, `dateToPrefix` → `formatDateStr` en 3 call sites |
| `src/services/moodService.ts` | 3 | 3 | `getTodayPrefix` → `getLocalDayKey`, import path change |
| `src/services/driveBackupService.ts` | 2 | 2 | Same |
| `src/hooks/useDriveActions.ts` | 2 | 2 | Same |
| `src/screens/SettingsScreen.tsx` | 2 | 2 | Same |
| `src/screens/RestoreFromDriveScreen.tsx` | 2 | 2 | Same |
| `src/__tests__/dateUtils.test.ts` | 7 todos | 11 real tests | Populated RED skeletons with real tests (port of cross-midnight + DST scenarios) |
| `src/__tests__/dailyAssignments.test.ts` | 5 | 6 | Mock target switched: `'../services/db'` → `'../utils/date'`. `nextDay` ahora importado desde `utils/date` |
| `src/__tests__/habitService.test.ts` | 3 | 3 | Mock target switch |
| `src/__tests__/sanitize.test.ts` | 1 | 1 | Comment update |

## Files deleted

| File | Reason |
|---|---|
| `src/__tests__/db.test.ts` | Tenía solo tests de `getTodayPrefix`; portados verbatim a `dateUtils.test.ts` |

**Net delta:** 142 deletions − 106 insertions = **−36 LOC net** (codemod simplifica el módulo).

## Verification log

- ✅ `npm test -- --testPathPatterns=dateUtils` → 11/11 passing (was 7 todos).
- ✅ `npm test` (full suite) → 19 suites passed, 181 tests (157 passing + 24 todo), 0 failures. (-1 suite vs Plan 03 baseline: db.test.ts deleted.)
- ✅ `npx tsc --noEmit` → 2 errores TS pre-existentes idénticos antes y después del codemod (LinearGradient, parsing.ts — fuera de scope).
- ✅ `grep -rn "getTodayPrefix" src/` → 0 matches en código (los 3 hits restantes son referencias en jsdoc de `date.ts` documentando el rename).
- ✅ `grep -rn "new Date().toISOString().slice(0,10)" src/` → 0 matches en código (idem).
- ✅ `grep -rn "function getTodayPrefix\|function getNowTimestamp\|function isFutureDate\|function getTimestampForDate" src/services/db.ts` → 0 matches.

## Behaviors verified by `dateUtils.test.ts` (11 tests)

- `getLocalDayKey` usa getters locales — port del cross-midnight test (GMT-3 invariant).
- `getLocalDayKey` retorna formato YYYY-MM-DD a cualquier system time.
- `getLocalDayKey` NO usa `toISOString().slice` (UTC bias).
- `isFutureDate` true para futuro lejano, false para hoy.
- `nextDay` avanza un día, DST-safe (cruza spring-forward sin saltar).
- `formatDateStr` retorna YYYY-MM-DD via UTC getters, DST-stable.
- `getNowTimestamp` matchea `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$`.
- `getTimestampForDate('2026-05-12')` matchea `^2026-05-12 \d{2}:\d{2}:\d{2}$`.

## Threat mitigations applied

- **T-02-01** (codemod parcial deja import roto) — Detectado en CI: missed `dateToPrefix(current)` en `backfillRange` durante el sweep inicial; capturado por `dailyAssignments.test.ts › checkAndBackfillHistory`, fixed antes de cerrar la wave. Full suite + grep ban final asegura.
- **T-02-02** (`formatDateStr` cambia semántica vs `dateToPrefix`) — Tests directos + el caller existente en `assignmentService.weekRange` siguen verde (sin cambios funcionales observables).

## Downstream contracts unlocked

- Wave 3 (Plan 04 / migrationV2) puede importar `getLocalDayKey` para stamp del pre-v2 snapshot filename y para mood_log.date_key.
- Wave 4 (Plan 05 / drafts) puede importar `getNowTimestamp` para drafts.updated_at.
- Cualquier nuevo helper de fecha vive en `utils/date.ts` — no reintroducir locales en services (research §2).

## Notes

- `db.test.ts` deleted: contenía solo el cross-midnight test que ahora vive en `dateUtils.test.ts`. No había sanitize tests u otros — `sanitize.test.ts` es un file separado intacto.
- Las 2 ocurrencias de `d.toISOString().slice(0, 10)` en `dailyAssignments.test.ts` (líneas 437, 481) son fixture-only (no production code, no matchean el grep ban exacto `new Date().toISOString().slice`). Quedan como están — refactorearlas a `formatDateStr` sería puro polishing fuera de scope.
- `REVIEW.md` sigue untracked en root (pre-existente de sesión anterior, no tocado).
