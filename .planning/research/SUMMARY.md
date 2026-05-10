# Project Research Summary

**Project:** Cozy Habits — v1.1 Bienestar emocional
**Domain:** React Native / Expo brownfield extension — emotional wellbeing capture, visualization & weekly reflection
**Researched:** 2026-05-06
**Confidence:** HIGH (stack + architecture); MEDIUM-HIGH on features/UX; MEDIUM on expo-notifications platform edges

## Executive Summary

v1.1 is an additive milestone on top of a layered, local-first React Native app (Expo 54, Zustand, expo-sqlite). Eight new features (A.1–A.4 capture, B.1/B.2/B.4 visualization, C.1 weekly review) plus configurable push notifications layer cleanly onto the existing Screen → Store → Service → Repository → SQLite stack. The integration shape matters more than any single feature: a single shared `MoodPicker` component, a single `getLocalDayKey()` helper, and a single migration v2 introducing five new wellbeing tables are the linchpins.

The recommended approach reuses everything already in the stack (existing `@react-native-community/slider`, `react-native-chart-kit` for line/bar/contribution graphs, `TextInput` for journaling, Zustand for flow state) and adds **only two dependencies**: `expo-notifications` (~0.32.17) and `@react-native-community/datetimepicker` (~8.4.x). No chart-library swap, no state-machine library, no rich-text editor, no second mood-input UI.

The dominant risks are subtle and correlated: (1) day-key drift across features (qu5 precedent); (2) mood scale shape change post-launch; (3) backup/restore version skew; (4) notification antipatterns (Android 12+ doze, orphan schedules, TZ change, dark-pattern copy); (5) wellbeing UX antipatterns (streak shaming, spurious correlations on small N). All have concrete mitigations in PITFALLS.md.

## Key Findings

### Recommended Stack

The v1.0 stack is preserved entirely. Only **two new dependencies** in v1.1:

- `expo-notifications@~0.32.17` — `DAILY` / `WEEKLY` recurring triggers; well under iOS 64-cap; OS-managed. Requires `app.json` plugin entry for Android icon. New dev-client build needed.
- `@react-native-community/datetimepicker@~8.4.x` — native time picker for Settings. Install both via `npx expo install`.

**Critical reuse decisions (no new package):**

- Mood input: extract `MoodPicker` shared component from the existing `ReflectionModal` `MoodSection`.
- Sleep input: reuse same Slider with bounds 0–14h step 0.25.
- Charts: `LineChart`, `BarChart` (sleep↔mood is a **bucketed bar**, not scatter — chart-kit has no scatter), `ContributionGraph` — all in existing `react-native-chart-kit@^6.12.0`.
- Check-in flow state: Zustand slices. No XState/react-hook-form.

### Expected Features

**Must have (table stakes):**
A.1 Morning check-in (mood + sleep + comment, idempotent 1×/day) · A.3 Evening check-in (symmetric) · A.2 Free-form mood notes (N/day, FAB) · B.1 Emotional timeline (day view) · Push notifications morning + evening · Unified MoodPicker (foundation).

**Should have (competitive differentiators):**
B.2 Wellbeing stats (mood avg + distribution + bucketed sleep↔mood, N≥14 gate) · B.4 Journaling notebook (calendar + swipe) · A.4 Phrases collection (widget-ready schema) · B.1 week view · B.2 Habits-on-good-days (uniquely possible because Cozy already has habit data).

**Cut first if pressed (per PROJECT.md):**
C.1 Weekly review · B.2 habits-on-good-days · push for weekly review.

**Defer (v2+):**
A.4 home-screen widget (Issue #20 future scope) · voice-to-text on notes · notification snooze · journal export.

**Anti-features (confirmed out):**
AI/NLP sentiment · proactive mood pushes · journal share · partner mode · daily prompts · "insights" cards · multi-dimensional mood · feeling tags · streaks/badges/social comparison.

### Architecture Approach

Brownfield integration that respects existing layers exactly.

**Key decisions:**

1. **Fully-unified mood schema (user decisions 2026-05-10).** Four tables: `mood_log` (kind=morning|evening|note|reflection, partial UNIQUE INDEX(kind, date_key) for check-ins, FK habit_id for reflections), `text_library` (kind=quote|future), `weekly_reviews`, `drafts`. Existing `mood_entries` is **migrated into `mood_log` with kind='reflection' and dropped** in migration v2 (atomic, rollback on failure). Driver: single source of truth for mood, modular toggles (v1.2), no split-brain queries, no future migration of accumulated reflection data.
2. **Mood SoT, no data migration.** Existing `mood_entries` already uses [1, 10] step 0.5; new tables adopt the same scale. New `src/config/mood.ts` re-exports constants + adds discrete labels. Shared `<MoodPicker>` is the only mood UI; `ReflectionModal` is refactored to use it.
3. **Single migration v2, atomic.** One `migrationV2.ts` adds all 5 tables + indices in one transaction. `mood_scale_version` column on every mood-bearing row from day 1.
4. **Single `useEmotionalStore`.** Mirrors `useHabitStore` pattern. Stores never call each other; services compose repositories.
5. **Read-time timeline aggregation** via `emotionalTimelineService` (UNION ALL). Reject denormalized `events` table.
6. **Notifications: new service + Settings slice.** Single `notificationsService.ts` is the only file calling `expo-notifications`. Scheduled IDs in `useSettingsStore`, not SQLite.
7. **BACKUP_VERSION = 2.** Graceful v1→v2 dispatcher; v1 backups treat new arrays as `[]`. Notification prefs stay in settings.json.

**Major components:** MoodPicker · Migration v2 · 5 repos + 5 services · `useEmotionalStore` · `emotionalTimelineService` · `notificationsService` + Settings slice · WellbeingStatsSection (sub-section in existing StatsScreen) · 4 new screens (EmotionalTimeline, Journal, Quotes, WeeklyReview).

### Critical Pitfalls

1. **Inconsistent "today" across features (qu5 precedent).** → Single `getLocalDayKey()` helper in `src/utils/date.ts`; forbid `toISOString().slice(0,10)` via grep/lint; capture day key at submit, not modal open; cross-midnight unit test.
2. **Idempotency race on check-ins.** → Schema-level UNIQUE INDEX + UPSERT; disable submit while in-flight.
3. **Mood scale shape change without versioning.** → `mood_scale_version` column on every mood-bearing row from migration v2 (default `'v1'`). Migrations never rewrite historical mood values.
4. **Backup version skew.** → Bump `BACKUP_VERSION = 2` in same commit as migration v2; graceful v1→v2 dispatcher; fixture tests both directions; Drive + local share dispatcher.
5. **Notification antipatterns** (Android 12+ doze, orphan schedules, TZ change, shaming copy). → Single `notificationsService`; persist all IDs by purpose; reconcile on foreground; channels at App.tsx boot before any schedule call; permission denied → banner, never re-prompt; **no "we miss you" copy, no streaks, no nag UI**; test only via `build-apk-local` skill.

**Other pitfalls (full list in PITFALLS.md):** timeline N+1 → single SQL UNION; text paste-bombs → 4000-char cap notes / 20000 journal; sleep edges → stepper 0–14h, NULL excluded from averages, key by wake-date; week boundaries → `weekStartsOn` setting + ISO `week_key` + DST test; mid-entry data loss → drafts table autosave; spurious correlations → hide until N≥14, never display r=, color-blind palette + non-color encoding.

## Implications for Roadmap

### Phase 1: Foundation
**Rationale:** Mood scale, day-key helper, migration v2, and backup extension are mutually entangled and must land together.
**Delivers:** `getLocalDayKey()` · `src/config/mood.ts` + `MoodPicker` (refactor `ReflectionModal`) · `migrationV2.ts` (5 tables + indices + `mood_scale_version` column) · `BACKUP_VERSION = 2` + graceful dispatcher + fixture tests · `drafts` table · `tone-of-voice.md`.
**Avoids:** Pitfalls 1, 2, 3, 4.

### Phase 2: Capture (Eje A)
**Rationale:** No visualization without capture data. Captures are the source of every B/C feature.
**Delivers:** A.1 Morning check-in (UPSERT, draft autosave) · A.3 Evening check-in · A.2 Free-form notes · A.4 Phrases. Backup round-trip per feature.
**Implements:** 4 repos + 4 services + 4 modals; extends `useEmotionalStore`.

### Phase 3: Visualization (Eje B) ‖ parallelizable with Phase 4
**Rationale:** Pure consumers of capture data; B.1 highest-leverage.
**Delivers:** B.1 Timeline (day → week) via `emotionalTimelineService` · B.4 Journal notebook · B.2 Stats sub-section in StatsScreen (mood avg + distribution first; sleep↔mood + habits-on-good-days after with N≥14 gate).

### Phase 4: Reflection (Eje C — Weekly Review)
**Rationale:** Independent of timeline/stats. Per PROJECT.md cut-line, ships first if scope squeezed (architecture supports the pivot).
**Delivers:** `WeeklyReviewScreen` · auto-summary block · 2-mode UI (Quick/Full) · 3 skippable prompts · idempotent per ISO `week_key` · `weekStartsOn` setting + `src/utils/week.ts` with DST test.

### Phase 5: Notifications
**Rationale:** Last because deep-link targets must exist.
**Delivers:** `notificationsService.ts` (single owner) · `app.json` plugin + Android `SCHEDULE_EXACT_ALARM` · Settings UI + native time pickers · channel creation at App.tsx boot · `rescheduleAll()` after `initDatabase()` · foreground reconciliation (TZ change, orphan cleanup) · permission-denied banner. Real-device overnight QA via `build-apk-local`.
**Uses:** The two new dependencies (`expo-notifications`, `datetimepicker`).

### Phase Ordering Rationale
- Foundation must be first — day-key/scale/migration/backup are entangled; partial landing risks silent data loss.
- Capture before visualization — B.x can't be tested without data; A.4 is independent and can ship as warm-up within Phase 2.
- Phases 3 and 4 parallelizable across worktrees.
- Notifications last — deep-link targets must exist; highest platform-edge risk benefits from tight scope.
- **Cut-line pivot:** Foundation → minimal Capture (A.1) → Reflection → fill in remaining. Architecture supports without rework.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Notifications):** expo-notifications platform edges are MEDIUM-confidence. Verify Android 12+ `SCHEDULE_EXACT_ALARM` flow, channel creation order, TZ-change reconciliation, multi-fire bug (#34782) on real device.
- **Phase 4 (Weekly Review):** prompt design + 2-mode UI MEDIUM-confidence. UX research pass on Spanish prompt phrasing + tone review before locking copy.

Phases with standard patterns (skip phase research):
- **Phase 1 (Foundation):** SQLite migration + backup version bump are well-trodden in this codebase (migration v1, backup v0→v1 are direct precedents).
- **Phase 2 (Capture):** Modal/form/repo/service patterns exist in `ReflectionModal` and habit CRUD.
- **Phase 3 (Visualization):** chart-kit + StatsScreen are integration points; bucketed-bar approach researched and locked.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7 + `expo/expo@sdk-54` repo + repo grep. Only 2 new deps. |
| Features | MEDIUM-HIGH | Competitor patterns well-documented; Spanish prompt phrasing needs Phase 4 validation. |
| Architecture | HIGH | Grounded in `src/`; conventions from `.planning/codebase/`. Schema decisions justified vs alternatives. Mood SoT validated against existing `mood_entries`. |
| Pitfalls | HIGH for code-level (qu5, idempotency, scale-version, backup, timeline, sleep, week, drafts) — direct codebase precedents; MEDIUM for expo-notifications edges; MEDIUM for UX antipatterns. |

**Overall:** HIGH for proceeding to roadmap.

### Gaps to Address
- Notifications platform-edge verification → Phase 5 research + real-device overnight QA via `build-apk-local`.
- Tone-of-voice in Spanish → Phase 1 deliverable `tone-of-voice.md`; revisit per phase.
- Weekly review prompt design → Phase 4 UX spike.
- FTS5 search for journal → decide in REQUIREMENTS phase; if deferred, cap entries < 1k or add in v1.2.
- Color-blind stats palette → Phase 3 design pass.
- Soft-delete vs hard-delete → Phase 2 REQUIREMENTS.

## Sources

### Primary (HIGH)
- Context7 `/websites/expo_dev_versions_sdk_notifications`
- `expo/expo@sdk-54` repo — version pinning
- `https://docs.expo.dev/versions/v54.0.0/sdk/date-time-picker/`
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONCERNS.md`, `INTEGRATIONS.md`
- Repo verification: `src/services/db.ts`, `migrations/migrationV1.ts`, `backupService.ts`, `backupRepository.ts`, `useSettingsStore.ts`, `types/index.ts`, `config/constants.ts`, `ReflectionModal.tsx`
- `.planning/PROJECT.md`

### Secondary (MEDIUM)
- MeasuringU, UXPA Journal — scale design
- Daylio, Stoic, Day One, Diarly, Mudo, Bearable, iMoodJournal, FitRest — competitor patterns
- Material 3 / Mobbin — FAB best practices
- Todoist, Ness Labs, Koder.ai — weekly review patterns
- expo-notifications GH #34782, #10700, #3946; Medium "Making Expo Notifications Actually Work…"

### Tertiary (LOW — needs validation)
- N=14 correlation threshold — heuristic, no cited study
- Spanish prompt phrasing — design in Phase 4

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*
