---
phase: 1
slug: bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BUG-01 | unit | `npm test -- --testNamePattern "BUG-01"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | BUG-02 | unit | `npm test -- --testNamePattern "isFutureDate"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | BUG-03 | unit | `npm test -- --testNamePattern "BUG-03"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | BUG-04 | unit | `npm test -- --testNamePattern "BUG-04"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/dailyAssignments.test.ts` — add BUG-01 test: ensureAssignmentsForDate skips when only spontaneous exist
- [ ] `src/__tests__/dailyAssignments.test.ts` — add BUG-02 test: isFutureDate exists and is used by both call sites
- [ ] `src/__tests__/dailyAssignments.test.ts` — add BUG-03 test: nextDay returns correct date regardless of timezone
- [ ] `src/__tests__/dailyAssignments.test.ts` — add BUG-04 test: addSpontaneous throws on invalid category

*Existing infrastructure covers framework needs — only test cases are missing.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
