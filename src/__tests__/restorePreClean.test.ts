/**
 * restorePreClean.test.ts — REQ-04-03 (integration-level).
 *
 * Verifica que `backupService.restoreData` aplica `dedupeAssignmentsArray`
 * pre-bulk-insert para que un backup pre-Phase-4 con duplicados no rompa el
 * partial UNIQUE INDEX (idx_unique_habit_date) introducido por la migración v1.
 *
 * Usa `createTestDatabase()` (que YA incluye el index) — escenario realista:
 * si el pre-clean fallara, el segundo INSERT del par duplicado lanzaría
 * `UNIQUE constraint failed`, lo cual el test detectaría como rechazo de
 * `await restoreData(...)`.
 */

// Mocks de módulos nativos que backupService importa pero que no están bajo test.
// expo-sharing y expo-document-picker sólo se usan en exportBackup/importBackup
// (path de UI), NO en restoreData. Stubs vacíos evitan que Jest falle al transpilar.
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }), { virtual: true });
jest.mock(
  'expo-document-picker',
  () => ({ getDocumentAsync: jest.fn() }),
  { virtual: true },
);

import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  resetTestDatabase,
} from './setup/testDatabase';
import { restoreData } from '../services/backupService';
import type { BackupData } from '../types';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});

function makeBackup(over: Partial<BackupData> = {}): BackupData {
  return {
    version: 1,
    exportedAt: '2026-03-15T10:00:00.000Z',
    habits: [
      {
        id: 'h1',
        name: 'Meditar',
        frequency: 'daily',
        base_points: 1,
        default_categories: '[]',
        is_active: 1,
      },
    ],
    performed_habits: [],
    mood_entries: [],
    daily_assignments: [],
    ...over,
  };
}

function countAssignments(): number {
  return (
    db.prepare('SELECT COUNT(*) as c FROM daily_assignments').get() as {
      c: number;
    }
  ).c;
}

function countAssignmentsForHabit(habitId: string): number {
  return (
    db
      .prepare('SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ?')
      .get(habitId) as { c: number }
  ).c;
}

describe('restoreData pre-clean — REQ-04-03', () => {
  test('REQ-04-03: JSON sin duplicados → todas las rows persistidas', async () => {
    const backup = makeBackup({
      daily_assignments: [
        {
          id: 'a1',
          habit_id: 'h1',
          date: '2026-03-15',
          snapshot_name: 'Meditar',
          snapshot_points: 1,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 0,
          is_spontaneous: 0,
        },
      ],
    });
    await restoreData(backup);
    expect(countAssignments()).toBe(1);
  });

  test('REQ-04-03: JSON con duplicados regulares (uno completed) → sobrevive el completed, sin UNIQUE error', async () => {
    const backup = makeBackup({
      daily_assignments: [
        {
          id: 'a1',
          habit_id: 'h1',
          date: '2026-03-15',
          snapshot_name: 'Meditar',
          snapshot_points: 1,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 0,
          is_spontaneous: 0,
        },
        {
          id: 'a2',
          habit_id: 'h1',
          date: '2026-03-15',
          snapshot_name: 'Meditar',
          snapshot_points: 1,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 0,
        },
      ],
    });
    await restoreData(backup); // NO debe arrojar UNIQUE constraint
    expect(countAssignmentsForHabit('h1')).toBe(1);
    const survivor = db
      .prepare(
        'SELECT id, is_completed FROM daily_assignments WHERE habit_id = ?',
      )
      .get('h1') as { id: string; is_completed: number };
    expect(survivor.is_completed).toBe(1); // D-03 step 1: completed wins
  });

  test('REQ-04-03: spontaneous duplicados (habit_id=null) → todos persisten (passthrough)', async () => {
    const backup = makeBackup({
      daily_assignments: [
        {
          id: 's1',
          habit_id: null,
          date: '2026-03-15',
          snapshot_name: 'Logro 1',
          snapshot_points: 0,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 1,
        },
        {
          id: 's2',
          habit_id: null,
          date: '2026-03-15',
          snapshot_name: 'Logro 2',
          snapshot_points: 0,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 1,
        },
        {
          id: 's3',
          habit_id: null,
          date: '2026-03-15',
          snapshot_name: 'Logro 3',
          snapshot_points: 0,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 1,
        },
      ],
    });
    await restoreData(backup);
    expect(countAssignments()).toBe(3);
  });

  test('REQ-04-03: mixed — 2 duplicados regulares + 1 spontaneous → 1 regular + 1 spontaneous', async () => {
    const backup = makeBackup({
      daily_assignments: [
        {
          id: 's1',
          habit_id: null,
          date: '2026-03-15',
          snapshot_name: 'Spontaneous',
          snapshot_points: 0,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 1,
        },
        {
          id: 'a1',
          habit_id: 'h1',
          date: '2026-03-15',
          snapshot_name: 'Meditar',
          snapshot_points: 1,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 0,
          is_spontaneous: 0,
        },
        {
          id: 'a2',
          habit_id: 'h1',
          date: '2026-03-15',
          snapshot_name: 'Meditar',
          snapshot_points: 1,
          snapshot_categories: '[]',
          snapshot_frequency: 'daily',
          is_completed: 1,
          is_spontaneous: 0,
        },
      ],
    });
    await restoreData(backup);
    expect(countAssignments()).toBe(2);
    expect(countAssignmentsForHabit('h1')).toBe(1);
  });
});
