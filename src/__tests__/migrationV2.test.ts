/**
 * src/__tests__/migrationV2.test.ts
 *
 * Wave 0 (Plan 01) — RED skeleton consumido por Wave 3 (Plan 04).
 * Cubre FOUND-03/FOUND-04/D-06. Cada `it.todo` mapea a 01-VALIDATION.md.
 */

describe('migrationV2 — forward', () => {
  it.todo('pre: user_version=1 + mood_entries with N rows; post: user_version=2 + mood_log kind=reflection count=N');
  it.todo('creates 4 tables: mood_log, text_library, weekly_reviews, drafts');
  it.todo('creates partial UNIQUE INDEX idx_mood_log_one_per_day');
  it.todo('drops mood_entries table');
});

describe('migrationV2 — idempotency', () => {
  it.todo('runMigrations × 2 → second run is no-op (user_version stays 2)');
});

describe('migrationV2 — rollback', () => {
  it.todo('forced throw inside INSERT...SELECT → user_version stays 1 AND mood_entries intacta');
});

describe('migrationV2 — data integrity', () => {
  it.todo('count(mood_log kind=reflection) === pre-count(mood_entries) (assertion DENTRO de la transaction)');
});

describe('migrationV2 — pre-v2 snapshot (D-06)', () => {
  it.todo('writes JSON to documentDirectory/pre-v2-snapshot-<ts>.json BEFORE BEGIN TRANSACTION');
  it.todo('if writeAsStringAsync fails → migration NOT executed; user_version stays 1');
});

describe('migrationV2 — cleanup 30d (D-06)', () => {
  it.todo('snapshots with mtime > 30d removed on subsequent boot post-success');
  it.todo('snapshots within 30d preserved');
});
