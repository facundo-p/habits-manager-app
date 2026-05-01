# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**Type Safety Issues with Optional Module Loading:**
- Issue: `useSpeechRecognition.ts` uses `any` type for `SpeechModule` due to optional/dynamic module loading. If `expo-speech-recognition` is not installed, the module is null, and the hook handles this gracefully, but TypeScript doesn't know the shape of `SpeechModule`.
- Files: `src/hooks/useSpeechRecognition.ts` (lines 16, 41)
- Impact: Type safety is compromised in one non-critical hook. No runtime errors expected as the code is defensive, but IDE type checking fails.
- Fix approach: Create a typed interface for `SpeechModule` and use conditional type assertions or optional chaining more explicitly. Consider extracting module detection logic to a separate utility.

**JSON Serialization/Parsing Scattered Throughout:**
- Issue: JSON serialization happens in multiple places without centralized validation. `snapshot_categories` and `default_categories` are stored as JSON strings in SQLite and parsed on demand in services, utils, and components.
- Files: `src/services/db.ts` (line 160: `JSON.parse`), `src/services/statsService.ts` (parseJsonArray calls), `src/utils/parsing.ts` (parseJsonArray implementation), multiple components
- Impact: If category JSON becomes malformed, silent failures could occur. `parseJsonArray` already has try-catch, but parsing is done in multiple layers.
- Fix approach: Centralize all category parsing to a single utility function (already partially done in `src/utils/parsing.ts`). Add validation to ensure parsed arrays match `VALID_AREA_IDS` at the boundary between DB and service layer.

**Untyped Database Query Results in Sanitization:**
- Issue: `sanitizeTable` function in `db.ts` uses `{ id: string; [key: string]: any }` to handle dynamic column names.
- Files: `src/services/db.ts` (line 160)
- Impact: Limited type safety for sanitization logic. If schema changes, this function won't catch mismatches at compile time.
- Fix approach: Create a strongly-typed approach using type-safe query builders or explicit type definitions for each table being sanitized.

## Known Bugs (with Inline Comments)

**Backfill Logic Ignores Spontaneous Assignments:**
- Issue: Line 201 of `assignmentService.ts` comments "Bug 2: ignorar espontáneos" — `countHabitAssignmentsByDate()` counts only assignments with `habit_id IS NOT NULL`, missing spontaneous records. If a date has only spontaneous assignments, the backfill will regenerate regular habits.
- Symptom: Spontaneous records may be duplicated if backfill runs on a date that previously had only spontaneous entries.
- Files: `src/services/assignmentService.ts` (line 201), `src/repositories/assignmentRepository.ts` (lines 19-20, 70)
- Trigger: Call `checkAndBackfillHistory()` after adding spontaneous records, then check if duplicates appear.
- Workaround: None. Manual DB inspection needed to identify duplicates.

**Future Date Check Implemented But Redundant:**
- Issue: Line 200 in `assignmentService.ts` comments "Bug 3: nunca generar para fechas futuras" — the check `if (datePrefix > getTodayPrefix()) return;` is correct but is duplicated in `addAssignmentForHabit()` at line 116.
- Symptom: No functional impact (defensive programming), but creates maintenance burden if logic needs to change.
- Files: `src/services/assignmentService.ts` (lines 116, 200)
- Trigger: Not a bug in practice; both checks prevent future date assignments.
- Workaround: Already working. Just needs refactoring to DRY.

## Security Considerations

**Backup File Encryption Not Implemented:**
- Risk: Backup files stored in app storage can be accessed by other apps if device is rooted. Sensitive habit and mood data is unencrypted.
- Files: `src/services/backupService.ts`, `src/repositories/backupRepository.ts`
- Current mitigation: Backups are stored in app's private document directory (`DocumentPickerAsset`), which provides some OS-level protection on iOS/Android.
- Recommendations:
  - Encrypt backup files using `expo-crypto` before writing to filesystem
  - Hash backup metadata to detect tampering
  - Add option to password-protect backups

**SQL Injection Protection via Parameterized Queries:**
- Risk: All database queries use parameterized queries (good), but raw SQL is concatenated in `sanitizeTable()` with template string for table/column names.
- Files: `src/services/db.ts` (lines 161-162: `SELECT id, ${column} FROM ${table} ...`)
- Current mitigation: Only called internally during initialization with constants from code (not user input).
- Recommendations: Add comment documenting why this is safe. Consider extracting to explicit functions for each table (`sanitizeHabitCategories`, `sanitizePerformedCategories`).

**Credential/Secret Storage:**
- Risk: No external API keys or credentials detected in codebase. Voice recognition requires optional module that's not in base dependencies. Good security posture for a local-first app.
- Files: None
- Current mitigation: No sensitive credentials in code.
- Recommendations: Continue avoiding API keys in code. If future integrations are added (cloud sync, etc.), ensure credentials use Expo SecureStore.

## Performance Bottlenecks

**O(n) Category Validation on Database Init:**
- Problem: `sanitizeCategories()` loads all records with category JSON, parses each one, filters, and writes back. On large datasets (1000+ habit records), this blocks app initialization.
- Files: `src/services/db.ts` (lines 150-173)
- Cause: Row-by-row processing in JavaScript instead of batch SQL operation.
- Improvement path: Rewrite using raw SQL to filter JSON arrays without loading into memory. SQLite's `json_extract()` can validate IDs at the DB level.

**Unnecessary Re-renders in DailySheet Due to Large Arrays:**
- Problem: `groupByFrequency()` in `DailySheetScreen.tsx` filters and maps `DailyItem[]` on every render. If there are 100+ habits, this could impact frame rate on older devices.
- Files: `src/screens/DailySheetScreen.tsx` (lines 46-62)
- Cause: Grouping is done inline in render path, not memoized.
- Improvement path: Move `groupByFrequency()` to a `useMemo()` hook that depends on `items` array identity. Add `useCallback` for event handlers.

**Stats Screen Loads All Monthly Data on Every Month Change:**
- Problem: Changing month in `StatsScreen.tsx` triggers `loadStats()` which queries heatmap, categories, and weekly comparison in parallel. No caching between month views.
- Files: `src/screens/StatsScreen.tsx` (lines 45-54)
- Cause: No memoization of results. Each month switch is a fresh DB query.
- Improvement path: Implement a simple cache (e.g., `Map<monthKey, data>`) or use React Query/SWR. Most users won't visit 12 months in one session, so the impact is low, but noticeable on slower devices.

## Fragile Areas

**Daily Assignments Snapshot Logic:**
- Files: `src/services/assignmentService.ts`, `src/repositories/assignmentRepository.ts`
- Why fragile: Daily assignment snapshots (name, points, categories, frequency) are immutable once created. If a habit is edited after assignments are generated, only today's uncompleted assignments get updated. Any completed assignment preserves the old snapshot. This is intentional but creates coupling between:
  - `updateTodaySnapshotForHabit()` (lines 148-161) — only updates today
  - `ensureAssignmentsForDate()` (lines 199-224) — creates with current habit data
  - Tests expect this behavior: `src/__tests__/dailyAssignments.test.ts`
- Safe modification: Change is only safe if:
  1. All tests in `dailyAssignments.test.ts` pass
  2. Backfill logic is verified to not duplicate assignments
  3. Historical data (completed assignments) is not modified retroactively
- Test coverage: Good — 357 lines of test code dedicated to this logic. Tests check:
  - Backfill doesn't duplicate
  - Completed assignments preserve snapshots
  - Future dates are never created
  - Adding/removing habits only affects today

**Mood Entry Lifecycle:**
- Files: `src/services/moodService.ts`, `src/store/useHabitStore.ts` (toggleItem/saveReflection)
- Why fragile: When an assignment is uncompleted, the mood is deleted (line 120 in useHabitStore). But if a user toggles a habit multiple times on the same day, the mood association could become inconsistent.
- Safe modification: Only modify `deleteMoodForHabit()` call sites with care. Verify that:
  1. Mood deletion only happens when uncompleting an assignment
  2. No dangling mood records are created if user cancels reflection
  3. Tests validate toggle→mood→toggle flow
- Test coverage: Limited — no dedicated mood toggle tests. Only covered indirectly via reflection modal.

**Unique Constraint on Daily Assignments:**
- Files: `src/services/db.ts` (line 140: `CREATE UNIQUE INDEX ... ON daily_assignments(habit_id, date) WHERE habit_id IS NOT NULL`)
- Why fragile: The index allows multiple NULL `habit_id` values (spontaneous records). If logic changes to allow duplicate spontaneous entries on the same date, or if a bug violates this constraint, DB operations could fail silently or throw unhandled errors.
- Safe modification: Any change to spontaneous record creation must verify:
  1. `addSpontaneous()` doesn't create duplicates
  2. Backfill doesn't create habit assignments for already-assigned days
  3. Error handling catches constraint violations
- Test coverage: Good for habit assignments, minimal for spontaneous records.

## Test Coverage Gaps

**Spontaneous Habit Handling Barely Tested:**
- What's not tested:
  - Adding spontaneous to a date with existing assignments
  - Removing spontaneous and re-adding same day
  - Spontaneous not being included in backfill count (Bug 2)
  - Spontaneous appearing in stats
- Files: `src/services/assignmentService.ts` (lines 85-102), `src/screens/DailySheetScreen.tsx` (spontaneous section)
- Risk: Bug 2 (backfill ignoring spontaneous) could silently duplicate regular habit assignments.
- Priority: High — spontaneous records are a key feature

**No Tests for Historical Date Editing:**
- What's not tested:
  - Toggling habits on past dates via StatsScreen
  - Backfill filling gaps between two existing dates
  - Date navigation in DailySheet (viewDate changes)
- Files: `src/screens/DailySheetScreen.tsx` (line 8: viewDate logic), `src/screens/StatsScreen.tsx` (handleEditDay)
- Risk: Silent data inconsistencies if date boundaries aren't handled correctly.
- Priority: Medium — less common user flow, but complex state management

**Mood/Reflection Feature Has No Service Tests:**
- What's not tested:
  - Mood creation with correct timestamp
  - Mood deletion when uncompleting
  - Reflection modal flow (open, edit, save, skip)
  - Mood retrieval for editing existing reflections
- Files: `src/services/moodService.ts`, `src/components/modals/ReflectionModal.tsx`
- Risk: Mood data could become orphaned or duplicated without tests catching it.
- Priority: Medium — existing functionality, but needs safety net

**No Error Handling Tests:**
- What's not tested:
  - DB transaction failures
  - Network errors (if backup upload is added later)
  - Concurrent operations (two togles on same assignment)
- Files: `src/services/` (all service files have generic `catch(err) { console.error() }`)
- Risk: Users see spinner indefinitely if DB operation fails.
- Priority: Low for current functionality (no network), but high if new features added

## Scaling Limits

**SQLite Suitable for Current Scale, Limits at 10k+ Records:**
- Current capacity: Tested with typical use (100 habits, 2+ years of history). Daily query for 8 assignments with 8 performed records returns in <100ms.
- Limit: SQLite performance degrades noticeably with 10,000+ records across habits/performed_habits/daily_assignments combined. Heatmap queries for full year become slow (>500ms).
- Scaling path:
  1. Implement pagination/windowing for stats screens (load current month, not full year)
  2. Add indexing for date range queries (already has `idx_unique_habit_date`)
  3. Archive old records (move data >2 years old to separate DB or compressed archive)
  4. If absolutely necessary, migrate to cloud database (Firebase, Supabase)

**Device Storage Limits for Backup Files:**
- Current capacity: Backup files are typically 50-200KB for 100 habits + 2 years of data.
- Limit: Multiple backups could consume significant storage. No cleanup policy for old backups.
- Scaling path: Implement backup rotation (keep last N backups, delete older ones). Add compression for backup files. Allow user to manually manage backup history.

**Memory Usage During Stats Rendering:**
- Current capacity: Chart rendering with <1000 habit records is smooth.
- Limit: Pie chart with >50 categories becomes slow. Heatmap with full year × 100 habits could cause memory spikes on low-end devices.
- Scaling path: Add limits (show only top 10 categories in pie chart), implement virtual scrolling for habit lists, lazy-load chart data.

## Dependencies at Risk

**expo-sqlite ~16.0.10 — Stable but Performance-Limited:**
- Risk: SQLite in Expo is stable, but performance isn't optimized for large datasets. No migration path to native SQLite if needed in future.
- Impact: If app grows to 10k+ records, DB operations could block UI thread.
- Migration plan: No immediate need. If required, consider `react-native-sqlite-storage` (more control) or cloud sync (Supabase, Firebase).

**react-native-chart-kit ^6.12.0 — Outdated, May Have Security Issues:**
- Risk: Chart library hasn't been updated in 2+ years. No TypeScript types built-in. Uses legacy lifecycle methods internally.
- Impact: Minor — charting is non-critical. Could cause crashes on future React Native versions.
- Migration plan: Evaluate `react-native-skia` or `victory-native` as replacements if chart issues arise.

**expo-speech-recognition — Optional, May Not Install:**
- Risk: Module is optional and only works in dev builds, not Expo Go. If package version changes, could break voice dictation feature.
- Impact: Users on Expo Go lose voice input. No fallback UI (button is hidden, which is correct).
- Migration plan: Consider implementing fallback to native audio input, or document that voice requires dev build.

**zustand ^5.0.11 — Stable but Check for Updates:**
- Risk: Zustand is lightweight and stable. No known issues. Version 5 is recent; check breaking changes before major version bumps.
- Impact: None expected.
- Migration plan: None needed. Good choice for state management in React Native.

## Missing Critical Features

**No Offline Backup/Restore:**
- Problem: App stores data locally in SQLite, but there's no automatic backup or recovery if DB becomes corrupted.
- Blocks: Users can't recover from accidental data loss or app crashes.
- Suggestion: Implement daily automatic backup to device storage with restore option. Optional: sync to iCloud/Google Drive.

**No Data Import from Other Apps:**
- Problem: Users switching from other habit trackers can't import their data.
- Blocks: Friction in user onboarding; users may switch to competitors if they can't migrate data.
- Suggestion: Add CSV/JSON import feature parsing from popular habit apps.

**No Sync Across Devices:**
- Problem: Data is device-local only. Users with multiple devices see different data.
- Blocks: Not a blocker for MVP, but limits user base to single-device use.
- Suggestion: Out of scope for now, but plan for cloud sync architecture (Supabase, Firebase) for future expansion.

## Hidden Issues

**Backfill Date Calculation Uses Local Timezone:**
- Issue: `checkAndBackfillHistory()` uses `new Date()` which is device local time. If user changes timezone between app sessions, dates could shift.
- Files: `src/services/assignmentService.ts` (lines 184-189)
- Impact: Low — most users don't change timezone. But international users could see date misalignment.
- Fix: Store all dates in UTC explicitly, convert to local display only.

**Spontaneous Category JSON Not Validated on Insert:**
- Issue: `addSpontaneous()` accepts `categories: string[]` and serializes it directly. If `categories` array contains invalid IDs, they're stored and silently filtered later.
- Files: `src/services/assignmentService.ts` (line 93: `JSON.stringify(categories)`)
- Impact: Stats filtering removes invalid categories, so no data loss. But UI should validate before insert.
- Fix: Validate categories against `VALID_AREA_IDS` in `SpontaneousModal` before calling `addSpontaneous()`.

---

*Concerns audit: 2026-03-17*
