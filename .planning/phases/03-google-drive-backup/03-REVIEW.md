---
phase: 03-google-drive-backup
reviewed: 2026-04-27T00:00:00Z
depth: standard
iteration: 2
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
  info: 7
  total: 7
status: issues_found
---

# Phase 3: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found (info-only)
**Previous review:** Iteration 1 — 0 critical / 4 warning / 7 info
**Fix report:** `03-REVIEW-FIX.md` — all 4 warnings fixed across commits `58b8895`, `cdb515e`, `0b99572`, `8930fee`, `d3f5564`, `acd1235`.

## Summary

All four Iteration-1 warnings were re-verified in source and confirmed correctly applied with no regressions and no incidental new issues. Phase 3 is now warning-clean for the next gate.

**Verified fixes:**
- **WR-01** (auth SDK error mapping) — `getDriveAccessToken()` at `src/services/driveBackupService.ts:105-118` wraps both `signInSilently` and `getTokens` rejections, distinguishing `TypeError /network/i` → `ALERT_DRIVE_NO_NETWORK`, empty token → `ALERT_DRIVE_AUTH_EXPIRED`, everything else → `ALERT_DRIVE_AUTH_EXPIRED`. Three regression tests in `src/__tests__/driveBackupService.test.ts:169-195` cover all branches. Function size 14 lines (≤20).
- **WR-02** (preserve newest pre-restore cache) — `cleanupOldPreRestoreCache()` at `src/services/driveBackupService.ts:416-430` filters `cozyhabits-pre-restore-*.json`, sorts lexicographically (ISO timestamps in name == chronological), and applies `slice(0, -1)` to skip the most recent. Test at `src/__tests__/driveBackupService.restore.test.ts:139-160` asserts the just-written cache survives. Function size 13 lines.
- **WR-03** (isMountedRef guards) — `mountedRef = useRef(true)` plus cleanup effect added in `RestoreFromDriveScreen.tsx:89-90` and `SettingsScreen.tsx:96-97`. Each `setState`-after-`await` is guarded across `loadList`, `performRestore`, `previewAndConfirm` (Restore screen) and `handleConnect`, `performBackup` (Settings screen). `handleSignOutConfirm` has no `setState` post-await so no guard required (correctly omitted).
- **WR-04** (single-download invariant) — `isPreparing` state at `RestoreFromDriveScreen.tsx:86`, early-return at line 135, `setIsPreparing(true/false)` lifecycle, and `disabled={isPreparing}` propagated to `BackupRow` (line 198) for belt-and-suspenders coverage of the ~250ms RN Modal fade-animation race window.

**Re-evaluation of Iteration-1 info findings:** All seven persist verbatim — none were incidentally addressed by the warning fixes. They are re-listed below with the same severity (Info) for future iteration. No new issues were introduced by the fixes.

No real Google client IDs, secrets, or access tokens found in source. `app.json` keeps `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`; web client ID is read from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` env var.

## Info

### IN-01: Hardcoded Spanish UI strings bypass constants module

**File:** `src/screens/RestoreFromDriveScreen.tsx:61-62, 172, 179, 185-186` plus templated copy at lines 123 and 145-150
**Issue:** Several Spanish UI strings live inline rather than in `src/config/constants.ts`:
- "No se pudo cargar la lista" (line 61)
- "Verificá tu conexión e intentá de nuevo." (line 62)
- "Restaurar desde Drive" (line 172)
- "Cargando backups..." (line 179)
- "No hay backups todavía" / "Hacé tu primer backup desde Ajustes." (lines 185-186)
- Templated alert message strings at line 123 (`Tus datos fueron restaurados desde el backup del ${fechaLabel}. Tus datos previos quedaron respaldados...`) and 145-150 (counts breakdown).

The `ALERT_DRIVE_*` constants explicitly carry a `// message templated at call site con {fecha, N, M, K, J}` comment, so the templated messages are by-design. The static screen labels (loading caption, empty heading/body, error heading/body, screen title) are not.

**Fix:** Add an `EMPTY_DRIVE_BACKUPS` / `ERROR_DRIVE_LOAD` / `RESTORE_SCREEN_TITLE` group in `constants.ts` and import them in the screen. This isolates copy changes (e.g. future i18n) to one file. Lower priority than the warnings.

### IN-02: `console.warn` in `silentSignInIfPossible` may leak SDK error fields

**File:** `src/services/googleAuth.ts:33`
**Issue:** `console.warn('[silentSignInIfPossible]', err)` logs the entire error object. Depending on SDK version, the rejection error may carry `userInfo` / `nativeStackAndroid` payloads that include token fragments or account hints. For a personal-data-bearing app, prefer logging only `err.message` + `err.code`.

**Fix:**
```ts
console.warn('[silentSignInIfPossible]',
  (err as { code?: string; message?: string })?.code ?? 'no-code',
  (err as { message?: string })?.message ?? String(err));
```
Same pattern is used in `App.tsx:117`, `SettingsScreen.tsx:104, 122, 145, 167, 197, 207`, and `RestoreFromDriveScreen.tsx:100, 126, 160` — those paths log a `DriveError` (which only carries the alert title in `.message`, no token data), so they're lower risk, but worth a sweep.

### IN-03: `signIn()` maps any non-cancellation error to `ALERT_DRIVE_GENERIC`

**File:** `src/services/driveBackupService.ts:79-94`
**Issue:** The catch block at lines 87-93 only special-cases `SIGN_IN_CANCELLED`. A network failure during sign-in (`TypeError: Network request failed`) maps to `ALERT_DRIVE_GENERIC` instead of the more specific `ALERT_DRIVE_NO_NETWORK`. Likewise for `PLAY_SERVICES_NOT_AVAILABLE`, which a user could reasonably interpret as a network/auth issue. This was NOT incidentally fixed by WR-01 because WR-01 only touches `getDriveAccessToken()` (silent path), not `signIn()` (interactive path).

**Fix:**
```ts
} catch (err) {
  const code = (err as { code?: string } | null)?.code;
  if (code === statusCodes.SIGN_IN_CANCELLED) return null;
  if (err instanceof TypeError && /network/i.test(err.message)) {
    throw new DriveError(ALERT_DRIVE_NO_NETWORK, err);
  }
  throw new DriveError(ALERT_DRIVE_GENERIC, err);
}
```

### IN-04: `pruneOldBackupsBestEffort` mixes a stale token with `listBackups`'s fresh token

**File:** `src/services/driveBackupService.ts:260-275`
**Issue:** `pruneOldBackupsBestEffort(token)` is called from `uploadBackup` at line 173 with the token used for the upload. Inside the helper, `listBackups()` calls `getDriveAccessToken()` again (a second `signInSilently` round-trip) and then `deleteFile(id, token)` uses the **outer** stale token. If the upload took long enough that the token rotated, deletes will 401 and the inner `try/catch` will swallow them as warnings. Result: pruning silently no-ops.

This is best-effort by design (Pitfall #8 — never throws), so impact is low (next upload's prune will retry), but the inconsistency is gratuitous.

**Fix:** Drop the `token` parameter and re-fetch a fresh token alongside `listBackups`:
```ts
async function pruneOldBackupsBestEffort(): Promise<void> {
  try {
    const token = await getDriveAccessToken();
    const files = await listBackups();
    const toPrune = selectFilesToPrune(files, new Date());
    for (const id of toPrune) {
      try { await deleteFile(id, token); }
      catch (err) { console.warn('[pruneOldBackups] delete fallo, continuando', id, err); }
    }
  } catch (err) {
    console.warn('[pruneOldBackups] pruning skipped', err);
  }
}
// Call site:
void pruneOldBackupsBestEffort();
```

### IN-05: `postMultipart` / `patchMultipart` don't validate Drive's response shape

**File:** `src/services/driveBackupService.ts:207-208, 230-231`
**Issue:** Both helpers do `const data = await res.json()` and then read `data.id`, `data.name`, `data.size` with no narrowing. If Drive returns a partial object (it shouldn't, but the SDK contract isn't enforced here), `fileId: data.id` could be `undefined`, which then propagates into `setLastBackup(... result.fileId)` at `SettingsScreen.tsx:160` and persists `lastBackupFileId: undefined` (serialized as missing key) to the settings file.

**Fix:** Narrow the parse, or define a `DriveUploadResponse` type:
```ts
const data = await res.json() as { id?: string; name?: string; size?: string };
if (typeof data.id !== 'string') {
  throw new DriveError(ALERT_DRIVE_GENERIC);
}
return { fileId: data.id, name: data.name ?? filename, size: data.size ?? '0' };
```
Same applies to `listBackups` at line 135 (returns `data.files` blindly cast to `DriveBackupFile[]`) and `findFileByName` at line 149.

### IN-06: `signOut` doesn't reset the in-memory `configured` flag in `googleAuth.ts`

**File:** `src/services/googleAuth.ts:10-22`, `src/services/driveBackupService.ts:97-99`
**Issue:** `configureGoogleSignin()` sets `configured = true` on first call. `signOut` (in `driveBackupService`) calls `GoogleSignin.signOut()` but `configured` stays true. This is benign — `configure` is idempotent — but if a future change ever needs to re-configure with different scopes (e.g. user toggles a "use offline access" preference), the early return at `if (configured) return` will prevent it.

**Fix (low priority):** No code change required today; add a comment acknowledging the design:
```ts
// Idempotente — early return si ya fue llamada. Si un futuro feature requiere
// reconfigurar (p.ej. scope adicional), exponer un resetConfig() helper.
```

### IN-07: `handleSignOutConfirm` keeps user "logged in" if `signOut` rejects

**File:** `src/screens/SettingsScreen.tsx:202-210`
**Issue:** If `drive.signOut()` rejects (network failure mid-revoke or SDK threw), the catch block shows `ALERT_DRIVE_GENERIC` but **does not** call `clearGoogleSession()`. Result: user sees a "something went wrong" toast and the email row stays visible. The intuitive UX is "sign-out succeeds locally regardless of SDK round-trip success" because the SDK call is local-only (D-10: no `revokeAccess`).

**Fix:**
```ts
const handleSignOutConfirm = useCallback(async () => {
  try {
    await drive.signOut();
  } catch (err) {
    console.warn('[handleSignOut] SDK signOut threw — limpiando estado local igual', err);
  }
  clearGoogleSession(); // siempre limpia el slice local
}, [clearGoogleSession]);
```

---

_Reviewed: 2026-04-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
