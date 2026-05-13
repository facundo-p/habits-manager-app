/**
 * src/__tests__/drafts.test.ts
 *
 * Wave 0 (Plan 01) — RED skeleton consumido por Wave 4 (Plan 05).
 * Cubre FOUND-05 drafts repo + useDraftAutosave hook (D-04 debounce 500ms).
 */

describe('draftsRepository', () => {
  it.todo('upsert + find round-trip preserves payload_json');
  it.todo('UNIQUE(kind, key) enforced → second upsert overwrites, no duplicate row');
  it.todo('delete removes the row');
  it.todo('purgeOlderThan(cutoffIso) removes rows with updated_at < cutoff');
});

describe('useDraftAutosave hook', () => {
  it.todo('debounce 500ms — multiple changes within 500ms result in ONE upsert call');
  it.todo('uses jest.useFakeTimers()');
  it.todo('cleanup on unmount cancels pending timer');
});
