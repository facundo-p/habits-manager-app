---
phase: 4
slug: habit-creation-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
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
| **Quick run command** | `npm test -- --testPathPattern='dailyAssignments|migrationV1|periodHelpers'` |
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

> Filled by gsd-planner during step 8. Each task in PLAN.md must map to a row here
> (or be marked "no automated verify — manual only" with justification).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-XX-XX | TBD | TBD | REQ-04-XX | — | TBD | unit | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/__tests__/periodHelpers.test.ts` — stubs for REQ-04-01..03 (period boundaries, completion-in-period)
- [ ] `src/services/__tests__/migrationV1.test.ts` — stubs for REQ-04-04..07 (dedup tie-break, atomicity, idempotency, index creation)
- [ ] `src/__tests__/restoreCleanup.test.ts` — stubs for REQ-04-08 (pre-clean of backup JSON)
- [ ] `src/__tests__/dailyAssignmentsRegression.test.ts` — extension of existing `dailyAssignments.test.ts` for REQ-04-09..11 (per-flow regression: rollover, addAssignmentForHabit, updateTodaySnapshotForHabit)

*If existing `src/__tests__/dailyAssignments.test.ts` already includes a `describe("Prevención de duplicados")` block (per RESEARCH.md), planner should extend it instead of creating a new file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migración corre silenciosamente al primer boot post-update sin feedback visible (D-06) | REQ-04-06 | Comportamiento de UI/boot sequence; no asertable desde Jest | (1) Build APK con `build-apk-local` skill; (2) Instalar sobre versión previa con DB poblada (con duplicados conocidos); (3) Abrir app; (4) Verificar que no hay UI bloqueante; (5) `adb logcat` muestra "migration v1 ok" o `console.error` (si falla); (6) Re-abrir app: confirmar idempotencia (no corre de nuevo). |
| Restore de backup pre-fix con duplicados no rompe el UNIQUE INDEX | REQ-04-08 | E2E flow involucra Drive/file pickers difíciles de unit-testear | (1) Generar JSON de backup con duplicados conocidos; (2) Reset DB; (3) Restore via Drive backup UI; (4) Verificar que post-restore no hay duplicados y la app abre normal. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (periodHelpers, migrationV1, restoreCleanup test files)
- [ ] No watch-mode flags (`--watch` prohibido en commands de plan)
- [ ] Feedback latency < 15s para quick, < 60s para full
- [ ] `nyquist_compliant: true` set in frontmatter (planner debe actualizar tras llenar la per-task map)

**Approval:** pending
