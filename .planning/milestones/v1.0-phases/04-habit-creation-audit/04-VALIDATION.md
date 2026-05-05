---
phase: 4
slug: habit-creation-audit
status: ready-for-execute
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
last_updated: 2026-05-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/04-habit-creation-audit/04-RESEARCH.md` §"Validation Architecture"

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | `jest.config.js` (existing) |
| **Quick run command** | `npm test -- --testPathPatterns='dailyAssignments|migrationV1|periodHelpers|dedupeAssignmentsArray|restorePreClean'` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~12s quick / ~45s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (scoped pattern above)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | REQ-04-12 | T-04-01-02 | getPeriodKey correcto en boundaries ISO/year/month | unit | `npm test -- --testPathPatterns=periodHelpers` | ✅ (creado en task) | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | REQ-04-03 | T-04-01-01 | dedupeAssignmentsArray respeta D-03 + spontaneous passthrough | unit | `npm test -- --testPathPatterns=dedupeAssignmentsArray` | ✅ (creado en task) | ⬜ pending |
| 04-01-T3 | 04-01 | 1 | (infra) | — | createPreMigrationTestDatabase + seedDuplicates + insertTestPerformed disponibles | unit (smoke) | `npm test` | ✅ | ⬜ pending |
| 04-01-T4 | 04-01 | 1 | (infra) | — | __mocks__/expo-sqlite.ts expone `withTransactionAsync` (BEGIN/COMMIT/ROLLBACK) — desbloquea tests de migrationV1 y restoreAllData | unit (smoke) | `npm test` | ✅ | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | REQ-04-04, REQ-04-05 | T-04-02-01 | SQL constants para dedup CTE + INDEX exportadas | unit (smoke) | `npm test` | ✅ | ⬜ pending |
| 04-02-T2 | 04-02 | 2 | REQ-04-04..09 | T-04-02-01, T-04-02-02 | migration v1 atomicity + idempotency + silent failure | unit | `npm test -- --testPathPatterns=migrationV1` | ✅ (creado en task) | ⬜ pending |
| 04-02-T3 | 04-02 | 2 | REQ-04-06 | T-04-02-01 | runMigrations integrado en initDatabase + boot order verified | unit (smoke) | `npm test` | ✅ | ⬜ pending |
| 04-03-T1 | 04-03 | 3 | REQ-04-10, REQ-04-11 | T-04-03-01 | DailyItem + repo wrappers para visibility de período | unit (smoke) | `npm test` | ✅ | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | REQ-04-01, REQ-04-10, REQ-04-11 | T-04-03-01, T-04-03-02 | service-layer enrichment + propagación + dev invariant | unit | `npm test -- --testPathPatterns=dailyAssignments` | ✅ | ⬜ pending |
| 04-03-T3 | 04-03 | 3 | REQ-04-01, REQ-04-02, REQ-04-10, REQ-04-11 | T-04-03-01 | tests REQ-04-10/11 + REQ-04-01 dev invariant | unit | `npm test -- --testPathPatterns=dailyAssignments` | ✅ | ⬜ pending |
| 04-04-T1 | 04-04 | 4 | REQ-04-03 | (mitigado en 04-01) | restoreData pre-clean — backup pre-fix no rompe INDEX | unit | `npm test -- --testPathPatterns=restorePreClean` | ✅ (creado en task) | ⬜ pending |
| 04-04-T2 | 04-04 | 4 | (docs) | — | ARCHITECTURE.md alineado + VALIDATION.md cierre | doc | `grep "idx_unique_habit_date" .planning/codebase/ARCHITECTURE.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 (Now Complete)

- [x] `src/__tests__/periodHelpers.test.ts` — REQ-04-12
- [x] `src/__tests__/dedupeAssignmentsArray.test.ts` — REQ-04-03 (utility-level)
- [x] `src/__tests__/setup/testDatabase.ts` extendido con createPreMigrationTestDatabase + seedDuplicates + insertTestPerformed
- [x] `__mocks__/expo-sqlite.ts` extendido con `withTransactionAsync` (BEGIN/COMMIT/ROLLBACK shim)
- [x] `src/__tests__/migrationV1.test.ts` — REQ-04-04..09
- [x] `src/__tests__/dailyAssignments.test.ts` extendido — REQ-04-10/11/01
- [x] `src/__tests__/restorePreClean.test.ts` — REQ-04-03 (integration-level)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migración corre silenciosamente al primer boot post-update sin feedback visible (D-06) | REQ-04-07 | Comportamiento de UI/boot sequence; no asertable desde Jest | (1) Build APK con `build-apk-local` skill; (2) Instalar sobre versión previa con DB poblada (con duplicados conocidos sembrados manualmente via `adb shell sqlite3` o pre-cargando un backup pre-fix); (3) Abrir app; (4) Verificar que NO hay UI bloqueante (sólo el ActivityIndicator de fonts breve); (5) `adb logcat -s ReactNativeJS` debe mostrar `'DB inicializada y backfill completado'` y NO `[migration v1]` errors; (6) Re-abrir app: idem (idempotencia — ningún log de migration nueva). |
| Restore de backup pre-fix con duplicados no rompe el UNIQUE INDEX | REQ-04-03 | E2E flow involucra Drive/file pickers difíciles de unit-testear | (1) Generar JSON de backup pre-fix con duplicados conocidos (via export de un APK viejo o JSON sintético); (2) Reset DB local; (3) Restore via Drive backup UI o vía importBackup local; (4) Verificar post-restore: cero duplicados (`SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` retorna 0 rows); la app abre normal sin alerta de error. |
| Visibility weekly/monthly en device — completar miércoles propaga visualmente al resto de la semana | REQ-04-10 | UX visual; los unit tests cubren la lógica pero no el rendering | (1) Crear hábito weekly desde Biblioteca; (2) Verificar que el ítem aparece en DailySheet hoy; (3) Cambiar viewDate al lunes y al domingo de la misma semana ISO — el ítem aparece en ambos; (4) Completar el ítem hoy; (5) Cambiar viewDate al lunes — el ítem se ve marcado como "completado para este período" (visual: tilde verde, opacidad reducida, etc., según el render de DailySheet); (6) Idem domingo. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (periodHelpers, migrationV1, restorePreClean test files)
- [x] No watch-mode flags (`--watch` prohibido en commands de plan)
- [x] Feedback latency < 15s para quick, < 60s para full
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready-for-execute
