---
phase: 03-google-drive-backup
reviewed: 2026-04-27T00:00:00Z
depth: standard
iteration: 3
files_reviewed: 23
files_reviewed_list:
  - App.tsx
  - __mocks__/expo-file-system.ts
  - app.json
  - jest.config.js
  - package.json
  - src/__tests__/dateFormat.test.ts
  - src/__tests__/driveBackupService.restore.test.ts
  - src/__tests__/driveBackupService.test.ts
  - src/__tests__/driveRetention.test.ts
  - src/__tests__/useSettingsStore.googleAuth.test.ts
  - src/components/shared/LoadingOverlay.tsx
  - src/config/constants.ts
  - src/screens/RestoreFromDriveScreen.styles.ts
  - src/screens/RestoreFromDriveScreen.tsx
  - src/screens/SettingsScreen.styles.ts
  - src/screens/SettingsScreen.tsx
  - src/services/backupService.ts
  - src/services/driveBackupService.ts
  - src/services/googleAuth.ts
  - src/store/useSettingsStore.ts
  - src/types/index.ts
  - src/utils/dateFormat.ts
  - src/utils/driveRetention.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 3: Code Review Report (Iteration 3)

**Reviewed:** 2026-04-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** clean
**Previous reviews:**
- Iteration 1 — 0 critical / 4 warning / 7 info
- Iteration 2 — 0 critical / 0 warning / 7 info (4 warnings fixed)
- Iteration 3 (this review) — 0 / 0 / 0 (all 7 info findings fixed)

## Summary

All seven Iteration-2 info findings were re-verified in source and confirmed correctly applied with no regressions and no new issues introduced. Phase 3 is now fully clean: no critical, warning, or info findings remain. The 50 tests in the five Drive-related test suites pass (`driveBackupService.test.ts`, `driveBackupService.restore.test.ts`, `useSettingsStore.googleAuth.test.ts`, `dateFormat.test.ts`, `driveRetention.test.ts`).

No real Google client IDs, secrets, or access tokens found in source. `app.json` keeps `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`; the web client ID is read from the `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` env var (`googleAuth.ts:17`). The `fake_token` literal in tests is a Jest-mock fixture, not a real credential.

## Verified Fixes

### IN-01: Static UI strings centralized in `constants.ts`
**Commit:** `b48afcf`
**Verified at:** `src/config/constants.ts:333-350`, `src/screens/RestoreFromDriveScreen.tsx:22-32, 181, 188, 194-195, 70-71, 78`
- `RESTORE_SCREEN_TITLE`, `RESTORE_SCREEN_LOADING`, `RESTORE_SCREEN_OVERLAY_READING`, `RESTORE_SCREEN_OVERLAY_RESTORING` defined as plain string consts.
- `EMPTY_DRIVE_BACKUPS` (heading + body) and `ERROR_DRIVE_LOAD` (heading + body + retryLabel) defined as `as const` objects.
- All five Iteration-2 inline strings (loading caption, empty heading/body, error heading/body, screen title) now read from constants.
- The `OverlayMsg` union type at `RestoreFromDriveScreen.tsx:37-40` reuses `typeof RESTORE_SCREEN_OVERLAY_*` so the constants ARE the source of truth — no string drift possible.
- Remaining inline strings in the screen are correctly out-of-scope: (a) two templated alert messages at lines 132 and 153-159 (the `ALERT_DRIVE_*` constants explicitly carry a `// message templated at call site` comment marking this as by-design), (b) one accessibility label `"Reintentar carga de backups"` at line 76 (a11y hints, not user-visible copy). No orphaned Spanish strings remain that should have been moved.

### IN-02: SDK error logs sanitized in `silentSignInIfPossible`
**Commit:** `daa9b0e`
**Verified at:** `src/services/googleAuth.ts:38-44, 56`
- New `sanitizeAuthError(err)` helper extracts only `code` + `message` (defaulting to `'no-code'` / `String(err)` when absent), used at line 56: `console.warn('[silentSignInIfPossible]', code, message)`.
- The full `err` object — which may carry `userInfo` / `nativeStackAndroid` payloads with token fragments in some SDK versions — is no longer logged. Iteration-2 risk eliminated.
- Helper is private (not exported), so blast radius is limited to this file. Helper size is 7 lines (≤20).

### IN-03: `signIn()` maps network errors to `NO_NETWORK` (parity with `getDriveAccessToken`)
**Commit:** `29a5d54`
**Verified at:** `src/services/driveBackupService.ts:79-99`
- The catch block at lines 87-98 now distinguishes three branches: `SIGN_IN_CANCELLED` → return `null`, `TypeError /network/i` → `DriveError(ALERT_DRIVE_NO_NETWORK)`, everything else → `DriveError(ALERT_DRIVE_GENERIC)`.
- Parity with the silent-path mapping in `getDriveAccessToken()` (lines 123-136) confirmed: both paths special-case the `TypeError network` heuristic and fall through to a tagged `DriveError`.
- Test coverage at `src/__tests__/driveBackupService.test.ts:88-104` exercises both new branches: `TypeError('Network request failed') → ALERT_DRIVE_NO_NETWORK`, `Error('something else') → ALERT_DRIVE_GENERIC`. The pre-existing cancellation test (line 75) and `response.type==='cancelled'` test (line 82) still pass.
- Function size is 19 lines (≤20).

### IN-04: `pruneOldBackupsBestEffort` re-fetches its own token
**Commit:** `53092ca`
**Verified at:** `src/services/driveBackupService.ts:193, 299-318`
- Helper signature changed from `pruneOldBackupsBestEffort(token: string)` to `pruneOldBackupsBestEffort()` — no caller-supplied token.
- Call site at line 193 is now `void pruneOldBackupsBestEffort()`. Fire-and-forget semantics preserved (the upload's `UploadResult` is returned immediately at line 195; pruning races in the background — which is the intended D-14 best-effort policy).
- Inside the helper, `getDriveAccessToken()` is called fresh at line 304 before `listBackups()` and the per-file `deleteFile` loop. The outer `try/catch` (lines 303-317) catches any throw from `getDriveAccessToken()` itself (e.g. revoked session post-upload) and downgrades to `console.warn` — no propagation to the upload flow. Pitfall #8 (NUNCA throws) honored.
- **No infinite-retry risk:** there is no retry loop. A failed `getDriveAccessToken` simply skips this prune cycle; the next successful upload triggers another single-shot attempt.
- **No race with concurrent uploads:** `uploadBackup` doesn't `await` the prune (line 193: `void`), so the upload's own token from line 181 is never re-used by the prune. The two operations now use independent token fetches; they don't interfere with each other's auth state.
- **Minor inefficiency note (NOT flagged):** `pruneOldBackupsBestEffort()` calls `getDriveAccessToken()` AND `listBackups()` (which itself calls `getDriveAccessToken()` at line 142) — so two `signInSilently` round-trips per prune cycle. Negligible: pruning happens at most once per backup, and the SDK caches credentials. Not worth a finding.

### IN-05: `parseUploadResponse` narrows Drive POST/PATCH responses
**Commit:** `748188e`
**Verified at:** `src/services/driveBackupService.ts:198-215, 246-247, 269-270`
- New `parseUploadResponse(data: unknown, filename: string)` helper validates the response shape: rejects with `DriveError(ALERT_DRIVE_GENERIC)` if `id` is missing or non-string or empty (line 207-209); falls back to `filename`/`'0'` for missing `name`/`size` rather than persisting `undefined`.
- **Rejects malformed responses gracefully:** the shape check at line 207 throws a tagged `DriveError`, NOT a raw `TypeError` from accessing `data.id` on null. Confirmed by inspection: line 206 narrows `data` via `as { id?: unknown; ... } | null` and the guard at line 207 covers `!d` (null/undefined data) before any property access.
- Both `postMultipart` (line 246-247) and `patchMultipart` (line 269-270) now call `parseUploadResponse(data, filename)` after `await res.json()`. Type at the call site is `unknown` (line 246: `const data: unknown = await res.json()`) so the narrowing is enforced by TypeScript.
- The downstream `setLastBackup(now, result.fileId)` at `SettingsScreen.tsx:161` now receives a guaranteed-string `fileId`, fixing the originally-flagged risk of persisting `lastBackupFileId: undefined`.
- Helper size is 13 lines (≤20).

### IN-06: `resetGoogleSigninConfig()` helper exposed
**Commit:** `ebec52a`
**Verified at:** `src/services/googleAuth.ts:29-31`
- New exported function flips the in-memory `configured` flag back to `false`. Comment block at lines 26-28 documents intent (tests + future re-config flows) and explicitly notes it does NOT call `signOut` or revoke access — pure config-state reset.
- Idempotency contract preserved: `configureGoogleSignin()` (lines 15-24) still early-returns when `configured === true`. The new helper is the only path that flips it back.
- No callers in production code — exposed for future use only. Doesn't change runtime behavior of the current flow.
- Function size is 3 lines.

### IN-07: `signOutSafe` keeps local session on SDK failure with user alert
**Commits:** `2057698`
**Verified at:** `src/services/driveBackupService.ts:106-117`, `src/screens/SettingsScreen.tsx:203-215`, `src/config/constants.ts:269-275`
- New `signOutSafe()` returns a discriminated union `{ ok: true } | { ok: false, error: unknown }` — the `try/catch` at lines 111-116 NEVER throws. SDK call is local-only (no network round-trip per D-10), and any rejection is captured in the `error` field.
- `handleSignOutConfirm` at `SettingsScreen.tsx:207-215` is exactly 9 lines (well under 20):
  ```
  const result = await drive.signOutSafe();
  if (!result.ok) {
    console.error('[handleSignOut]', result.error);
    Alert.alert(ALERT_DRIVE_SIGNOUT_FAILED.title, ALERT_DRIVE_SIGNOUT_FAILED.message);
    return; // mantenemos el estado local: googleEmail sigue visible
  }
  clearGoogleSession(); // D-11: preserva lastBackupAt + lastBackupFileId
  ```
- **Correctness verified:** on SDK failure, `clearGoogleSession()` is NOT called (early return on line 212), so `googleEmail` remains in the store and the email row stays visible in Settings — avoiding the "Google says no but local says yes" inconsistency the reviewer flagged. On success, the existing D-11 semantics (clear email, preserve `lastBackupAt`/`lastBackupFileId`) hold.
- **User-visible alert fires:** `ALERT_DRIVE_SIGNOUT_FAILED` is a new constant (lines 269-275 of `constants.ts`) with title "No se pudo cerrar sesión" + message guiding the user to retry. `Alert.alert(title, message)` is the same pattern used elsewhere for tagged DriveError UI.
- Test coverage at `driveBackupService.test.ts:114-128` covers both branches: SDK resolves → `{ ok: true }`, SDK rejects → `{ ok: false, error: sdkErr }` and asserts the same error reference is passed through. The `signOut` describe block (lines 107-112) still verifies the legacy `signOut()` (without "Safe" suffix) is preserved for any other call sites — though grep confirms no production caller uses the unsafe variant after this fix.

## New Issues Introduced by the Fixes

None. The five files most touched by Iteration-3 fixes (`driveBackupService.ts`, `googleAuth.ts`, `RestoreFromDriveScreen.tsx`, `SettingsScreen.tsx`, `constants.ts`) were re-read end-to-end:
- **No closure staleness** in `signOutSafe` or `parseUploadResponse` — both helpers are pure (no captured state) or only capture their immediate parameters.
- **No side effects** in `signOutSafe` beyond the SDK call and the result tag — no store mutations, no logging beyond what the caller does.
- **No type-narrowing edge cases** in `parseUploadResponse` — the null-check at line 207 covers `data === null` before any property access; the `typeof d.id !== 'string'` and `d.id.length === 0` guards together rule out empty/non-string IDs; `name` and `size` fall back to safe defaults rather than throwing.
- **No new `as any`, `as unknown as ...`, `@ts-ignore`, or `@ts-expect-error`** introduced. The single pre-existing `as unknown as { cause: unknown }` at line 55 is unchanged from Iteration 1 (a workaround for the ES2022 `Error.cause` polyfill in the RN runtime).
- **No new debug artifacts:** no `console.log`, `debugger`, `TODO`, `FIXME`, `XXX`, or `HACK` strings introduced. The two existing matches (`'TODOS tus datos'` in an alert message, and a `'WR-02: borra TODOS'` JSDoc comment) are coincidental Spanish text, not debug markers.
- **Tests still pass:** all 50 tests across the 5 Drive test suites green (`jest src/__tests__/driveBackupService.test.ts ...` exits 0).

## Re-verified: No Regressions in Iteration-2 Fixes

Quick spot-check that the four Iteration-1 warning fixes verified clean in Iteration 2 still hold after Iteration-3 churn:
- **WR-01** (auth SDK error mapping in `getDriveAccessToken`) — lines 123-136 unchanged structurally; `signIn`'s new mapping at lines 87-98 is parallel, not in conflict.
- **WR-02** (preserve newest pre-restore cache) — `cleanupOldPreRestoreCache` at lines 459-473 unchanged.
- **WR-03** (`isMountedRef` guards) — `RestoreFromDriveScreen` and `SettingsScreen` mount guards unchanged. `handleSignOutConfirm` (the IN-07 target) correctly remains unguarded — the only post-await side-effects are `Alert.alert` (mount-safe) and the synchronous `clearGoogleSession`/early-return paths.
- **WR-04** (single-download invariant via `isPreparing`) — `RestoreFromDriveScreen.tsx:95, 144, 174, 207` all preserved.

---

_Reviewed: 2026-04-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
