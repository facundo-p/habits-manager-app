---
phase: 03-google-drive-backup
fixed_at: 2026-04-27T00:00:00Z
review_path: .planning/phases/03-google-drive-backup/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report (Iteration 2 source / Iteration 1 of info-scope fixer)

**Fixed at:** 2026-04-27T00:00:00Z
**Source review:** `.planning/phases/03-google-drive-backup/03-REVIEW.md` (review iteration 2)
**Fixer iteration:** 1
**Scope:** `--all` (Critical + Warning + Info). Source review reported 0 critical / 0 warning / 7 info, so this run targets the 7 info findings only. The 4 warnings were already addressed in a previous fixer session (commits `58b8895`, `cdb515e`, `0b99572`, `8930fee`, `d3f5564`, `acd1235`).

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0
- Tests: 98 -> 102 passing (4 new regression tests for IN-03 + IN-07; rest stayed green)

## Fixed Issues

### IN-01: Hardcoded Spanish UI strings bypass constants module

**Files modified:** `src/config/constants.ts`, `src/screens/RestoreFromDriveScreen.tsx`
**Commit:** `b48afcf` — `refactor(03): IN-01 move RestoreFromDriveScreen static strings to constants`
**Applied fix:** Added `RESTORE_SCREEN_TITLE`, `RESTORE_SCREEN_LOADING`, `RESTORE_SCREEN_OVERLAY_READING`, `RESTORE_SCREEN_OVERLAY_RESTORING`, `EMPTY_DRIVE_BACKUPS`, and `ERROR_DRIVE_LOAD` to `src/config/constants.ts`. Replaced inline JSX strings (screen title, loading caption, empty heading/body, error heading/body, retry label) and the `OverlayMsg` type literals in `RestoreFromDriveScreen.tsx`. Templated alert messages (counts breakdown, restore success body) stay at the call site, as they were already documented as by-design via `// message templated at call site` comments in the existing `ALERT_DRIVE_*` constants.

### IN-02: console.warn in silentSignInIfPossible may leak SDK error fields

**Files modified:** `src/services/googleAuth.ts`
**Commit:** `daa9b0e` — `fix(03): IN-02 sanitize SDK error logs in silentSignInIfPossible`
**Applied fix:** Added a `sanitizeAuthError(err)` helper that returns `{ code, message }` only — never the full SDK error object (which on some versions carries `userInfo` / `nativeStackAndroid` payloads with token fragments or account hints). `silentSignInIfPossible` now logs `console.warn('[silentSignInIfPossible]', code, message)`.

### IN-03: signIn() maps any non-cancellation error to ALERT_DRIVE_GENERIC

**Files modified:** `src/services/driveBackupService.ts`, `src/__tests__/driveBackupService.test.ts`
**Commit:** `29a5d54` — `fix(03): IN-03 map network errors during interactive signIn to NO_NETWORK alert`
**Applied fix:** In the `signIn()` catch block, added a `TypeError + /network/i.test(err.message)` branch that throws `DriveError(ALERT_DRIVE_NO_NETWORK, err)` before the GENERIC fallback. Did NOT extract a shared helper with `getDriveAccessToken` because the fallback semantics differ (signIn -> GENERIC, getDriveAccessToken -> AUTH_EXPIRED) — a unified helper would obscure per-path intent. Added 2 regression tests in `signIn` describe block: network TypeError -> `NO_NETWORK`; generic Error -> `GENERIC`.

### IN-04: pruneOldBackupsBestEffort mixes a stale token with listBackups's fresh token

**Files modified:** `src/services/driveBackupService.ts`
**Commit:** `53092ca` — `fix(03): IN-04 refresh token inside pruneOldBackupsBestEffort to avoid stale token`
**Applied fix:** Dropped the `token` parameter from `pruneOldBackupsBestEffort()`. The helper now calls `getDriveAccessToken()` itself before iterating deletes, so the token used for DELETE matches the generation `listBackups()` already refreshes internally. Updated the call site in `uploadBackup()` to `void pruneOldBackupsBestEffort()`. Still best-effort (Pitfall #8): both the inner per-delete try/catch and the outer try/catch swallow errors so pruning failures never fail the backup. Existing pruning tests still pass without modification.

### IN-05: postMultipart / patchMultipart don't validate Drive's response shape

**Files modified:** `src/services/driveBackupService.ts`
**Commit:** `748188e` — `refactor(03): IN-05 narrow Drive upload response with parseUploadResponse helper`
**Applied fix:** Added a `parseUploadResponse(data: unknown, filename: string)` helper that:
- Casts the response to `{ id?: unknown; name?: unknown; size?: unknown } | null`.
- Throws `DriveError(ALERT_DRIVE_GENERIC)` if `id` is not a non-empty string (would otherwise propagate `undefined` to `setLastBackup` and persist `lastBackupFileId: undefined`).
- Defaults `name` to the requested filename if missing/non-string.
- Defaults `size` to `'0'` if missing/non-string.
Replaced direct `data.id / data.name / data.size` reads in `postMultipart` and `patchMultipart` with `parseUploadResponse(...)`. `listBackups` and `findFileByName` already had a defensive `Array.isArray(data?.files)` check, so they were left as-is per the lightweight-approach instruction.

### IN-06: signOut doesn't reset the in-memory configured flag

**Files modified:** `src/services/googleAuth.ts`
**Commit:** `ebec52a` — `chore(03): IN-06 expose resetGoogleSigninConfig() helper for re-config flows`
**Applied fix:** Exported `resetGoogleSigninConfig()` that sets `configured = false`. Updated the JSDoc on `configureGoogleSignin()` to point at the new helper for re-configuration scenarios. Did NOT change `configureGoogleSignin` behavior — it stays idempotent. Useful for tests (re-configure between runs) and for a future scope-change feature.

### IN-07: handleSignOutConfirm keeps user "logged in" if signOut rejects

**Files modified:** `src/config/constants.ts`, `src/services/driveBackupService.ts`, `src/screens/SettingsScreen.tsx`, `src/__tests__/driveBackupService.test.ts`
**Commit:** `2057698` — `fix(03): IN-07 keep local session on SDK signOut failure with user alert`
**Applied fix:** Per the per-finding instructions in `<important_constraints>` (which override the REVIEW.md suggestion): a partial sign-out where Google says "no" but local state is cleared is worse than a no-op + alert.
- Added `ALERT_DRIVE_SIGNOUT_FAILED` constant in `src/config/constants.ts`.
- Added `signOutSafe()` to `driveBackupService.ts` returning `{ ok: true } | { ok: false, error }` — typed result instead of throw, so the UI decides what to do without coupling.
- `handleSignOutConfirm` now calls `signOutSafe()`. On `ok: false`, it shows `ALERT_DRIVE_SIGNOUT_FAILED` and `return`s early — `clearGoogleSession()` is NOT called, so `googleEmail` stays visible and the user can retry (or cancel from Google's account page if the SDK keeps failing).
- Added 2 regression tests for `signOutSafe`: success path returns `{ ok: true }`; SDK rejection returns `{ ok: false, error }` without throwing.

## Skipped Issues

None.

## Verification

- `npm test` after each fix commit: tests stayed green (98 -> 100 -> 100 -> 100 -> 100 -> 100 -> 102).
- Final run: **102/102 tests pass** in 10 suites (98 baseline + 2 new for IN-03 + 2 new for IN-07).
- No unrelated dirty/untracked files staged: every commit used explicit `--files <list>`. Pre-existing modifications to `src/store/useHabitStore.ts`, `.planning/config.json`, `03-RESEARCH.md`, `03-VALIDATION.md`, and untracked `.claude/`, `02-PATTERNS.md`, `03-PATTERNS.md`, plan/deferred markdown stay un-staged.
- Project rule "function ≤20 lines" respected:
  - `signIn` after IN-03: 16 lines.
  - `pruneOldBackupsBestEffort` after IN-04: 16 lines.
  - `parseUploadResponse`: 13 lines.
  - `postMultipart` / `patchMultipart`: 18 lines each.
  - `signOutSafe`: 7 lines.
  - `sanitizeAuthError`: 6 lines.
  - `handleSignOutConfirm` after IN-07: 8 lines.
- No inline styles introduced.
- Spanish UI strings: not translated, only centralized (per instruction). New constant `ALERT_DRIVE_SIGNOUT_FAILED` follows the existing `ALERT_DRIVE_*` naming pattern.

## Commits Summary (atomic, one per finding)

| Finding | Commit  | Type        |
|---------|---------|-------------|
| IN-01   | `b48afcf` | refactor(03) |
| IN-02   | `daa9b0e` | fix(03)      |
| IN-03   | `29a5d54` | fix(03)      |
| IN-04   | `53092ca` | fix(03)      |
| IN-05   | `748188e` | refactor(03) |
| IN-06   | `ebec52a` | chore(03)    |
| IN-07   | `2057698` | fix(03)      |

---

_Fixed: 2026-04-27T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
