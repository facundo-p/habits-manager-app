# Feature Landscape

**Domain:** Mobile habit tracker — bug fixes, tech debt cleanup, Google Drive cloud backup
**Researched:** 2026-03-17
**Project:** Cozy Habits

---

## Context

The app already ships a working local backup/restore system (`backupService.ts`) via the OS share sheet
(expo-sharing) and document picker (expo-document-picker). The JSON format covers all four tables:
`habits`, `performed_habits`, `mood_entries`, `daily_assignments`. The milestone adds Google Drive
as a cloud destination and fixes correctness bugs in the daily assignments system.

---

## Bug Fix Features

These are correctness fixes, not user-visible features. They are nonetheless the highest priority
items because they create silent data corruption.

### Bug 2 — Backfill ignores spontaneous assignments

**What:** `countHabitAssignmentsByDate()` filters `habit_id IS NOT NULL`, so dates with only
spontaneous records appear "empty" and trigger a full backfill, duplicating regular habit
assignments.

**Scope:** `assignmentRepository.ts` (query), `assignmentService.ts` (ensureAssignmentsForDate).

**Fix pattern:** Change the count query to include all assignment types OR add a separate check
for `habit_id IS NULL` records before deciding to regenerate. The safer approach is a boolean
`hasSpontaneousOnly(date)` guard in `ensureAssignmentsForDate`.

**Test requirement:** Unit test for `ensureAssignmentsForDate` when date has only spontaneous
records — must NOT insert regular habit assignments.

### Bug 3 — Duplicate future-date guard

**What:** `if (day > getTodayPrefix()) return;` appears at line 116 (`addAssignmentForHabit`)
and line 200 (`ensureAssignmentsForDate`). No functional breakage, but creates maintenance
risk if the condition ever diverges.

**Scope:** `assignmentService.ts` two call sites.

**Fix pattern:** Extract `isFutureDate(datePrefix: string): boolean` utility and call it from
both locations. Single source of truth.

### Bug 4 — Timezone drift in backfill date iteration

**What:** `checkAndBackfillHistory` constructs Date objects with local-timezone midnight
(`new Date(\`${dateStr}T00:00:00\`)`). `d.toISOString().slice(0, 10)` returns UTC date, which
shifts by ±1 day for users in UTC-X or UTC+X timezones.

**Scope:** `assignmentService.ts` — `nextDay()`, `formatDateStr()`, backfill loop.

**Fix pattern:** Use `Date.UTC()` explicitly or parse dates as UTC from the start:
`new Date(\`${dateStr}T00:00:00Z\`)`. Verify `toISOString().slice(0, 10)` always returns the
intended calendar date in UTC.

### Bug 5 — Spontaneous category JSON not validated on insert

**What:** `addSpontaneous()` serializes `categories: string[]` directly. Invalid area IDs are
stored and silently dropped later by stats filtering. UI should reject invalid categories before
the DB write.

**Scope:** `assignmentService.ts` line 93, `SpontaneousModal.tsx` (validation site).

**Fix pattern:** Validate `categories` against `VALID_AREA_IDS` in `SpontaneousModal` before
calling `addSpontaneous()`. No change needed in service layer (it's the wrong boundary).

---

## Tech Debt Features

These are structural improvements with no user-visible behavior change.

### TD-1 — Type safety in useSpeechRecognition

**What:** `SpeechModule` is typed as `any` (lines 16, 41). The module is loaded conditionally
so TypeScript can't infer its shape.

**Fix pattern:** Define a `SpeechModuleInterface` with the minimal surface used by the hook.
Use a type assertion at the conditional import boundary, not scattered across the hook body.

**Complexity:** Low. One file, no behavioral change.

### TD-2 — Centralize JSON category parsing

**What:** `JSON.parse` for `snapshot_categories` / `default_categories` happens in `db.ts`,
`statsService.ts`, `utils/parsing.ts`, and components. Parsing is already partially centralized
in `parseJsonArray` in `parsing.ts`.

**Fix pattern:** Eliminate all `JSON.parse` calls outside `parsing.ts`. Route all callers
through `parseJsonArray`. Add validation against `VALID_AREA_IDS` inside `parseJsonArray`
(or a separate `parseAndValidateCategories` function).

**Complexity:** Medium. Multi-file change, must not break stats queries.

### TD-3 — Type sanitizeTable results

**What:** `sanitizeTable` returns `{ id: string; [key: string]: any }`. If schema changes,
TypeScript won't catch mismatches.

**Fix pattern:** Define explicit types for each sanitized table (`SanitizedHabitRow`,
`SanitizedPerformedRow`). Alternatively extract `sanitizeHabitCategories()` and
`sanitizePerformedCategories()` as typed functions. Add a comment documenting why
the SQL string interpolation is safe (controlled constants, not user input).

**Complexity:** Low to Medium. Isolated in `db.ts`.

---

## Table Stakes — Cloud Backup

Features users must have or they perceive cloud backup as broken/useless.
Based on analysis of Loop Habit Tracker, Streaks, HabitNow, and Way of Life patterns.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sign in with Google | Required to access Drive API | Medium | `expo-auth-session` or `@react-native-google-signin/google-signin` — must be Expo managed compatible |
| Upload backup to Drive | Core feature | Medium | POST to Drive REST API with `multipart/related` upload; file already exists from local backup flow |
| Download backup from Drive | Core restore flow | Medium | List files, let user pick, download content, pipe to existing `restoreData()` |
| Show last backup timestamp | Users need confirmation it worked | Low | Store `lastDriveBackupAt` in AsyncStorage or SecureStore |
| Manual trigger | Users expect explicit control over when backup runs | Low | Button in Settings → Backup section |
| Sign out / disconnect | Users must be able to revoke access | Low | Clear stored token, revoke OAuth scope |
| Error messaging | Drive failures must surface to user (quota, auth, network) | Low | Toast/modal with actionable message; silent failure is unacceptable |

### What "upload" means in this context

The existing `exportBackup()` already produces a JSON file at `FileSystem.documentDirectory`.
The Google Drive feature reuses `buildBackupData()` and POSTs the result directly to Drive
without invoking the share sheet. No new serialization logic needed.

### Authentication approach (Expo managed constraint)

Use `expo-auth-session` with Google's OAuth 2.0 endpoint and request the
`https://www.googleapis.com/auth/drive.file` scope (narrow: only files created by this app).
Do NOT use `@react-native-google-signin/google-signin` — it requires native module linking
and breaks Expo managed workflow. Store the refresh token in `expo-secure-store`.

**Confidence: MEDIUM** — verified via Expo docs and Medium articles; specific SDK 54
compatibility should be tested during implementation.

---

## Differentiators — Cloud Backup

Features that add value beyond the baseline. Build these after table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Named backup files with date | Users can identify backups by date; `cozyhabits-2026-03-17.json` | Low | Change `BACKUP_FILENAME` constant to include date |
| Backup history list | Show last N backups stored in Drive | Medium | Drive API list query filtered by app folder |
| Automatic backup on app close / daily | No user action required to stay protected | High | Background tasks in Expo managed are limited (`expo-background-fetch`); reliability on Android/iOS varies significantly |
| Backup size display | Show how much Drive storage the backup uses | Low | Drive file metadata includes `size` field |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time bidirectional sync | Requires conflict resolution logic, server infrastructure, and versioning. Complexity is disproportionate to value for a personal-use app. | Scope to manual backup/restore only |
| Automatic periodic background backup | `expo-background-fetch` on iOS is unreliable (OS can defer or skip). Android has better support but adds complexity. Users with few habits rarely need this. | Show last backup date prominently to prompt manual backup |
| Backup encryption | Adds key management complexity (where to store key?). Drive's own transport encryption (TLS) + the `drive.file` scope limiting access is sufficient for this audience. | Document the security posture; defer encryption to future milestone if users request it |
| Multi-cloud support (Dropbox, iCloud) | Each cloud provider has a different SDK and auth flow. Low ROI in first iteration. | Google Drive only; iCloud is iOS-only anyway |
| Data import from other habit apps | Different schemas, fragile mapping logic. Out of scope per PROJECT.md. | Export/import within Cozy Habits only |
| Import from CSV | Parsing ambiguity (date formats, category names). Not worth the edge cases. | JSON only |
| Overwrite protection / merge on restore | Complex conflict resolution. Current behavior (full replace) is explicit and predictable. | Warn user that restore replaces all local data |

---

## Feature Dependencies

```
Google Auth (expo-auth-session + expo-secure-store)
  └─> Upload to Drive
        └─> Download from Drive
              └─> Restore (reuses existing restoreData())
  └─> Sign out / disconnect

Bug 2 fix (spontaneous count in backfill)
  └─> Tests for spontaneous + backfill interaction

Bug 3 fix (DRY future-date guard)
  └─> isFutureDate() utility
        └─> used in addAssignmentForHabit + ensureAssignmentsForDate

TD-2 (centralize JSON parsing)
  └─> parseAndValidateCategories()
        └─> Bug 5 fix (validate on insert uses same VALID_AREA_IDS)
```

---

## MVP Recommendation

### Phase 1 — Bug Fixes (do first, unblocks correct data for backup)

Priority order:
1. Bug 2 — backfill + spontaneous (data corruption, highest risk)
2. Bug 4 — timezone drift in date iteration (silent data misalignment)
3. Bug 3 — DRY future-date guard (low risk but pairs with Bug 2 work)
4. Bug 5 — category validation at insert boundary (pairs with TD-2)

### Phase 2 — Tech Debt

Priority order:
1. TD-2 — centralize JSON parsing (enables Bug 5 fix cleanly)
2. TD-3 — type sanitizeTable (low effort, high correctness payoff)
3. TD-1 — useSpeechRecognition typing (isolated, non-critical)

### Phase 3 — Google Drive Backup

Priority order:
1. Google OAuth with expo-auth-session + drive.file scope
2. Upload backup (reuse buildBackupData, POST to Drive)
3. Download + restore (list files, pick, pipe to restoreData)
4. Last backup timestamp display
5. Sign out / disconnect

Defer:
- Named backup files with date: simple but not blocking MVP
- Backup history list: useful but requires Drive list API work
- Automatic backup: defer indefinitely — reliability risk outweighs convenience

---

## Sources

- [Expo Google Authentication Guide](https://docs.expo.dev/guides/google-authentication/) — MEDIUM confidence
- [expo-google-drive-api-wrapper (npm)](https://www.npmjs.com/package/expo-google-drive-api-wrapper) — MEDIUM confidence (fork with expo-file-system support)
- [Solving Google Drive API Integration Challenges with Expo](https://medium.com/@tempmailwithpassword/solving-google-drive-api-integration-challenges-with-expo-and-firebase-15a863459e2a) — LOW confidence (single source)
- [Frequently Asked Questions — Loop Habit Tracker (GitHub)](https://github.com/iSoron/uhabits/discussions/689) — MEDIUM confidence (real user expectations for habit app backup)
- [Reclaim: Best Habit Tracker Apps 2026](https://reclaim.ai/blog/habit-tracker-apps) — LOW confidence (marketing content, used for feature landscape only)
- [SQLite Date And Time Functions (official)](https://sqlite.org/lang_datefunc.html) — HIGH confidence (UTC modifier behavior)
- Project context: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` — HIGH confidence (first-party)
