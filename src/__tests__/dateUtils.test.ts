/**
 * src/__tests__/dateUtils.test.ts
 *
 * Wave 0 (Plan 01) — RED skeleton consumido por Wave 1 (Plan 02).
 * Cubre FOUND-01 (date helpers codemod / D-01). Cada `it.todo` lista un caso
 * mapeado a 01-VALIDATION.md "Per-Requirement Verification Map".
 */

describe('getLocalDayKey', () => {
  it.todo('returns YYYY-MM-DD in local TZ at 23:59 → next day at 00:01 (cross-midnight)');
  it.todo('NEVER returns a UTC-rolled date (port of db.test.ts cross-midnight)');
});

describe('isFutureDate', () => {
  it.todo('"YYYY-MM-DD" > getLocalDayKey() → true');
});

describe('nextDay', () => {
  it.todo('returns date+1 in UTC arithmetic, DST-safe');
});

describe('formatDateStr (ex-dateToPrefix)', () => {
  it.todo('UTC getters rewrite produces same YYYY-MM-DD');
});

describe('getNowTimestamp', () => {
  it.todo('returns "YYYY-MM-DD HH:MM:SS" current');
});

describe('getTimestampForDate', () => {
  it.todo('returns "<dateKey> HH:MM:SS" with current time');
});
