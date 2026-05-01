# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- TypeScript 5.9.3 - Application logic, component definitions, services
- JSX/TSX - React component syntax

**Secondary:**
- JavaScript - Configuration files (metro.config.js, babel.config.js, tailwind.config.js, jest.config.js)
- CSS - Utility-first styling via NativeWind/TailwindCSS

## Runtime

**Environment:**
- React Native 0.81.5 - Cross-platform mobile framework
- Expo 54.0.33 - React Native framework with pre-built modules
- Node.js - Development environment

**Package Manager:**
- npm 10+ (inferred from package-lock.json presence)
- Lockfile: `package-lock.json` (present and committed)

## Frameworks

**Core Mobile:**
- React 19.1.0 - UI library
- React Native 0.81.5 - Native mobile runtime
- React Native Web 0.21.0 - Web platform support
- Expo 54.0.33 - Managed React Native platform

**Navigation:**
- @react-navigation/native 7.1.28 - Core navigation
- @react-navigation/bottom-tabs 7.13.0 - Bottom tab navigation
- @react-navigation/native-stack 7.12.0 - Native stack navigator

**Styling:**
- NativeWind 4.2.1 - TailwindCSS for React Native
- TailwindCSS 3.4.19 - Utility-first CSS framework

**State Management:**
- Zustand 5.0.11 - Lightweight state management library

**Testing:**
- Jest 30.3.0 - Test runner
- ts-jest 29.4.6 - TypeScript support for Jest

## Key Dependencies

**Critical:**
- zustand 5.0.11 - Core state management for habits, daily items, stats, library
- nativewind 4.2.1 - Styling system across entire app
- react-native-reanimated 4.1.1 - Animation library for gesture handling

**Database & Data:**
- expo-sqlite 16.0.10 - Local SQLite database for all app data (habits, assignments, moods, performed_habits)
- expo-crypto 15.0.8 - UUID generation for database IDs

**File & Device Integration:**
- expo-file-system 19.0.21 - File system access for backup export
- expo-sharing 14.0.8 - Native share dialog for backup files
- expo-document-picker 14.0.8 - File picker for backup import

**Platform Features:**
- expo-haptics 15.0.8 - Haptic feedback on habit completion
- expo-fonts 14.0.11 - Custom font loading (Merriweather, Lato)
- expo-blur 15.0.8 - Blur effect component
- expo-linear-gradient 15.0.8 - Gradient backgrounds
- expo-status-bar 3.0.9 - Status bar customization

**UI Components:**
- lucide-react-native 0.564.0 - Icon library
- react-native-safe-area-context 5.6.0 - Safe area handling
- react-native-screens 4.16.0 - Native navigation screens
- react-native-svg 15.12.1 - SVG rendering
- react-native-chart-kit 6.12.0 - Charts for statistics view
- @react-native-community/slider 5.0.1 - Custom slider component

**Fonts:**
- @expo-google-fonts/lato 0.4.1 - Lato font (sans-serif, body text)
- @expo-google-fonts/merriweather 0.4.2 - Merriweather font (serif, headers)

**Dev Tools:**
- @babel/core 7.29.0 - JavaScript transpiler
- TypeScript 5.9.3 - Type system
- @types/jest 30.0.0 - Type definitions for Jest
- @types/better-sqlite3 7.6.13 - Type definitions (dev only, not used in app)
- @types/react 19.1.10 - React type definitions
- better-sqlite3 12.6.2 - Dev dependency (not used in app runtime)

## Configuration

**Environment:**
- No environment variables detected - Configuration is hardcoded in `src/config/constants.ts`
- No `.env` file present

**Build:**
- `tsconfig.json` - TypeScript strict mode enabled, JSX preset for NativeWind
- Path alias: `@/*` → `./src/*`
- `babel.config.js` - Babel transpilation for JSX/TS
- `metro.config.js` - React Native bundler configuration
- `jest.config.js` - Test configuration with ts-jest transformer
- `tailwind.config.js` - TailwindCSS configuration with NativeWind preset

**App Configuration:**
- `app.json` - Expo app manifest with EAS project ID: `153f52bd-3be7-4b9b-8400-903e38d80162`
- Android package: `com.facupich.cozyhabit`
- iOS app slug: `cozy-habit`
- Orientation: portrait mode only
- Plugins enabled: `expo-font`, `expo-sqlite`

## Database

**Type:** SQLite (local device storage via `expo-sqlite`)

**Tables:**
- `habits` - Habit definitions
- `daily_assignments` - Daily habit snapshots with completion status
- `performed_habits` - Historical completed habit records
- `mood_entries` - Mood tracking entries

**Features:**
- WAL mode enabled for concurrent access
- Foreign key constraints enabled
- Automatic schema creation and migrations on app startup
- Seed data auto-loaded on first run

## Platform Requirements

**Development:**
- Node.js 18+
- npm 10+
- Xcode (for iOS development)
- Android Studio/SDK (for Android development)
- Expo CLI (globally or via npx)

**Production:**
- iOS 14.0+ (inferred from safe-area-context requirements)
- Android 8.0+ (API level 26+)
- Device storage for SQLite database (typically <10MB)

**Expo Go:**
- Compatible with Expo SDK 54
- Uses expo-dev-client for development

---

*Stack analysis: 2026-03-17*
