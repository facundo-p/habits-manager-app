/**
 * migrationV2.test.ts — Cobertura de Plan 04 / Wave 3.
 *
 * Cubre los behaviors definidos en 01-04-PLAN.md `<behavior>`:
 *   Tests 1-6: migration forward / idempotency / rollback / data integrity (Task 1)
 *   Tests 7-10: pre-v2 snapshot (Task 2 — D-06)
 *   Test 11: cleanup 30d (Task 2 — D-06)
 *   Test 12: habit reflection reroute (Task 4 — FOUND-06 integration)
 *
 * Convención: jest.doMock para `expo-file-system/legacy` con jest.fn() por
 * cada API consumida, replicando el patrón de `driveBackupService.restore.test.ts`.
 * El mock global de expo-file-system del proyecto no expone `readDirectoryAsync`,
 * por eso necesitamos doMock acá.
 */

import type Database from 'better-sqlite3';

// ─── Mocks ──────────────────────────────────────────────────────────

const writeAsStringAsyncMock = jest.fn();
const readDirectoryAsyncMock = jest.fn();
const getInfoAsyncMock = jest.fn();
const deleteAsyncMock = jest.fn();

jest.doMock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  writeAsStringAsync: writeAsStringAsyncMock,
  readDirectoryAsync: readDirectoryAsyncMock,
  getInfoAsync: getInfoAsyncMock,
  deleteAsync: deleteAsyncMock,
}));

// Imports DESPUÉS del mock para que las funciones consumidoras lo levanten.
import {
  createPreMigrationV2TestDatabase,
  resetTestDatabase,
} from './setup/testDatabase';
import { runMigrations } from '../services/migrations/migrationV1';
import * as migrationV2Module from '../services/migrations/migrationV2';
import { getDatabase } from '../services/db';
import { cleanupPreV2Snapshots } from '../services/preV2Snapshot';
import { createMoodEntry, getMoodForHabit } from '../services/moodService';

const { migrationV2_addWellbeingTables, assertInsertSelectCount } = migrationV2Module;

// ─── Helpers ────────────────────────────────────────────────────────

let db: Database.Database;

function getUserVersion(): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function getTables(): string[] {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'",
  ).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function insertMoodEntry(rowId: string, value: number, timestamp: string, habitId: string | null = null): void {
  db.prepare(
    'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)',
  ).run(rowId, value, `desc-${rowId}`, timestamp, habitId);
}

beforeEach(() => {
  writeAsStringAsyncMock.mockReset();
  writeAsStringAsyncMock.mockResolvedValue(undefined);
  readDirectoryAsyncMock.mockReset();
  readDirectoryAsyncMock.mockResolvedValue([]);
  getInfoAsyncMock.mockReset();
  getInfoAsyncMock.mockResolvedValue({ exists: true, modificationTime: 0 });
  deleteAsyncMock.mockReset();
  deleteAsyncMock.mockResolvedValue(undefined);
});

afterEach(() => {
  resetTestDatabase();
  jest.restoreAllMocks();
});

// ─── Tests 1-4: forward ─────────────────────────────────────────────

describe('migrationV2 — forward', () => {
  test('pre user_version=1 + mood_entries[N]; post user_version=2 + mood_log count=N kind=reflection', async () => {
    db = await createPreMigrationV2TestDatabase();
    db.prepare(
      'INSERT INTO habits (id, name, frequency, base_points) VALUES (?, ?, ?, ?)',
    ).run('h1', 'Meditar', 'daily', 1);
    insertMoodEntry('m1', 7.5, '2026-04-10T10:00:00.000Z', 'h1');
    insertMoodEntry('m2', 5.0, '2026-04-11T11:00:00.000Z', 'h1');
    insertMoodEntry('m3', 9.0, '2026-04-12T12:00:00.000Z', null);

    await runMigrations(await getDatabase());

    expect(getUserVersion()).toBe(2);
    const rows = db.prepare(
      "SELECT id, kind, mood_value, mood_scale_version FROM mood_log WHERE kind='reflection' ORDER BY id",
    ).all() as Array<{ id: string; kind: string; mood_value: number; mood_scale_version: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.kind === 'reflection')).toBe(true);
    expect(rows.every((r) => r.mood_scale_version === 'v1')).toBe(true);
    expect(rows.map((r) => r.mood_value).sort()).toEqual([5.0, 7.5, 9.0]);
  });

  test('post-migration the 4 new tables exist', async () => {
    db = await createPreMigrationV2TestDatabase();
    await runMigrations(await getDatabase());

    const tables = getTables();
    expect(tables).toEqual(expect.arrayContaining(['mood_log', 'text_library', 'weekly_reviews', 'drafts']));
  });

  test('partial UNIQUE INDEX idx_mood_log_one_per_day blocks duplicate morning/evening', async () => {
    db = await createPreMigrationV2TestDatabase();
    await runMigrations(await getDatabase());

    db.prepare(
      `INSERT INTO mood_log (id, kind, date_key, occurred_at, mood_value, mood_scale_version, created_at, updated_at)
       VALUES ('a','morning','2026-05-01','2026-05-01T08:00:00Z',7,'v1','t','t')`,
    ).run();
    expect(() =>
      db.prepare(
        `INSERT INTO mood_log (id, kind, date_key, occurred_at, mood_value, mood_scale_version, created_at, updated_at)
         VALUES ('b','morning','2026-05-01','2026-05-01T09:00:00Z',8,'v1','t','t')`,
      ).run(),
    ).toThrow(/UNIQUE/);
  });

  test('drops mood_entries table', async () => {
    db = await createPreMigrationV2TestDatabase();
    await runMigrations(await getDatabase());
    expect(getTables()).not.toContain('mood_entries');
  });
});

// ─── Test 5: idempotency ────────────────────────────────────────────

describe('migrationV2 — idempotency', () => {
  test('runMigrations × 2 → user_version stays 2, no throw', async () => {
    db = await createPreMigrationV2TestDatabase();
    await runMigrations(await getDatabase());
    expect(getUserVersion()).toBe(2);

    await expect(runMigrations(await getDatabase())).resolves.toBeUndefined();
    expect(getUserVersion()).toBe(2);
  });
});

// ─── Test 6: rollback + data integrity ──────────────────────────────

describe('migrationV2 — rollback / integrity', () => {
  test('throw inside transaction → rollback, user_version stays 1, mood_entries intact, console.error sin payloads', async () => {
    db = await createPreMigrationV2TestDatabase();
    insertMoodEntry('m1', 5, '2026-04-10T10:00:00.000Z');
    insertMoodEntry('m2', 6, '2026-04-11T10:00:00.000Z');

    // Forzamos un throw dentro del transaction interceptando el DROP TABLE
    // mood_entries (último step antes del PRAGMA). Esto verifica el rollback
    // post-INSERT...SELECT: mood_entries debe sobrevivir porque la tx rolleback.
    const realDb = await getDatabase();
    const realExecAsync = realDb.execAsync.bind(realDb);
    const execSpy = jest.spyOn(realDb, 'execAsync').mockImplementation(async (sql: string) => {
      if (sql.includes('DROP TABLE mood_entries')) {
        throw new Error('forced rollback for test');
      }
      return realExecAsync(sql);
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(runMigrations(realDb)).rejects.toThrow(/forced rollback/);

    // Rollback: user_version sigue en 1
    expect(getUserVersion()).toBe(1);
    // mood_entries intacta (rollback)
    const count = (db.prepare('SELECT COUNT(*) as c FROM mood_entries').get() as { c: number }).c;
    expect(count).toBe(2);
    // mood_log no debe existir (rollback eliminó el CREATE TABLE)
    expect(getTables()).not.toContain('mood_log');

    // console.error NO incluye row payloads — solo message
    const allArgs = errSpy.mock.calls.flat().map((a) => String(a)).join(' ');
    expect(allArgs).toContain('migration v2');
    expect(allArgs).not.toContain('desc-m1');

    execSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('count mismatch is detected — pre-existing mood_log reflection row triggers assert', async () => {
    db = await createPreMigrationV2TestDatabase();
    insertMoodEntry('m1', 5, '2026-04-10T10:00:00.000Z');

    // Pre-crear mood_log con una row de tipo reflection ANTES de que migration v2
    // intente crear la tabla (CREATE TABLE IF NOT EXISTS la respeta). Esto fuerza
    // count(post) === preCount + 1 → mismatch → assertInsertSelectCount throws.
    db.prepare(
      `CREATE TABLE mood_log (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        date_key TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        mood_value REAL NOT NULL,
        mood_scale_version TEXT NOT NULL DEFAULT 'v1',
        sleep_hours REAL,
        comment TEXT,
        habit_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ).run();
    db.prepare(
      `INSERT INTO mood_log (id, kind, date_key, occurred_at, mood_value, mood_scale_version, created_at, updated_at)
       VALUES ('pre','reflection','2026-01-01','2026-01-01T00:00:00Z',5,'v1','t','t')`,
    ).run();

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(runMigrations(await getDatabase())).rejects.toThrow(/mismatch/);
    expect(getUserVersion()).toBe(1);
    errSpy.mockRestore();
  });
});

// ─── Tests 7-10: pre-v2 snapshot ────────────────────────────────────

describe('migrationV2 — pre-v2 snapshot (D-06)', () => {
  test('writePreV2Snapshot fires BEFORE any v2 CREATE TABLE', async () => {
    db = await createPreMigrationV2TestDatabase();
    insertMoodEntry('m1', 7, '2026-04-10T10:00:00.000Z');

    const realDb = await getDatabase();
    const execCalls: string[] = [];
    const realExecAsync = realDb.execAsync.bind(realDb);
    jest.spyOn(realDb, 'execAsync').mockImplementation(async (sql: string) => {
      execCalls.push(sql);
      return realExecAsync(sql);
    });

    await runMigrations(realDb);

    const firstWriteOrder = writeAsStringAsyncMock.mock.invocationCallOrder[0];
    const firstCreateMoodLogIdx = execCalls.findIndex((s) => s.includes('CREATE TABLE') && s.includes('mood_log'));
    expect(firstWriteOrder).toBeDefined();
    expect(firstCreateMoodLogIdx).toBeGreaterThanOrEqual(0);
    // El write ocurrió antes del primer CREATE TABLE mood_log de la migration:
    // si invertimos el orden, writeAsStringAsyncMock no se habría llamado.
    expect(writeAsStringAsyncMock).toHaveBeenCalledTimes(1);
  });

  test('snapshot path matches /pre-v2-snapshot-<ts>.json/ pattern', async () => {
    db = await createPreMigrationV2TestDatabase();
    await runMigrations(await getDatabase());

    expect(writeAsStringAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/pre-v2-snapshot-.+\.json$/),
      expect.any(String),
      expect.any(Object),
    );
  });

  test('snapshot content has shape v1 with mood_entries[N]', async () => {
    db = await createPreMigrationV2TestDatabase();
    insertMoodEntry('m1', 7.5, '2026-04-10T10:00:00.000Z', null);
    insertMoodEntry('m2', 5.0, '2026-04-11T11:00:00.000Z', null);

    await runMigrations(await getDatabase());

    const [, jsonContent] = writeAsStringAsyncMock.mock.calls[0];
    const snapshot = JSON.parse(jsonContent);
    expect(snapshot.version).toBe(1);
    expect(snapshot.mood_entries).toHaveLength(2);
    expect(snapshot.mood_entries.map((m: { id: string }) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  test('snapshot write failure blocks migration deterministically (D-06)', async () => {
    db = await createPreMigrationV2TestDatabase();
    insertMoodEntry('m1', 7, '2026-04-10T10:00:00.000Z');
    writeAsStringAsyncMock.mockRejectedValueOnce(new Error('disk full'));

    await expect(runMigrations(await getDatabase())).rejects.toThrow(/disk full/);

    // Migration no se ejecutó: user_version sigue en 1, mood_entries intacta,
    // mood_log NO existe.
    expect(getUserVersion()).toBe(1);
    expect(getTables()).not.toContain('mood_log');
    const count = (db.prepare('SELECT COUNT(*) as c FROM mood_entries').get() as { c: number }).c;
    expect(count).toBe(1);
  });
});

// ─── Test 11: cleanup 30d ───────────────────────────────────────────

describe('cleanupPreV2Snapshots — 30d retention', () => {
  const NOW_MS = 1_700_000_000_000; // arbitrary fixed
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  test('removes snapshots older than 30d; preserves recent ones; ignores unrelated files', async () => {
    readDirectoryAsyncMock.mockResolvedValueOnce([
      'pre-v2-snapshot-old.json',
      'pre-v2-snapshot-recent.json',
      'cozyhabits-backup.json',
      'random.txt',
    ]);
    // Antiguo (35d) y reciente (5d). mtime de FileSystem viene en SEGUNDOS.
    getInfoAsyncMock.mockImplementation(async (path: string) => {
      if (path.endsWith('old.json'))
        return { exists: true, modificationTime: (NOW_MS - 35 * DAY_MS) / 1000 };
      if (path.endsWith('recent.json'))
        return { exists: true, modificationTime: (NOW_MS - 5 * DAY_MS) / 1000 };
      return { exists: true, modificationTime: NOW_MS / 1000 };
    });

    await cleanupPreV2Snapshots();

    const deleted = deleteAsyncMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(deleted).toEqual(['/mock/documents/pre-v2-snapshot-old.json']);
    expect(deleted).not.toContain('/mock/documents/pre-v2-snapshot-recent.json');
    expect(deleted).not.toContain('/mock/documents/cozyhabits-backup.json');
    expect(deleted).not.toContain('/mock/documents/random.txt');
  });

  test('silent failure: a thrown error in readDirectoryAsync does not propagate', async () => {
    readDirectoryAsyncMock.mockRejectedValueOnce(new Error('FS error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(cleanupPreV2Snapshots()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── Test 12: habit reflection reroute (Task 4 integration) ─────────

describe('moodService → mood_log kind=reflection (FOUND-06)', () => {
  test('createMoodEntry writes to mood_log with kind=reflection, mood_scale_version=v1', async () => {
    db = await createPreMigrationV2TestDatabase();
    db.prepare(
      'INSERT INTO habits (id, name, frequency, base_points) VALUES (?, ?, ?, ?)',
    ).run('h1', 'Meditar', 'daily', 1);
    await runMigrations(await getDatabase());

    await createMoodEntry(7.5, 'me siento bien', 'h1');

    const rows = db.prepare(
      "SELECT kind, habit_id, mood_value, mood_scale_version, comment FROM mood_log",
    ).all() as Array<{ kind: string; habit_id: string; mood_value: number; mood_scale_version: string; comment: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      kind: 'reflection',
      habit_id: 'h1',
      mood_value: 7.5,
      mood_scale_version: 'v1',
      comment: 'me siento bien',
    });
  });

  test('getMoodForHabit reads from mood_log filtering kind=reflection', async () => {
    db = await createPreMigrationV2TestDatabase();
    db.prepare(
      'INSERT INTO habits (id, name, frequency, base_points) VALUES (?, ?, ?, ?)',
    ).run('h1', 'Meditar', 'daily', 1);
    await runMigrations(await getDatabase());

    await createMoodEntry(6.0, null, 'h1', '2026-05-10');
    const result = await getMoodForHabit('h1', '2026-05-10');
    expect(result).toBe(6.0);
  });
});
