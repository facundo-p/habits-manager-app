# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout

```
habits-manager-app/
├── src/
│   ├── screens/              # Tab/Stack screens (Hoy, Biblioteca, Progreso, Ajustes)
│   ├── components/
│   │   ├── layout/           # Layout wrappers (AppBackground, AppScreenHeader, BottomSheet, NotebookPaper)
│   │   ├── modals/           # Modal dialogs (HabitFormModal, ReflectionModal, SpontaneousModal, AreaInfoModal)
│   │   ├── shared/           # Reusable UI (AreaPicker, MicButton)
│   │   └── *.styles.ts       # Component-specific styles (one per component)
│   ├── services/             # Business logic orchestrators (habitService, assignmentService, moodService, db.ts)
│   ├── repositories/         # Data access layer (habitRepository, assignmentRepository, moodRepository, taskRepository)
│   ├── store/                # Zustand stores (useHabitStore, useSettingsStore)
│   ├── hooks/                # Custom React hooks (useFeedback, useSpeechRecognition)
│   ├── types/                # TypeScript domain types (index.ts only)
│   ├── config/               # Constants and configuration
│   ├── styles/               # Global styles (ui.styles.ts, global.css via NativeWind)
│   ├── utils/                # Shared utilities (dateHelpers, statsHelpers, parsing)
│   └── __tests__/            # Test files and setup
├── assets/                   # Images, fonts, static files
├── App.tsx                   # Root component (entry point for Expo)
├── app.json                  # Expo configuration
├── eas.json                  # EAS Build configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest test runner config
├── babel.config.js           # Babel transpiler config
├── tailwind.config.js        # Tailwind CSS config (for NativeWind)
├── metro.config.js           # Metro bundler config
├── nativewind-env.d.ts       # NativeWind TypeScript definitions
├── global.css                # Global CSS (imported by App.tsx)
└── .planning/                # GSD planning documents (this directory)
```

## Directory Purposes

**src/screens/:**
- Purpose: Screen components mounted in navigation stack/tabs
- Contains: DailySheetScreen, HabitLibraryScreen, StatsScreen, SettingsScreen
- Key files: `DailySheetScreen.tsx`, `HabitLibraryScreen.tsx`, `StatsScreen.tsx`, `SettingsScreen.tsx`
- Each screen has paired `.styles.ts` file with all styling (NativeWind classes)
- Screens are dumb; all business logic delegated to `useHabitStore`

**src/components/layout/:**
- Purpose: Layout components shared across multiple screens
- Contains:
  - `AppBackground.tsx` - Root gradient + notebook texture wrapper
  - `AppScreenHeader.tsx` - Reusable header with title, date, settings menu
  - `BottomSheet.tsx` - Slide-up modal sheet for user input
  - `NotebookPaper.tsx` - Notebook paper effect container (spiral binding, ruled lines)
- Pattern: Pure presentational; accept `children` prop and style overrides

**src/components/modals/:**
- Purpose: Dialog modals for forms and information
- Contains:
  - `HabitFormModal.tsx` - Create/edit habit dialog (name, frequency, points, categories)
  - `ReflectionModal.tsx` - Capture mood + description after habit completion
  - `SpontaneousModal.tsx` - Quick-add for spontaneous completions
  - `AreaInfoModal.tsx` - Display information about habit categories (salud_fisica, mental, etc.)
- Pattern: Each modal opens/closes via store state; form submissions dispatch to store actions

**src/components/shared/:**
- Purpose: Micro UI components used within modals/screens
- Contains:
  - `AreaPicker.tsx` - Multi-select dropdown for habit categories with color icons
  - `MicButton.tsx` - Voice input button (uses `useSpeechRecognition`)
- Pattern: Single responsibility; props-driven customization

**src/services/:**
- Purpose: Business logic orchestrators; delegate data access to repositories
- Contains:
  - `db.ts` - Database initialization, schema, migrations, seed data, date/ID utilities
  - `habitService.ts` - Habit CRUD, completion tracking, library operations
  - `assignmentService.ts` - Daily assignment generation, backfill, toggle, spontaneous habits
  - `moodService.ts` - Mood entries (create, fetch, delete)
  - `statsService.ts` - Statistical aggregations (streaks, weekly totals, category points)
  - `backupService.ts` - Import/export database state
- Pattern: Pure async functions; each file corresponds to a domain concept; no export default (named exports)
- Key Rule: Only services can call repositories; screens/stores cannot call repos directly

**src/repositories/:**
- Purpose: Execute SQL queries; no business logic
- Contains:
  - `habitRepository.ts` - CRUD for `habits` table (findAll, insert, update, delete, setActive)
  - `assignmentRepository.ts` - CRUD for `daily_assignments` table (findByDate, setCompleted, insert)
  - `moodRepository.ts` - CRUD for `mood_entries` table (insert, delete, findByHabitAndDate)
  - `taskRepository.ts` - CRUD for `performed_habits` table (insert, delete, updateDescription, countByHabit)
  - `backupRepository.ts` - Bulk export/import (getFullDump, insertFullDump)
- Pattern: SQL constants at top; no interpolation (all parameterized); functions are thin db wrappers
- Exports: Individual functions only; no classes

**src/store/:**
- Purpose: Centralized state management via Zustand
- Contains:
  - `useHabitStore.ts` - Main store for daily view, library, reflections (lines 80-254)
    - State: `viewDate`, `dailyItems`, `dailyStats`, `libraryHabits`, `pendingReflection`, loading flags
    - Actions: `fetchHabitsForDate()`, `toggleItem()`, `addHabit()`, `editHabit()`, etc.
  - `useSettingsStore.ts` - Persistent settings (haptics, sounds, language)
    - State: `hapticsEnabled`, `soundsEnabled`, `voiceDictationEnabled`, `language`
    - Storage: Custom file storage via `expo-file-system`
- Pattern: Create hook with reducer-like actions; stores call services, which call repos
- State shape: Flat objects (no nested state); each action handles its own loading state

**src/hooks/:**
- Purpose: Custom React hooks for reusable logic
- Contains:
  - `useFeedback.ts` - Trigger haptic feedback based on settings
  - `useSpeechRecognition.ts` - Wrapper around expo voice APIs (if implemented)
- Pattern: Custom hooks that wrap store/service calls; return memoized callbacks

**src/types/:**
- Purpose: TypeScript domain type definitions
- Contains: `index.ts` (single file; all types exported from here)
  - Entity types: `Habit`, `PerformedHabit`, `MoodEntry`, `DailyAssignment`
  - View types: `DailyItem`, `DailyHabit`, `DailyStats`, `FrequencyGroup`
  - Form types: `HabitFormData`
  - Navigation types: `RootStackParamList`, `RootTabParamList`
  - Backup types: `BackupData`
- Pattern: No logic; types only; names match database schema (snake_case for DB fields)

**src/config/:**
- Purpose: Constants and configuration values
- Contains: `constants.ts` (all magic strings/numbers live here)
  - Database: `DB_NAME`
  - Mood: `MOOD_MIN`, `MOOD_MAX`, `MOOD_STEP`, `MOOD_DEFAULT_VALUE`
  - Frequencies: `HABIT_FREQUENCY`, `FREQUENCY_OPTIONS`, `FREQUENCY_LABELS`
  - Areas: `HABIT_AREAS` (9 categories with colors, icons, descriptions)
  - Routes: `ROUTES` (navigation route names)
  - Alert messages: Predefined Alert.alert configurations
- Pattern: Named exports; never use hardcoded strings in code

**src/styles/:**
- Purpose: Global styles and UI theme constants
- Contains:
  - `ui.styles.ts` - Color palette (amber50, amber600, etc.), component defaults (tabBarTheme, iconDefaults)
  - `global.css` - Tailwind/NativeWind reset (imported by App.tsx)
- Pattern: Centralize colors/spacing; reference from component .styles.ts files

**src/utils/:**
- Purpose: Shared utility functions (no state, no side effects)
- Contains:
  - `dateHelpers.ts` - Format dates (formatTodayDate, formatHistoricDate), validate date strings
  - `statsHelpers.ts` - Calculate stats (buildStats: compute percentage from earned/total)
  - `parsing.ts` - Parse JSON arrays safely (parseJsonArray)
- Pattern: Pure functions; import into services/screens as needed

**src/__tests__/:**
- Purpose: Test files and test utilities
- Contains:
  - `dailyAssignments.test.ts` - Tests for assignment logic
  - `setup/testDatabase.ts` - Test database setup/teardown
  - `__mocks__/` - Mocked dependencies (repo at root: `__mocks__/`)
- Pattern: Co-located with source; test file mirrors source name + .test.ts extension

**assets/:**
- Purpose: Static images, icons, fonts (not code)
- Contains: PNG/SVG icons, font files
- Note: Expo Google Fonts (`@expo-google-fonts/merriweather`, `@expo-google-fonts/lato`) imported in App.tsx

**Root Config Files:**
- `App.tsx` - Main app component; initializes DB, sets up navigation
- `app.json` - Expo app config (name, version, plugins, permissions)
- `eas.json` - Expo Application Services build config
- `package.json` - Dependencies (React Native 0.81, Expo 54, Zustand, React Navigation)
- `tsconfig.json` - TypeScript strict mode enabled
- `jest.config.js` - Jest runner; uses `ts-jest` preprocessor
- `babel.config.js` - Babel presets for React Native + Expo
- `tailwind.config.js` - Tailwind config for NativeWind
- `metro.config.js` - Metro bundler config (resolver paths, source extensions)
- `nativewind-env.d.ts` - NativeWind type definitions for className support

## Key File Locations

**Entry Points:**
- `App.tsx` - Root component; App initialization, navigation setup, DB initialization
- `src/screens/DailySheetScreen.tsx` - Primary user-facing screen (daily habits view)
- `src/screens/HabitLibraryScreen.tsx` - Habit management screen
- `src/screens/StatsScreen.tsx` - Analytics and historical view

**Configuration:**
- `src/config/constants.ts` - All magic strings/numbers (routes, DB name, mood range, habit areas)
- `src/styles/ui.styles.ts` - Colors, theme defaults
- `src/types/index.ts` - All TypeScript types

**Core Logic:**
- `src/services/db.ts` - Database initialization, schema, seed data
- `src/services/habitService.ts` - Habit CRUD and completion logic
- `src/services/assignmentService.ts` - Daily assignment generation and management
- `src/store/useHabitStore.ts` - Central state store for habit operations

**Testing:**
- `jest.config.js` - Test runner configuration
- `src/__tests__/` - Test files

## Naming Conventions

**Files:**
- Screens: `PascalCase` + `Screen` suffix (e.g., `DailySheetScreen.tsx`)
- Components: `PascalCase` (e.g., `AppBackground.tsx`, `AreaPicker.tsx`)
- Services: `camelCase` + `Service` suffix (e.g., `habitService.ts`)
- Repositories: `camelCase` + `Repository` suffix (e.g., `habitRepository.ts`)
- Hooks: `camelCase` + `use` prefix (e.g., `useFeedback.ts`)
- Types: `index.ts` in `types/` directory (all types exported from single file)
- Styles: `PascalCase` + `.styles.ts` (paired with component, e.g., `DailySheetScreen.styles.ts`)
- Tests: `camelCase` + `.test.ts` (e.g., `dailyAssignments.test.ts`)
- Utilities: `camelCase` + `Helpers` suffix (e.g., `dateHelpers.ts`)

**Directories:**
- Screen containers: lowercase (e.g., `screens/`, `components/`)
- Logical groupings: lowercase (e.g., `layout/`, `modals/`, `shared/`)
- Named by domain: `services/`, `repositories/`, `store/`, `hooks/`, `types/`, `config/`, `styles/`, `utils/`

**TypeScript:**
- Interfaces: `PascalCase` (e.g., `Habit`, `DailyItem`, `HabitArea`)
- Types: `PascalCase` (e.g., `SupportedLanguage`)
- Functions: `camelCase` (e.g., `getItemsForDate()`, `toggleItem()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MOOD_MAX`, `DB_NAME`, `VALID_AREA_IDS`)
- Component Props: `PascalCase` + `Props` suffix (e.g., `NotebookPaperProps`)

## Where to Add New Code

**New Feature (e.g., streak tracking):**
- Primary code: `src/services/` (logic), `src/repositories/` (if new table needed)
- Store action: Add to `useHabitStore` (lines 80-254)
- Types: Add to `src/types/index.ts`
- UI: New component in `src/components/shared/` or modal in `src/components/modals/`
- Constants: Add to `src/config/constants.ts`

**New Screen:**
- Implementation: `src/screens/NewFeatureScreen.tsx`
- Styles: `src/screens/NewFeatureScreen.styles.ts`
- Navigation: Register in App.tsx (Stack.Screen or Tab.Screen)
- Types: Add route param type to `RootStackParamList` or `RootTabParamList` in `src/types/index.ts`

**New Component/Module:**
- Single component: `src/components/shared/ComponentName.tsx` + `ComponentName.styles.ts`
- Modal dialog: `src/components/modals/ComponentName.tsx` + `ComponentName.styles.ts`
- Layout wrapper: `src/components/layout/ComponentName.tsx` + `ComponentName.styles.ts`

**Utilities:**
- Shared helpers: `src/utils/featureName.ts` (e.g., `streakHelpers.ts`)
- Used by: Services and screens import and call utility functions
- Pattern: Pure functions; no side effects

**Database Changes:**
- New table: Define CREATE TABLE in `src/services/db.ts` (add to `executeSchema()`)
- New repository: Create `src/repositories/newTableRepository.ts`
- New service: Create `src/services/newFeatureService.ts` that orchestrates repos
- Migrations: Add migration function to `initDatabase()` sequence in db.ts
- Types: Add entity type to `src/types/index.ts`

**Tests:**
- Unit tests for services: `src/__tests__/featureName.test.ts`
- Setup/mocks: `src/__tests__/setup/` for shared test utilities
- Root mocks: `__mocks__/` for module mocks

## Special Directories

**src/__tests__/:**
- Purpose: Test files and test infrastructure
- Generated: No (checked in)
- Committed: Yes
- Contains: Test files, setup utilities, mocks
- Note: Jest runs all `*.test.ts` files; uses ts-jest to transpile

**.planning/:**
- Purpose: GSD orchestrator planning documents
- Generated: Yes (created by `/gsd:map-codebase`, `/gsd:plan-phase`, etc.)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md

**assets/:**
- Purpose: Static files (images, fonts)
- Generated: No
- Committed: Yes
- Note: Expo Google Fonts installed via npm; not committed

**node_modules/:**
- Purpose: Package dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (in .gitignore)

**.expo/:**
- Purpose: Expo CLI cache and metadata
- Generated: Yes (created by `expo` CLI)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-03-17*
