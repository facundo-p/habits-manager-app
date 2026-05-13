/**
 * src/__tests__/backupV1toV2.test.ts
 *
 * Wave 0 (Plan 01) — RED skeleton consumido por Wave 3 (Plan 04).
 * Cubre FOUND-04 backup v1→v2 forward + v2 round-trip + future-version reject.
 */

describe('backupService — v1 forward', () => {
  it.todo('v1 backup JSON with mood_entries[N] → restoreData → mood_log has N rows kind=reflection');
  it.todo('v1 mood_entries.timestamp → mood_log.date_key (slice 0,10) and occurred_at preserved');
  it.todo('mood_scale_version = "v1" stamped on all migrated rows');
});

describe('backupService — v2 round-trip', () => {
  it.todo('buildBackupData → JSON → parseAndValidate → restoreData round-trip preserves mood_log + text_library + weekly_reviews');
  it.todo('drafts EXCLUDED from buildBackupData output (transient — FOUND-04)');
});

describe('backupService — future version reject', () => {
  it.todo('parseAndValidate({version:3,...}) throws actionable error "Backup más nuevo que la app"');
});
