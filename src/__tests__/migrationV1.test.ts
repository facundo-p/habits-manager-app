/**
 * migrationV1.test.ts — Tests para REQ-04-04..REQ-04-09
 *
 * Cubre:
 *   - D-03 priority (completed > has_performed > rowid ASC)
 *   - REQ-04-05: partial UNIQUE INDEX idx_unique_habit_date
 *   - REQ-04-06: idempotency vía PRAGMA user_version
 *   - REQ-04-07: silent failure (console.error + DB en versión 0)
 *   - REQ-04-08: spontaneous (habit_id NULL) permitidos múltiples por día
 *   - REQ-04-09: rechazo de duplicados regulares post-migration
 */

// v1 tests focalizan SOLO en migration v1. Mockeamos v2 a no-op para que el
// dispatcher de runMigrations no contamine los asserts de user_version y no
// requiera fixtures v2 (mood_log no existe en createPreMigrationTestDatabase).
jest.mock('../services/migrations/migrationV2', () => ({
  migrationV2_addWellbeingTables: jest.fn().mockResolvedValue(undefined),
}));

import type Database from 'better-sqlite3';
import {
  createPreMigrationTestDatabase,
  resetTestDatabase,
  insertTestHabit,
  insertTestAssignment,
  seedDuplicates,
} from './setup/testDatabase';
import { runMigrations } from '../services/migrations/migrationV1';
import { getDatabase } from '../services/db';

let db: Database.Database;

beforeEach(() => {
  db = createPreMigrationTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.restoreAllMocks();
});

function getUserVersion(): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function hasUniqueIndex(): boolean {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_unique_habit_date'",
  ).get();
  return row !== undefined;
}

function countAssignmentsForHabitDate(habitId: string, date: string): number {
  return (db.prepare(
    'SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ? AND date = ?',
  ).get(habitId, date) as { c: number }).c;
}

function getSurvivor(habitId: string, date: string): { id: string; is_completed: number } {
  return db.prepare(
    'SELECT id, is_completed FROM daily_assignments WHERE habit_id = ? AND date = ?',
  ).get(habitId, date) as { id: string; is_completed: number };
}

describe('migration v1 — REQ-04-04..09', () => {
  test('REQ-04-04 D-03 step 1: completed wins', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    seedDuplicates(db, 'h1', '2026-03-15', { count: 2, withCompleted: true });
    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(2);

    await runMigrations(await getDatabase());

    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(1);
    expect(getSurvivor('h1', '2026-03-15').is_completed).toBe(1);
  });

  test('REQ-04-04 D-03 step 2: has_performed wins on completion tie', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestHabit(db, { id: 'h2', name: 'Caminar' });
    // h1: dos rows uncompleted, una con performed_link
    seedDuplicates(db, 'h1', '2026-03-15', { count: 2, withPerformedLink: true });
    // h2: dos rows uncompleted, sin performed_link
    seedDuplicates(db, 'h2', '2026-03-15', { count: 2, withPerformedLink: false });

    await runMigrations(await getDatabase());

    // Ambos grupos quedan en 1 row
    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(1);
    expect(countAssignmentsForHabitDate('h2', '2026-03-15')).toBe(1);
    // Ambas siguen uncompleted (step 1 no discriminó)
    expect(getSurvivor('h1', '2026-03-15').is_completed).toBe(0);
    expect(getSurvivor('h2', '2026-03-15').is_completed).toBe(0);
  });

  test('REQ-04-04 D-03 step 3 oldest: rowid ASC en full tie', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    const ids = seedDuplicates(db, 'h1', '2026-03-15', { count: 3 });
    // ids[0] insertado primero → rowid más bajo

    await runMigrations(await getDatabase());

    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(1);
    expect(getSurvivor('h1', '2026-03-15').id).toBe(ids[0]);
  });

  test('REQ-04-05: crea partial UNIQUE INDEX idx_unique_habit_date', async () => {
    expect(hasUniqueIndex()).toBe(false);
    await runMigrations(await getDatabase());
    expect(hasUniqueIndex()).toBe(true);
  });

  test('REQ-04-05/09: post-migration, INDEX rechaza duplicado regular', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: '2026-03-15' });

    await runMigrations(await getDatabase());

    expect(() => {
      insertTestAssignment(db, { id: 'a2', habit_id: 'h1', date: '2026-03-15' });
    }).toThrow(/UNIQUE constraint/);
  });

  test('REQ-04-08: post-migration, INDEX permite múltiples spontaneous (habit_id=null)', async () => {
    await runMigrations(await getDatabase());

    insertTestAssignment(db, {
      id: 's1', habit_id: null, date: '2026-03-15', is_spontaneous: 1,
    });
    insertTestAssignment(db, {
      id: 's2', habit_id: null, date: '2026-03-15', is_spontaneous: 1,
    });
    const c = (db.prepare('SELECT COUNT(*) as c FROM daily_assignments WHERE date = ?').get('2026-03-15') as { c: number }).c;
    expect(c).toBe(2);
  });

  test('REQ-04-06 idempotency: PRAGMA user_version = 1 post-migration', async () => {
    expect(getUserVersion()).toBe(0);
    await runMigrations(await getDatabase());
    expect(getUserVersion()).toBe(1);
  });

  test('REQ-04-06 idempotency: 2x runMigrations no throws ni cambia estado', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    seedDuplicates(db, 'h1', '2026-03-15', { count: 2, withCompleted: true });

    await runMigrations(await getDatabase());
    expect(getUserVersion()).toBe(1);
    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(1);

    await runMigrations(await getDatabase()); // segunda corrida
    expect(getUserVersion()).toBe(1);
    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(1);
  });

  test('REQ-04-07 silent failure: error en migration → console.error + DB queda en v0', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    seedDuplicates(db, 'h1', '2026-03-15', { count: 2 });

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const realDb = await getDatabase();

    // Spy sobre execAsync — primer call dentro de la tx (SQL_DEDUPE_VIA_CTE) throws.
    const execSpy = jest.spyOn(realDb, 'execAsync').mockImplementation(async (sql: string) => {
      if (sql.includes('DELETE FROM daily_assignments')) {
        throw new Error('forced failure on dedup');
      }
      return undefined;
    });

    await runMigrations(realDb);

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[migration v1]'),
      expect.any(Error),
    );
    expect(getUserVersion()).toBe(0);
    expect(countAssignmentsForHabitDate('h1', '2026-03-15')).toBe(2); // ROLLBACK preservó duplicados

    execSpy.mockRestore();
    errSpy.mockRestore();
  });
});
