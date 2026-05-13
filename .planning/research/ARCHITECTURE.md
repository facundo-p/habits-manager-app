# Architecture Research — v1.1 Bienestar emocional Integration

**Domain:** React Native local-first wellbeing app (extension of existing Cozy Habits)
**Researched:** 2026-05-06
**Confidence:** HIGH (grounded in actual files; conventions read directly from `src/`)

> **Scope of this document.** This is *integration* architecture for a brownfield milestone, not greenfield design. The existing app already prescribes a layered architecture (Screen → Store → Service → Repository → SQLite). Goal here: decide where each new wellbeing capability lives in that mold, what gets created vs modified, and the build order that respects dependencies.

---

## 1. Existing Architecture (Anchor — DO NOT change)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Presentation: src/screens/  +  src/components/{layout,modals,shared}│
│  - Dumb consumers; no SQL, no service-internal logic                 │
├──────────────────────────────────────────────────────────────────────┤
│  State: src/store/  (Zustand)                                        │
│  - useHabitStore  (in-DB domain)                                     │
│  - useSettingsStore (file-persisted prefs + Drive auth slice)        │
├──────────────────────────────────────────────────────────────────────┤
│  Services: src/services/                                             │
│  - One file per domain concept; orchestrate repos, resolve dates,    │
│    enforce business rules. ONLY layer allowed to talk to repos.      │
├──────────────────────────────────────────────────────────────────────┤
│  Repositories: src/repositories/                                     │
│  - SQL-only; one file per table; SQL constants at the top.           │
├──────────────────────────────────────────────────────────────────────┤
│  SQLite (expo-sqlite) — source of truth                              │
│  Migrations: PRAGMA user_version, atomic via withTransactionAsync    │
└──────────────────────────────────────────────────────────────────────┘
                            ↓ (backup transport)
        backupService (build/parse/restoreData)  →  Drive | local file
```

Hard rules (preserved from `.planning/codebase/`):
- One repository file per table.
- SQL constants at top of repo files; never inline.
- Services own date resolution (`getTodayPrefix`, `getTimestampForDate`, `getNowTimestamp` from `db.ts`).
- Stores never call repos directly.
- Migrations are versioned via `PRAGMA user_version`, atomic in `withTransactionAsync`, idempotent at boot.
- All new tables MUST round-trip through `backupService.buildBackupData` / `restoreData`.

---

## 2. Schema Decision — Partial Unified, Shared Mood Vocabulary

> **2026-05-10 OVERRIDE (user decision):** The original research recommendation was split-tables. After discussion, the decision changed to **partial unification by domain**: one `mood_log` for kinds with shared shape (morning/evening/note), one `text_library` for kinds with shared shape (quote/future "question"), and standalone tables for `weekly_reviews` and `drafts`. Driver: future modular toggles (v1.2) and ability to add similar kinds without migrations. The original split rationale (preserved below) is the explicit context we are overriding.
>
> **Final tables for migration v2:** `mood_log`, `text_library`, `weekly_reviews`, `drafts`. Plus `mood_scale_version` column added to existing `mood_entries`.

### Final shape (chosen)

```sql
-- Unified mood capture (morning, evening, note, reflection — extensible)
CREATE TABLE IF NOT EXISTS mood_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('morning','evening','note','reflection')),
  date_key TEXT NOT NULL,                  -- 'YYYY-MM-DD' via getLocalDayKey()
  occurred_at TEXT NOT NULL,               -- full ISO timestamp
  mood_value REAL NOT NULL,
  mood_scale_version TEXT NOT NULL DEFAULT 'v1',
  sleep_hours REAL,                        -- only populated when kind='morning'
  comment TEXT,                            -- free text; for 'note' = body; for 'reflection' = description
  habit_id TEXT,                           -- only populated when kind='reflection'; FK to habits
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
);
-- 1 row per day for check-ins; notes and reflections are free
CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_log_one_per_day
  ON mood_log(kind, date_key)
  WHERE kind IN ('morning','evening');
CREATE INDEX IF NOT EXISTS idx_mood_log_date_key ON mood_log(date_key);
CREATE INDEX IF NOT EXISTS idx_mood_log_kind ON mood_log(kind);
CREATE INDEX IF NOT EXISTS idx_mood_log_habit_id ON mood_log(habit_id) WHERE habit_id IS NOT NULL;

-- Unified text library (quotes; future: questions, mantras, etc.)
CREATE TABLE IF NOT EXISTS text_library (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('quote')),  -- expand via migration when adding kinds
  text TEXT NOT NULL,
  author TEXT,                             -- nullable
  is_active INTEGER NOT NULL DEFAULT 1,    -- soft-delete (mirrors habits.is_active)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_text_library_kind_active ON text_library(kind, is_active);

-- Weekly review: 1 per ISO week, snapshot + answers
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL UNIQUE,           -- 'YYYY-Www' ISO
  week_start TEXT NOT NULL,                -- 'YYYY-MM-DD' Monday or Sunday per setting
  mood_avg REAL,
  sleep_avg REAL,
  top_habits_json TEXT NOT NULL DEFAULT '[]',
  answers_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Drafts: transient autosave (NOT in backup)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                      -- 'morning'|'evening'|'note'|'weekly_review'
  key TEXT NOT NULL,                       -- date_key, week_key, or note_id
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_kind_key ON drafts(kind, key);

-- Migrate existing mood_entries into mood_log as kind='reflection', then drop the table
INSERT INTO mood_log (
  id, kind, date_key, occurred_at, mood_value, mood_scale_version,
  sleep_hours, comment, habit_id, created_at, updated_at
)
SELECT
  id, 'reflection', substr(timestamp, 1, 10), timestamp, value, 'v1',
  NULL, description, habit_id, timestamp, timestamp
FROM mood_entries;

DROP TABLE mood_entries;
```

**Migration v2 is atomic in `withTransactionAsync`.** All CREATE TABLE + CREATE INDEX + INSERT...SELECT + DROP statements live in a single transaction. If any step fails (e.g., a malformed `timestamp` cannot be parsed for `date_key`), the entire transaction rolls back and `user_version` stays at 1.

### Why this shape

1. **Modular toggles (v1.2 target).** Disable morning, evening, or note independently from `settings.json` — queries naturally return zero rows; no schema gymnastics.
2. **Future similar kinds = no migration.** Lunch checkin, post-workout mood, mantras, daily questions — expand the CHECK constraint or just remove it. Same code paths.
3. **Timeline read is cheaper.** Single `SELECT * FROM mood_log WHERE date_key BETWEEN ? AND ?` plus a join into `mood_entries`, instead of UNION over 4 tables.
4. **Repos/services are thinner.** One `moodLogRepository` with kind-aware methods (`getMorningOf(date)`, `getEveningOf(date)`, `getNotesOf(date)`) — same internals, type-safe surface.
5. **Schema lies are bounded.** Only `sleep_hours` is sparse (NULL except for kind='morning'). Service layer + TS discriminated union enforce per-kind invariants. Mitigated by repo methods that NEVER expose raw `mood_log` access without a kind filter.

### Trade-offs accepted

- **Validation moves to service layer.** `moodLogService.createMorning({...})` enforces "sleep_hours allowed; date_key unique"; service for `createNote` enforces "no sleep_hours; comment is the text body". Tests cover each kind.
- **Discriminated union types** in TS instead of separate concrete types. Acceptable cost for the structural payoff.
- **A single bug in a query that forgets `WHERE kind = ?` could leak data across kinds.** Mitigated by repo design: no raw access; every public function takes or implies a kind.
- **If a kind diverges hard (e.g., morning gains 10 fields)** we'd split that kind to its own table later — not anticipated for v1.1.

### Original split-tables rationale (overridden 2026-05-10)

The original recommendation favored split tables citing: schema clarity, one-repo-per-table convention, simple per-kind UNIQUE constraints, and avoiding sparse columns. This analysis is preserved here as context. The override applies because (a) per-kind volume is low → cost of UNION is real but small either way, (b) the modular-toggle direction makes unified more natural, and (c) only one column is genuinely sparse (`sleep_hours`).

### Migration impact on existing code

`mood_entries` is **dropped** at migration v2. All existing reflection data is migrated into `mood_log` with `kind='reflection'`. Touched code:

- `src/repositories/moodRepository.ts` — rewrite queries against `mood_log WHERE kind = 'reflection'` (preserve same public API surface so callers don't change).
- `src/repositories/backupRepository.ts` — replace `SQL_ALL_MOODS`/`SQL_CLEAR_MOODS`/`SQL_INSERT_MOOD` with `mood_log` equivalents scoped to `kind='reflection'` for the reflection path; new functions cover the other kinds.
- `src/services/backupService.ts` + `src/services/driveBackupService.ts` — `buildBackupData` writes a single `mood_log` array. `parseAndValidate` + `restoreData` accept both v1 (with `mood_entries`) and v2 (with `mood_log`); v1 entries are mapped to reflection rows.
- Tests touching `mood_entries` (`driveBackupService.restore.test.ts`, `restorePreClean.test.ts`, `testDatabase.ts`) — updated to seed `mood_log` directly or assert the v1→v2 mapping.

### What we are NOT changing

- `performed_habits` and `daily_assignments` — untouched. The reflection flow still creates a `performed_habits` row + a `mood_log` row with `kind='reflection'` (same as today, just different target table).
- `habit_id` semantics — still the stable anchor (we did not migrate it to `daily_assignment_id`).

---

## 3. Mood Scale — Single Source of Truth

**Decision:** Centralize the mood vocabulary in a dedicated module, reusing the existing constants from `src/config/constants.ts` (`MOOD_MIN=1`, `MOOD_MAX=10`, `MOOD_STEP=0.5`, `MOOD_DEFAULT_VALUE=5`). **No data migration needed** because the new tables adopt the same scale.

### Files

- **`src/config/mood.ts` (NEW).** Re-exports the constants and adds: discrete enum/labels (`muyMal`, `mal`, `neutral`, `bien`, `muyBien`) mapping to numeric ranges, color tokens, and pure helper `moodLabelFor(value: number)`. This is the SoT consumers import from.
- **`src/components/shared/MoodPicker.tsx` (NEW).** Single picker component used by `ReflectionModal` (existing), morning check-in screen, evening check-in screen, mood note modal. Props: `{ value, onChange, size?: 'compact' | 'full' }`.
- **`src/components/modals/ReflectionModal.tsx` (MODIFIED).** Replace the inline mood UI (currently uses `MOOD_MIN/MAX/STEP` directly per grep) with `<MoodPicker />`.

**Why no scale conversion of existing data:** existing `mood_entries.value` is already in the [1, 10] range with step 0.5. When migrated to `mood_log` as `kind='reflection'`, the values are copied verbatim with `mood_scale_version = 'v1'`. If the team later wants a discrete 5-bucket UX, that's a *presentation* change — `moodLabelFor` is the only thing that needs to evolve, and it works on existing numeric data.

**Risk flagged for PITFALLS.md (cross-doc):** if anyone proposes changing the *numeric* scale (e.g., to 1–5), it becomes a data migration touching every row in `mood_log` (across all kinds). The `mood_scale_version` column is what enables this safely. Make a "do not do without an ADR" rule.

---

## 4. Notifications — New Service, New Settings Slice

**Decision:** New `src/services/notificationsService.ts`. Scheduled IDs and user prefs live in `useSettingsStore` (it already persists across reboots via file storage and is the right home for "user preferences"). No new repository — there is no SQLite state to model; expo-notifications is the system of record for scheduled notifications, our store keeps a thin reflection.

### Files

**NEW**
- `src/services/notificationsService.ts` — wraps `expo-notifications`. Public API:
  - `requestPermissions(): Promise<'granted' | 'denied'>`
  - `scheduleMorningCheckin(timeHHMM: string): Promise<string>` — returns scheduled ID
  - `scheduleEveningCheckin(timeHHMM: string)`
  - `scheduleWeeklyReview(weekday: 0–6, timeHHMM: string)`
  - `cancelNotification(id: string)`
  - `cancelAllManaged()` — clears the four IDs we own
  - `rescheduleAll(prefs: NotificationPrefs)` — convenience used after restore/permission change
- `src/config/notifications.ts` — channel IDs (Android), default times, copy templates.

**MODIFIED**
- `src/store/useSettingsStore.ts` — add slice:
  ```ts
  notificationPrefs: {
    morningEnabled: boolean; morningTime: string; // 'HH:MM'
    eveningEnabled: boolean; eveningTime: string;
    weeklyReviewEnabled: boolean; weeklyReviewWeekday: number; weeklyReviewTime: string;
  };
  scheduledIds: { morning?: string; evening?: string; weekly?: string };
  setNotificationPref(...): void;
  ```
  Add to `partialize` so it persists. The store is already the home of user-toggled prefs (`hapticsEnabled`, `voiceDictationEnabled`); notifications fit naturally.
- `src/screens/SettingsScreen.tsx` — wire the existing notification toggle stub to the new prefs and call `notificationsService.rescheduleAll` on change.
- `App.tsx` — call `notificationsService.requestPermissions()` lazily (on first toggle ON, not at boot) and `rescheduleAll()` after `initDatabase()` to repair scheduling after OS-level cancellations.

**Why scheduled IDs in Settings, not in DB.** They are ephemeral (OS may clear on uninstall/permission revoke) and tightly coupled to the user pref. Persisting alongside the pref keeps "what the user wants" and "what is currently scheduled" in one transactional file.

**Backup impact:** notification prefs are user prefs, not user data — they belong to settings.json (already excluded from DB backup). A restored device will re-prompt for permissions and reschedule from settings.json on next boot. **No new field in `BackupData`.**

---

## 5. Backup / Restore Extension

**Decision:** Extend `BackupData` with three new arrays (`mood_log`, `text_library`, `weekly_reviews`). Bump `BACKUP_VERSION = 2`. Extend `parseAndValidate`, `buildBackupData`, `restoreData`, and `backupRepository.restoreAllData` symmetrically. **No new dedup heuristic required** because uniqueness is enforced via partial `UNIQUE INDEX(kind, date_key)` on `mood_log` and `UNIQUE(week_key)` on `weekly_reviews`; a duplicate restore from a malformed backup fails at `INSERT` and aborts the transaction (fail loud, don't silently lose data). `drafts` is excluded from backup — transient autosave state.

### Modified types (`src/types/index.ts`)

```ts
// Discriminated union over the unified mood_log table
export type MoodLogEntry =
  | { id: string; kind: 'morning';    date_key: string; occurred_at: string; mood_value: number; mood_scale_version: string; sleep_hours: number | null; comment: string | null; habit_id: null;           created_at: string; updated_at: string }
  | { id: string; kind: 'evening';    date_key: string; occurred_at: string; mood_value: number; mood_scale_version: string; sleep_hours: null;          comment: string | null; habit_id: null;           created_at: string; updated_at: string }
  | { id: string; kind: 'note';       date_key: string; occurred_at: string; mood_value: number; mood_scale_version: string; sleep_hours: null;          comment: string;        habit_id: null;           created_at: string; updated_at: string }
  | { id: string; kind: 'reflection'; date_key: string; occurred_at: string; mood_value: number; mood_scale_version: string; sleep_hours: null;          comment: string | null; habit_id: string | null;  created_at: string; updated_at: string };

// Discriminated union over the unified text_library table
export type TextLibraryItem =
  | { id: string; kind: 'quote'; text: string; author: string | null; is_active: number; created_at: string; updated_at: string };
  // future kinds: 'question', 'mantra', ...

export interface WeeklyReview {
  id: string; week_key: string; week_start: string;
  mood_avg: number | null; sleep_avg: number | null;
  top_habits_json: string; answers_json: string;
  created_at: string; updated_at: string;
}

export interface BackupData {
  version: number;                    // bump to 2
  exportedAt: string;
  habits: Habit[];
  performed_habits: PerformedHabit[];
  daily_assignments: DailyAssignment[];
  mood_log: MoodLogEntry[];           // NEW v2 — replaces mood_entries; covers morning/evening/note/reflection
  text_library: TextLibraryItem[];    // NEW v2
  weekly_reviews: WeeklyReview[];     // NEW v2
  // v1 backups also carry: mood_entries: MoodEntry[]
  // parseAndValidate maps v1 mood_entries → mood_log entries with kind='reflection' on restore
}
```

### Modified files

- `src/config/constants.ts` — `BACKUP_VERSION = 2`.
- `src/services/backupService.ts` — `parseAndValidate` accepts v1 backups by treating new arrays as `[]` when missing (graceful upgrade); rejects v>2. `buildBackupData` runs the new repo reads in `Promise.all`. `restoreData` passes new arrays through.
- `src/repositories/backupRepository.ts` — add `readAllMorningCheckins/...` and extend `restoreAllData` (clear + insert for each new table; transaction continues to wrap everything).

### Backward-compat invariant

A v2 app restoring a v1 backup MUST succeed (only old tables populated; new tables remain empty). The `parseAndValidate` change above guarantees this.

---

## 6. Migration Strategy — Single migration v2, atomic

**Decision:** One migration `migrationV2.ts` adds all five tables + indices in one transaction. Reject incremental per-feature migrations.

### Rationale

- The tables don't depend on each other in declaration order; there's no upside to splitting.
- Versioned migrations are cheap to add but expensive to coordinate (each phase would bump `user_version`, and a half-applied state is harder to reason about).
- One v2 means: a user on app version 1.0 who upgrades to 1.1 sees one atomic schema change.

### File

- `src/services/migrations/migrationV2.ts` (NEW) — mirrors `migrationV1.ts` shape:
  - `TARGET_VERSION = 2`
  - Reads `PRAGMA user_version`; if `< 2`, runs `migrationV2_addWellbeingTables(db)` inside `withTransactionAsync`.
  - On error: `console.error` and continue boot (D-06 convention from v1).
- `src/services/migrations/migrationV1.ts` (MODIFIED) — extend `runMigrations` dispatcher to call v2:
  ```ts
  if (current < 1) await migrationV1_dedupeAndIndex(db);
  if (current < 2) await migrationV2_addWellbeingTables(db);
  ```
  Or: rename the entry-point file (e.g., `migrations/index.ts`) and have it import both. Either way the dispatcher remains single.

### Integration with existing schema bootstrap

`db.ts:executeSchema()` currently CREATEs the four base tables with `IF NOT EXISTS`. Two options:

1. **Keep new CREATEs only in migration v2** (recommended). Fresh installs at v1.1 still go through `runMigrations`, which sets `user_version = 0 → 2`. Idempotent because of `IF NOT EXISTS`.
2. Add new CREATEs to `executeSchema` AND in migration v2. More duplication, marginal safety. Reject.

Pick option 1, matching how migration v1 is the sole owner of the partial UNIQUE INDEX.

---

## 7. Stats Integration — Extend, don't fork

**Decision:** Extend the existing `statsService.ts` with wellbeing aggregations and add a new screen *tab section* (not a new top-level tab) inside `StatsScreen`. The current Progreso tab already mixes habit stats, categories and weekly comparison; a "Bienestar" sub-section keeps users in one place.

### Files

**MODIFIED**
- `src/services/statsService.ts` — add functions:
  - `getMoodAverage(range: DateRange): Promise<number>`
  - `getMoodDistribution(range): Promise<Record<MoodBucket, number>>`
  - `getSleepMoodCorrelation(range): Promise<{ pearson: number; n: number }>`
  - `getHabitsOnGoodDays(range, threshold = 7): Promise<HabitFrequencyOnGoodDays[]>`
- `src/screens/StatsScreen.tsx` — add Bienestar sub-section component.

**NEW**
- `src/components/stats/WellbeingStatsSection.tsx` — chart components (sparkline, distribution bars). Uses existing chart approach (kept as-is per Out of Scope).
- `src/utils/correlation.ts` — pure Pearson helper (testable).

**Why not a new screen:** the existing Stats screen is the established place for analytics; bifurcating creates discoverability problems and duplicates date-range UI.

---

## 8. Timeline Aggregator — Read-time UNION, no denormalized events table

**Decision:** Build the timeline at read-time by querying the source tables and merging in the service. Reject a denormalized `events` table.

### Rationale

- A denormalized table doubles writes (every check-in, note, completion writes twice) and creates a synchronization invariant that can drift on backup restore.
- Per-day read volume is small (≤2 check-ins + N notes + M completions; N and M typically <30). A `UNION ALL` of typed selects is fast on indexed `date` columns.
- Adding the events table later is easy if profiling shows a problem; reverting from it is hard.

### File

**NEW**
- `src/services/emotionalTimelineService.ts` — public API:
  - `getTimelineForDate(date: string): Promise<TimelineEntry[]>`
  - `getTimelineForWeek(weekStart: string): Promise<TimelineEntry[]>`
- `src/types/index.ts` (MODIFIED) — add `TimelineEntry` discriminated union: `{ kind: 'morning' | 'evening' | 'note' | 'completion', timestamp, mood_value?, payload: ... }`.

The service composes reads from `morningCheckinRepository`, `eveningCheckinRepository`, `moodNoteRepository`, and the existing `taskRepository` (for completions with mood). It does NOT execute SQL itself; it orchestrates repos — strict layer boundary preserved.

### Journaling notebook

Same shape, different filter: `getJournalForDate(date)` returns `{ morning?, evening?, notes[], reflectionsFromCompletions[] }`. Lives in `emotionalTimelineService.ts` (close kin) or a sibling `journalService.ts` if it grows.

---

## 9. Stores — One new store, plus settings extension

**Decision:** Single new `useEmotionalStore.ts`. Reject a per-feature store split.

### Rationale

- The wellbeing features share state coupling: timeline reads ALL of them; updating a check-in invalidates the timeline view; the journaling screen aggregates across kinds. Multiple stores would force cross-store subscriptions.
- Mirrors the existing pattern: `useHabitStore` is one store for several related habit concepts (daily, library, reflections).

### Files

**NEW**
- `src/store/useEmotionalStore.ts` — actions and state (sketch):
  ```ts
  interface EmotionalState {
    // capture
    todayMorning: MorningCheckin | null;
    todayEvening: EveningCheckin | null;
    todayNotes: MoodNote[];

    // browsing
    selectedDate: string | null;
    timelineForSelected: TimelineEntry[];
    journalForSelected: JournalDay | null;

    // quotes
    quotes: Quote[];

    // weekly review
    currentWeekReview: WeeklyReview | null;

    // actions
    saveMorningCheckin(input): Promise<void>;
    saveEveningCheckin(input): Promise<void>;
    addMoodNote(input): Promise<void>;
    deleteMoodNote(id): Promise<void>;
    fetchTimelineForDate(date): Promise<void>;
    fetchJournalForDate(date): Promise<void>;
    addQuote/editQuote/archiveQuote(...): Promise<void>;
    saveWeeklyReview(weekStart, payload): Promise<void>;
    refreshToday(): Promise<void>;
  }
  ```

**MODIFIED**
- `src/store/useHabitStore.ts` — *no contract changes*. The emotional store reads from the habit store's `dailyItems` only via service composition (timeline service queries `taskRepository`); the two stores stay independent.

**Cross-store interaction rule:** stores never call each other. If a screen needs both, it subscribes to both. If a service needs habit + emotional data in one query, the service uses both repositories — not both stores.

---

## 10. Push Notifications Plumbing — explicit dependencies

```
SettingsScreen (toggle) ─→ useSettingsStore.setNotificationPref
                                    │
                                    ▼
                          notificationsService.rescheduleAll(prefs)
                                    │
                                    ▼
                          expo-notifications API
                                    │
                                    ▼
              tap → deep link to MorningCheckin/EveningCheckin/WeeklyReview screen
```

Permission edge cases (cover in PITFALLS.md):
- Permission denied: store the pref but skip scheduling; show a banner.
- Permission revoked between sessions: detect on boot via `getPermissionsAsync`, mark prefs as "needs re-auth".
- Time zone change / DST: expo-notifications reschedules from local trigger; document the limitation.

---

## 11. New vs Modified — Explicit File List

### NEW

| Path | Purpose |
|------|---------|
| `src/services/migrations/migrationV2.ts` | Atomic add of 5 wellbeing tables + indices |
| `src/services/notificationsService.ts` | Wrap expo-notifications |
| `src/services/emotionalTimelineService.ts` | Read-time aggregator (timeline + journaling) |
| `src/services/morningCheckinService.ts` | One-per-day upsert + queries |
| `src/services/eveningCheckinService.ts` | One-per-day upsert + queries |
| `src/services/moodNoteService.ts` | CRUD + day queries |
| `src/services/quoteService.ts` | CRUD + active filter |
| `src/services/weeklyReviewService.ts` | One-per-week upsert + queries |
| `src/repositories/morningCheckinRepository.ts` | SQL only |
| `src/repositories/eveningCheckinRepository.ts` | SQL only |
| `src/repositories/moodNoteRepository.ts` | SQL only |
| `src/repositories/quoteRepository.ts` | SQL only |
| `src/repositories/weeklyReviewRepository.ts` | SQL only |
| `src/store/useEmotionalStore.ts` | All wellbeing state |
| `src/config/mood.ts` | Mood scale SoT |
| `src/config/notifications.ts` | Channels, default times, copy |
| `src/components/shared/MoodPicker.tsx` | Shared mood UI |
| `src/components/modals/MorningCheckinModal.tsx` | Capture morning |
| `src/components/modals/EveningCheckinModal.tsx` | Capture evening |
| `src/components/modals/MoodNoteModal.tsx` | Capture free note |
| `src/components/modals/QuoteFormModal.tsx` | Create/edit quote |
| `src/screens/EmotionalTimelineScreen.tsx` | Day/week timeline view |
| `src/screens/JournalScreen.tsx` | Day-by-day notes notebook |
| `src/screens/QuotesScreen.tsx` | Mis frases de cabecera |
| `src/screens/WeeklyReviewScreen.tsx` | Weekly review form |
| `src/components/stats/WellbeingStatsSection.tsx` | Stats sub-section |
| `src/utils/correlation.ts` | Pearson helper |
| `src/utils/weekHelpers.ts` (if not extending dateHelpers) | ISO week-start computation |

### MODIFIED

| Path | Change |
|------|--------|
| `src/types/index.ts` | Add 5 entity types + `TimelineEntry` + extend `BackupData` |
| `src/config/constants.ts` | `BACKUP_VERSION = 2`; re-export from `config/mood.ts` for backward compat |
| `src/services/db.ts` | No schema change here (migration v2 owns it) — but verify `runMigrations` import path still valid |
| `src/services/migrations/migrationV1.ts` | Extend `runMigrations` dispatcher to call v2 (or move dispatcher to `migrations/index.ts`) |
| `src/services/backupService.ts` | `buildBackupData`/`parseAndValidate`/`restoreData` handle 5 new arrays; v1 backups upgrade gracefully |
| `src/repositories/backupRepository.ts` | Read + clear + insert for the 5 new tables in `restoreAllData` |
| `src/services/statsService.ts` | Add wellbeing aggregations |
| `src/store/useSettingsStore.ts` | Add `notificationPrefs` + `scheduledIds` slice; extend `partialize` |
| `src/screens/SettingsScreen.tsx` | Wire notification toggles to `notificationsService` |
| `src/screens/StatsScreen.tsx` | Mount `WellbeingStatsSection` |
| `src/components/modals/ReflectionModal.tsx` | Replace inline mood UI with `<MoodPicker />` |
| `App.tsx` | Call `notificationsService.rescheduleAll()` after `initDatabase()` |

---

## 12. Suggested Build Order (respects dependencies)

> Each phase ends with backup/restore round-trip verified, because that's the cheapest way to catch schema mistakes early.

**Phase A — Foundation (unblocks everything)**
1. Migration v2 + 5 empty tables landed.
2. `src/config/mood.ts` + `MoodPicker` component. Refactor `ReflectionModal` to use it (regression-test existing mood capture).
3. Extend `BackupData`, `buildBackupData`, `restoreData`, `parseAndValidate`. Round-trip a backup with empty new tables.

**Phase B — Capture (depends on A)**
4. Morning check-in: repo + service + modal + integration into Hoy or as a banner. Backup round-trip with data.
5. Evening check-in: ditto.
6. Mood notes: repo + service + modal + entry point. Backup round-trip.
7. Quotes: repo + service + screen + modal. Backup round-trip.

> At this point, **all data sources for the timeline exist**. Visualization can start.

**Phase C — Visualization (depends on B)**
8. `emotionalTimelineService` + `EmotionalTimelineScreen` (day view first, week after).
9. `JournalScreen` (reuses the same service).
10. `WellbeingStatsSection` in StatsScreen — mood avg + distribution first; sleep↔mood correlation and "habits on good days" after, since they need more data to be meaningful.

**Phase D — Reflection (independent of C; can parallelize with C if priority demands)**
11. Weekly review: repo + service + screen + question config.

**Phase E — Notifications (last because it needs all capture screens to deep-link)**
12. `notificationsService` + Settings UI wiring + deep links to capture screens.

### Critical dependency chain

```
migration v2 ─┬─► capture features (B) ─┬─► timeline (C8/C9) ─► stats (C10)
              │                          └─► weekly review (D) — independent of timeline
              └─► mood scale (A2) ──────► all capture features
                                          │
backup extension (A3) ◄────────────────── │  (must land BEFORE Phase B exits, else
                                          │   any user export loses new data silently)
                                          ▼
                                       notifications (E) — needs deep-link targets
```

**The cut-line.** Per PROJECT.md, if scope is squeezed, Reflexión (Eje C / weekly review) ships first because it's smaller and high-value. With this build order, Phase D can be lifted to run after A and a minimal capture surface (a single capture path), since weekly review doesn't depend on the timeline or stats. The architecture supports that pivot without rework.

---

## 13. Anti-Patterns to Avoid in v1.1

### Anti-Pattern 1: Polymorphic table to "save" on schema work
**What people do:** put morning/evening/notes in one `wellbeing_entries` table with a `kind` column.
**Why it's wrong:** every consumer must filter and branch; per-kind constraints (sleep_hours only on morning, UNIQUE(date) only on check-ins) become awkward CHECK clauses.
**Do this instead:** split tables. The `UNION ALL` cost is negligible at this volume.

### Anti-Pattern 2: Cross-store coupling
**What people do:** have `useEmotionalStore` import and call `useHabitStore` actions to refresh the daily view after a check-in.
**Why it's wrong:** breaks the unidirectional flow; subscribers stop getting predictable updates.
**Do this instead:** screens that show both subscribe to both. If a service genuinely needs both data domains, it composes repositories.

### Anti-Pattern 3: Denormalized timeline/events table
**What people do:** mirror every capture into an `events` table for fast reads.
**Why it's wrong:** doubles writes, creates a sync invariant that breaks on restore.
**Do this instead:** read-time `UNION ALL`. Only denormalize after profiling shows a real problem.

### Anti-Pattern 4: Inline mood UI per screen
**What people do:** copy ReflectionModal's mood slider into the morning check-in modal "for now".
**Why it's wrong:** scale changes (numeric → discrete) become N edits; emoji/label drift.
**Do this instead:** the `MoodPicker` component is the *only* way to capture mood, anywhere.

### Anti-Pattern 5: Notification IDs in SQLite
**What people do:** create a `scheduled_notifications` table to track expo-notifications IDs.
**Why it's wrong:** the OS, not us, owns these IDs' lifecycle (revocations, OS upgrades, uninstalls). DB will drift.
**Do this instead:** keep IDs in the settings store next to the prefs that produced them; reschedule on boot if needed.

---

## 14. Integration Points Summary

| Boundary | Communication | Notes |
|---------|---------------|-------|
| `useEmotionalStore` ↔ `useHabitStore` | None — independent | Screens subscribe to both if needed |
| `emotionalTimelineService` ↔ `taskRepository` | Direct service-to-repo | Timeline includes habit completions with mood |
| `notificationsService` ↔ `useSettingsStore` | Read prefs, write `scheduledIds` | Service is stateless wrt our store; store holds the reflection of OS state |
| `backupService` ↔ new repos | Through `buildBackupData`/`restoreData` | All five new tables MUST round-trip; verified per phase |
| Migration v2 ↔ existing schema | Independent CREATEs (no FK to existing tables yet) | Future: if a check-in needs to FK a habit, plan an additive migration v3 |
| Push notification tap ↔ navigation | Deep-link via React Navigation | Targets must exist before notifications ship (build order Phase E last) |

---

## 15. Quality Gate Checklist (this document)

- [x] Concrete file paths for every integration point (sections 11, 4, 5, 9)
- [x] New vs Modified explicit (section 11)
- [x] Build order respects dependencies (section 12)
- [x] Mood scale SoT named and located (`src/config/mood.ts`)
- [x] Backup/restore extension specified (section 5; `BACKUP_VERSION = 2`, graceful v1→v2)
- [x] Migration strategy named (single migration v2, atomic, dispatched from existing `runMigrations`)
- [x] Schema decisions justified vs alternatives (sections 2, 8)
- [x] Stores organization decided (one new `useEmotionalStore`; Settings extension)
- [x] Anti-patterns specific to this milestone (section 13)

---

## Sources

- `.planning/PROJECT.md` — milestone goal, priority cut-line (Reflexión first if scope squeezed), out-of-scope items.
- `.planning/codebase/ARCHITECTURE.md` — layer rules, error handling, persistence model.
- `.planning/codebase/STRUCTURE.md` — naming conventions, "where to add new code".
- `src/services/db.ts` — schema bootstrap, date helpers, migration entry point.
- `src/services/migrations/migrationV1.ts` — versioned-migration template (followed by v2).
- `src/services/backupService.ts` + `src/repositories/backupRepository.ts` — backup/restore extension surface.
- `src/store/useSettingsStore.ts` — file-persisted prefs pattern (followed for `notificationPrefs`).
- `src/types/index.ts` — entity-type extension surface.
- `src/config/constants.ts` — existing mood constants (`MOOD_MIN/MAX/STEP/DEFAULT_VALUE`); reused, not changed.

*Architecture research for: v1.1 Bienestar emocional integration*
*Researched: 2026-05-06*
