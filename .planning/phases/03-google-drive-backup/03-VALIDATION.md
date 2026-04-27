---
phase: 3
slug: google-drive-backup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | `jest.config.js` (project root) |
| **Quick run command** | `npm test -- --testPathPattern="<pattern>"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="<file>"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-XX | 01 | 1 | DRIVE-01 | — | OAuth client IDs not in repo (env/Constants only) | manual | manual UAT | ❌ W0 | ⬜ pending |
| 3-02-XX | 02 | 2 | DRIVE-02, DRIVE-04 | — | Multipart body well-formed; no token logging | unit | `npm test -- driveBackupService` | ❌ W0 | ⬜ pending |
| 3-02-XX | 02 | 2 | DRIVE-04 | — | Retention keeps newest 10 files | unit | `npm test -- retention` | ❌ W0 | ⬜ pending |
| 3-03-XX | 03 | 3 | DRIVE-05, DRIVE-06 | — | Pre-restore safety cache written before destructive replace | unit | `npm test -- restoreFromDrive` | ❌ W0 | ⬜ pending |
| 3-03-XX | 03 | 3 | DRIVE-07 | — | Error mapping covers network/401/403/429/5xx → user message | unit | `npm test -- errorMapping` | ❌ W0 | ⬜ pending |
| 3-03-XX | 03 | 3 | DRIVE-03, DRIVE-08 | — | Sign-out clears tokens + store state | unit | `npm test -- useSettingsStore.googleAuth` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/drive/driveBackupService.test.ts` — mocked-fetch tests for upload/list/download/delete
- [ ] `__tests__/lib/drive/retention.test.ts` — pure-function retention policy
- [ ] `__tests__/lib/drive/errorMapping.test.ts` — HTTP code → user message mapping
- [ ] `__tests__/store/useSettingsStore.googleAuth.test.ts` — auth state slice
- [ ] `__tests__/lib/drive/__mocks__/google-signin.ts` — shared mock for `@react-native-google-signin/google-signin`

*If existing infrastructure (jest-expo) covers framework setup, only test files above are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth sign-in works on real device | DRIVE-01 | Requires Google Cloud OAuth client + EAS dev build | Run on Android dev build, tap "Connect Google", complete OAuth, verify email appears in Settings |
| Drive upload visible in Drive web | DRIVE-02 | External system (Google Drive) | After backup, open drive.google.com → look for `cozyhabits-YYYY-MM-DD.json` in app data folder |
| Restore from Drive replaces local data | DRIVE-05, DRIVE-06 | End-to-end flow with real Drive | Add a habit, backup, delete habit, restore from Drive, verify habit returns |
| Sign-out clears email from Settings | DRIVE-03 | UI state visible only in app | Tap "Sign out", verify email/last-backup row hidden, "Connect" button reappears |
| Error message on no-network | DRIVE-07 | Requires network manipulation | Toggle airplane mode, tap "Backup to Drive", verify actionable error shown |
| Android `getTokens()` returns valid token after expiry | — (pitfall) | Bug only reproducible on Android with expired token | Sign in, wait 1h+, attempt backup, verify silent re-auth fix kicks in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
