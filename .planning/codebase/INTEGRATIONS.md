# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**None Detected** - This is a standalone mobile application with no remote API integrations, cloud services, or third-party APIs. All operations are local to the device.

## Data Storage

**Databases:**
- SQLite (local device storage)
  - Client: `expo-sqlite` 16.0.10
  - Accessed via: `src/services/db.ts`
  - Database name: Defined in `src/config/constants.ts` as `DB_NAME`
  - All data persisted locally on device
  - Tables: habits, daily_assignments, performed_habits, mood_entries

**File Storage:**
- Local device filesystem only
  - Used for: Backup/restore of database exports
  - Accessed via: `expo-file-system` 19.0.21
  - Implementation: `src/services/backupService.ts`
  - Backup location: Device document directory (device-specific path)
  - Backup format: JSON file with structure defined in `src/types/index.ts` as `BackupData`

**Caching:**
- None detected - In-memory state management only via Zustand
- State stores: `src/store/useHabitStore.ts`, `src/store/useSettingsStore.ts`
- No persistent caching layer

## Authentication & Identity

**Auth Provider:**
- None - Application is completely offline with no user accounts or authentication
- No login/signup flow
- No user identification beyond device-local state

## Monitoring & Observability

**Error Tracking:**
- None - No error tracking service (Sentry, Bugsnag, etc.) integrated

**Logs:**
- Console logging only
  - Implementation: Standard `console.log()`, `console.error()` calls
  - Example: `src/services/db.ts` line 102: `console.log('DB inicializada...')`
  - No remote log aggregation

## CI/CD & Deployment

**Hosting:**
- Expo Application Services (EAS) for app distribution
  - EAS Project ID: `153f52bd-3be7-4b9b-8400-903e38d80162`
  - Configuration: `eas.json` in project root

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or other CI service configuration present
- Manual deployment assumed

**Build Targets:**
- iOS via EAS build
- Android via EAS build or APK (build artifact present: `build-1771216036543.apk`)

## Device Integrations

**Haptic Feedback:**
- Service: `expo-haptics` 15.0.8
- Implementation: `src/hooks/useFeedback.ts`
- Usage: Triggers on successful habit completion, enabled/disabled via settings
- Notification types: Success, Light impact

**File System Access:**
- Read: `expo-file-system` 19.0.21
  - For reading imported backup JSON files
- Write: `expo-file-system` 19.0.21
  - For writing backup JSON to document directory
- Document picker: `expo-document-picker` 14.0.8
  - For user file selection during backup import

**Native Share:**
- Service: `expo-sharing` 14.0.8
- Implementation: `src/services/backupService.ts` (exportBackup function)
- Usage: Opens native share dialog to save/send backup files

**Cryptography:**
- Service: `expo-crypto` 15.0.8
- Implementation: `src/services/db.ts` (generateId function)
- Usage: UUID generation for database record IDs

**Fonts:**
- Google Fonts via Expo
  - @expo-google-fonts/lato 0.4.1 - Lato_400Regular
  - @expo-google-fonts/merriweather 0.4.2 - Merriweather_700Bold
  - Loaded in: `App.tsx` with error handling

**Status Bar:**
- Service: `expo-status-bar` 3.0.9
- Configuration: Light mode via `app.json`

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints or background listeners

**Outgoing:**
- None - No outbound webhooks or push notifications

## Data Backup & Recovery

**Backup Mechanism:**
- Format: JSON file export
- Trigger: Manual user action via Settings screen
- Scope: All habits, daily assignments, performed records, mood entries
- Version: Defined in `src/config/constants.ts` as `BACKUP_VERSION`
- Timestamp: Included in backup file (`exportedAt` field)
- Implementation: `src/services/backupService.ts` → `src/repositories/backupRepository.ts`

**Restore Mechanism:**
- Method: File picker (user selects JSON backup file)
- Validation: Schema validation against `BackupData` type
- Execution: Atomic transaction with automatic rollback on failure
- Side effects: Completely replaces existing data in database

## Security Characteristics

**No Remote Communication:** No network requests detected - application is fully offline
**Local-Only Data:** All user data stored only on device, never transmitted
**No API Keys:** No environment variables or secrets management required
**No Authentication:** No account systems, login flows, or identity verification
**Database Safety:** Foreign key constraints enabled, transaction support for atomic operations

---

*Integration audit: 2026-03-17*
