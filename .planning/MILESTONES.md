# Milestones

## v1.0 Bug Fixes, Tech Debt & Cloud Backup (Shipped: 2026-05-05)

**Phases completed:** 4 phases, 12 plans, 12 tasks

**Known deferred items at close:** 7 (see STATE.md "Deferred Items")

**Key accomplishments:**

- **Phase 1 — Bug Fixes:** Three backfill bugs fixed: `isFutureDate` utility extracted to `db.ts`, UTC-safe date iteration with `setUTCDate`, and spontaneous-entry guard using `countByDate`. `addSpontaneous` now validates category IDs against `VALID_AREA_IDS` before DB insert. 29 passing tests.
- **Phase 2 — Tech Debt:** Centralized JSON parsing of categories in `src/utils/parsing.ts` (`parseAndValidateCategories`); `useSpeechRecognition` typed via `SpeechModuleInterface` (no `any`); `sanitizeTable` replaced with explicit per-table sanitizers using static SQL.
- **Phase 3 — Google Drive Backup:** Bootstrap (`@react-native-google-signin/google-signin@16.1.2` + idempotent `googleAuth.ts` + non-blocking startup hook). Transport layer (`signIn`/`signOut`/`upload`/`list`/`download`/`mapError` with multipart manual + Time Machine retention). Settings UI ("Backup en la nube" with 5 states + LoadingOverlay). Restore flow with `prepareRestore`/`applyRestore` API split and pre-restore safety cache (D-19). 95/95 tests green. Runtime OAuth pending GCP Console setup.
- **Phase 4 — Habit Creation Audit & Duplicate Cleanup:** Versioned migration v1 (`PRAGMA user_version`) applies D-03 priority dedup + creates partial `UNIQUE INDEX idx_unique_habit_date` atomically with rollback-on-failure. Visibility-aware reads (D-01 Opción B): one row per day, completion propagates to all rows in current period. `restoreData` deduplicates pre-bulk-insert (REQ-04-03 integration).

---
