# Domain Pitfalls

**Domain:** Mobile habit tracker — SQLite data integrity fixes + Google Drive cloud backup
**Researched:** 2026-03-17
**Confidence:** HIGH (code-grounded, confirmed against actual source files)

---

## Critical Pitfalls

Mistakes that cause data loss, rewrites, or security incidents.

---

### Pitfall 1: Backfill Generates Duplicates When Only Spontaneous Records Exist

**What goes wrong:**
`ensureAssignmentsForDate()` calls `countHabitAssignmentsByDate()` which counts only rows where `habit_id IS NOT NULL`. If a date has only spontaneous records (habit_id IS NULL), the count returns 0 and backfill proceeds to insert regular habit assignments — creating a mixed set of records for a day that had already been "handled" by the user.

**Why it happens:**
The UNIQUE index `idx_unique_habit_date` only covers `(habit_id, date) WHERE habit_id IS NOT NULL`. Spontaneous rows are invisible to both the index and the count query. The guard `if (existing > 0) return` was designed to skip backfill for processed days, but it only sees non-spontaneous rows.

**Exact locations in code:**
- `src/repositories/assignmentRepository.ts` line 20: `SQL_COUNT_HABIT_ASSIGNMENTS_BY_DATE` — the WHERE clause excludes spontaneous rows
- `src/services/assignmentService.ts` line 201: the check that uses this count, annotated "Bug 2: ignorar espontáneos"

**Consequences:**
- A day where the user manually added spontaneous records (but no regular habits were tracked yet) gets re-processed by backfill on the next app open
- Regular habits appear retroactively on days where the user only did spontaneous entries
- Stats (heatmap, weekly comparison) are inflated with phantom completions

**Prevention:**
Replace `countHabitAssignmentsByDate` with `countByDate` (which counts all rows regardless of habit_id) in the backfill guard check. The distinction between spontaneous and regular counts is only needed for insert logic, not for "has this date been processed" detection.

**Detection (warning signs):**
- Days show unexpected habit assignments after adding a spontaneous record
- Test: add spontaneous for yesterday, restart app, check if regular habits now appear for yesterday

**Phase:** Bug fixes phase — address before any Google Drive work to avoid backing up corrupt data.

---

### Pitfall 2: Restore Overwrites Local Data Silently — No User Confirmation or Merge

**What goes wrong:**
`restoreAllData()` in `backupRepository.ts` immediately runs `DELETE FROM` on all four tables inside a transaction, then inserts backup data. The current UI flow calls this after file selection without asking the user to confirm they want to overwrite all current data. If a user selects an old backup by mistake, all newer data is gone with no recovery path.

**Why it happens:**
The local backup flow (export to device, import from device) is low-stakes because users rarely import. Google Drive backup changes the risk profile: users may trigger restore from a "Sync" button thinking it will merge, or accidentally restore a stale cloud backup after already doing work on the device.

**Exact locations in code:**
- `src/services/backupService.ts` lines 42-58: `importBackup()` calls `restoreData()` immediately after validation — no confirmation step
- `src/repositories/backupRepository.ts` lines 71-103: `restoreAllData()` is destructive-first (delete, then insert)

**Consequences:**
- User loses all data entered since the last backup
- No merge path: local-only spontaneous records added after last backup are gone
- No rollback UI: the app reloads with the restored state, the user has no "undo"

**Prevention:**
1. Always show a modal before restore: display backup date (`exportedAt`), record counts from backup vs current, and explicit confirmation that current data will be overwritten
2. Export a local snapshot immediately before restore (a "safety backup" in `documentDirectory`) so users can recover
3. For Google Drive specifically, label restore clearly as "Replace all data with cloud backup from [date]" — never call it "Sync"

**Detection (warning signs):**
- Import flow proceeds from file picker directly to success toast with no confirmation step in between
- `importBackup()` returns `true` with no intermediate user gate

**Phase:** Must be addressed in the same phase as Google Drive backup implementation. Applies to existing local backup as well.

---

### Pitfall 3: Google Drive OAuth Without Backend — Client Secret Exposure or No Refresh Token

**What goes wrong:**
Google OAuth for Drive access requires a client secret to exchange the authorization code for tokens. In Expo managed workflow, the app runs entirely on-device — there is no server to hold the secret. Two common failure modes:

1. **Developer embeds the client secret in app code.** The secret is extractable from the APK/IPA and can be used to impersonate the app to Google's token endpoint.
2. **Developer uses PKCE-only flow without requesting `offline_access`.** The access token (1-hour lifespan) is issued, but no refresh token is returned. The user must re-authenticate every hour.

**Why it happens:**
Expo's `expo-auth-session` supports PKCE flows which avoids needing a client secret for the initial token exchange — but Google may still not return a refresh token unless `access_type=offline` is explicitly requested in the authorization URL. This parameter is often forgotten.

Additionally, developers use the Android OAuth client ID (not the Web Application client ID) for token exchange, which does not support refresh token issuance.

**Consequences:**
- Token expires after 1 hour; Drive uploads fail silently; user sees no error
- If secret is embedded, any user can extract it and abuse the quota for the Google Cloud project
- If no refresh token, the backup function becomes unreliable after the initial session

**Prevention:**
1. Use `access_type=offline` and `prompt=consent` in the authorization request to force refresh token issuance
2. Use the **Web Application** OAuth client ID (not Android) when using PKCE flow via expo-auth-session
3. Store access + refresh tokens in `expo-secure-store`, never in AsyncStorage or app state
4. For the token exchange step, use the PKCE code verifier flow (no client secret required at token exchange) — this is now the recommended pattern for mobile OAuth
5. Implement token refresh logic: before every Drive API call, check token expiry and refresh proactively

**Detection (warning signs):**
- OAuth response includes `access_token` but no `refresh_token`
- Drive upload works for 1 hour after login, then fails
- Token stored in Zustand store or component state instead of SecureStore

**Phase:** Google Drive implementation phase — must be solved during OAuth setup before writing any Drive API code.

---

### Pitfall 4: Wrong Google Drive Scope — Fails Review or Exposes All User Files

**What goes wrong:**
There are three meaningfully different Drive scopes:
- `drive` — full access to all user files (requires security assessment, almost never approved for new apps)
- `drive.file` — access only to files created by this app (requires user to pick files via Google Picker on re-open; cannot list files programmatically)
- `drive.appdata` — access to a hidden app-specific folder invisible to the user in Drive UI

For a backup app, `drive.appdata` is the correct scope, but developers commonly request `drive.file` (because tutorials use it) or `drive` (because it's simpler to implement). `drive.file` causes a UX problem: the app cannot silently read its own previously-uploaded backup without the user selecting it via a file picker each time.

**Why it happens:**
Tutorial code almost universally uses `drive.file` for simplicity. The `drive.appdata` scope is less documented and requires using the `appDataFolder` space in the API instead of `root`.

**Consequences:**
- `drive.file`: Users must manually select the backup file every time they want to restore, making automatic restore impossible
- `drive`: Google's OAuth consent screen shows "Access all files in Google Drive" — users refuse to grant it; app also requires a formal security audit
- Scope mismatch causes `403 Forbidden` errors on API calls with confusing error messages

**Prevention:**
Use `https://www.googleapis.com/auth/drive.appdata` exclusively. Use `spaces: 'appDataFolder'` in all Drive API file list and create calls. Store backup files with `parents: ['appDataFolder']` on upload.

**Detection (warning signs):**
- OAuth consent shows "See and download all your Google Drive files" instead of "Store app settings"
- File list query uses `spaces: 'drive'` instead of `spaces: 'appDataFolder'`
- App requires user to pick the file manually on restore

**Phase:** Google Drive implementation phase — must be defined before writing any Drive API calls.

---

## Moderate Pitfalls

---

### Pitfall 5: Timezone Bug in Backfill Date Loop Creates Off-by-One on DST Transitions

**What goes wrong:**
`checkAndBackfillHistory()` constructs dates using `new Date(\`${dateStr}T00:00:00\`)` — which is interpreted as local time. When looping day-by-day with `setDate(d.getDate() + 1)` across a DST transition (spring forward), the midnight constructor can produce the same date twice or skip a date depending on the device's system timezone.

Additionally, `getTodayPrefix()` in `db.ts` line 30 uses `new Date().toISOString().slice(0, 10)` which IS UTC — so `getTodayPrefix()` returns yesterday's date for users in UTC+X timezones after midnight local time, causing mismatch with the backfill loop's local date constructor.

**Exact locations in code:**
- `src/services/db.ts` line 30: `getTodayPrefix()` uses UTC (correct)
- `src/services/assignmentService.ts` lines 182-188: backfill loop uses local time constructors (inconsistent with above)

**Consequences:**
- In UTC+2 timezone, after midnight local time, `getTodayPrefix()` returns "yesterday" while the backfill loop's `new Date(dateStr + T00:00:00)` computes "today" — backfill runs for "today" which is still in progress
- On DST transition nights, one date may get double-processed or skipped

**Prevention:**
Standardize all date arithmetic on ISO UTC strings. Replace `new Date(\`${dateStr}T00:00:00\`)` with `new Date(\`${dateStr}T00:00:00Z\`)` in the backfill loop. This matches how `getTodayPrefix()` already works.

**Detection (warning signs):**
- User in UTC+5 timezone sees "tomorrow's" habits appearing after midnight local time
- Unit test with a mocked non-UTC timezone shows different results than UTC

**Phase:** Bug fixes phase — same phase as the backfill spontaneous fix.

---

### Pitfall 6: Restore Transaction Silently Succeeds With Partial Data If expo-sqlite withTransactionAsync Has Inconsistent Rollback Behavior

**What goes wrong:**
`restoreAllData()` wraps all deletes and inserts in `db.withTransactionAsync()`. SQLite guarantees atomicity at the engine level, but `expo-sqlite`'s async wrapper can have edge cases where the JS promise rejects after the C-level commit in certain Expo versions, leaving the app with restored data but throwing an error to the UI.

More practically: the current implementation inserts all tables sequentially in separate `runAsync` calls inside one transaction. If a single row insert fails (e.g., a UUID collision from a malformed backup), the transaction rolls back — but the error propagates as a generic rejection with no context about which row failed.

**Exact location in code:**
- `src/repositories/backupRepository.ts` line 71: `db.withTransactionAsync` — no per-insert error context

**Consequences:**
- Restore fails mid-way, all tables are cleared (the DELETEs ran), rollback restores them — but user sees a generic error and doesn't know if their data is safe
- If rollback also fails (rare but possible on low storage), user loses all data

**Prevention:**
1. Validate backup data shape before touching the database — check for UUID format, required fields, and referential integrity (all `habit_id` values in performed_habits must exist in habits array)
2. Wrap the entire `importBackup()` in a try-catch that shows "Restore failed, your current data was not modified" on failure
3. Add version compatibility check: reject restores where `backup.version` is newer than the current app version

**Detection (warning signs):**
- `parseAndValidate()` only checks for array presence, not row-level integrity
- No pre-restore data validation beyond `Array.isArray`

**Phase:** Google Drive backup phase — strengthen before making restore more accessible.

---

### Pitfall 7: Type Refactoring of `sanitizeTable` Changes Runtime Behavior if Types Are Used as Guards

**What goes wrong:**
`sanitizeTable` in `db.ts` uses `{ id: string; [key: string]: any }` to handle dynamic column names. The risk in refactoring this to strongly-typed functions is that TypeScript type assertions (`as SomeType`) don't provide runtime guarantees. If the refactored code uses type assertions to "prove" a column exists, SQLite will still return `undefined` for a missing column — and the new typed code may now silently skip the sanitization instead of filtering it.

**Why it happens:**
Developers replace `any` with typed interfaces and add `as` assertions to make the compiler happy, without adding runtime guards. The code looks correct but `row.default_categories` can still be `undefined` at runtime if the schema has not yet applied the migration.

**Prevention:**
When removing `any` from database result types:
1. Use `unknown` as an intermediate step — it forces explicit runtime checks before use
2. Add runtime guards: `if (typeof row[column] !== 'string') continue;` before parsing JSON
3. Never use `as SomeType` on raw DB query results — always validate first

**Detection (warning signs):**
- Type refactoring adds `as` casts to database query results
- Existing null checks are removed because "TypeScript now says it's a string"

**Phase:** Tech debt phase — review all DB result types for this pattern.

---

### Pitfall 8: Spontaneous Records Without Category Validation Create Silent Stats Corruption

**What goes wrong:**
`addSpontaneous()` in `assignmentService.ts` line 93 calls `JSON.stringify(categories)` directly without validating the `categories` array against `VALID_AREA_IDS`. Invalid category IDs are stored in `snapshot_categories`. Later, `sanitizeCategories()` runs only at DB init, not on every insert. Stats queries that group by category will silently ignore invalid IDs (filtered by `filterValidIds`) — producing stats that don't add up.

**Exact location in code:**
- `src/services/assignmentService.ts` line 93: no category validation before insert
- `src/services/db.ts` lines 150-153: sanitization only runs at init, not after inserts

**Consequences:**
- Categories pie chart shows lower totals than expected because some entries have categories that got sanitized away
- User-entered data appears to "disappear" from stats without any error

**Prevention:**
Validate `categories.filter(id => VALID_AREA_IDS.has(id))` in `addSpontaneous()` before serialization. Do not rely on init-time sanitization as the only guard — fail fast at insert time.

**Detection (warning signs):**
- `SpontaneousModal` passes user-selected categories directly to the service without filtering
- Stats totals don't match the sum of visible category entries

**Phase:** Bug fixes phase — same batch as backfill and category validation fixes.

---

## Minor Pitfalls

---

### Pitfall 9: Future Date Check Duplicated — Divergence Risk on Future Edits

**What goes wrong:**
The future date guard `if (day > getTodayPrefix()) return` appears in both `addAssignmentForHabit()` (line 116) and `ensureAssignmentsForDate()` (line 200). Currently harmless, but if someone modifies the logic in one place (e.g., to allow scheduling future habits), the other copy is forgotten and behavior diverges.

**Prevention:**
Extract to a single `isFutureDate(datePrefix: string): boolean` utility. Both call sites import and call it. One source of truth.

**Phase:** Tech debt phase — low priority but prevents future confusion.

---

### Pitfall 10: JSON Parsing Scattered Across Layers — Error Context Lost

**What goes wrong:**
`JSON.parse` on category strings happens in `db.ts` (sanitization), `statsService.ts` (via `parseJsonArray`), and components. When a malformed JSON string causes a parse error, the `try-catch` returns `[]` silently. No logging, no indication of which record caused the parse failure.

**Prevention:**
Centralize all category JSON parsing behind a single `parseCategoryList(json: string, context?: string): string[]` function. Add a development-mode warning (`__DEV__ && console.warn(...)`) when parse fails, including the context string to identify the source.

**Phase:** Tech debt phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Bug fix: backfill spontaneous | Pitfall 1 — wrong count query | Change guard to use `countByDate` (counts all rows), not `countHabitAssignmentsByDate` |
| Bug fix: backfill timezone | Pitfall 5 — local vs UTC date constructors | Append `Z` to date strings in backfill loop to force UTC parsing |
| Bug fix: category validation | Pitfall 8 — invalid categories stored on insert | Validate against `VALID_AREA_IDS` before `JSON.stringify` in `addSpontaneous()` |
| Type safety refactoring | Pitfall 7 — `as` assertions hide runtime nulls | Use `unknown` + runtime checks, never `as SomeType` on raw DB rows |
| Google Drive: OAuth setup | Pitfall 3 — missing refresh token | Request `access_type=offline`, use Web App client ID, store in SecureStore |
| Google Drive: scope selection | Pitfall 4 — wrong scope fails or exposes data | Use `drive.appdata` exclusively; use `appDataFolder` space in all API calls |
| Google Drive: restore UX | Pitfall 2 — silent destructive overwrite | Confirmation modal with backup date + record counts before any restore |
| Google Drive: error handling | Pitfall 6 — partial restore with no context | Validate all rows before touching DB; wrap in try-catch with user-visible message |

---

## Sources

- Expo Authentication docs: [https://docs.expo.dev/guides/google-authentication/](https://docs.expo.dev/guides/google-authentication/)
- Google Drive API scopes: [https://developers.google.com/workspace/drive/api/guides/api-specific-auth](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- Google Drive appdata folder: [https://developers.google.com/workspace/drive/api/guides/appdata](https://developers.google.com/workspace/drive/api/guides/appdata)
- Google Drive quota limits: [https://developers.google.com/workspace/drive/api/guides/limits](https://developers.google.com/workspace/drive/api/guides/limits)
- expo-auth-session issue — scopes: [https://github.com/expo/expo/issues/12793](https://github.com/expo/expo/issues/12793)
- SQLite atomicity: [https://sqlite.org/atomiccommit.html](https://sqlite.org/atomiccommit.html)
- React Native timezone bugs (confirmed issue): [https://github.com/facebook/react-native/issues/38102](https://github.com/facebook/react-native/issues/38102)
- Expo SDK 53 Google auth breaking change: [https://medium.com/@ruveydakayabasi/fixing-the-broken-google-login-after-expo-sdk-53-7872655e0c49](https://medium.com/@ruveydakayabasi/fixing-the-broken-google-login-after-expo-sdk-53-7872655e0c49)
- React Native Cloud Storage (Drive config reference): [https://react-native-cloud-storage.oss.kuatsu.de/docs/installation/configure-google-drive/](https://react-native-cloud-storage.oss.kuatsu.de/docs/installation/configure-google-drive/)
- Android backup security best practices: [https://developer.android.com/privacy-and-security/risks/backup-best-practices](https://developer.android.com/privacy-and-security/risks/backup-best-practices)
- Codebase audit: `.planning/codebase/CONCERNS.md` (2026-03-17)
- Source code reviewed: `src/services/assignmentService.ts`, `src/services/db.ts`, `src/services/backupService.ts`, `src/repositories/assignmentRepository.ts`, `src/repositories/backupRepository.ts`
