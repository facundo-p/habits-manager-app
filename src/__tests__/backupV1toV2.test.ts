/**
 * backupV1toV2.test.ts — Cobertura de Plan 04 Task 3 (FOUND-04).
 *
 * Cubre el dispatcher v1/v2/v3 de `parseAndValidate` + el mapeo en memoria
 * `mood_entries[]` → `mood_log[]` kind='reflection' que `restoreData` aplica
 * cuando el backup parseado es v1.
 */

// expo-sharing / expo-document-picker no son transformados por ts-jest
// (transformIgnorePatterns) y backupService.ts los importa al tope. Mock virtual.
jest.doMock('expo-sharing', () => ({ shareAsync: jest.fn() }), { virtual: true });
jest.doMock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }), { virtual: true });

import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  resetTestDatabase,
} from './setup/testDatabase';
import {
  parseAndValidate,
  restoreData,
  buildBackupData,
} from '../services/backupService';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
});

// ─── Helpers ────────────────────────────────────────────────────────

function makeV1Backup(moodEntries: Array<{
  id: string; value: number; description: string | null; timestamp: string; habit_id: string | null;
}>): string {
  return JSON.stringify({
    version: 1,
    exportedAt: '2026-04-27T00:00:00Z',
    habits: [],
    performed_habits: [],
    daily_assignments: [],
    mood_entries: moodEntries,
  });
}

function makeV2Backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 2,
    exportedAt: '2026-05-10T00:00:00Z',
    habits: [],
    performed_habits: [],
    daily_assignments: [],
    mood_log: [],
    text_library: [],
    weekly_reviews: [],
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('backupService — v1 forward', () => {
  test('v1 backup JSON with mood_entries[N] → restoreData inserts N rows in mood_log kind=reflection', async () => {
    const json = makeV1Backup([
      { id: 'm1', value: 7.5, description: 'reflexión 1', timestamp: '2026-05-12T15:30:00.000Z', habit_id: null },
      { id: 'm2', value: 5.0, description: null, timestamp: '2026-05-13T10:00:00.000Z', habit_id: null },
      { id: 'm3', value: 9.0, description: 'reflexión 3', timestamp: '2026-05-14T20:00:00.000Z', habit_id: null },
    ]);

    const data = parseAndValidate(json);
    expect(data.version).toBe(1);
    await restoreData(data);

    const rows = db.prepare(
      "SELECT id, kind, mood_value, mood_scale_version FROM mood_log",
    ).all() as Array<{ id: string; kind: string; mood_value: number; mood_scale_version: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.kind === 'reflection')).toBe(true);
    expect(rows.every((r) => r.mood_scale_version === 'v1')).toBe(true);
  });

  test('v1 mood_entries.timestamp → mood_log.date_key (slice 0,10) + occurred_at preservado', async () => {
    const json = makeV1Backup([
      { id: 'm1', value: 7.5, description: null, timestamp: '2026-05-12T15:30:00.000Z', habit_id: null },
    ]);

    await restoreData(parseAndValidate(json));

    const row = db.prepare('SELECT date_key, occurred_at FROM mood_log').get() as { date_key: string; occurred_at: string };
    expect(row.date_key).toBe('2026-05-12');
    expect(row.occurred_at).toBe('2026-05-12T15:30:00.000Z');
  });

  test('mood_scale_version = "v1" stamped on all migrated rows', async () => {
    const json = makeV1Backup([
      { id: 'm1', value: 7, description: null, timestamp: '2026-04-01T10:00:00Z', habit_id: null },
      { id: 'm2', value: 8, description: null, timestamp: '2026-04-02T10:00:00Z', habit_id: null },
    ]);
    await restoreData(parseAndValidate(json));

    const stamps = db.prepare(
      'SELECT mood_scale_version FROM mood_log',
    ).all() as Array<{ mood_scale_version: string }>;
    expect(stamps.every((s) => s.mood_scale_version === 'v1')).toBe(true);
  });
});

describe('backupService — v2 round-trip', () => {
  test('buildBackupData → JSON → parseAndValidate → restoreData preserves mood_log + text_library + weekly_reviews', async () => {
    // Sembrar v2 data antes de exportar.
    db.prepare(
      `INSERT INTO mood_log (id, kind, date_key, occurred_at, mood_value, mood_scale_version, created_at, updated_at)
       VALUES ('ml1','note','2026-05-10','2026-05-10T08:00:00Z',6,'v1','2026-05-10','2026-05-10')`,
    ).run();
    db.prepare(
      `INSERT INTO text_library (id, kind, text, author, is_active, created_at, updated_at)
       VALUES ('tl1','quote','Sé el cambio','Gandhi',1,'2026-05-10','2026-05-10')`,
    ).run();
    db.prepare(
      `INSERT INTO weekly_reviews (id, week_key, week_start, mood_avg, sleep_avg, top_habits_json, answers_json, created_at, updated_at)
       VALUES ('wr1','2026-W19','2026-05-04',7,7.5,'[]','{}','2026-05-10','2026-05-10')`,
    ).run();

    const data = await buildBackupData();
    const json = JSON.stringify(data);
    const parsed = parseAndValidate(json);
    await restoreData(parsed);

    expect((db.prepare("SELECT COUNT(*) AS c FROM mood_log").get() as { c: number }).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS c FROM text_library").get() as { c: number }).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS c FROM weekly_reviews").get() as { c: number }).c).toBe(1);
  });

  test('buildBackupData output does NOT include drafts (FOUND-04 transient)', async () => {
    db.prepare(
      "INSERT INTO drafts (id, kind, key, payload_json, updated_at) VALUES ('d1','note','k1','{}','2026-05-10')",
    ).run();

    const data = await buildBackupData();
    expect((data as unknown as Record<string, unknown>).drafts).toBeUndefined();
  });
});

describe('backupService — v3+ reject', () => {
  test('parseAndValidate({version:3,...}) throws "Backup más nuevo que la app"', () => {
    const json = JSON.stringify({
      version: 3,
      exportedAt: '2027-01-01T00:00:00Z',
      habits: [],
      performed_habits: [],
      daily_assignments: [],
    });
    expect(() => parseAndValidate(json)).toThrow(/Backup más nuevo/);
  });
});

describe('backupService — v2 partial tolerance', () => {
  test('v2 without text_library / weekly_reviews keys → defaults to []', () => {
    const json = JSON.stringify({
      version: 2,
      exportedAt: '2026-05-10T00:00:00Z',
      habits: [],
      performed_habits: [],
      daily_assignments: [],
      mood_log: [],
      // text_library, weekly_reviews omitidos
    });
    const data = parseAndValidate(json);
    expect(data.text_library).toEqual([]);
    expect(data.weekly_reviews).toEqual([]);
  });
});
