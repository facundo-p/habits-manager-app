# Project Research Summary

**Project:** Cozy Habits — Google Drive Backup Milestone
**Domain:** Mobile habit tracker — bug fixes, tech debt cleanup, Google Drive cloud backup
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

This milestone adds Google Drive cloud backup to an existing habit tracker app that already has a working local backup/restore system via the OS share sheet. The app runs on Expo SDK 54 / React Native 0.81 with expo-sqlite and Zustand. The recommended approach treats Drive as a second transport layer over the existing backup logic — `buildBackupData()` and `parseAndValidate()` are promoted to exported helpers shared by the new `driveBackupService.ts`, so backup serialization remains in a single place. The critical library choice is `@react-native-google-signin/google-signin` (not `expo-auth-session/providers/google`) because expo-auth-session cannot inject the `drive.appdata` scope — a confirmed open issue. This requires a development build rather than Expo Go, but the project already has `expo-dev-client` installed.

Before any Drive work, four correctness bugs in the daily assignments system must be fixed. One causes silent data corruption: the backfill guard counts only non-spontaneous rows, so dates with only spontaneous records get flooded with phantom regular habit assignments. The others involve UTC/local timezone drift in date iteration, a duplicate future-date guard, and unvalidated category IDs stored at insert time. These bugs directly affect the data that would be backed up to Drive, so fixing them first is non-negotiable.

The primary risks for the Drive phase are OAuth token refresh gaps (no refresh token returned if `access_type=offline` is omitted), wrong Drive scope selection (tutorials default to `drive.file` which prevents silent re-listing of own backups — `drive.appdata` is correct), and a destructive restore flow with no user confirmation. All three have clear, well-documented mitigations and must be addressed before the Drive feature goes live.

---

## Key Findings

### Recommended Stack

The existing stack requires one new dependency: `@react-native-google-signin/google-signin` for Google OAuth with custom scope support. Drive API calls use the built-in `fetch` against Google Drive REST API v3 — no wrapper library is needed for the three calls required (list, upload, download). Token storage uses `expo-secure-store`, already bundled in Expo SDK 54. The Drive scope is `drive.appdata` (hidden app folder, non-sensitive, no Google security review required).

**Core technologies:**
- `@react-native-google-signin/google-signin` ^14.x: Google OAuth with `drive.appdata` scope — the only library that supports custom Drive scopes reliably in Expo SDK 54; expo-auth-session is confirmed broken for this use case
- Native `fetch`: Google Drive REST API v3 calls (upload, list, download) — zero dependency overhead for three straightforward HTTP calls
- `expo-secure-store` ^14.x: OAuth token persistence — Keychain/Keystore-backed, already in SDK 54 bundle
- `drive.appdata` scope: Hidden app-specific Drive folder, invisible in user's Drive UI, non-sensitive (no Google review required)

**Critical constraint:** This feature requires a development build. It cannot be tested in Expo Go.

### Expected Features

**Must have (table stakes):**
- Sign in with Google — required to access Drive API
- Upload backup to Drive — core feature, reuses existing `buildBackupData()`
- Download and restore backup from Drive — pipes to existing `restoreData()`
- Last backup timestamp display — users need confirmation the backup worked
- Manual trigger via Settings button — users expect explicit control
- Sign out / disconnect — users must be able to revoke access
- Explicit confirmation modal before restore — silent destructive overwrite is unacceptable
- Actionable error messages — silent Drive failures are unacceptable

**Bug fixes (must precede Drive work):**
- Bug 2: Backfill incorrectly floods days that have only spontaneous records with phantom regular assignments
- Bug 4: Timezone drift in backfill date iteration (local vs UTC constructors)
- Bug 3: Duplicate future-date guard (DRY refactor)
- Bug 5: Unvalidated category IDs stored on spontaneous insert

**Tech debt (should precede Drive work):**
- TD-2: Centralize JSON category parsing through a single `parseJsonArray` / `parseAndValidateCategories` path
- TD-3: Type `sanitizeTable` results with explicit interfaces using `unknown` intermediate, not `as` assertions
- TD-1: Define `SpeechModuleInterface` to remove `any` typing in `useSpeechRecognition`

**Should have (differentiators, after table stakes):**
- Named backup files with date: `cozyhabits-2026-03-17.json` — low effort
- Backup history list: show last N backups from Drive — medium effort

**Defer (v2+):**
- Automatic background backup — `expo-background-fetch` is unreliable on iOS; risk outweighs convenience
- Backup encryption — Drive TLS + appdata scope is sufficient; key management adds disproportionate complexity
- Multi-cloud support — each provider is a separate integration; Drive only for v1
- Real-time bidirectional sync — conflict resolution complexity is out of scope for a personal-use app

### Architecture Approach

Extend the existing layered architecture (Screen → Store → Service → Repository → SQLite) with a single new service, `driveBackupService.ts`, that handles all Google OAuth and Drive API communication. Auth state (`googleIsSignedIn`, `googleUserEmail`) is added to the existing `useSettingsStore` — not a new store — because it is a persistent setting, not domain data. The backup serialization logic (`buildBackupData`, `parseAndValidate`) is promoted from private to exported in `backupService.ts` and reused by the Drive service, keeping JSON format logic in a single place.

**Major components:**
1. `driveBackupService.ts` (new): `signIn()`, `signOut()`, `backupToDrive()`, `restoreFromDrive()` — exclusive owner of all Google API calls
2. `useSettingsStore` (extended): `googleIsSignedIn: boolean`, `googleUserEmail: string | null`, `setGoogleAuth()` — persisted to `settings.json`
3. `backupService.ts` (refactored): `buildBackupData()` and `parseAndValidate()` promoted to named exports
4. `SettingsScreen` (extended): Google Drive section with sign-in/out button, backup/restore triggers, last backup timestamp

### Critical Pitfalls

1. **Backfill duplicates on spontaneous-only days** — Replace the count query guard in `ensureAssignmentsForDate` to use `countByDate` (all rows) instead of `countHabitAssignmentsByDate` (non-null habit_id only). This is the highest-priority fix; it causes silent data corruption affecting stats.

2. **Destructive restore with no confirmation** — Before any restore (local or Drive), show a modal displaying the backup date, record counts, and explicit warning that current data will be replaced. Never label the action "Sync."

3. **Missing refresh token from OAuth** — Must include `access_type=offline` and `prompt=consent` in the authorization request. Must use the Web Application OAuth client ID (not Android). Store tokens in `expo-secure-store`. Implement token refresh before every Drive API call.

4. **Wrong Drive scope** — Use `drive.appdata` exclusively, not `drive.file` or `drive`. Use `spaces: 'appDataFolder'` in all list queries. Use `parents: ['appDataFolder']` on upload. `drive.file` prevents silent re-listing of own files; `drive` triggers a Google security audit.

5. **Timezone drift in backfill date loop** — Replace `new Date(\`${dateStr}T00:00:00\`)` (local time) with `new Date(\`${dateStr}T00:00:00Z\`)` (UTC) in the backfill loop to match how `getTodayPrefix()` already works.

---

## Implications for Roadmap

Based on research, the suggested phase structure is driven by two constraints: (1) the bug fixes create data corruption that would be perpetuated by a Drive backup if not fixed first, and (2) the tech debt fixes create the structural foundation (centralized parsing, typed DB results) that makes the Drive feature easier and safer to build.

### Phase 1: Bug Fixes

**Rationale:** Data corruption bugs must be fixed before Drive backup, or the first cloud backup will contain malformed data. These are also the highest-risk items — they have been silently affecting user data since the daily assignments feature shipped. No new dependencies required; all changes are in existing service and repository layers.

**Delivers:** Correct assignment generation, correct backfill behavior, UTC-consistent date arithmetic, category validation at insert boundary.

**Addresses:** Bug 2 (spontaneous backfill duplication), Bug 4 (timezone drift), Bug 3 (DRY future-date guard), Bug 5 (unvalidated categories on spontaneous insert)

**Avoids:** Pitfall 1 (backfill duplicates), Pitfall 5 (timezone off-by-one), Pitfall 8 (stats corruption from invalid categories)

**Research flag:** None needed — all bug locations are precisely identified in PITFALLS.md with exact file and line references.

### Phase 2: Tech Debt

**Rationale:** Centralizing JSON parsing (TD-2) enables the Bug 5 fix to use a shared `VALID_AREA_IDS` validator rather than a one-off check. Typing `sanitizeTable` (TD-3) prevents the `as` assertion anti-pattern from propagating into the Drive restore path. Both items reduce the risk surface before adding new complexity.

**Delivers:** Single `parseAndValidateCategories()` entry point, typed `SanitizedHabitRow`/`SanitizedPerformedRow`, typed `SpeechModuleInterface`.

**Addresses:** TD-2 (centralize JSON parsing), TD-3 (type sanitizeTable), TD-1 (useSpeechRecognition type safety)

**Avoids:** Pitfall 7 (type refactoring that hides runtime nulls — use `unknown` + runtime guards, not `as` assertions), Pitfall 10 (scattered JSON parse errors with no context)

**Research flag:** None needed — standard TypeScript refactoring patterns.

### Phase 3: Google Drive Backup

**Rationale:** Drive is built last because it depends on correct data (Phase 1) and clean service boundaries (Phase 2). The architecture is additive: one new service, extensions to an existing store, and promotion of two private helpers to named exports. The OAuth setup must be done before any Drive API code is written.

**Delivers:** Google OAuth sign-in/out, backup upload to `appDataFolder`, backup restore with confirmation modal, last backup timestamp display, sign-in state persistence across restarts.

**Addresses:** All table stakes from FEATURES.md — sign in, upload, download, timestamp, manual trigger, sign out, error messaging, confirmation before restore.

**Uses:** `@react-native-google-signin/google-signin`, `expo-secure-store`, native `fetch` against Drive REST API v3

**Implements:** `driveBackupService.ts`, `useSettingsStore` extensions, `SettingsScreen` Drive section

**Avoids:** Pitfall 2 (silent destructive restore), Pitfall 3 (missing refresh token), Pitfall 4 (wrong Drive scope), Pitfall 6 (partial restore with no context)

**Build order within phase:**
1. Export `buildBackupData()` and `parseAndValidate()` from `backupService.ts`
2. Add Google auth fields to `useSettingsStore`
3. Create `driveBackupService.ts` (signIn, signOut, backupToDrive, restoreFromDrive)
4. Add Google Sign-In config plugin to `app.json` (parallel with step 3)
5. Extend `SettingsScreen` with Drive backup UI
6. EAS development build to test native OAuth flow

**Research flag:** OAuth setup and SHA-1 fingerprint registration are environment-specific steps that require Google Cloud Console access. Confirm client ID type (Web Application, not Android) and scope configuration before writing service code.

### Phase Ordering Rationale

- Bug fixes precede Drive because corrupt data backed up to the cloud would be treated as canonical and spread across devices.
- Tech debt precedes Drive because `buildBackupData()` must become an exported function, and centralizing JSON parsing reduces the chance of the new service introducing a third parsing path.
- Drive is a clean final phase because both prior phases eliminate the risk factors that would make the integration fragile.
- Automatic background backup is explicitly deferred — `expo-background-fetch` on iOS is unreliable and the user value is low for an app with manual habits.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (OAuth setup):** SHA-1 fingerprint registration for dev and prod environments is environment-specific. Confirm: (a) correct client ID type for `@react-native-google-signin`, (b) `webClientId` vs `androidClientId` configuration, (c) whether existing EAS credentials need to be registered.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bug fixes):** All locations are precisely identified. Fixes are surgical changes to existing query conditions and date constructors.
- **Phase 2 (Tech debt):** Standard TypeScript refactoring with well-established patterns (`unknown` guards, centralized parse functions).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions sourced from official Expo docs, official library docs, and a confirmed GitHub issue. One medium-confidence item: exact `@react-native-google-signin` version — verify with `npm info` before install. |
| Features | HIGH | Bug locations confirmed against actual source files. Cloud backup feature set sourced from first-party PROJECT.md and established habit app patterns. |
| Architecture | HIGH | Existing architecture is well-understood. Drive integration pattern (new service + shared helpers) follows established layer conventions. |
| Pitfalls | HIGH | All critical pitfalls are grounded in actual source file line references, confirmed GitHub issues, and official API documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Google Cloud Console setup:** Client ID types and SHA-1 fingerprint registration are not covered by research (environment-specific). Address during Phase 3 planning — create a setup checklist before writing service code.
- **EAS build environment:** Whether the existing EAS configuration supports the new config plugin without changes is untested. Validate early in Phase 3 by running a development build before writing Drive API code.
- **Exact `@react-native-google-signin` version:** Confirm with `npm info @react-native-google-signin/google-signin version` — research indicates ^14.x but did not confirm the exact current version.
- **Token refresh behavior with `@react-native-google-signin`:** Research indicates the library manages token caching natively via `getTokens()`, but the exact behavior on session expiry (after 30 days) should be tested during implementation.

---

## Sources

### Primary (HIGH confidence)
- [Expo Google Authentication Guide](https://docs.expo.dev/guides/google-authentication/) — OAuth library selection, scope constraints
- [React Native Google Sign-In Expo Setup](https://react-native-google-signin.github.io/docs/setting-up/expo) — config plugin, `webClientId` configuration
- [Google Drive appdata Folder Guide](https://developers.google.com/drive/api/guides/appdata) — scope behavior, API space parameter
- [Google Drive REST API v3 Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3) — upload, list, download call patterns
- [expo/expo issue #12793](https://github.com/expo/expo/issues/12793) — confirmed expo-auth-session scope limitation
- [SQLite atomicity](https://sqlite.org/atomiccommit.html) — transaction rollback behavior
- Project codebase: `assignmentService.ts`, `assignmentRepository.ts`, `backupService.ts`, `backupRepository.ts`, `db.ts` — bug location and fix scope

### Secondary (MEDIUM confidence)
- [Google Drive in React Native — cmichel.io](https://cmichel.io/google-drive-in-react-native) — fetch-based Drive API pattern
- [Loop Habit Tracker backup discussions](https://github.com/iSoron/uhabits/discussions/689) — real user expectations for habit app backup features
- [Expo Google authentication SDK 53 breaking change (Medium, Dec 2025)](https://medium.com/@ruveydakayabasi/fixing-the-broken-google-login-after-expo-sdk-53-7872655e0c49) — SDK 53/54 instability for built-in Google provider

### Tertiary (LOW confidence)
- [react-native-cloud-storage library](https://react-native-cloud-storage.oss.kuatsu.de/) — evaluated and rejected; low adoption, thin abstraction
- [Reclaim: Best Habit Tracker Apps 2026](https://reclaim.ai/blog/habit-tracker-apps) — feature landscape context only

---

*Research completed: 2026-03-17*
*Ready for roadmap: yes*
