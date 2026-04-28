---
phase: 03-google-drive-backup
fixed_at: 2026-04-27T00:00:00Z
review_path: .planning/phases/03-google-drive-backup/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-27T00:00:00Z
**Source review:** .planning/phases/03-google-drive-backup/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical: 0, Warning: 4)
- Info findings (out of scope): 7
- Fixed: 4
- Skipped: 0

All four warnings were addressed via TDD-style commits where applicable
(RED test commit + GREEN fix commit) and atomic single-purpose fixes for
the defensive changes. Test suite stays green: 98/98 tests passing
(95 baseline + 3 new auth-mapping tests for WR-01).

## Fixed Issues

### WR-01: Auth SDK errors bypass `DriveError` mapping

**Files modified:** `src/__tests__/driveBackupService.test.ts`, `src/services/driveBackupService.ts`
**Commits:**
- `58b8895` test(03): WR-01 add failing tests for auth SDK error mapping
- `cdb515e` fix(03): WR-01 map auth SDK errors to DriveError(AUTH_EXPIRED|NO_NETWORK)

**Applied fix:** Wrapped `getDriveAccessToken()` SDK calls in try/catch:
- `signInSilently` / `getTokens` rejections that aren't already `DriveError` are
  re-thrown as `DriveError(ALERT_DRIVE_AUTH_EXPIRED, err)`.
- `TypeError` matching `/network/i` re-throws as
  `DriveError(ALERT_DRIVE_NO_NETWORK, err)`.
- An empty `accessToken` from `getTokens()` raises
  `DriveError(ALERT_DRIVE_AUTH_EXPIRED)` directly.

Three regression tests cover all branches: SDK rejection, empty token, network
TypeError. Function size: 14 lines (≤20 cumple regla de proyecto).

### WR-02: Pre-restore cache cleanup deletes the just-written safety cache

**Files modified:** `src/__tests__/driveBackupService.restore.test.ts`, `src/services/driveBackupService.ts`
**Commits:**
- `0b99572` test(03): WR-02 expect newest pre-restore cache to survive cleanup
- `8930fee` fix(03): WR-02 preserve newest pre-restore cache during cleanup

**Applied fix:** Per user-confirmed Option A — the cleanup implementation now
matches the UI promise. `cleanupOldPreRestoreCache` filters
`cozyhabits-pre-restore-*.json` entries, sorts them lexicographically (ISO
timestamps in name = chronological order), and applies `slice(0, -1)` to skip
the newest. The freshly-written pre-restore cache from this restore survives so
the user can revert if something goes wrong. Existing test 5 was updated to
include a "today" pre-restore file in the directory mock and assert it is NOT
in the deletion list. Function size: 13 lines (≤20).

### WR-03: Async `setState` after unmount in restore + connect flows

**Files modified:** `src/screens/RestoreFromDriveScreen.tsx`, `src/screens/SettingsScreen.tsx`
**Commit:** `d3f5564` fix(03): WR-03 add isMountedRef guards for async setState in restore + settings flows

**Applied fix:** Added `mountedRef = useRef(true)` + `useEffect(() => () => { mountedRef.current = false; }, [])`
cleanup pattern in both screens. Each `setState` call after an `await` is now
guarded by `if (!mountedRef.current) return;` (or wrapped in
`if (mountedRef.current) ...` for `finally` blocks). Applied to:
- `RestoreFromDriveScreen.loadList`, `performRestore`, `previewAndConfirm`
- `SettingsScreen.handleConnect`, `performBackup`

Defensive — no behavior change in the happy path. Test suite remains green
(98/98).

### WR-04: `previewAndConfirm` allows concurrent downloads

**File modified:** `src/screens/RestoreFromDriveScreen.tsx`
**Commit:** `acd1235` fix(03): WR-04 add isPreparing single-download guard with disabled BackupRow

**Applied fix:** Added `isPreparing` boolean state to enforce single-download
invariant as belt-and-suspenders alongside the existing `LoadingOverlay` Modal:
- `previewAndConfirm` returns early if `isPreparing` is already `true`.
- `setIsPreparing(true)` at the top, cleared in `finally` (mount-guarded).
- `BackupRow` accepts a `disabled?: boolean` prop forwarded to its `Pressable`,
  and the FlatList passes `disabled={isPreparing}` to all rows during a download.

This prevents the ~250ms RN Modal fade-animation race window where a second
tap could register on the FlatList behind the overlay.

## Skipped Issues

None — all four in-scope warnings fixed cleanly.

## Out-of-scope (Info findings, not addressed)

The following 7 Info-level findings were explicitly out of scope for this fix
session (`fix_scope: critical_warning`). They remain documented in
`03-REVIEW.md` for future iteration:

- IN-01: Hardcoded Spanish UI strings bypass constants module
- IN-02: `console.warn` in `silentSignInIfPossible` may leak SDK error fields
- IN-03: `signIn()` maps any non-cancellation error to `ALERT_DRIVE_GENERIC`
- IN-04: `pruneOldBackupsBestEffort` mixes a stale token with `listBackups`'s fresh token
- IN-05: `postMultipart` / `patchMultipart` don't validate Drive's response shape
- IN-06: `signOut` doesn't reset the in-memory `configured` flag in `googleAuth.ts`
- IN-07: `handleSignOutConfirm` keeps user "logged in" if `signOut` rejects

## Verification

- `npm test` after the final fix commit: **98/98 tests pass** in 10 suites.
  - 95 baseline tests preserved.
  - 3 new tests for WR-01 (`signInSilently rechaza`, `getTokens accessToken vacío`, `signInSilently TypeError network`).
  - 1 existing test reused/updated for WR-02 (assertion on newest cache survival).
- Each behavior fix has a paired RED test commit (TDD discipline).
- No unrelated dirty/untracked files were staged into any commit (used explicit
  `--files <list>` for every commit).
- Project rule "function ≤20 lines" respected:
  - `getDriveAccessToken`: 14 lines.
  - `cleanupOldPreRestoreCache`: 13 lines.
  - All callbacks in screens stay below the threshold.
- No inline styles introduced; only added a `disabled` prop to existing
  `Pressable`.
- Spanish UI strings: no user-facing text changed in this session — WR-02 was
  fixed by aligning implementation with the existing `ALERT_DRIVE_RESTORE_SUCCESS`
  promise instead of editing the alert constant.

---

_Fixed: 2026-04-27T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
