# Roadmap: Cozy Habits

## Milestones

- ✅ **v1.0 Bug Fixes, Tech Debt & Cloud Backup** — Phases 1-4 (shipped 2026-05-05) — see [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Bienestar emocional** — Phases 1-5 (planning) — capture mood/sleep, visualize timeline & stats, weekly reflection, push notifications

## Phases

<details>
<summary>✅ v1.0 Bug Fixes, Tech Debt & Cloud Backup (Phases 1-4) — SHIPPED 2026-05-05</summary>

- [x] Phase 1: Bug Fixes (2/2 plans) — daily assignment correctness (UTC iteration, isFutureDate utility, spontaneous guard, category validation)
- [x] Phase 2: Tech Debt (3/3 plans) — typed SpeechModule, centralized category parsing, explicit sanitize functions
- [x] Phase 3: Google Drive Backup (3/3 plans) — OAuth bootstrap, Drive transport + Settings UI, restore flow with safety cache
- [x] Phase 4: Habit Creation Audit & Duplicate Cleanup (4/4 plans) — versioned migration v1, partial UNIQUE INDEX, visibility-aware reads (D-01 Opción B)

**Known deferred items:** 7 (see STATE.md "Deferred Items" — UAT/Verification gaps for Phases 02-04 + 1 abandoned debug session + 1 unresolved quick task)

</details>

### 🚧 v1.1 Bienestar emocional (Phases 1-5)

- [ ] **Phase 1: Foundation** — Mood scale unification, day-key helper, migration v2 (`mood_log` + `text_library` + `weekly_reviews` + `drafts` + `mood_scale_version` col), backup v2 dispatcher
- [ ] **Phase 2: Capture** — Morning check-in, evening check-in, free-form mood notes, frases de cabecera (4 capture surfaces)
- [ ] **Phase 3: Visualization** — Emotional timeline (day/week), wellbeing stats (mood, sleep, correlations), journaling notebook
- [ ] **Phase 4: Reflection** — Weekly review with auto-summary + skippable prompts, idempotent per ISO week (cut-line candidate)
- [ ] **Phase 5: Notifications** — Configurable push reminders for morning, evening, weekly review (last; deep-links into existing screens)

## Phase Details

### Phase 1: Foundation
**Goal**: Establish the cross-cutting primitives every wellbeing feature depends on, in a single atomic step
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. Every "today" computation in the app uses a single `getLocalDayKey()` helper (no `toISOString().slice(0,10)` in the codebase)
  2. The shared `<MoodPicker>` component is the only mood-input UI (existing `ReflectionModal` refactored to use it; identical scale across all surfaces)
  3. Database boots at `user_version = 2` with the unified wellbeing tables (`mood_log` with partial `UNIQUE(kind, date_key)`, `text_library`, `weekly_reviews`, `drafts`) + `mood_scale_version` column on `mood_entries`
  4. A v1 backup imports cleanly into a v1.1 install with new tables empty, and a v2 backup round-trips through Drive and local export with `BACKUP_VERSION = 2`
  5. An in-progress check-in/note/review survives an app kill and is restored as a draft on reopen
**Plans**: TBD

### Phase 2: Capture
**Goal**: Users can record all four wellbeing data sources reliably, idempotently, and without losing in-progress text
**Depends on**: Phase 1
**Requirements**: MORN-01, MORN-02, MORN-03, MORN-04, MORN-05, EVEN-01, EVEN-02, EVEN-03, EVEN-04, NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, PHRA-01, PHRA-02, PHRA-03, PHRA-04, PHRA-05
**Success Criteria** (what must be TRUE):
  1. User can submit, edit, and delete the morning check-in (mood + sleep 0–14h step 0.25 + comment) with exactly one row per day
  2. User can submit, edit, and delete the evening check-in (mood + comment) with exactly one row per day
  3. User can create N notes per day from a Home FAB, edit/delete them, with text capped at 4000 chars and visible counter
  4. User can manage a library of frases (text + optional author) with full CRUD and a `getRandomQuote()` API ready for a future widget
  5. Every capture surface autosaves drafts and round-trips through backup/restore without data loss
**Plans**: TBD
**UI hint**: yes

### Phase 3: Visualization
**Goal**: Users see their captured wellbeing data as a coherent timeline, stats panel, and day-by-day journal
**Depends on**: Phase 2 (consumes capture data); parallelizable with Phase 4
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06, JOUR-01, JOUR-02, JOUR-03, JOUR-04
**Success Criteria** (what must be TRUE):
  1. User opens an emotional timeline showing today's mood points (morning + notes + habit completions with mood + evening) in chronological order, can navigate to previous days, and can toggle to a week view
  2. User sees a wellbeing stats sub-section with mood average over time, mood distribution, and sleep average, all driven by a single SQL aggregation per chart
  3. Sleep↔mood correlation and habits-on-good-days insights appear only when N ≥ 14 days of paired data exist; below the threshold an explanatory placeholder shows instead of misleading numbers
  4. User opens the journal notebook for any day and sees morning comment + notes + evening comment in chronological order, can swipe between days, and edits any entry from its original flow
  5. Empty days in timeline and journal render with a calm, non-shaming empty state (no "you missed" copy)
**Plans**: TBD
**UI hint**: yes

### Phase 4: Reflection
**Goal**: Users close their week with a guided review that combines auto-summary data with optional reflection prompts
**Depends on**: Phase 1 only (architecturally independent of Phases 2/3 capture surfaces — cut-line candidate per PROJECT.md)
**Requirements**: REVI-01, REVI-02, REVI-03, REVI-04, REVI-05, REVI-06
**Success Criteria** (what must be TRUE):
  1. User accesses the weekly review from Home (auto-prompt on closing day) or via a manual entry point
  2. The review screen shows a read-only summary of the week's mood average, top completed habits, and sleep average — sourced from existing stats logic
  3. User can answer or skip 2–3 guided wellbeing prompts individually; partial submissions are valid
  4. Exactly one review exists per ISO week (UPSERT by `week_key`); user can re-open and edit the existing review
  5. The `weekStartsOn` setting (Lunes / Domingo) is honored by `week_key` derivation and the review window
**Plans**: TBD
**UI hint**: yes

### Phase 5: Notifications
**Goal**: Users receive empathetic, configurable, non-manipulative push reminders that deep-link into existing capture/review screens
**Depends on**: Phase 2 (morning/evening deep-link targets) and Phase 4 (weekly review target — degrades gracefully if Phase 4 was cut)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. User configures morning, evening, and weekly review notifications independently from Settings (toggle + time picker; weekday picker for weekly)
  2. Tapping a notification deep-links into the corresponding screen with focus on the primary action
  3. When OS permission is denied, a non-intrusive banner explains how to enable it from system settings; the app never re-prompts aggressively
  4. On foreground, the app reconciles scheduled notifications: orphans are cancelled, TZ changes trigger reschedule, and stale daily/weekly entries refresh
  5. Notification copy is reviewed against the tone-of-voice doc — no "we miss you", no streak shaming, no false urgency
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status   | Completed  |
|-------|-----------|----------------|----------|------------|
| 1. Bug Fixes | v1.0 | 2/2 | Complete | 2026-05-05 |
| 2. Tech Debt | v1.0 | 3/3 | Complete | 2026-05-05 |
| 3. Google Drive Backup | v1.0 | 3/3 | Complete | 2026-05-05 |
| 4. Habit Creation Audit & Duplicate Cleanup | v1.0 | 4/4 | Complete | 2026-05-05 |
| 1. Foundation | v1.1 | 0/3 | Not started | - |
| 2. Capture | v1.1 | 0/4 | Not started | - |
| 3. Visualization | v1.1 | 0/3 | Not started | - |
| 4. Reflection | v1.1 | 0/2 | Not started | - |
| 5. Notifications | v1.1 | 0/2 | Not started | - |
