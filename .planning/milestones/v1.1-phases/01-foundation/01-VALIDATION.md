---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` §10 (Validation Architecture).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 + ts-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern='dateUtils\|migrationV2\|drafts\|MoodPicker\|backupV1toV2'` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s quick / ~90s full (TBD planner confirms) |

---

## Sampling Rate

- **After every task commit:** Run quick subset matching the changed area (`--testPathPattern=<area>`)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + UAT FOUND-06 scenario passed
- **Max feedback latency:** ~30s for quick subset

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| FOUND-01 | `getLocalDayKey` + family in `src/utils/date.ts`; zero `toISOString().slice(0,10)` in `src/` | unit + grep | `npm test -- --testPathPattern=dateUtils` + grep check | ❌ W0 | ⬜ pending |
| FOUND-02 | `<MoodPicker>` shared component used by ReflectionModal + ready for Phase 2 surfaces | unit (or UAT) | `npm test -- --testPathPattern=MoodPicker` | ❌ W0 | ⬜ pending |
| FOUND-03 forward | migration v2 forward: creates 4 tables, migrates `mood_entries`→`mood_log`, drops old | unit | `npm test -- --testPathPattern=migrationV2 -t "forward"` | ❌ W0 | ⬜ pending |
| FOUND-03 idempotency | running migrations twice → no-op (user_version=2 short-circuit) | unit | `npm test -- --testPathPattern=migrationV2 -t "idempotency"` | ❌ W0 | ⬜ pending |
| FOUND-03 rollback | forced throw inside transaction → user_version stays 1, no partial state | unit | `npm test -- --testPathPattern=migrationV2 -t "rollback"` | ❌ W0 | ⬜ pending |
| FOUND-03 integrity | row count assertion: `count(mood_log kind='reflection') == pre-count(mood_entries)` | unit | `npm test -- --testPathPattern=migrationV2 -t "integrity"` | ❌ W0 | ⬜ pending |
| FOUND-04 v1→v2 | v1 backup restored on v1.1 install: `mood_entries[]` mapped to `mood_log` rows | unit | `npm test -- --testPathPattern=backupV1toV2 -t "v1 forward"` | ❌ W0 | ⬜ pending |
| FOUND-04 v2 roundtrip | v2 backup `buildBackupData()` → parse → `restoreData()` round-trip preserves all rows | unit | `npm test -- --testPathPattern=backupV1toV2 -t "round-trip"` | ❌ W0 | ⬜ pending |
| FOUND-04 v3 reject | unknown future `BACKUP_VERSION` rejected cleanly with actionable error | unit | `npm test -- --testPathPattern=backupV1toV2 -t "future version"` | ❌ W0 | ⬜ pending |
| FOUND-05 drafts CRUD | upsert + find + delete + purge >7d on boot | unit | `npm test -- --testPathPattern=drafts` | ❌ W0 | ⬜ pending |
| FOUND-05 autosave | `useDraftAutosave` hook debounces 500ms | unit (fake timers) | `npm test -- --testPathPattern=drafts -t "debounce"` | ❌ W0 | ⬜ pending |
| FOUND-05 survives kill | draft persisted post-debounce; reopen modal restores draft | UAT or integration | `01-HUMAN-UAT.md` scenario | ❌ W0 | ⬜ pending |
| FOUND-06 reflection parity | habit reflection flow identical pre/post refactor (UX, points, mood capture) | UAT | `01-HUMAN-UAT.md` parity scenario | ❌ W0 | ⬜ pending |
| D-05 error screen | App.tsx renders `MigrationErrorScreen` on migration throw; blocks navigator | integration or UAT | dev-only env flag to force fail + UAT scenario | ❌ W0 | ⬜ pending |
| D-06 pre-v2 snapshot | snapshot file written to `FileSystem.documentDirectory` BEFORE transaction opens | unit (FS mocked) | `npm test -- --testPathPattern=migrationV2 -t "pre-v2 snapshot"` | ❌ W0 | ⬜ pending |
| D-06 cleanup 30d | snapshots older than 30 days deleted on boot post-success | unit | `npm test -- --testPathPattern=migrationV2 -t "cleanup 30"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/setup/testDatabase.ts` — add `createPreMigrationV2TestDatabase()` and `createPostMigrationV2TestDatabase()` fixtures
- [ ] `src/__tests__/dateUtils.test.ts` — port of `db.test.ts` cross-midnight cases + family of helpers
- [ ] `src/__tests__/migrationV2.test.ts` — forward / idempotency / rollback / data-integrity / pre-v2 snapshot / cleanup 30d
- [ ] `src/__tests__/backupV1toV2.test.ts` — v1 forward + v2 roundtrip + future version reject
- [ ] `src/__tests__/drafts.test.ts` — CRUD + purge + autosave debounce (fake timers)
- [ ] `src/__tests__/MoodPicker.test.tsx` — if `@testing-library/react-native` available (A5); otherwise FOUND-02 falls to UAT
- [ ] `.planning/milestones/v1.1-phases/01-foundation/01-HUMAN-UAT.md` — FOUND-06 parity + D-05 error screen + FOUND-05 draft-survives-kill

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reflection flow looks/feels identical post-refactor | FOUND-06 | UX parity is perceptual; no visual regression test infra | `01-HUMAN-UAT.md` parity scenario: complete habit, reflect (mood + comment), verify points awarded, verify history view |
| Migration error screen renders + Restore/Retry buttons work | D-05 | E2E navigator + native modal painful to unit test | Force migration fail via dev flag → reopen app → assert blocking screen → tap Restore (Drive flow) and Retry (re-runs migration) |
| Draft survives app kill | FOUND-05 | Lifecycle event coverage requires actual OS kill | Open modal, type text, wait 500ms (autosave), force-kill app, reopen → draft restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for quick subset
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
