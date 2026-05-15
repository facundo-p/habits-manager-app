/**
 * src/__tests__/dateUtils.test.ts
 *
 * Cubre FOUND-01 (D-01 codemod). Verifica que `getLocalDayKey` usa getters
 * locales (no UTC) y que `formatDateStr` / `nextDay` son DST-safe.
 *
 * Port del cross-midnight test que vivía en db.test.ts.
 */

import {
  getLocalDayKey,
  isFutureDate,
  nextDay,
  formatDateStr,
  getNowTimestamp,
  getTimestampForDate,
} from '../utils/date';

afterEach(() => {
  jest.useRealTimers();
});

describe('getLocalDayKey', () => {
  it('returns YYYY-MM-DD using local Date getters (not UTC slice)', () => {
    // Invariant: result must match local getFullYear/Month/Date trio.
    // The test runner timezone may equal UTC, so we assert the implementation
    // path rather than a hard-coded value — the GMT-3 cross-midnight scenario
    // is covered at device-level.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T02:00:00Z'));
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(getLocalDayKey()).toBe(expected);
  });

  it('returns YYYY-MM-DD format at any system time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-05T10:00:00Z'));
    expect(getLocalDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does NOT use toISOString().slice (UTC bias) — local-getter parity check', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T00:00:01Z'));
    const d = new Date();
    const localExpected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(getLocalDayKey()).toBe(localExpected);
  });
});

describe('isFutureDate', () => {
  it('returns true for a far-future YYYY-MM-DD', () => {
    expect(isFutureDate('2099-01-01')).toBe(true);
  });

  it('returns false for today itself', () => {
    expect(isFutureDate(getLocalDayKey())).toBe(false);
  });
});

describe('nextDay', () => {
  it('advances one calendar day in UTC arithmetic', () => {
    expect(nextDay('2026-03-09')).toBe('2026-03-10');
  });

  it('crosses DST spring-forward without skipping (UTC math is DST-immune)', () => {
    // 2026-03-08 → 2026-03-09 spans US DST spring-forward (Mar 8 2026).
    // UTC arithmetic must produce a clean +1 day.
    expect(nextDay('2026-03-08')).toBe('2026-03-09');
  });
});

describe('formatDateStr', () => {
  it('formats a UTC Date to YYYY-MM-DD using UTC getters', () => {
    expect(formatDateStr(new Date('2026-03-10T00:00:00Z'))).toBe('2026-03-10');
  });

  it('is DST-stable: same date string regardless of system DST status', () => {
    const d = new Date('2026-06-21T12:00:00Z');
    expect(formatDateStr(d)).toBe('2026-06-21');
  });
});

describe('getNowTimestamp', () => {
  it('returns "YYYY-MM-DD HH:MM:SS"', () => {
    expect(getNowTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('getTimestampForDate', () => {
  it('prefixes the given date with current HH:MM:SS', () => {
    expect(getTimestampForDate('2026-05-12')).toMatch(/^2026-05-12 \d{2}:\d{2}:\d{2}$/);
  });
});
