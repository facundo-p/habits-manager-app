---
phase: 03-google-drive-backup
reviewed: 2026-04-27T00:00:00Z
depth: standard
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
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 3 (Google Drive backup) is in solid shape: token handling is JIT (no persistence, no logging of access tokens), the `DriveError` + `ALERT_DRIVE_*` taxonomy is consistent, the multipart PATCH/POST split honours the documented Pitfall #4 (no `parents` on PATCH), and the restore flow respects the strict order `build → write cache → restore → cleanup` with a guard that keeps the pre-restore cache intact when `restoreData` throws.

No critical bugs were found. The four warnings concern (1) auth-SDK errors that bypass the `DriveError` mapping and surface as raw `Error` to the UI, (2) a misleading user-facing promise that the pre-restore safety cache "stays on the device" when in fact it is wiped on success, (3) async `setState` after unmount in three screens, and (4) a race in `previewAndConfirm` that allows a second `prepareRestore` to start while the first is still downloading. Info-level findings cover hardcoded UI strings that bypass the constants module, a token-leak risk in a `console.warn`, and minor consistency items.

No real Google client IDs, secrets, or access tokens were found in source — `app.json` uses a `PLACEHOLDER_REVERSED_IOS_CLIENT_ID`, and the web client ID is read from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Mocks use clearly-marked `'fake_token'`.

## Warnings

### WR-01: Auth SDK errors bypass `DriveError` mapping

**File:** `src/services/driveBackupService.ts:101-106`
**Issue:** `getDriveAccessToken()` is called at the top of `listBackups`, `uploadBackup`, `downloadBackup`, and (transitively) `prepareRestore` / `applyRestore`. If `signInSilently()` or `getTokens()` reject — e.g. revoked grant, expired refresh token, `SIGN_IN_REQUIRED` — the error propagates as a plain `Error`, never reaches `fetchOrFail`, and is **not** wrapped in `DriveError`. The screens then fall back to `ALERT_DRIVE_GENERIC` ("Algo salió mal") via `err instanceof drive.DriveError ? err.alert : ALERT_DRIVE_GENERIC`, when the user really needs `ALERT_DRIVE_AUTH_EXPIRED` ("Volvé a conectar tu cuenta desde Ajustes" + `actionLabel: 'Ir a Ajustes'`).

The existing tests don't cover this path because the SDK mock always resolves successfully.

**Fix:**
```ts
async function getDriveAccessToken(): Promise<string> {
  try {
    await GoogleSignin.signInSilently();
    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) throw new DriveError(ALERT_DRIVE_AUTH_EXPIRED);
    return accessToken;
  } catch (err) {
    if (err instanceof DriveError) throw err;
    // Network errors during refresh -> NO_NETWORK; everything else -> AUTH_EXPIRED
    if (err instanceof TypeError && /network/i.test(err.message)) {
      throw new DriveError(ALERT_DRIVE_NO_NETWORK, err);
    }
    throw new DriveError(ALERT_DRIVE_AUTH_EXPIRED, err);
  }
}
```
Add a regression test that mocks `GoogleSignin.signInSilently` to reject and asserts `uploadBackup()` rejects with `DriveError` whose `.alert === ALERT_DRIVE_AUTH_EXPIRED`.

### WR-02: Pre-restore safety cache is deleted right after success — UI message is misleading

**File:** `src/services/driveBackupService.ts:375-412`, `src/screens/RestoreFromDriveScreen.tsx:108-112`
**Issue:** `applyRestore` flow is:

1. `writePreRestoreCache()` — writes `cozyhabits-pre-restore-{ts}.json`
2. `restoreData(payload.data)`
3. `cleanupOldPreRestoreCache()` — iterates `cacheDirectory` and deletes **everything** that starts with `cozyhabits-pre-restore-` and ends with `.json`, **including the file just written in step 1**.

The success Alert in `RestoreFromDriveScreen` tells the user: *"Tus datos previos quedaron respaldados en el dispositivo por si querés revertir."* That promise is false on the success path — the safety cache only survives if `restoreData` throws. The `applyRestore: cleanup borra sólo cozyhabits-pre-restore-*.json` test (line 138-152 of `driveBackupService.restore.test.ts`) actually documents this behaviour, so it is intentional, but the UI string is wrong.

This is a UX/correctness issue, not a crash, but it directly contradicts a destructive-action promise made to the user.

**Fix (pick one):**
- **A. Keep the most recent pre-restore cache.** Sort entries by name (timestamps in name are sortable) and exclude the newest from deletion:
  ```ts
  async function cleanupOldPreRestoreCache(): Promise<void> {
    try {
      const dir = FileSystem.cacheDirectory;
      if (!dir) return;
      const entries = (await FileSystem.readDirectoryAsync(dir))
        .filter((n) => n.startsWith('cozyhabits-pre-restore-') && n.endsWith('.json'))
        .sort(); // ISO timestamps in name -> lexicographic == chronological
      const toDelete = entries.slice(0, -1); // keep newest
      for (const name of toDelete) {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
      }
    } catch (err) {
      console.warn('[cleanupOldPreRestoreCache] cleanup skipped', err);
    }
  }
  ```
  Update the existing test to assert the newest cache survives.
- **B. Remove the "respaldados en el dispositivo" sentence** from the success Alert in `RestoreFromDriveScreen.tsx:111`, since the cache is in fact transient.

Option A matches the documented intent in the file header ("D-19 safety cache") and the screen's user-facing promise.

### WR-03: Async `setState` after unmount in restore + connect flows

**File:** `src/screens/RestoreFromDriveScreen.tsx:83-148`, `src/screens/SettingsScreen.tsx:134-166`
**Issue:** Several callbacks do `setState` after `await`:

- `RestoreFromDriveScreen.loadList` (lines 84-92): `setStatus('loading')` → await `listBackups()` → `setFiles(...)` / `setStatus(...)`. If the user presses back during the network call, React logs a warning and (more importantly) the `useEffect`'s `setStatus('loading')` ran but a fresh mount on next visit may race.
- `RestoreFromDriveScreen.previewAndConfirm` (lines 121-148): `setOverlayMsg('Leyendo backup...')` → await `prepareRestore()` → `setOverlayMsg(null)`. The Alert that's shown after the download completes can fire on an unmounted component if the user backs out during download.
- `RestoreFromDriveScreen.performRestore` (lines 102-119): `await applyRestore` then `Alert.alert(...)` and `setOverlayMsg(null)` in `finally`.
- `SettingsScreen.handleConnect` / `handleBackupNow` / `performBackup`: `setIsConnecting`, `setIsUploading` after `await`.

The Modal-based `LoadingOverlay` blocks back-press during overlay visibility, which mitigates the restore case. But `loadList` runs without the overlay (it uses inline `ActivityIndicator`) and is fully exposed.

**Fix:** Add an `isMounted` ref guard for the screens that don't have a blocking overlay during async work:
```ts
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
// ...
if (mountedRef.current) setStatus(result.length === 0 ? 'empty' : 'loaded');
```
Or — preferred for `listBackups` — pass an `AbortSignal` through `fetchOrFail`. Minimal-diff fix is the ref guard in `RestoreFromDriveScreen.loadList` (the most exposed path).

### WR-04: `previewAndConfirm` allows concurrent downloads (single-download invariant)

**File:** `src/screens/RestoreFromDriveScreen.tsx:121-148`
**Issue:** Tapping a `BackupRow` calls `previewAndConfirm`, which sets `setOverlayMsg('Leyendo backup...')` and then awaits `drive.prepareRestore(file.id)`. The `LoadingOverlay` Modal IS visible during the download and DOES block touches on the FlatList rows behind it (`Modal` with `transparent` + the dim backdrop). However:

- The Modal's `transparent` overlay still passes the `accessibilityViewIsModal` flag, which RN respects on iOS but not always on Android pre-13.
- More importantly, on slow networks the user may tap a row, see the overlay flash, then the Modal animation has not yet finished mounting (animationType="fade" gives a 250ms window where touches can still register on the FlatList in some RN versions).

The plan requires a single-download invariant. The Modal partially provides it, but a defensive guard is cheap:

**Fix:**
```ts
const [isPreparing, setIsPreparing] = useState(false);
const previewAndConfirm = useCallback(async (file: drive.DriveBackupFile) => {
  if (isPreparing) return; // single-download invariant
  setIsPreparing(true);
  setOverlayMsg('Leyendo backup...');
  try {
    // ... existing body ...
  } finally {
    setIsPreparing(false);
    // overlayMsg already cleared inside try/catch
  }
}, [isPreparing, performRestore, showError]);
```
Or, equivalently, pass `disabled={overlayMsg !== null}` to `BackupRow`.

## Info

### IN-01: Hardcoded Spanish UI strings bypass constants module

**File:** `src/screens/RestoreFromDriveScreen.tsx:60-61, 153, 160, 166-167`
**Issue:** Several Spanish UI strings live inline rather than in `src/config/constants.ts`:
- "No se pudo cargar la lista" (line 60)
- "Verificá tu conexión e intentá de nuevo." (line 61)
- "Restaurar desde Drive" (line 153)
- "Cargando backups..." (line 160)
- "No hay backups todavía" / "Hacé tu primer backup desde Ajustes." (lines 166-167)
- Templated message strings on lines 109-112, 128-134

The `ALERT_DRIVE_*` constants explicitly carry a `// message templated at call site con {fecha, N, M, K, J}` comment, so the templated messages are by-design. The static screen labels (loading caption, empty heading/body, error heading/body, screen title) are not.

**Fix:** Add an `EMPTY_DRIVE_BACKUPS` / `ERROR_DRIVE_LOAD` / `RESTORE_SCREEN_TITLE` group in `constants.ts` and import them in the screen. This isolates copy changes (e.g. future i18n) to one file. Lower priority than the warnings.

### IN-02: `console.warn` in `silentSignInIfPossible` may leak SDK error fields

**File:** `src/services/googleAuth.ts:32-34`
**Issue:** `console.warn('[silentSignInIfPossible]', err)` logs the entire error object. Depending on SDK version, the rejection error may carry `userInfo` / `nativeStackAndroid` payloads that include token fragments or account hints. For a personal-data-bearing app, prefer logging only `err.message` + `err.code`.

**Fix:**
```ts
console.warn('[silentSignInIfPossible]',
  (err as { code?: string; message?: string })?.code ?? 'no-code',
  (err as { message?: string })?.message ?? String(err));
```
Same pattern is used in `App.tsx:117`, `SettingsScreen.tsx:117, 140, 160, 199`, and `RestoreFromDriveScreen.tsx:90, 114, 144` — those paths log a `DriveError` (which only carries the alert title in `.message`, no token data), so they're lower risk, but worth a sweep.

### IN-03: `signIn()` maps any non-cancellation error to `ALERT_DRIVE_GENERIC`

**File:** `src/services/driveBackupService.ts:79-94`
**Issue:** The catch block on line 87-93 only special-cases `SIGN_IN_CANCELLED`. A network failure during sign-in (`TypeError: Network request failed`) maps to `ALERT_DRIVE_GENERIC` instead of the more specific `ALERT_DRIVE_NO_NETWORK`. Likewise for `PLAY_SERVICES_NOT_AVAILABLE` (no internet on the device's Google Play Services), which the user could reasonably interpret as a network/auth issue.

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

**File:** `src/services/driveBackupService.ts:248-263`
**Issue:** `pruneOldBackupsBestEffort(token)` is called from `uploadBackup` with the token used for the upload. Inside the helper, `listBackups()` calls `getDriveAccessToken()` again (a second `signInSilently` round-trip) and then `deleteFile(id, token)` uses the **outer** stale token. If the upload took long enough that the token rotated, deletes will 401 and the inner `try/catch` will swallow them as warnings. Result: pruning silently no-ops.

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

**File:** `src/services/driveBackupService.ts:178-220`
**Issue:** Both helpers do `const data = await res.json()` and then read `data.id`, `data.name`, `data.size` with no narrowing. If Drive returns a partial object (it shouldn't, but the SDK contract isn't enforced here), `fileId: data.id` could be `undefined`, which then propagates into `setLastBackup(... result.fileId)` and persists `lastBackupFileId: undefined` (serialized as missing key) to the settings file.

**Fix:** Narrow the parse, or define a `DriveUploadResponse` type:
```ts
const data = await res.json() as { id?: string; name?: string; size?: string };
if (typeof data.id !== 'string') {
  throw new DriveError(ALERT_DRIVE_GENERIC);
}
return { fileId: data.id, name: data.name ?? filename, size: data.size ?? '0' };
```
Same applies to `listBackups` (line 124) and `findFileByName` (line 138) — they cast `data.files` blindly.

### IN-06: `signOut` doesn't reset the in-memory `configured` flag in `googleAuth.ts`

**File:** `src/services/googleAuth.ts:10-22`, `src/services/driveBackupService.ts:97-99`
**Issue:** `configureGoogleSignin()` sets `configured = true` on first call. `signOut` (in `driveBackupService`) calls `GoogleSignin.signOut()` but `configured` stays true. This is benign — `configure` is idempotent — but if a future change ever needs to re-configure with different scopes (e.g. the user toggles a "use offline access" preference), the early return at `if (configured) return` will prevent it.

**Fix (low priority):** No code change required today; add a comment acknowledging the design:
```ts
// Idempotente — early return si ya fue llamada. Si un futuro feature requiere
// reconfigurar (p.ej. scope adicional), exponer un resetConfig() helper.
```

### IN-07: `handleSignOutConfirm` keeps user "logged in" if `signOut` rejects

**File:** `src/screens/SettingsScreen.tsx:194-202`
**Issue:** If `drive.signOut()` rejects (network failure mid-revoke), the catch shows `ALERT_DRIVE_GENERIC` but **does not** call `clearGoogleSession()`. Result: user sees a "something went wrong" toast and the email row stays visible. The intuitive UX is "sign-out succeeds locally regardless of SDK round-trip success" because the SDK call is local-only (D-10: no `revokeAccess`).

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
