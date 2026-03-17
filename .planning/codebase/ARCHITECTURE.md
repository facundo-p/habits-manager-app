# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Clean Layered Architecture with Unidirectional State Flow

The application follows a clear separation of concerns across three distinct layers:
1. **Presentation Layer** (Screens, Components, Hooks)
2. **Business Logic Layer** (Services)
3. **Data Access Layer** (Repositories, Database)

State is managed centrally via Zustand stores, which orchestrate service calls and emit updates to the UI. Data flows unidirectionally: UI → Store → Services → Repositories → Database.

**Key Characteristics:**
- **Strict layer boundaries** - Only `services/` can execute SQL; repositories are "dumb" CRUD; screens delegate all logic to stores
- **Separation of concerns** - UI presentation in components, business logic in services, data access in repositories
- **Type-first design** - All domain entities defined in `src/types/index.ts`; types drive API contracts
- **Immutable snapshots** - `daily_assignments` table captures immutable state of habits for historical accuracy
- **Explicit state management** - Zustand stores (useHabitStore, useSettingsStore) are single source of truth
- **No direct database access from UI** - All database operations go through services → repositories chain

## Layers

**Presentation Layer (Screens & Components):**
- Purpose: Render UI and handle user interactions; delegate all side effects to stores
- Location: `src/screens/`, `src/components/`
- Contains: Screen components, layout components (AppBackground, BottomSheet), modals (HabitFormModal, ReflectionModal), shared UI (AreaPicker, MicButton)
- Depends on: `useHabitStore`, `useSettingsStore`, hooks (useFeedback, useSpeechRecognition)
- Used by: React Navigation stack/tab navigators
- **Pattern:** Functional React components with hooks; no styling in JSX (all in .styles.ts files); components are dumb consumers of store state

**Business Logic Layer (Services):**
- Purpose: Orchestrate repositories, validate inputs, compute derived state, implement business rules
- Location: `src/services/`
- Contains:
  - `db.ts` - Database initialization, schema creation, migrations, seed data, date/ID generation utilities
  - `habitService.ts` - Habit CRUD, completions, library operations
  - `assignmentService.ts` - Daily assignment generation, completion toggle, spontaneous habit handling
  - `moodService.ts` - Mood entry creation, retrieval, deletion
  - `statsService.ts` - Statistical aggregation (completion counts, streak calculations)
  - `backupService.ts` - Import/export of database state
- Depends on: Repositories (habitRepository, assignmentRepository, moodRepository, taskRepository, backupRepository)
- Used by: Zustand stores exclusively
- **Pattern:** Pure async functions; no class-based approach; services are orchestrators that coordinate multiple repositories; business rules and date resolution happen here

**Data Access Layer (Repositories):**
- Purpose: Execute SQL queries and mutations; no business logic, no transformation
- Location: `src/repositories/`
- Contains:
  - `habitRepository.ts` - CRUD for `habits` table
  - `assignmentRepository.ts` - CRUD for `daily_assignments` table
  - `moodRepository.ts` - CRUD for `mood_entries` table
  - `taskRepository.ts` - CRUD for `performed_habits` table (executed completions)
  - `backupRepository.ts` - Bulk export/import operations
- Depends on: `src/services/db.ts` (getDatabase, generateId)
- Used by: Services only
- **Pattern:** Each file maps to one table; SQL statements defined as constants; functions are thin wrappers around db.getAllAsync/getFirstAsync/runAsync

**State Management (Zustand Stores):**
- Location: `src/store/`
- `useHabitStore.ts`: Central store for habit operations (daily view, library, reflections)
  - Maintains: `dailyItems`, `dailyStats`, `libraryHabits`, `pendingReflection`, `viewDate`
  - Triggers: All habit operations (toggle, add spontaneous, CRUD habits)
  - Coordinates: assignmentService, habitService, moodService
- `useSettingsStore.ts`: Persistent settings (haptics, sounds, language)
  - Uses custom file storage via expo-file-system
  - Survives app restarts

**Database Layer (SQLite):**
- Purpose: Durable storage of all application state
- Location: `src/services/db.ts`
- Tables:
  - `habits` - Master habit templates (name, frequency, base_points, categories)
  - `daily_assignments` - Snapshots of habits for each day (immutable once created; represents "what should the user do today?")
  - `performed_habits` - Record of completed habits (linked to assignments; stores reflection/mood data)
  - `mood_entries` - Mood values linked to habits
- Key Pattern: **Time Capsule Design** - `daily_assignments` captures the state of each habit on each day so historical data remains accurate even if the habit definition changes

## Data Flow

**Daily Habit Completion Flow:**

1. User taps checkbox on DailySheetScreen
2. Screen calls `store.toggleItem(dailyItem)`
3. Store dispatches to `assignmentService.completeAssignment(item)`
4. Service calls:
   - `assignmentRepository.setCompleted(assignmentId, true)` - Mark assignment complete
   - `taskRepository.insert()` - Create performed_habit record
5. Store refreshes daily view:
   - `assignmentService.getItemsForDate()` - Fetch daily assignments, enrich with performed data
   - `assignmentService.getPointsForDate()` - Calculate totals
6. Store emits update → Screen re-renders
7. If habit has `habitId`, store opens ReflectionModal for mood/description capture
8. User saves reflection → `moodService.createMoodEntry()` + `habitService.updatePerformedDescription()`

**Library Habit Creation Flow:**

1. User opens HabitLibraryScreen → `store.fetchLibrary()`
2. Store calls `habitService.getAllHabits()` + `habitService.getCompletionCounts()`
3. Service calls `habitRepository.findAll()` + `taskRepository.countByHabit()`
4. Store returns enriched list with completion counts
5. User clicks "Add" → `store.addHabit(formData)`
6. Store calls `habitService.createHabit()` → `habitRepository.insert()`
7. Store calls `assignmentService.addAssignmentForHabit(habitId)` to create today's assignment
8. Store calls `store.refreshAll()` to reload both daily and library views

**Historical View Flow:**

1. User navigates to past date via StatsScreen
2. StatsScreen calls `store.setViewDate(dateString)`
3. Store updates `viewDate` (null = today, otherwise YYYY-MM-DD)
4. DailySheetScreen refetches with `store.fetchHabitsForDate(store.viewDate)`
5. Service calls `assignmentService.getItemsForDate(dateString)`
6. Repository fetches `daily_assignments WHERE date = dateString`
7. Displays immutable snapshot of that day's assignments and completions

**State Management:**

- Single source of truth: Zustand stores
- Reads: Screens read state via hook subscriptions (e.g., `const items = useHabitStore(s => s.dailyItems)`)
- Writes: Screens call store actions; stores call services synchronously; services call repos
- Persistence: Database backed by SQLite; settings backed by file system
- Initialization: App.tsx calls `initDatabase()` + `checkAndBackfillHistory()` on mount

## Key Abstractions

**DailyItem (Daily Assignment Entity):**
- Purpose: Unified representation of a habit-to-complete for the user's current view day
- Defined: `src/types/index.ts` lines 60-70
- Contains: assignmentId, habitId, name, points, categories, frequency, isCompleted, isSpontaneous, performedHabitId
- Created by: `assignmentService.enrichAssignments()` which joins `daily_assignments` with `performed_habits`
- Pattern: Immutable snapshot; never changes after date passes (historical accuracy)

**DailyStats (Progress Calculation):**
- Purpose: Represent earned points, total available, and completion percentage
- Defined: `src/types/index.ts` lines 73-77
- Computed by: `statsHelpers.buildStats(earned, total)` in services
- Used: For all progress bars and percentage displays

**Habit (Template Definition):**
- Purpose: Master definition of a repeating habit the user owns
- Defined: `src/types/index.ts` lines 10-17
- Lives in: `habits` table
- Can be: active/inactive; daily/weekly/monthly frequency
- Snapshot in: `daily_assignments` preserves the habit's name/points at time of creation

**PerformedHabit (Completion Record):**
- Purpose: Record that the user completed an assignment on a specific timestamp
- Defined: `src/types/index.ts` lines 19-26
- Created by: `taskRepository.insert()` when assignment is marked complete
- Linked to: MoodEntry (via habit_id and timestamp)
- Contains: Reflection description, mood data

**HabitArea (Category System):**
- Purpose: Categorize habits into 9 life domains (physical health, mental health, relationships, etc.)
- Defined: `src/types/index.ts` lines 130-137
- Defined data: `src/config/constants.ts` lines 46-130
- Used in: Assignment categories (JSON array per assignment)
- Pattern: Immutable constant; colors and icons are metadata

## Entry Points

**App Root:**
- Location: `App.tsx` (root of project, imported by Expo)
- Triggers: Expo initialization
- Responsibilities:
  - Load fonts (Merriweather, Lato)
  - Initialize database via `initDatabase()` + backfill logic
  - Create bottom-tab navigation (Hoy, Biblioteca, Progreso) with stack overlay for Settings
  - Render AppBackground (gradient+notebook texture)
  - Show loading spinner during font/DB init

**DailySheetScreen (Hoy Tab):**
- Location: `src/screens/DailySheetScreen.tsx`
- Triggers: Tab press or navigation from Stats screen
- Responsibilities:
  - Fetch today's items (or historical date) via `store.fetchHabitsForDate()`
  - Group items by frequency (daily/weekly/monthly)
  - Render assignment checkboxes with progress mini-bars
  - Handle toggle (complete/uncomplete assignment)
  - Open ReflectionModal on completion for mood capture
  - Support date navigation (prev/next day)
  - Handle "Add Spontaneous Habit" flow

**HabitLibraryScreen (Biblioteca Tab):**
- Location: `src/screens/HabitLibraryScreen.tsx`
- Triggers: Tab press
- Responsibilities:
  - Fetch all habits (active + inactive) via `store.fetchLibrary()`
  - Display with completion counts
  - Open HabitFormModal to create/edit habits
  - Toggle habit active/inactive status

**StatsScreen (Progreso Tab):**
- Location: `src/screens/StatsScreen.tsx`
- Triggers: Tab press
- Responsibilities:
  - Render calendar view with completion data per day
  - Calculate weekly totals, streaks, trends
  - Allow tapping a date to navigate to historical DailySheetScreen
  - Show category breakdowns and mood trends

**SettingsScreen (Modal):**
- Location: `src/screens/SettingsScreen.tsx`
- Triggers: Header menu in AppScreenHeader
- Responsibilities:
  - Toggle haptics, sounds, voice dictation (via `useSettingsStore`)
  - Export/import backup (via `backupService`)
  - Clear data

## Error Handling

**Strategy:** Try-catch-log; fail gracefully without crashing

**Patterns:**

- **Service layer errors** (src/services/):
  - Services wrap all async operations in try-catch
  - Catch logs to console with error context (e.g., `console.error('[fetchHabitsForDate]', err)`)
  - No error is re-thrown; store actions mark `isLoading: false` in finally block
  - Client receives empty/default state on error (empty arrays, zero stats)

  Example from `assignmentService.ts` lines 20-32:
  ```typescript
  export async function getItemsForDate(datePrefix?: string): Promise<DailyItem[]> {
    const day = datePrefix ?? getTodayPrefix();
    await ensureAssignmentsForDate(day);
    // ... queries
  }
  ```
  Errors bubble up to store, which catches them.

- **Store actions errors** (src/store/useHabitStore.ts lines 99-112):
  ```typescript
  fetchHabitsForDate: async (date) => {
    set({ isLoading: true });
    try {
      // ... fetch
      set({ dailyItems: items, dailyStats: stats, isLoading: false });
    } catch (err) {
      console.error('[fetchHabitsForDate]', err);
      set({ isLoading: false });
    }
  },
  ```

- **Database initialization** (src/services/db.ts):
  - `initDatabase()` calls migration functions and sanitization
  - If a migration fails, the database is left in a semi-initialized state
  - Seeds are only inserted if `habits` table is empty
  - On app restart, migrations re-run (idempotent operations)

- **UI Error Handling:**
  - Loading state (`isLoading`, `isLibraryLoading`) disables interactions
  - Empty states are rendered (empty FlatList, empty stats = 0%)
  - No explicit error UI; errors are only in console

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.log()` and `console.error()` to React Native console
- Pattern: "[Function Name]" prefix on errors, e.g., `console.error('[toggleItem]', err)`
- Location: Every service action wraps in try-catch with error logging
- No centralized logger; leverages Expo dev tools for debugging

**Validation:**

- **Type Safety:** TypeScript enforces types at compile time
- **Database Schema:** SQLite schema defines columns and constraints (NOT NULL, FOREIGN KEY, defaults)
- **Input Validation:**
  - Form inputs (HabitFormModal) validate on submit (name length, base_points range)
  - Dates validated via `isValidDateString()` in `src/utils/dateHelpers.ts`
  - Category IDs validated during sanitization in `db.ts` against `VALID_AREA_IDS`
  - Mood values clamped to [1.0, 10.0] in modal

- **Data Integrity:**
  - Foreign keys enabled in SQLite (`PRAGMA foreign_keys = ON`)
  - Cascading deletes on habit deletion
  - Unique constraint on `(habit_id, date)` for daily_assignments (prevents duplicate assignments)
  - JSON parsing with fallback to `[]` if malformed

**Authentication:**
- Not applicable; app is local-first, single-user, no backend

**Authorization:**
- Not applicable; all data belongs to single user

**Persistence:**

- **Database:** SQLite via `expo-sqlite`, stored in app's documents directory
  - Write-Ahead Logging (WAL) enabled for concurrency (`PRAGMA journal_mode = WAL`)
  - Database file persists across app restarts

- **Settings:** Custom file storage via `expo-file-system`
  - Zustand's `persist` middleware writes settings.json on each change
  - Loaded on app boot before any UI renders

- **Assets:** No asset caching beyond Expo's native caching

---

*Architecture analysis: 2026-03-17*
