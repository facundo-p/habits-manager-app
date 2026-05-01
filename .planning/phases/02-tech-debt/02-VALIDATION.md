---
phase: 2
slug: tech-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + ts-jest |
| **Config file** | `jest.config.js` (project root) |
| **Quick run command** | `npx jest --testPathPattern="parsing\|sanitize\|speechRecognition\|habitService"` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~12 seconds (full suite, in-memory better-sqlite3) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="parsing|sanitize|speechRecognition|habitService"`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd-verify-work`:** Full suite must be green (29 Phase 1 tests + new Phase 2 tests)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-W0a | 01 | 0 | DEBT-02 | T-02-01 | parser filters invalid IDs (whitelist) | unit (stub) | `npx jest --testPathPattern="parsing"` | ❌ W0 | ⬜ pending |
| 02-01-W0b | 01 | 0 | DEBT-03 | T-02-02 | static SQL only — no concatenation | unit (stub) | `npx jest --testPathPattern="sanitize"` | ❌ W0 | ⬜ pending |
| 02-01-W0c | 01 | 0 | DEBT-02 | T-02-03 | write validation rejects invalid IDs | unit (stub) | `npx jest --testPathPattern="habitService"` | ❌ W0 | ⬜ pending |
| 02-01-W0d | 01 | 0 | DEBT-01 | — | hook handles missing native module | unit (stub) | `npx jest --testPathPattern="speechRecognition"` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | DEBT-02 | T-02-01 | `parseAndValidateCategories` exported, drops invalid IDs, console.warn invoked | unit | `npx jest --testPathPattern="parsing"` | ✅ after W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DEBT-02 | — | 4 call sites use parser, no `parseJsonArray` imports remain | grep | `! grep -r "parseJsonArray" src/` | n/a | ⬜ pending |
| 02-01-03 | 01 | 1 | DEBT-03 | T-02-02 | two named functions, no template SQL, no `[key: string]: any` | unit + grep | `npx jest --testPathPattern="sanitize" && ! grep -E "SELECT.*\\\${" src/services/db.ts` | ✅ after W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | DEBT-02 | T-02-03 | `createHabit`/`updateHabit` throw on invalid IDs | unit | `npx jest --testPathPattern="habitService"` | ✅ after W0 | ⬜ pending |
| 02-01-05 | 01 | 2 | DEBT-01 | — | `SpeechModuleInterface` typed, zero `any` in file | unit + grep | `npx jest --testPathPattern="speechRecognition" && ! grep -n "any" src/hooks/useSpeechRecognition.ts` | ✅ after W0 | ⬜ pending |
| 02-01-06 | 01 | 2 | DEBT-02 | — | `backupService.parseAndValidate` returns `BackupData` without `as` assertions | unit | `! grep -E "as (Partial<)?BackupData" src/services/backupService.ts && npx jest --testPathPattern="backup"` | ❌ optional | ⬜ pending |
| 02-01-V | 01 | 3 | all | — | global verification: zero `any`, zero `as` (categories/backup), full suite green | grep + suite | `! grep -nE "\\bany\\b" src/hooks/useSpeechRecognition.ts src/services/db.ts && npx jest` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/parsing.test.ts` — covers DEBT-02: `parseAndValidateCategories` happy path, invalid IDs, malformed JSON, empty array, console.warn assertion
- [ ] `src/__tests__/sanitize.test.ts` — covers DEBT-03: both per-table sanitizers using better-sqlite3 in-memory (mirror `dailyAssignments.test.ts` pattern)
- [ ] `src/__tests__/habitService.test.ts` — covers D-15: write validation throws descriptive error on invalid category IDs in `createHabit`/`updateHabit`
- [ ] `src/__tests__/speechRecognition.test.ts` — covers DEBT-01: hook with missing module (Expo Go path) and present module (mocked require)

**Reference test pattern:** `src/__tests__/dailyAssignments.test.ts` (29 passing tests from Phase 1) — uses `better-sqlite3` in-memory, `jest.mock` for dependencies, explicit TypeScript types throughout. New tests follow the same shape.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `useSpeechRecognition` works on real device with native module installed | DEBT-01 | Cannot exercise native bridge in Jest — only the missing-module path is unit-testable | Run dev build on iOS/Android device, dictate a habit name, verify transcript reaches form |
| `sanitizeCategories` migration on legacy DB with invalid IDs | DEBT-03 | One-shot defensive cleanup at app boot — manual smoke once after deploy | After upgrade, query `SELECT default_categories FROM habits` and confirm no invalid area IDs remain |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes Wave 0 stubs)

**Approval:** pending
