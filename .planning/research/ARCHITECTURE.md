# Architecture Patterns: Google Drive Backup Integration

**Domain:** Mobile habit tracker (React Native/Expo) adding cloud backup
**Researched:** 2026-03-17
**Overall confidence:** HIGH (existing architecture), MEDIUM (Drive integration patterns)

---

## Recommended Architecture

### Summary

The existing layered architecture (Screen → Store → Service → Repository → SQLite) should be extended with two additions:

1. A new `driveBackupService.ts` as a peer to the existing `backupService.ts`, handling all Google Drive API communication via REST (no native modules needed)
2. Auth state extended into `useSettingsStore` — no new store required; Google auth state (signed-in status + cached token) is a setting, not domain data

The key architectural principle: **Drive is just another backup transport**. The `buildBackupData()` and `parseAndValidate()` logic already in `backupService.ts` is reused as-is. Drive backup only replaces the Sharing/DocumentPicker transport layer.

---

## Component Boundaries

### Existing Components (unchanged)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `SettingsScreen` | UI for backup actions, Google sign-in button | `useSettingsStore`, `useHabitStore`, `backupService`, `driveBackupService` |
| `backupService.ts` | Local export (Sharing) + import (DocumentPicker) | `backupRepository`, `expo-file-system`, `expo-sharing` |
| `backupRepository.ts` | Bulk read/write of all SQLite tables | `expo-sqlite` via `db.ts` |
| `useSettingsStore.ts` | Persistent user preferences | `expo-file-system` (settings.json) |

### New Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `driveBackupService.ts` | Google OAuth token acquisition + Drive API calls (upload/download/list) | `@react-native-google-signin/google-signin`, `backupService.buildBackupData()`, Google Drive REST API v3 |
| Auth state in `useSettingsStore` | Track Google sign-in status and cached user email | `driveBackupService` (token retrieval), `SettingsScreen` (display) |

### Component Boundary Rules

- `SettingsScreen` calls `driveBackupService.backupToDrive()` or `driveBackupService.restoreFromDrive()` — same pattern as existing `exportBackup()` / `importBackup()` calls
- `driveBackupService` is responsible for ALL Google API communication; no Drive SDK code leaks into the screen or store
- Auth state (isSignedIn, userEmail) lives in `useSettingsStore` — it is persisted and survives restarts
- `driveBackupService` calls `buildBackupData()` from `backupService.ts` directly (shared helper, not duplicated)
- `backupRepository.ts` is shared by both backup services without modification

---

## Data Flow

### Backup Upload Flow

```
SettingsScreen
  → calls driveBackupService.backupToDrive()
    → calls GoogleSignin.getTokens() to get accessToken
    → calls backupService.buildBackupData() → backupRepository reads all tables
    → serializes BackupData to JSON string
    → POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
        Authorization: Bearer {accessToken}
        parents: ['appDataFolder']
        name: 'cozyhabits-backup.json'
    → on success: returns metadata (fileId, updatedAt)
  → SettingsScreen shows success alert + last backup timestamp
```

### Backup Restore Flow

```
SettingsScreen
  → calls driveBackupService.restoreFromDrive()
    → calls GoogleSignin.getTokens() to get accessToken
    → GET https://www.googleapis.com/drive/v3/files
        Authorization: Bearer {accessToken}
        spaces=appDataFolder
        fields=files(id,name,modifiedTime)
    → selects most recent cozyhabits-backup.json by modifiedTime
    → GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
    → parses JSON → calls parseAndValidate() from backupService.ts
    → calls backupRepository.restoreAllData()
  → SettingsScreen refreshes all stores (same pattern as importBackup)
```

### Auth State Flow

```
App boot
  → useSettingsStore hydrates from settings.json
  → if googleUserEmail is set: GoogleSignin.hasPreviousSignIn() to verify session

SettingsScreen renders
  → reads googleIsSignedIn + googleUserEmail from useSettingsStore
  → shows "Sign in with Google" button OR signed-in user email + "Sign out" + backup buttons

User taps "Sign in with Google"
  → SettingsScreen calls driveBackupService.signIn()
    → GoogleSignin.signIn() → triggers native OAuth flow (system browser)
    → returns user email
  → SettingsScreen calls useSettingsStore.setGoogleAuth(email, true)
  → useSettingsStore persists to settings.json

User taps "Sign out"
  → driveBackupService.signOut()
  → useSettingsStore.setGoogleAuth(null, false)
```

### Token Refresh Pattern

```
driveBackupService makes any API call
  → try: GoogleSignin.getTokens() (uses cached token if valid)
  → on 401 response:
    → GoogleSignin.clearCachedAccessToken(oldToken)
    → GoogleSignin.getTokens() (forces refresh)
    → retry request once
  → on persistent failure: throw error → SettingsScreen shows sign-in prompt
```

---

## Patterns to Follow

### Pattern 1: Shared BackupData Builder

**What:** `driveBackupService` imports and calls `buildBackupData()` from `backupService.ts` rather than reimplementing database read logic.

**Why:** Keeps backup logic DRY. The JSON format is already versioned and validated.

**Boundary:** `backupService.ts` exports `buildBackupData()` and `parseAndValidate()` as named exports (currently private helpers — they need to become exported). The sharing/DocumentPicker transport stays in `backupService.ts`. Drive transport lives exclusively in `driveBackupService.ts`.

### Pattern 2: Auth State in Existing Settings Store

**What:** Extend `useSettingsStore` with Google auth fields instead of creating a new store.

```typescript
interface SettingsState {
  // existing fields...
  googleIsSignedIn: boolean;
  googleUserEmail: string | null;
  setGoogleAuth: (email: string | null, isSignedIn: boolean) => void;
}
```

**Why:** Google sign-in state is a persistent setting (survives restarts), not domain data. It's already written to `settings.json` via Zustand persist — no new infrastructure needed. A separate `useGoogleAuthStore` would be over-engineering for a single-user local app.

**Constraint:** The auth token itself is NOT stored in the settings store — it is retrieved fresh via `GoogleSignin.getTokens()` on each backup/restore operation. Tokens are short-lived (1 hour) and the library manages refresh automatically.

### Pattern 3: Drive API via REST (No Heavy SDK)

**What:** Use `fetch()` directly against Google Drive REST API v3 with the Bearer token from `@react-native-google-signin/google-signin`. Do not introduce a Drive SDK wrapper library.

**Why:** The backup use case needs only 3 API calls (list files, upload file, download file). A full SDK wrapper adds unnecessary bundle size and a dependency to maintain. The REST pattern is stable and well-documented.

**Drive appdata scope:** Use `https://www.googleapis.com/auth/drive.appdata` — this is a non-sensitive scope (no Google review required), stores files only the app can access (not visible in user's Drive UI), and is sufficient for backup purposes.

### Pattern 4: Service Layer Owns All External API Communication

**What:** `driveBackupService.ts` is the exclusive owner of all Google Drive and GoogleSignin API calls. Screens and stores do not import from `@react-native-google-signin/google-signin` directly.

**Why:** Consistent with existing architecture where services are orchestrators and UI is a pure consumer. Makes Drive integration mockable for future testing.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New Store for Auth State

**What:** Creating a `useGoogleAuthStore` or `useCloudStore` for Google sign-in state.

**Why bad:** Adds a third store for what is effectively one boolean and one string. Settings store already persists to file system and handles all persistent preferences.

**Instead:** Extend `useSettingsStore` with `googleIsSignedIn` and `googleUserEmail` fields.

### Anti-Pattern 2: Duplicating Backup Serialization Logic

**What:** `driveBackupService.ts` reimplements the table-reading and JSON-building logic.

**Why bad:** Two code paths for constructing the backup JSON — diverges over time, schema changes must be made in two places.

**Instead:** Promote `buildBackupData()` and `parseAndValidate()` to exported functions in `backupService.ts` and import them in `driveBackupService.ts`.

### Anti-Pattern 3: Storing OAuth Tokens in Persistent Storage

**What:** Writing `accessToken` or `refreshToken` to settings.json or AsyncStorage.

**Why bad:** Tokens expire; storing them creates stale token issues. Creates a security exposure if the file is read by other processes.

**Instead:** Always retrieve tokens via `GoogleSignin.getTokens()` — the library manages token caching and refresh natively.

### Anti-Pattern 4: Using expo-auth-session for Drive Scopes

**What:** Using `expo-auth-session/providers/google` for the OAuth flow.

**Why bad:** Known limitation — expo-auth-session forces minimum scopes (openid, profile, email) and there is no documented way to add `drive.appdata` on top. This is a confirmed open issue.

**Instead:** Use `@react-native-google-signin/google-signin` which supports arbitrary scopes including `drive.appdata`. This requires a development build (not Expo Go), but the project already has `expo-dev-client` installed.

### Anti-Pattern 5: Sync on App Foreground

**What:** Automatically syncing backup when the app comes to foreground.

**Why bad:** Drive API calls on foreground require reliable network, add latency, and can fail silently — degrading UX. Out of scope per PROJECT.md (real-time sync excluded).

**Instead:** Backup is always user-initiated (explicit button press in SettingsScreen).

---

## Suggested Build Order

Dependencies between components determine this order:

1. **Export `buildBackupData()` and `parseAndValidate()` from `backupService.ts`**
   — Required by: `driveBackupService.ts`
   — Risk: Low. Internal refactor only; no behavior change.

2. **Add Google auth fields to `useSettingsStore`**
   — Required by: `SettingsScreen` (to show sign-in state) and `driveBackupService` (to read sign-in status)
   — Risk: Low. Additive change to persisted store; existing settings.json files remain valid.

3. **Create `driveBackupService.ts`**
   — Required by: `SettingsScreen` (backup/restore/sign-in actions)
   — Contains: `signIn()`, `signOut()`, `backupToDrive()`, `restoreFromDrive()`
   — Depends on: Steps 1 and 2, `@react-native-google-signin/google-signin`

4. **Add Google Sign-In config to `app.json`**
   — Required by: Native OAuth flow (step 3)
   — Contains: Config plugin entry, `iosUrlScheme` (for iOS)
   — Parallel with step 3.

5. **Extend `SettingsScreen` with Drive backup UI**
   — Required by: User-facing feature
   — Depends on: All prior steps
   — UI additions: "Google Drive" section with sign-in/out and backup/restore buttons; last backup timestamp display

6. **EAS Build to test the native Google Sign-In flow**
   — Required by: `@react-native-google-signin/google-signin` does not run in Expo Go
   — The project already has `expo-dev-client` — a development build is the correct test vehicle.

---

## Integration with Existing Architecture Diagram

```
App.tsx (init)
    |
    ├── useSettingsStore ←──── settings.json (+ googleIsSignedIn, googleUserEmail)
    |
    └── SettingsScreen
            |
            ├── backupService.ts ─── exportBackup() / importBackup() [unchanged]
            |       └── backupRepository.ts ─── expo-sqlite
            |
            └── driveBackupService.ts [NEW]
                    ├── @react-native-google-signin/google-signin
                    |   (signIn, signOut, getTokens)
                    |
                    ├── backupService.buildBackupData() [promoted export]
                    ├── backupService.parseAndValidate() [promoted export]
                    |
                    └── fetch() → Google Drive REST API v3
                                  (appDataFolder scope)
```

---

## Expo/EAS Constraints

| Constraint | Impact | Resolution |
|------------|--------|------------|
| `@react-native-google-signin/google-signin` requires native code | Cannot run in Expo Go | Use `expo-dev-client` development build (already installed) |
| OAuth requires SHA-1 fingerprint registration in Google Cloud Console | Setup step per environment | Register dev + prod SHA-1 fingerprints |
| `drive.appdata` scope is non-sensitive | No Google app review needed | Include in config plugin scope list |
| EAS Build required for production | Existing workflow | No change to existing EAS setup |

---

## Sources

- [Expo Google Authentication Guide](https://docs.expo.dev/guides/google-authentication/) — HIGH confidence (official docs)
- [React Native Google Sign-In Expo Setup](https://react-native-google-signin.github.io/docs/setting-up/expo) — HIGH confidence (official library docs)
- [Google Drive appdata Folder Guide](https://developers.google.com/drive/api/guides/appdata) — HIGH confidence (official Google docs)
- [Google Drive REST API v3 Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3) — HIGH confidence (official Google docs)
- [Google Drive in React Native — cmichel.io](https://cmichel.io/google-drive-in-react-native) — MEDIUM confidence (community, verified against official docs)
- [expo-auth-session scope limitation issue #12793](https://github.com/expo/expo/issues/12793) — HIGH confidence (official issue tracker)
- [react-native-google-drive-api-wrapper npm](https://www.npmjs.com/package/@robinbobin/react-native-google-drive-api-wrapper) — LOW confidence (community library, referenced for pattern only)

---

*Architecture analysis: 2026-03-17*
