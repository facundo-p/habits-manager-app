# Feature Research — v1.1 Bienestar Emocional

**Domain:** Mood tracking + journaling layered onto existing habit tracker
**Researched:** 2026-05-05
**Confidence:** MEDIUM-HIGH (UX patterns well-documented across competitors; app-specific integration requires judgement)
**Scope:** 8 NEW features only (A.1, A.2, A.3, A.4, B.1, B.2, B.4, C.1). Existing habit/stats/backup features NOT re-researched.

---

## Cross-Cutting Foundation: Unified Mood Scale

Before per-feature analysis, this foundation drives every other decision and is the single most important architectural call.

### Recommendation: 5-point emoji scale, single shared component

**Levels:** Muy mal · Mal · Neutro · Bien · Muy bien (1–5 internal, emoji-rendered)

**Why 5 over 7:**
- MeasuringU and UXPA Journal research: 5-point items have higher data quality than 7- or 11-point scales; 7-point only outperforms with younger/more educated samples. For a personal wellness app with non-academic users, 5 is the sweet spot.
- 5 fits a single row of comfortable tap targets on phones (44pt min), 7 forces smaller targets or wrapping.
- Existing habit completion already captures mood — must use SAME 5 levels to make timeline (B.1) and stats (B.2) coherent. Migration risk if existing data uses different scale.

**Why emoji over numeric slider:**
- Emoji scales are "easy to understand and engaging" (MeasuringU). Slider invites over-precision (was today a 6.3 or a 6.7?) which is anti-friction.
- One-tap selection is the proven low-friction pattern (Daylio: full entry in 2 taps).

**Caveat from research:** Emojis are "sometimes prone to multiple interpretations." Mitigate with tiny label under each emoji ("Bien", "Mal") on first encounter; can fade to emoji-only after onboarding.

**Component contract (single source of truth):**
```
<MoodScale value={1-5 | null} onChange={(v) => …} size="sm" | "md" | "lg" />
```
Used by: habit completion (existing), morning check-in, evening check-in, free notes, weekly review. ZERO duplicate scales allowed.

**Dependency on existing app:** REQUIRES audit of current habit completion mood field. If it stored 1–5, no migration. If it stored anything else (1–10, free text, emoji string), migration is mandatory before A.1 ships.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any mood/journaling app. Missing = feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **A.1 Morning check-in: mood + sleep hours + comment** | Daylio, Stoic, Reflection.app all anchor on morning prompt; this is THE core gesture of the milestone | LOW-MED | One-tap mood + numeric stepper for sleep hours (decimal: 7.5) + optional comment. Idempotent: editing today's entry updates, doesn't create dup. Hard 1×/day cap. |
| **A.3 Evening check-in: mood + comment** | Symmetric to morning; Stoic explicitly uses morning/evening pair as a structuring frame | LOW | Same shape as A.1 minus sleep field. Reuse same form component, parametrize fields. |
| **A.2 Free-form mood note: text + mood + timestamp** | Daylio multi-entry per day, MoodTide, Mudo — N-per-day notes are standard | LOW-MED | FAB on home/timeline = primary entry point. Inline append on timeline = secondary. Editable + deletable. Auto-timestamp at create; not editable. |
| **B.1 Emotional timeline (day/week chronological)** | Day One, MoodTide, Mudo all have timeline/feed view; users expect chronology after capturing | MED | Merge 4 sources (morning/evening check-in, free notes, habit completions w/ mood) into single sorted feed. Day toggle / week toggle. Each item visually distinguished by source-icon. |
| **A.4 Phrases collection (text + optional author, listable)** | Quote apps (Quotes Widget, Simple Quote Widget) — list + add + delete is baseline | LOW | Simple CRUD list. Long-press or swipe to delete. Tap to view full. Issue #20 mentions widget — design data shape now to make later widget consumption trivial. |
| **B.4 Journaling notebook (day-by-day text view)** | Day One, Diarly, Notebook app — calendar nav + swipe-left/right between days is universal | MED | Aggregates all written content per day (morning comment + free notes + evening comment) into "page" view. Swipe horizontally between days. Empty days shown with subtle "no entries". |
| **C.1 Weekly review screen** | Reflection.app, Notion templates, Todoist weekly review pattern — well-established ritual | MED-HIGH | Auto-summary block (mood avg, top habits, sleep avg) + 2–3 reflection prompts. Save creates a "weekly journal entry" surfaced in B.4. |
| **Push notifications: morning, evening, weekly review** | Existing settings has notifications stub — users expect configurable schedule | LOW-MED | User picks time per channel. Tappable → opens correct screen. Snooze optional (defer to v1.2). |

### Differentiators (Competitive Advantage)

Where Cozy Habits can lead vs Daylio/Stoic by leveraging the EXISTING habit infrastructure.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **B.2 Habits-on-good-days correlation** | Daylio shows mood↔activities correlations but Cozy already has rich habit data — surfacing "habits present on your top-mood days" is unique here | MED-HIGH | "Top 3 habits associated with days where mood ≥ 4." Requires defining "good day" deterministically (avg mood per day, threshold). Requires min sample size guard (e.g. ≥7 days data) before showing — research is unanimous: small-N correlation = lies. |
| **B.2 Sleep ↔ mood correlation** | iMoodJournal, Bearable, FitRest all do this, but it's a high-signal pairing for THIS user (already opted into hábitos serios) | MED | Scatter plot or simple bucketed bar: avg mood at <6h, 6–7h, 7–8h, 8–9h, ≥9h sleep. Skip Pearson r — show pattern visually, no statistical jargon. Same min-sample guard. |
| **Mood-mood unification (one scale across entire app)** | Most competitors silo mood per feature; Cozy treats it as one signal across check-ins, notes, habit completions | LOW (spec) / MED (refactor) | The "single source of truth" rule is a competitive moat IF executed cleanly. Failure mode: habit completion has 1–10 internally and check-in has 1–5 → timeline becomes nonsense. |
| **Phrases (A.4) tied to widget-ready shape** | Quote widgets exist as separate apps (Quotes Widget, Simple Quote Widget) — bundling user's OWN phrases inside a habits/wellness app is unusual | LOW (data) | Even if widget ships in v1.2, design `phrases` table now: id, text, author?, created_at. Random pick = `ORDER BY RANDOM() LIMIT 1`. No tags, no categories yet (anti-feature). |
| **Weekly review surfaces habits-as-evidence, not opinions** | Most weekly-review apps (Reflection, Stoic) lean on prompts only. Cozy can pre-fill summary with HARD habit data | MED | "This week: completed 5/7 'Meditar', mood avg 3.8 vs last week 3.5, slept avg 7.2h." Then prompts. Numbers anchor reflection. |

### Anti-Features (Out of Scope — Confirmed)

User has explicitly excluded these. Documenting to prevent scope creep mid-build.

| Feature | Why Tempting | Why Problematic | Alternative |
|---------|--------------|-----------------|-------------|
| **AI/NLP analysis of note text** | "Sentiment from your writing" sounds magical | Privacy (text leaves device or local model bloats app); accuracy in Spanish poor; users feel surveilled | Mood is captured EXPLICITLY by user via scale — no inference needed |
| **Proactive mood-based push ("you seem down")** | Empathetic on paper | Triggers on small samples = creepy/wrong; ethical landmines (mental health adjacent) | Only scheduled, neutral pushes (check-in reminders) |
| **Journal export / share** | Standard feature in journaling apps | Ships responsibility (cloud storage, formatting, redaction); OOS for v1.1 | Backup already covers data preservation via Drive |
| **Collaborative tracking (partner mode)** | Couples wellness trend | 10× complexity (auth, sync, permissions); contradicts "local-first" | Solo only |
| **Daily prompts (changing question per day)** | Reflection.app does this well | Maintenance burden (curating prompts); can feel preachy; user explicitly excluded | Free-form comment field only; weekly review IS the structured prompt slot |
| **Pattern hints / "insights" cards** | Trendy ("You feel better on Tuesdays!") | False patterns from small N; condescending tone risk | Show raw stats (B.2); user draws own conclusions |
| **Voice-to-text for notes** | Speeds capture | Existing app has speech recognition for habits — could reuse, BUT adds testing surface and the friction-killing win is already covered by 1-tap mood + optional text | Defer to v1.2 if requested; reuse existing `useSpeechRecognition` hook |
| **Mood with multiple dimensions (energy/valence)** | Russell's circumplex is psychologically richer | Doubles tap count; undermines unified scale; over-engineered for personal use | Single mood dimension, 5 levels |
| **Multi-emoji "feeling tags" (anxious, calm, etc.)** | Daylio offers activity/emotion tags | Inflates schema, fragments stats, requires tag CRUD UI | Free-form comment captures nuance for those who want it |

---

## Feature Dependencies

```
[Unified MoodScale component]
    ├──required by──> [A.1 Morning check-in]
    ├──required by──> [A.2 Free notes]
    ├──required by──> [A.3 Evening check-in]
    ├──required by──> [C.1 Weekly review]
    └──required by──> [B.1 Timeline]   (for rendering)

[A.1, A.2, A.3 capture data]
    ├──feeds──> [B.1 Emotional timeline]
    ├──feeds──> [B.2 Wellbeing stats]
    ├──feeds──> [B.4 Journaling notebook]   (text fields only)
    └──feeds──> [C.1 Weekly review]   (summary block)

[Existing habit completion mood]
    ├──feeds──> [B.1 Timeline]   (as one of 4 sources)
    ├──feeds──> [B.2 Habits-on-good-days correlation]
    └──feeds──> [C.1 Weekly review]   (top habits, completion %)

[Existing daily assignments]
    └──enables──> [B.2 Habits-on-good-days correlation]

[A.1 sleep hours field]
    └──required by──> [B.2 Sleep↔mood correlation]

[C.1 Weekly review entry]
    └──surfaces in──> [B.4 Notebook]   (as a "weekly" page type)

[A.4 Phrases collection]
    └──independent──>   (no deps; isolated feature)

[Push notifications config]
    ├──triggers──> [A.1 Morning check-in]
    ├──triggers──> [A.3 Evening check-in]
    └──triggers──> [C.1 Weekly review]
```

### Dependency Notes

- **Unified MoodScale is the linchpin.** If habit completion currently stores mood in any format other than 1–5 numeric, a migration phase MUST precede all capture features. Otherwise B.1 and B.2 break.
- **B.1, B.2, B.4 are pure consumers.** They cannot be built or meaningfully tested before at least 2–3 days of capture data exists. Build capture (A.x) first, then visualization (B.x), then reflection (C.1).
- **C.1 depends on capture + stats infrastructure.** Weekly review summary block reuses existing stats logic (weekly comparison already in v1.0) PLUS new wellbeing stats from B.2.
- **A.4 is independent.** Can ship in any phase without blocking; good "warm-up" feature or filler if a phase has slack.
- **Sleep hours field (in A.1) is the ONLY new "structured" data field.** Skipping it cripples B.2's sleep correlation. Don't make sleep optional at the schema level — make it skippable in UI but with clear "skipped" state.
- **A.4 phrases data shape is forward-looking.** Even though widget is out of scope for v1.1, a flat schema (`id, text, author, created_at`) supports random pick today and widget consumption later with zero migration.

---

## MVP Definition (within v1.1 milestone)

User's stated cut priority: "si aprieta, sale Reflexión (Eje C) primero. Captura es base." This drives MVP shaping.

### Must Ship (v1.1 core)

- [ ] **Unified MoodScale component + audit/migration of existing mood field** — foundation, blocks everything
- [ ] **A.1 Morning check-in** — anchor of the milestone, generates sleep data for B.2
- [ ] **A.2 Free-form mood notes** — N-per-day capture, the most flexible primitive
- [ ] **A.3 Evening check-in** — completes morning/evening symmetric pair (Stoic pattern)
- [ ] **B.1 Emotional timeline (day view)** — minimum viable visualization to make capture feel valuable; week view can defer
- [ ] **Push notifications (morning + evening)** — without these, capture adoption tanks; weekly push can defer with C.1

### Should Ship (v1.1 if scope permits)

- [ ] **B.2 Wellbeing stats (mood avg + distribution + sleep histogram)** — the "show me my data" payoff
- [ ] **B.4 Journaling notebook** — high-value re-reading pattern, but B.1 timeline partially covers it
- [ ] **A.4 Phrases collection** — independent, low-risk, ship if slack exists
- [ ] **B.1 week view** — extension of day view

### Cut First If Pressed

- [ ] **C.1 Weekly review** — user explicitly flagged this as droppable ("Reflexión sale primero" if pressed). Highest complexity, most prompt-design judgement, biggest UX risk.
- [ ] **B.2 habits-on-good-days correlation** — most complex stat; requires sample-size guards. Sleep↔mood is simpler and equally valuable.
- [ ] **Push for weekly review** — only relevant if C.1 ships.

### Future (v1.2+)

- [ ] **A.4 home screen widget** for random phrase (Issue #20 future scope)
- [ ] **Voice-to-text on notes/comments** (reuse existing `useSpeechRecognition`)
- [ ] **Notification snooze**
- [ ] **Mood reminders if check-in missed N days** — careful: borderline anti-feature
- [ ] **Export weekly review as image/text** — share pattern

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified MoodScale (foundation) | HIGH (correctness) | LOW-MED | P0 |
| A.1 Morning check-in | HIGH | LOW-MED | P1 |
| A.2 Free-form notes | HIGH | LOW-MED | P1 |
| A.3 Evening check-in | MED-HIGH | LOW | P1 |
| B.1 Timeline (day) | HIGH | MED | P1 |
| Push: morning + evening | HIGH | LOW-MED | P1 |
| B.2 Sleep↔mood correlation | MED-HIGH | MED | P2 |
| B.2 Mood avg + distribution | MED-HIGH | LOW-MED | P2 |
| B.4 Notebook | MED-HIGH | MED | P2 |
| B.1 Timeline (week) | MED | LOW (extension) | P2 |
| A.4 Phrases collection | LOW-MED | LOW | P2 |
| B.2 Habits-on-good-days | MED | MED-HIGH | P3 |
| C.1 Weekly review | MED-HIGH | MED-HIGH | P3 |
| Push: weekly | LOW (depends C.1) | LOW | P3 |

**P0:** Foundation, blocks everything. **P1:** MVP. **P2:** Should ship. **P3:** Cut first if pressed.

---

## UX Patterns to Follow (per feature)

### A.1 / A.3 Check-ins
- **Two-tap completion (Daylio benchmark):** tap mood → tap save. Sleep + comment optional inline below.
- **Idempotent:** opening when today's check-in exists → edit mode, not new entry. Visible "already done today" affordance.
- **Friction kill switches:** sleep hours = numeric stepper (default last value), comment = optional, single field. No "title", no tags, no category.
- **Notification CTA → screen:** push tap deep-links to the form already focused on mood scale.

### A.2 Free-form notes
- **FAB primary, inline timeline-append secondary:** Material/iOS FAB anchored bottom-right is standard for "create new" (Material 3 Expressive guidance, Daylio).
- **Modal/sheet entry:** mood scale at top (required), text below (optional), timestamp shown but not editable.
- **List in timeline + edit on tap.** Long-press or swipe to delete with confirm.

### A.4 Phrases
- **Simple list screen + FAB to add.** No categories, no tags (anti-features).
- **Add form:** text (required, multiline), author (optional). That's it.
- **Tap row → full view (text large, author italic).** Long-press for edit/delete menu.
- **Future-widget data shape now:** the schema must support a future "random pick" widget query without migration.

### B.1 Emotional timeline
- **Vertical chronological feed**, latest at top OR earliest at top (decide once; Day One uses earliest-first within day, latest-first across days).
- **Source-icon left-rail per item:** sun (morning), moon (evening), pencil (free note), check (habit completion w/ mood). Visual scanning matters more than timestamps.
- **Day/week toggle at top.** Week view: collapsed cards per day with mood gradient strip (Daylio multi-entry pattern: gradient bar shows mood range).
- **Empty-day affordance:** subtle "Sin registros" with FAB call-out to "Agregar nota".

### B.2 Wellbeing stats
- **Mood avg over time:** simple line chart (existing chart lib reused). 7d / 30d / 90d toggles.
- **Mood distribution:** stacked horizontal bar (% of entries at each level).
- **Sleep↔mood:** bucketed bar chart, NOT scatter plot. X = sleep buckets (<6, 6–7, 7–8, 8–9, ≥9h), Y = avg mood. Visual, no math.
- **Top habits on good days:** ranked list ("On días buenos, completaste más: 1. Meditar  2. Caminar  3. Leer"). Hide if N < 7 days data.
- **Always show sample size** ("basado en 14 días"). Hide stats with N < threshold instead of showing misleading.

### B.4 Journaling notebook
- **Calendar entry point** (Day One pattern) → tap day → page view.
- **Horizontal swipe between days** (Diarly, Day One). Edge cases: future days disabled or grayed.
- **Page composition per day, top to bottom:** morning comment block, free notes (chronological), evening comment block. If C.1 ships, weekly review entries get their own page type accessible from week boundary.
- **Read-mode default, edit on tap** of a section.
- **Notebook aesthetic:** serif font for entry text, soft paper background (light theme) / muted dark (dark theme). Visual differentiation from rest of app reinforces the "this is the journal" mode.

### C.1 Weekly review
- **Trigger:** Sunday evening push (configurable day/time) OR manual entry from journal/stats screen.
- **Two-mode option (research-backed):** "Quick (5 min)" with prompts only, "Full" with auto-summary block + prompts. Default = quick.
- **Auto-summary block (top of screen):** mood avg this week vs last week, top 3 completed habits, avg sleep, # of free notes captured. Read-only data, no editing.
- **3 prompts (user-specified):** "¿Qué te dio energía?" / "¿Qué te drenó?" / "¿Qué cambiarías?". All skippable. Multiline text. Optional one-sentence "week in a phrase" + 1–5 week rating (Reflection.app pattern).
- **Save → entry surfaces in B.4 notebook as weekly-marked page.**
- **Idempotent per ISO week:** editing existing review updates; doesn't create a second.

---

## Antipatterns to AVOID (per feature)

### A.1 / A.3 Check-ins
- DON'T make multi-step wizards (mood screen → next → sleep screen → next → comment screen). Single scrollable form.
- DON'T require comment. Optional means optional.
- DON'T allow multiple submissions per day silently (creates duplicate-data hell in B.1/B.2).
- DON'T hide sleep field — even if user often skips, presence reminds them it matters for stats.

### A.2 Notes
- DON'T put mood selector AFTER the text field. Mood first = single tap to save if no comment needed.
- DON'T autosave drafts indefinitely. Either commit on close or discard with confirm.
- DON'T add tags/categories now (anti-feature).
- DON'T allow editing the timestamp — it represents when the user FELT this, not when they edited.

### A.4 Phrases
- DON'T introduce categories, tags, ratings, favorites. Flat list.
- DON'T require author. Optional.
- DON'T add sharing/export — anti-feature for v1.1.

### B.1 Timeline
- DON'T merge same-source consecutive items into "smart" groups. Show every item; the chronology IS the value.
- DON'T add filtering by source initially — adds UI complexity and undermines holistic view. Reconsider in v1.2 if requested.
- DON'T forget habit completions are a source. The whole point of unified mood is they appear here.

### B.2 Stats
- DON'T show stats with N < threshold (e.g., 7 days). Show "Necesitas más datos" instead. Small-N stats LIE and erode trust.
- DON'T compute Pearson r and show it. Users don't want correlation coefficients. Show the bucketed visual.
- DON'T claim causation in copy. "On good days you also do X" not "X causes good mood".
- DON'T add insights/hints copy ("¡Detectamos un patrón!") — anti-feature.

### B.4 Notebook
- DON'T paginate by entry (Day One older pattern). Paginate by DAY. One day = one page even if 5 notes.
- DON'T strip mood data from notebook view — keep mood emoji inline next to each note's text. The journal IS emotionally annotated.
- DON'T add rich text formatting (bold, headers). Plain text only — anti-feature.
- DON'T require entries to render the page. Empty days are valid; show calmly.

### C.1 Weekly review
- DON'T force linear flow (must answer prompt 1 before 2). All prompts skippable, any order.
- DON'T over-prompt (user said 2–3, research said 3–5 max). Stick to 3.
- DON'T show summary block with N < threshold. Hide stats blocks individually if data missing.
- DON'T notify on weekend mornings. Sunday evening or user-chosen — never assume.
- DON'T gamify (streak of weekly reviews, badges) — anti-feature direction.

---

## Existing-App Integration Map

What each new feature touches in the existing codebase (high-level — phase research will detail).

| New Feature | Existing Touch Point | Integration Type |
|-------------|----------------------|------------------|
| MoodScale component | Existing habit completion mood field | Audit + possible migration; replace any inline mood UI |
| A.1, A.2, A.3 | Settings (notifications stub), SQLite (new tables), Screen→Store→Service→Repository layered pattern | New tables, new stores, but follow existing architecture exactly |
| B.1 Timeline | Existing habit completion data (read-only) | Repository query unioning new + existing mood-bearing rows |
| B.2 Wellbeing stats | Existing stats infra (heatmap, weekly comparison) | New stats screen sibling to existing; reuse chart library |
| B.2 Habits-on-good-days | Existing daily assignments table | Read-only join; existing data is sufficient |
| B.4 Notebook | None directly (consumes A.1/A.2/A.3 + C.1 text fields) | New screen; pure consumer |
| C.1 Weekly review | Existing weekly comparison stats; A.1/A.2/A.3 capture data | Reuses weekly stats logic; new "weekly_reviews" table |
| Push notifications | Existing notifications stub in Settings | Promote stub to real expo-notifications integration |
| All write features | Existing backup/restore (Drive + JSON export) | New tables MUST be added to backup payload + restore deduplication logic — easy to forget |

**Critical reminder:** v1.0 just shipped backup/restore. Every new SQLite table MUST be added to:
- Backup serialization
- Restore deserialization
- Restore deduplication (`restoreData` already deduplicates — extend to new tables)
- Migration version bump (`PRAGMA user_version` next increment)

Missing this means new wellbeing data doesn't back up. Highest-risk silent failure mode in this milestone.

---

## Sources

- [MeasuringU — Face Emoji vs Numeric Scales](https://measuringu.com/numbers-versus-face-emojis/) — emoji scales engaging but interpretation-prone; use labels initially
- [UXPA Journal — UX Rating Scales: 7, 11, 101 points](https://uxpajournal.org/user-experience-rating-scales-points/) — 5-point items have higher data quality than 7+
- [AndroidPolice — Daylio mood tracking review](https://www.androidpolice.com/i-used-daylio-track-moods-for-month/) — two-tap entry pattern
- [Daylio official](https://daylio.net/) — multi-entry/day, gradient bar for ranged moods
- [Mindful Suite — Best journaling apps 2026](https://www.mindfulsuite.com/reviews/best-journaling-apps) — Stoic morning/evening pair pattern
- [Reflection.app on Google Play](https://play.google.com/store/apps/details?id=app.reflection.reflection) — AI weekly summaries (we deliberately don't do AI but the structure is informative)
- [Day One Calendar View](https://dayoneapp.com/features/calendar-view/) — calendar entry to journal pages
- [Diarly — creating new entries](https://diarly.app/help/creating-new-entries/) — swipe left/right between day entries
- [Notebook — Diary & Journal App](https://apps.apple.com/us/app/notebook-diary-journal-app/id654645301) — page-turning aesthetic
- [Mudo iOS mood tracker](https://mudoapp.com/) — calendar + timeline review patterns
- [Moodistory](https://moodistory.com/) — year-in-pixels drill-down navigation
- [iMoodJournal](https://www.imoodjournal.com/) — mood↔sleep correlation as core feature
- [Bearable](https://bearable.app/) — habit↔symptom↔mood correlations
- [FitRest sleep & health tracker](https://apps.apple.com/us/app/fitrest-sleep-heart-rate/id6751546749) — 14-day trend visualization
- [Material 3 — Floating Action Button](https://developer.android.com/develop/ui/compose/components/fab) — FAB for primary create action
- [Material 3 Expressive FAB Menu](https://medium.com/@renaud.mathieu/discovering-material-3-expressive-fab-menu-ecfae766a946) — multi-action FAB pattern (relevant if A.2 + check-in share FAB)
- [Mobbin FAB best practices](https://mobbin.com/glossary/floating-action-button) — anchoring and single-action principle
- [Todoist — The Weekly Review](https://www.todoist.com/productivity-methods/weekly-review) — structured weekly review ritual
- [Ness Labs — Power of weekly review](https://nesslabs.com/weekly-review) — review framing/cadence
- [Koder.ai — Mobile weekly review app design](https://koder.ai/blog/create-mobile-app-personal-weekly-reviews) — friction-reduction UX, two-mode (5min/deep) approach, 3–5 prompts max
- [Quotes Widget on Google Play](https://play.google.com/store/apps/details?id=com.ashwin.apps.android.quoteswidget) — random quote widget reference for A.4 future scope
- [Simple Quote Widget](https://simple-quote-widget-quote-of.en.softonic.com/android) — customizable quote widget patterns

---

*Feature research for: Cozy Habits v1.1 Bienestar emocional*
*Researched: 2026-05-05*
