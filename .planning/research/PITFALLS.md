# Pitfalls Research

**Domain:** Emotional wellbeing features added to React Native/Expo habit tracker (Cozy Habits v1.1)
**Researched:** 2026-05-05
**Confidence:** HIGH for code-level/integration pitfalls (grounded in CONCERNS.md + STACK), MEDIUM for expo-notifications behavioral edges (one WebSearch source), MEDIUM for UX/wellbeing antipatterns (industry consensus, no formal study cited)

---

## Critical Pitfalls

### Pitfall 1: Inconsistent "today" between morning check-in, evening check-in, mood notes, and habit completions

**What goes wrong:**
The morning check-in writes a row keyed by `today`, the evening check-in writes another, mood notes write `Date.now()` timestamps, and habit completions already use `getTodayPrefix()`. If each feature computes "today" with a different formula (UTC vs local, `toISOString().slice(0,10)` vs custom), a user opening the morning check-in at 23:55 and submitting at 00:01 ends up with the morning belonging to one day and the evening (and habits) belonging to another. Idempotency breaks: user can do "today's morning check-in" twice on consecutive calendar days because each invocation reads a different `today`.

**Why it happens:**
The codebase has prior history of exactly this bug (qu5: `getWeekBounds` used UTC, fixed to local). New developers cargo-cult `new Date().toISOString().slice(0,10)` (UTC) instead of using the existing local-prefix helper. Each feature is implemented in isolation in a separate phase by a separate dev/agent.

**How to avoid:**
- Single source of truth: extract/reuse `getTodayPrefix()` (or whatever name `assignmentService` uses) as `getLocalDayKey(date?)` in `src/utils/date.ts`. Every wellbeing feature MUST import this helper. Forbid `toISOString().slice(0,10)` via lint rule or grep check.
- Capture the day key at submit time, not at modal open time. Store both `day_key` (local YYYY-MM-DD) and `created_at` (epoch ms) on every wellbeing row.
- Day-boundary rule documented in `src/utils/date.ts` JSDoc: "A day starts at 00:00 local device time and ends at 23:59:59.999 local device time. We do not honor 'logical day' (e.g. 4am cutoff). DST transitions: trust the OS local clock."
- Add a unit test for each new table: "writing two entries 1 second apart across local midnight produces two distinct day_keys".

**Warning signs:**
- Mixed usage of `new Date().toISOString()` and `getTodayPrefix()` in PRs.
- Unique constraint violation reports from users at midnight.
- Stats screen shows mood for "yesterday" that was entered "today" by user perception.

**Phase to address:** Phase 1 (Foundation: shared mood scale + date helper + migration) — before any feature ships.

---

### Pitfall 2: Idempotency of 1/day check-ins implemented via "look-then-insert" race

**What goes wrong:**
Morning check-in handler runs `SELECT WHERE day_key = ?` then `INSERT`. If the user double-taps the submit button or backgrounds/foregrounds quickly, two INSERTs land before either SELECT sees the other → duplicate rows for the same day. Worse: during restore-from-backup, an older row is inserted and the live row remains, producing a "two morning check-ins for 2026-04-12" inconsistency.

**Why it happens:**
JS is single-threaded but DB calls are async; `await db.getFirstAsync` then `await db.runAsync` is not atomic. The pattern works 99% of the time and silently fails under stress. Expo SQLite does not surface this in dev because the dev cycle is fast.

**How to avoid:**
- Enforce at schema level. Migration adds `UNIQUE INDEX ON morning_checkin(day_key)` and `UNIQUE INDEX ON evening_checkin(day_key)` and `UNIQUE INDEX ON weekly_review(week_key)`.
- Use UPSERT (`INSERT ... ON CONFLICT(day_key) DO UPDATE SET ...`) — single statement, atomic. Mirrors the v1.0 pattern (`idx_unique_habit_date`).
- Disable submit button while request is in-flight (`isSubmitting` state).
- Mood notes (N/day) get a different schema: composite key `(day_key, created_at)` with no UNIQUE on day_key.

**Warning signs:**
- Test "submit twice in quick succession only writes one row" missing or skipped.
- Stats query for morning mood returns array of length > 1 for a single day.
- Restore test doesn't cover "import a backup over an existing DB with same-day entries".

**Phase to address:** Phase 1 (schema + migration). Verified by integration tests in every feature phase.

---

### Pitfall 3: Mood scale shape change after data exists

**What goes wrong:**
Phase 1 ships a 5-point scale (1–5). In Phase 4, UX research says 7-point is better, or research says emoji-only with no numeric mapping. Existing rows have `mood_value = 3`. A naive change either:
(a) re-renders old data on the new 7-scale → "3" becomes a low value when it was originally a midpoint;
(b) loses data because the new component doesn't accept value 3;
(c) silently succeeds but Stats correlations now mix two semantically different scales without a flag.

**Why it happens:**
Mood is stored as a raw integer with no scale-version tag. The shared `<MoodPicker>` component is parameterized by config but the DB column is not.

**How to avoid:**
- Persist `mood_scale_version` (TEXT or INT) on every row that stores a mood. Default `'v1'` for the initial scale.
- Mood scale defined in code as a const map `{ v1: { min:1, max:5, labels:[...] }, v2: {...} }`. Stats / timeline read scale_version per-row and rescale to a normalized 0–1 float for cross-version aggregation, or refuse to aggregate across versions and warn.
- Migrations never rewrite historical mood values. Rewriting destroys the user's emotional history (and is irreversible across backup boundaries).
- Lock scale before Phase 1 ships. If the team is uncertain, prototype with a fake-data screen first.

**Warning signs:**
- PR adds a new mood enum without touching DB columns.
- Stats correlation suddenly looks "weird" after a deploy.
- Component prop `scale` exists but DB doesn't store which scale was used.

**Phase to address:** Phase 1 (foundation). Lock the scale and add `mood_scale_version` column from the very first migration. Phase 6 (Stats) verifies aggregation handles versioning.

---

### Pitfall 4: Backup/restore version skew — old backups missing new wellbeing tables

**What goes wrong:**
v1.0 backup JSON has shape `{ habits, daily_assignments, performed_habits, mood_entries }`. v1.1 adds `morning_checkin`, `evening_checkin`, `mood_notes`, `quotes`, `weekly_review`, `sleep_entries`, ... A user with a v1.0 backup tries to restore in v1.1: either the restore crashes (reading undefined arrays) or it succeeds and silently leaves new tables empty (acceptable) but `BACKUP_VERSION` mismatch is not surfaced.

The reverse direction is worse: a v1.1 backup restored on a v1.0 device (user reinstalled an old APK) crashes or drops the new data without warning.

**Why it happens:**
`BACKUP_VERSION` exists but the restore validator hardcodes the v1.0 shape. New tables are added without bumping `BACKUP_VERSION` and without adding migration-on-restore logic.

**How to avoid:**
- Bump `BACKUP_VERSION` to `2` (or semver `1.1.0`) when wellbeing tables ship.
- `applyRestore` reads `version`, then dispatches: `if (version < 2) { restoreV1(data); /* new tables stay empty */ } else { restoreV2(data); }`. New tables explicitly default to `[]` when missing.
- Forward-incompatible backups (v2 backup on v1 app): show explicit error "this backup was created with a newer version of Cozy Habits" — do not partially apply.
- Add restore tests with fixture backups for every prior version. Keep fixtures forever.
- Drive cloud restore (`prepareRestore`/`applyRestore`) shares this dispatch logic — do not duplicate.

**Warning signs:**
- `backupRepository.ts` has hardcoded keys without iterating a registry.
- No test file `backup-v1-on-v1.1.test.ts`.
- `BACKUP_VERSION` constant unchanged in PR that adds tables.

**Phase to address:** Phase 1 (migration + backup schema bump in same commit). Verified by Phase that ships first user-facing wellbeing feature.

---

### Pitfall 5: Notification scheduling drift, double-fires, and orphaned schedules on Android 12+

**What goes wrong:**
Configurable push notifications for morning check-in (e.g. 8am), evening check-in (10pm), weekly review (Sunday 7pm). Multiple known expo-notifications failure modes converge:
1. **Doze mode / inexact alarms**: Without `SCHEDULE_EXACT_ALARM` permission on Android 12+, daily notifications drift by minutes-to-hours, especially overnight.
2. **Recurring notification multi-fire**: GitHub issue #34782 reports `repeats: false` ignored; daily schedules can fire multiple times.
3. **Orphan schedules on toggle-off**: User disables notifications in settings; code calls `setIsEnabled(false)` but forgets `Notifications.cancelAllScheduledNotificationsAsync()` (or only cancels the most recent identifier). Old schedules keep firing after "off".
4. **Time zone change while traveling**: Notification was scheduled for "08:00 in CET" but user flies to JST. Expo schedules use device-local trigger, so the user gets pinged at 08:00 JST, but day_key has already advanced — the morning check-in idempotency check sees "today" = a different day than user expects.
5. **Channel creation order**: Scheduling before channel creation drops notifications silently on Android.
6. **iOS background/Expo Go**: Push doesn't work in Expo Go on Android SDK 53+; local schedules work but with limits. Devs test in Expo Go and ship broken builds.
7. **Permission denial**: User denies once → permission prompt never shows again. App must detect, deep-link to OS settings.

**Why it happens:**
expo-notifications has many subtle platform divergences and known bugs. Devs treat scheduling as fire-and-forget and don't track schedule IDs.

**How to avoid:**
- Maintain a single `notificationService.ts` that is the only file calling `expo-notifications`. Other code calls `enableMorningReminder(time)` / `disableMorningReminder()`.
- Persist all scheduled notification IDs in a settings table or AsyncStorage keyed by purpose (`'morning'`, `'evening'`, `'weekly'`). On toggle-off, look up the ID, cancel that one, then call `getAllScheduledNotificationsAsync()` and cancel any leftover with matching `data.purpose` tag (defense in depth).
- On app foreground: reconcile. Read settings → read all scheduled → diff → cancel orphans, schedule missing.
- Android: create channel(s) at app boot, before any schedule call. Request `SCHEDULE_EXACT_ALARM` via `app.json` plugin config and at runtime; gracefully degrade if denied.
- Time zone: subscribe to `Localization` changes (or check on foreground) and re-schedule if `Intl.DateTimeFormat().resolvedOptions().timeZone` changed since last schedule. Store the TZ alongside the schedule.
- Permission flow: detect `status === 'denied'`, show explanation UI with deep link to settings (`Linking.openSettings()`). Never re-prompt — system blocks it.
- Test on real device with Doze enabled. Build via `build-apk-local` skill (per memory: never cloud builds), install, leave overnight.
- Disable battery optimization prompt: include opt-in onboarding card pointing user to ignore-battery-optimizations setting.

**Warning signs:**
- `Notifications.scheduleNotificationAsync` called from a screen component directly.
- Notification IDs not persisted.
- No test or manual QA for "toggle off → no more notifications appear".
- User reports "notifications stopped working" after a few days.

**Phase to address:** Notifications phase (likely Phase 5 or 7). Define notificationService API in Phase 1 even if not used yet.

Source: [expo-notifications GitHub issue #34782 (repeats:false ignored)](https://github.com/expo/expo/issues/34782), [Making Expo Notifications Actually Work on Android 12+ and iOS](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845), [Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/). Confidence MEDIUM (single-pass web search, not deeply verified per claim).

---

### Pitfall 6: Aggregating mood from N tables → N+1 queries, sort-merge bugs, slow timeline

**What goes wrong:**
The emotional timeline pulls from `morning_checkin` + `evening_checkin` + `mood_notes` + `performed_habits.mood` (legacy from v1.0). Naive impl: four `SELECT * FROM ...` calls in a service, then `.concat()` in JS, then `.sort()`. With a year of data and a few notes per day, this is ~2–4k rows materialized in JS for a single screen render.

Worse, sorting requires a comparable timestamp. Each table uses different fields (`created_at` ms vs `day_key` only vs `recorded_at`). Sort merges produce out-of-order entries. Pagination becomes a nightmare because each table has its own page cursor.

**Why it happens:**
Each feature ships with its own table and its own service. Timeline is added later and reaches into all of them. Devs use the easiest pattern (service-per-table, JS aggregation).

**How to avoid:**
- Define a unified `wellbeing_event` *view* in SQL (`CREATE VIEW`) that UNIONs all sources with normalized columns: `(source TEXT, source_id TEXT, day_key TEXT, occurred_at INTEGER, mood_value INTEGER, mood_scale_version TEXT, text TEXT, payload_json TEXT)`. Timeline query = single `SELECT * FROM wellbeing_event WHERE day_key BETWEEN ? AND ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?`.
- Every event row stores epoch-ms `occurred_at`. day-only entries (morning check-in submitted without exact time? unlikely) use `day_key + 09:00 local` as a deterministic fallback.
- Repository layer returns the view rows; service layer maps to UI types. Do not fan out to 4 services.
- For Stats correlations (sleep↔mood) use grouped SQL: `SELECT s.hours, AVG(mc.mood) FROM sleep_entries s JOIN morning_checkin mc ON s.day_key = mc.day_key GROUP BY s.hours`. Never do this aggregation in JS.
- Add `idx_wellbeing_event_day_key` and `idx_wellbeing_event_occurred_at`.

**Warning signs:**
- Service file has multiple `await Promise.all([listMorning(), listEvening(), listNotes()])` followed by `.flat().sort()`.
- Timeline screen lags > 200ms on real device with 6 months of data.
- Pagination shows duplicates at boundaries.

**Phase to address:** Phase 6 (Timeline / Stats) — define the view in the migration that adds the last source table, not after.

---

### Pitfall 7: Surveillance, over-prompting, and missed-day guilt UX

**What goes wrong:**
Two daily check-ins + N mood notes + weekly review + correlation stats can quickly feel like the app is *judging* the user. Specific failure modes:
- **Streak shaming**: "You broke your 12-day check-in streak". User skipped one day because they were depressed. App reinforces the depression.
- **Mood shaming**: "Your mood has been below average this week" — the app does not have the standing to tell the user how they should feel.
- **Over-prompting**: 8am notification, then 10pm notification, plus weekly. If user ignores 8am, do not nag at 9am, 10am, etc. Do not show "you missed your morning check-in" in-app banner.
- **Empty state passive aggression**: "You haven't journaled in 4 days". The journal should look the same after 1 day of absence and 30.
- **Retention dark patterns**: Push notifications framed as "we miss you!" or with fake personification. Wellbeing apps that do this are roundly criticized.
- **Forced numeric mood**: requiring a numeric mood to log a note. Sometimes the user just wants to write.

**Why it happens:**
Habit-tracker mental model (gamification, streaks) leaks into wellbeing features where it actively harms users. Engagement metrics (DAU) bias devs/PMs toward retention nudges.

**How to avoid:**
- No streaks on check-ins. No "X days in a row" counter. No red dots on missed days. The calendar shows "logged" or "not logged" with neutral coloring.
- Phrasing audit before ship: every notification body, every empty state, every stats label reviewed by 2+ humans for tone. Replace "you missed", "you should", "your mood is low" with descriptive "no entry yet for today" / "mood logged 3 of 7 days this week".
- Notifications: fire-and-forget. If user doesn't tap, no follow-up. No "second chance" notifications.
- Mood notes do NOT require a mood value — text-only entries are valid. (Schema: `mood_value INTEGER NULL`.)
- Allow the user to delete any entry, including "today's morning check-in I regret writing". No "undo only within 5 minutes" gates.
- Setting: "quiet mode" disables all notifications and stats correlations for as long as user wants, with one tap. Privacy/dignity feature.
- No share-out, no badges, no social comparison.

**Warning signs:**
- A PR introduces the word "streak" or "you missed" in copy.
- Stats screen has a "this week vs last week" delta with red/green colors on mood.
- Notification body reads as if from a person ("Hey! Don't forget...").

**Phase to address:** Every feature phase reviews copy + empty states. Capture in a `tone-of-voice.md` doc in Phase 1 alongside the mood scale spec.

---

### Pitfall 8: Free-form text storage — paste-bombs, performance, and silent corruption

**What goes wrong:**
- User pastes 200KB of text (article, log dump). The note row is huge, FlatList rendering chokes, Drive backup balloons.
- User pastes HTML/markdown that contains characters the timeline component renders unsafely (not XSS in a security sense for a local app, but layout breakage from emojis, RTL marks, zero-width joiners).
- Search across notes (planned in journaling) is `LIKE '%query%'` which is O(n) and gets slow at thousands of entries.
- iOS smart-quote autocorrect changes user text after submit (subtle but real).

**Why it happens:**
Devs build "just a `<TextInput multiline>` and a `text TEXT` column" and ship.

**How to avoid:**
- Hard cap text length at insert (e.g. 4000 chars for notes, 20000 for journal entries). Show counter in UI. Reject longer with an explanatory message; never silently truncate.
- Sanitize on display only for layout safety: strip control chars / zero-width / RTL override. Do NOT mutate stored text.
- For search, use SQLite FTS5 virtual table from day one (`CREATE VIRTUAL TABLE notes_fts USING fts5(text, content='mood_notes', content_rowid='rowid')`). Triggers keep it synced. Adds <5KB code, scales to 100k entries.
- Persist exactly what user typed; do not auto-trim, auto-capitalize, auto-period.
- For long entries, render in a virtualized list and lazy-render text body (preview = first 200 chars, "tap to expand").

**Warning signs:**
- DB row inspection shows >50KB text fields.
- Journaling screen jank on scroll.
- Search latency > 500ms.
- Bug reports of "my text changed after I saved".

**Phase to address:** Phase that ships notes/journal (likely Phase 2 or 4). FTS5 added in same migration as the table.

---

### Pitfall 9: Sleep tracking input edge cases

**What goes wrong:**
User reports "8 hours" of sleep. What does that mean?
- Decimals: 7.5? 7:30? Mixed unit input crashes parser.
- Out-of-range: typo "78" hours. Does the form accept it?
- Cross-midnight: bed at 23:00, wake at 07:00 — which day_key does this belong to? If keyed by *bedtime*'s date, the morning check-in (which expects to read "last night's sleep") looks at the wrong day.
- Multi-nap users (parents of newborns, shift workers): "I slept 4 hours, then 3 hours". Single field forces lying.
- Missing sleep: user forgot to log. Does Stats treat missing as 0 (destroying averages) or NULL?

**Why it happens:**
"Hours of sleep" looks trivially simple. The model leaks complexity at the boundary.

**How to avoid:**
- Decision document: sleep is keyed by **wake date** (the day the user woke up), not bedtime. Document this in `src/utils/sleep.ts`. Rationale: the morning check-in submits with `day_key = today`; sleep logged at the same screen attaches to the same `day_key`. User mental model: "sleep that ended this morning".
- Input: numeric stepper with 0.25h granularity, range 0–14. No free text. Reject programmatically values outside 0–24. Show "long sleep" copy at >12h to confirm not a typo.
- Multi-nap: out of scope for v1.1. Document explicitly in REQUIREMENTS.md so it's not a "missing feature" surprise.
- Stats: missing sleep = `NULL`, excluded from averages. Surface as "data available for 23 of 30 days". Never coerce NULL to 0.

**Warning signs:**
- Sleep field is `<TextInput keyboardType="numeric">` without validation.
- Stats screen averages NULL as 0.
- User support: "my sleep didn't show up in correlations".

**Phase to address:** Morning check-in phase. Validation contract reviewed before ship.

---

### Pitfall 10: Weekly review — "what is a week" and retroactive completion

**What goes wrong:**
- Week starts Sunday in US, Monday in EU. Hardcoding either alienates the other.
- User installs app on Wednesday. The first week is partial (Wed–Sun). Stats for "this week" look terrible because they include 2 missing days the user wasn't even using the app for.
- User completes weekly review on Monday for "the week that just ended". Then taps the previous-week button and gets confused — was their review filed under week N or week N+1?
- DST transition week: 7 days isn't 168 hours. `endOfWeek - startOfWeek = 167h` or `169h`. Date arithmetic done in ms breaks.
- Idempotency: weekly review per `week_key`. What's `week_key`? `YYYY-Www` ISO format works only if week-start is consistent.

**Why it happens:**
Calendar arithmetic is famously error-prone; it's easy to write `addDays(d, 7)` and call it a week.

**How to avoid:**
- Setting: `weekStartsOn: 0 (Sun) | 1 (Mon)`, default by device locale, user-overridable. Stored on settings. Every "week" computation reads it.
- `week_key` = ISO-8601-like `YYYY-W##` derived from week-start setting. Document the computation in `src/utils/week.ts` with a unit test for DST week + year boundary.
- Weekly review form is for the *previous* completed week by default (so user reflects on what just happened). Allow user to navigate back to fill in older weeks but show "submitted late" badge so they know.
- Partial first week: show "this week so far (3 of 7 days)" and disable the Submit button until day 7 OR allow "submit short week" with explicit acknowledgement.
- Use date library (`date-fns`) for week arithmetic; never raw ms math. Confirm in STACK.md it's already a dependency.
- Backfill weekly_review per `week_key` on settings-change (`weekStartsOn` changed) is OUT OF SCOPE — historical reviews keep their old key. Document.

**Warning signs:**
- `Math.floor(timestamp / (7*24*60*60*1000))` anywhere in code.
- `weekStartsOn` not in settings store.
- No DST-week test.

**Phase to address:** Weekly review phase. Define `week_key` helper in Phase 1 alongside `day_key`.

---

### Pitfall 11: Mid-entry app kill → data loss + optimistic UI desync

**What goes wrong:**
User is typing a long evening check-in. OS kills the app (memory pressure, low battery). Re-open: text is gone. Worse: optimistic UI showed "Submitted!" toast for half a second before the kill, but the row was never written.

**Why it happens:**
TextInput state lives in component state; not flushed to disk until submit. Optimistic UI fires the success toast before the await resolves.

**How to avoid:**
- Draft persistence: on every change (debounced 500ms), write `{ form_id: 'evening_2026-05-05', payload }` to a `drafts` table or AsyncStorage. On screen mount, hydrate from draft. On successful submit, delete draft.
- Confirm-then-toast: success UI fires *after* the DB INSERT awaits (no optimistic confirmation for wellbeing entries — confirmation theatre is harmful when data is lost).
- Indicate save state in UI: "Draft saved" / "Submitted". Borrowed from email composers.
- Restore screen flow: if user opens morning check-in and a draft exists, show "Resume draft from yesterday?" with explicit accept/discard.

**Warning signs:**
- TextInput value held only in `useState` with no persistence.
- Toast/haptic fires before `await save()`.

**Phase to address:** Each feature with text input (Phases 2, 3, 4). Drafts table created in Phase 1.

---

### Pitfall 12: Stats correlations on small N → spurious findings + causation framing

**What goes wrong:**
After 5 days of use, Stats screen shows "You feel better when you sleep more!" or "Days you exercised correlate with higher mood (r=0.83)!". With N=5, r=0.83 is meaningless noise. User believes it. User stops exercising for unrelated reasons, mood drops, app says "told you so". This is anti-scientific and harms the user's relationship with their own data.

Also: chart palette uses red=bad/green=good, fails for color-blind users (~8% male population).

**Why it happens:**
Devs implement Pearson correlation, see a number, render it as fact. No statistical literacy gate.

**How to avoid:**
- Minimum N gate: do not show correlation cards until N ≥ 14 days of *both* variables present. Show "not enough data yet" placeholder.
- Confidence intervals or qualitative bucketing only ("Days with > 7h sleep had higher average mood by X" with N shown). Never display r as a number with 2 decimals — implies false precision.
- Copy: "associated with" never "causes". Append "this is a pattern, not a cause" footnote.
- Color: use ColorBrewer color-blind-safe palettes. Do not encode meaning by color alone — also use icons, position, or labels.
- Add a `WellbeingDisclaimer` component shown once on first stats view: "This is not medical advice. Patterns shown here are descriptive, not diagnostic."

**Warning signs:**
- Stats screen renders a number labeled "correlation" or "r=".
- No `if (n < threshold) return <Placeholder/>` guard.
- Charts use `#ff0000` / `#00ff00` directly.

**Phase to address:** Stats phase (Phase 6). Color/copy review at PR time.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `mood_scale_version` column, store raw int | Migration is smaller, component is simpler | Cannot ever change scale without rewriting history or losing comparability | Never — add the column from day 1 |
| Skip FTS5 for note search, use `LIKE '%q%'` | One less migration step | Search performance cliff at ~5k entries; refactor later requires re-indexing | OK for journaling-only-search if cap < 1k entries enforced; otherwise add FTS5 now |
| Inline `getTodayPrefix`-equivalent in each new service | Ships feature without touching shared utils | Drift between features; reproduces qu5 timezone bug | Never — reuse existing helper |
| Optimistic UI on wellbeing submits (toast before await) | Feels snappier | Data loss is invisible to user; trust eroded if they notice | Never for wellbeing data |
| Fan-out service calls for timeline aggregation | Ships fast, easy to reason about per-feature | N+1 query, sort bugs, pagination mess; rewrite required | Acceptable for prototype gated behind feature flag; not for ship |
| Hardcode `weekStartsOn = 1` (Monday) | Skip a setting | Half the user base has off-by-one weeks | Never — use locale default and expose setting |
| Skip drafts table | One fewer table | Mid-entry data loss bug reports; user trust hit | OK only if forms are < 3 fields and < 1 minute typical fill time. Evening check-in fails this test |
| Don't bump BACKUP_VERSION when adding tables | One less file changed in PR | Restore crashes or silently drops data; users report "I lost my mood data" | Never |
| Schedule notifications without storing IDs | Code is cleaner | Cannot reliably cancel; orphan schedules from prior installs | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| expo-notifications (Android 12+) | Schedule without `SCHEDULE_EXACT_ALARM` permission | Add to app.json plugin config, request at runtime, gracefully degrade |
| expo-notifications (channels) | Schedule before creating channel | Create channels at app boot (App.tsx mount), before any schedule call |
| expo-notifications (toggle off) | Cancel only the latest scheduled ID | Persist all IDs by purpose; on disable, cancel + reconcile via `getAllScheduledNotificationsAsync` |
| expo-notifications (Expo Go) | Test in Expo Go and assume it works in dev build | Test only via `build-apk-local` skill (per memory: never cloud builds) |
| expo-sqlite migrations | Add column without bumping `PRAGMA user_version` | Use existing versioned migration runner; new migration = new version, atomic rollback |
| Google Drive backup | Add new tables without bumping `BACKUP_VERSION` | Bump version + add restore version dispatcher with fixture tests |
| expo-localization | Assume device timezone is stable | Listen for changes on foreground; re-evaluate notification schedules and refuse to bake TZ into stored timestamps (always store epoch ms + day_key local) |
| Zustand (settings store) | Read `weekStartsOn` directly in components | Selector hooks; settings changes propagate to derived stats via re-render |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| JS-side aggregation across mood sources | Timeline jank, > 200ms render | Single SQL view with UNION + indexed `occurred_at` | ~6 months of data on mid-range Android |
| `LIKE '%q%'` search over notes | Search lag, dropped frames | SQLite FTS5 virtual table from day 1 | ~5k entries |
| Re-rendering long journal entries inline | Scroll jank in notebook view | FlatList with `getItemLayout` + collapsed previews; full text on tap | ~200 entries with paragraph text |
| Recomputing correlations on every Stats render | Stats screen takes seconds to open | `useMemo` keyed on `(monthKey, dataVersion)`; consider memoized cache à la existing `loadStats` (see CONCERNS.md) | When rows × variables grows |
| Loading full year of timeline at once | Memory spike, OOM on low-end | Paginate by week; load on scroll | ~12 months × multi-source |
| Drive backup serializes everything synchronously | UI freezes during backup, especially with growing notes/journal | Stream serialization; show progress; cap journal/notes size or chunk | Backup > 1MB |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Store mood/journal in plain SQLite without considering rooted-device exposure | Sensitive emotional data readable by any other app on rooted device | Document risk in REQUIREMENTS.md; flag encryption as v1.2 work (already deferred per PROJECT.md). Never log note text or mood values to console |
| Include note text or mood in Sentry-style error reports | Privacy leak if observability ever added | None today (no error tracker); pre-emptively forbid in `notificationService` and `errorHandler` |
| Persist notification body with the user's text ("Don't forget your evening reflection: '<their last note>'") | Lockscreen leak | Notification body is generic; never echo user content |
| Backup file readable from share sheet without warning | User shares to public chat by accident | Confirm dialog before invoking `expo-sharing`; warn that file contains personal data |
| Clipboard auto-paste in mood input | Sensitive content from another app leaks into Cozy if user re-shares backup | No auto-paste; user-initiated only |
| Migration script logs row contents on failure | Sensitive text in console / device logs | Log row IDs and counts only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Streak counter on check-ins | Reinforces guilt on bad mental-health days | No streaks. Neutral "logged / not logged" calendar |
| "You missed yesterday" banner | Mood-shaming, retention manipulation | No nag UI. At most: silent calendar marker |
| Required mood value on every note | User who wants to vent is forced to quantify first | Mood value is optional on notes |
| One-shot "rate your mood now" without history visibility | Feels like data extraction, not reflection | After submit, show recent timeline so user sees their own pattern |
| Notification copy with personification ("We miss you!") | Manipulation, parasocial | Plain factual: "Morning check-in" |
| Progress bars on weekly review | Implies wellbeing is a quota | Open prompts, optional sections |
| Numeric mood without label | "What does 3 mean?" | Always show emoji + word + number together; consistent across screens |
| Hard-deleting entries with no undo | User panic, lost reflection | Soft delete with 7-day recoverable bin OR "are you sure?" + immediate hard delete (pick one and document) |
| Journaling notebook shows blank pages for days with no entries | Visually shaming | Skip blank days OR clearly label "no entry — that's okay" with neutral icon |
| Charts encode mood by color only | Color-blind users can't read | Color + icon + label triple-encoding |
| Forcing user into morning AND evening flow first-time | Onboarding fatigue | Let user pick: enable morning OR evening OR both OR none; default to none, opt-in |

## "Looks Done But Isn't" Checklist

- [ ] **Morning check-in:** Idempotent on rapid double-tap? Verified by submitting twice in 100ms in test.
- [ ] **Morning check-in:** `day_key` computed via shared local helper (not `toISOString`)? Verify by grep.
- [ ] **Mood scale:** `mood_scale_version` column exists on every mood-bearing table? Migration includes it.
- [ ] **Mood scale:** Stats correlation refuses or rescales when rows have mixed scale versions? Test with mixed fixture.
- [ ] **Notifications:** Toggle off cancels ALL scheduled IDs, including orphans from prior installs? Manual QA on real device.
- [ ] **Notifications:** Reschedule on app foreground when timezone differs from last-stored TZ? Unit test with mock localization.
- [ ] **Notifications:** Channel created before first schedule on Android? App.tsx boot sequence verified.
- [ ] **Backup:** v1.0 backup imports cleanly into v1.1 app with new tables empty? Fixture test in restore suite.
- [ ] **Backup:** v1.1 backup on v1.0 app shows version-too-new error? Fixture test.
- [ ] **Backup:** Drive backup export and local export both bumped to new BACKUP_VERSION? Verify in PR diff.
- [ ] **Timeline:** Single SQL UNION query, not JS aggregation? Verify in repository code.
- [ ] **Timeline:** Pagination doesn't duplicate entries at boundaries? Test with 3 sources × 30 entries.
- [ ] **Sleep:** Numeric input rejects > 24h and < 0? Form validation test.
- [ ] **Sleep:** Stats treats missing sleep as NULL, not 0? Verify in correlation query.
- [ ] **Weekly review:** `weekStartsOn` setting respected by `week_key`, stats, and review form? Three-way test.
- [ ] **Weekly review:** DST week (e.g. spring forward) computed correctly? Unit test with frozen DST date.
- [ ] **Notes:** Length cap enforced at insert with user-facing message? Form test.
- [ ] **Notes:** FTS5 index synced on insert/update/delete? Trigger test.
- [ ] **Drafts:** Mid-entry kill → reopen → form pre-filled? Manual QA + unit test.
- [ ] **Drafts:** Successful submit clears draft? Test.
- [ ] **Stats correlations:** Hidden when N < 14? Snapshot test.
- [ ] **Stats correlations:** Color-blind palette + non-color encoding? Visual review.
- [ ] **Tone:** All notification bodies, empty states, error messages reviewed for shaming language? Doc + checklist in PR template.
- [ ] **Privacy:** No note text or mood values logged to console? grep `console.log` on PR.
- [ ] **Privacy:** Notification body never includes user content? Code review.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate check-ins from missing UNIQUE INDEX | LOW | Add migration: dedupe by (day_key, MIN(rowid)), then add unique index. Same playbook as v1.0 `idx_unique_habit_date` |
| Mood scale changed without versioning | HIGH | Cannot recover historical intent. Best: add `mood_scale_version` defaulting to `'v1'`, treat all existing as v1, ship v2 forward only. Inform user via release note |
| Backup version skew breaks restore | MEDIUM | Add backward-compatible restore dispatcher in hotfix; ask affected users to re-attempt restore |
| Orphan notifications from prior install | LOW | On app start, call `getAllScheduledNotificationsAsync` and reconcile against settings; cancel any without matching purpose tag |
| Timezone-shifted day_key entries | MEDIUM | Cannot rewrite; document that historical entries reflect device-local time at moment of submit. Add `tz_at_submit` column going forward to make future migrations possible |
| Timeline N+1 performance | MEDIUM | Introduce SQL view in a migration, refactor service to query view, add indexes; no data change required |
| Notes balloon backup size | MEDIUM | Add length cap retroactively (reject longer on edit, keep existing); offer "compact backup" option that strips notes > N chars |
| Streak/shaming copy shipped | LOW | Hotfix copy in next release; apologize in release notes |
| Spurious correlation displayed | LOW | Add N gate guard; prior screenshots already shown to users — no recovery needed beyond release-note acknowledgement |
| Mid-entry data loss reported by users | MEDIUM | Add drafts table + autosave hotfix; cannot recover lost text |

## Pitfall-to-Phase Mapping

Phase numbering assumes a roadmap that opens with a foundation phase. Adjust to actual roadmap names.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Inconsistent "today" computation | Phase 1 (Foundation) | grep for `toISOString().slice(0,10)`; unit test crossing local midnight |
| Idempotency race on check-ins | Phase 1 (migration) + each check-in phase | UNIQUE INDEX present in schema; UPSERT used; double-submit test |
| Mood scale change without versioning | Phase 1 (Foundation) | `mood_scale_version` column on every mood-bearing table from first migration |
| Backup version skew | Phase 1 (migration that adds wellbeing tables) | `BACKUP_VERSION` bumped; v1.0→v1.1 fixture restore test passes |
| Notification scheduling drift / orphans / TZ | Notifications phase (likely Phase 5 or 7) | Single notificationService; ID persistence; reconciliation on foreground; real-device overnight QA |
| N+1 / slow timeline aggregation | Phase 6 (Timeline) | Single SQL view defined in migration; query plan reviewed |
| Surveillance / mood shaming UX | Every feature phase | Tone-of-voice doc; PR template checkbox; copy review by 2+ humans |
| Free-form text traps | Phases shipping notes/journal (likely 2 + 4) | Length cap test; FTS5 trigger test; no auto-mutation |
| Sleep edge cases | Morning check-in phase (likely 2) | Validation contract test; missing-sleep NULL handling test |
| Weekly review week boundaries | Weekly review phase (likely 7) | `week_key` helper test; DST week test; `weekStartsOn` setting wired through |
| Mid-entry data loss | Phase 1 (drafts table) + each text-entry phase | Draft autosave test; kill-and-restore manual QA |
| Spurious correlations + a11y | Stats phase (likely 6) | N gate test; color-blind palette in shared theme; copy review |
| Stats infrastructure extension breaks existing tests | Stats phase | New aggregations live behind new functions; existing `loadStats` signature unchanged; CI runs full pre-v1.0 stats test suite |

## Sources

- `.planning/PROJECT.md` (Cozy Habits v1.1 milestone, prior qu5 timezone bug history)
- `.planning/codebase/CONCERNS.md` (existing tech debt, fragile areas — esp. mood entry lifecycle, backfill timezone, JSON parsing scattering)
- `.planning/codebase/INTEGRATIONS.md` (existing local-only architecture, expo-sqlite/expo-file-system patterns)
- `.claude/CLAUDE.md` (project rules — small refactors, separation of concerns, lessons.md loop)
- `MEMORY.md` (build APKs locally only via `build-apk-local` skill)
- [expo-notifications GitHub issue #34782 — recurring notifications repeat:false ignored](https://github.com/expo/expo/issues/34782)
- [Making Expo Notifications Actually Work on Android 12+ and iOS (Medium)](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845)
- [Expo Notifications official docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [expo-notifications scheduleNotification timing issues — GH #10700](https://github.com/expo/expo/issues/10700)
- [Local notification multi-fire on Android — GH #3946](https://github.com/expo/expo/issues/3946)

Confidence per area:
- Idempotency / day_key / migrations / backup version skew: **HIGH** — directly grounded in existing CONCERNS.md patterns and v1.0 fixes already in repo.
- expo-notifications behaviors: **MEDIUM** — single web-search pass, multiple GitHub issues converging but not exhaustively verified.
- UX/wellbeing antipatterns: **MEDIUM** — industry consensus from wellbeing-app criticism; no specific empirical study cited in this research pass.
- Mood scale versioning, timeline aggregation, sleep edge cases, weekly week-boundary: **HIGH** — derived from general app-data-modeling principles plus this codebase's prior timezone bug.
- Stats correlation statistics gate: **MEDIUM** — defensible threshold (N=14) is a heuristic, not derived from a cited study.

---
*Pitfalls research for: Cozy Habits v1.1 Bienestar emocional*
*Researched: 2026-05-05*
