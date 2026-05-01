/**
 * src/__tests__/setup/testDatabase.ts
 *
 * Crea una DB SQLite in-memory (better-sqlite3) con el mismo schema de producción.
 * NO impacta en la DB real del usuario (que usa expo-sqlite en el dispositivo).
 *
 * Uso en tests:
 *   import { createTestDatabase, resetTestDatabase } from './setup/testDatabase';
 *   beforeEach(() => { db = createTestDatabase(); });
 *   afterEach(() => resetTestDatabase());
 */

import Database from 'better-sqlite3';
import { setMockDatabase, clearMockDatabase } from '../../../__mocks__/expo-sqlite';

// ─── Schema (espejo exacto de db.ts) ────────────────────────────────────────

const SQL_CREATE_HABITS = `
  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    base_points INTEGER NOT NULL DEFAULT 1,
    default_categories TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1
  )
`;

const SQL_CREATE_PERFORMED = `
  CREATE TABLE IF NOT EXISTS performed_habits (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    points_earned REAL NOT NULL,
    habit_description TEXT,
    categories_used TEXT,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  )
`;

const SQL_CREATE_MOODS = `
  CREATE TABLE IF NOT EXISTS mood_entries (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL,
    description TEXT,
    timestamp TEXT NOT NULL,
    habit_id TEXT,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
  )
`;

const SQL_CREATE_ASSIGNMENTS = `
  CREATE TABLE IF NOT EXISTS daily_assignments (
    id TEXT PRIMARY KEY,
    habit_id TEXT,
    date TEXT NOT NULL,
    snapshot_name TEXT NOT NULL,
    snapshot_points INTEGER NOT NULL DEFAULT 0,
    snapshot_categories TEXT DEFAULT '[]',
    snapshot_frequency TEXT DEFAULT 'daily',
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_spontaneous INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
  )
`;

// Índice único (fix Bug 1) — incluido en el schema de test
const SQL_UNIQUE_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_habit_date
  ON daily_assignments(habit_id, date)
  WHERE habit_id IS NOT NULL
`;

// ─── API pública ─────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

/**
 * Crea una DB in-memory fresca e inyecta en el mock de expo-sqlite.
 * Llamar en beforeEach().
 */
export function createTestDatabase(): Database.Database {
  _db = new Database(':memory:');
  _db.pragma('foreign_keys = ON');
  _db.exec(SQL_CREATE_HABITS);
  _db.exec(SQL_CREATE_PERFORMED);
  _db.exec(SQL_CREATE_MOODS);
  _db.exec(SQL_CREATE_ASSIGNMENTS);
  _db.exec(SQL_UNIQUE_INDEX);
  setMockDatabase(_db);
  return _db;
}

/**
 * Cierra la DB de test y limpia el mock.
 * Llamar en afterEach().
 */
export function resetTestDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
  clearMockDatabase();
}

// ─── Helpers de seed ─────────────────────────────────────────────────────────

export interface TestHabitOpts {
  id: string;
  name: string;
  frequency?: string;
  base_points?: number;
  default_categories?: string;
  is_active?: number;
}

/** Inserta un hábito directamente en la DB de test (bypass service layer). */
export function insertTestHabit(db: Database.Database, opts: TestHabitOpts): void {
  db.prepare(`
    INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.name,
    opts.frequency ?? 'daily',
    opts.base_points ?? 1,
    opts.default_categories ?? '[]',
    opts.is_active ?? 1,
  );
}

export interface TestAssignmentOpts {
  id: string;
  habit_id: string | null;
  date: string;
  snapshot_name?: string;
  snapshot_points?: number;
  snapshot_categories?: string;
  snapshot_frequency?: string;
  is_completed?: number;
  is_spontaneous?: number;
}

/** Inserta una asignación directamente en la DB de test (bypass service layer). */
export function insertTestAssignment(db: Database.Database, opts: TestAssignmentOpts): void {
  db.prepare(`
    INSERT INTO daily_assignments
      (id, habit_id, date, snapshot_name, snapshot_points, snapshot_categories, snapshot_frequency, is_completed, is_spontaneous)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.habit_id,
    opts.date,
    opts.snapshot_name ?? 'Test Habit',
    opts.snapshot_points ?? 1,
    opts.snapshot_categories ?? '[]',
    opts.snapshot_frequency ?? 'daily',
    opts.is_completed ?? 0,
    opts.is_spontaneous ?? 0,
  );
}

// ─── Variante pre-migración (sin UNIQUE INDEX) ───────────────────────────────
//
// REQ-04-04..REQ-04-07: para testear la migración v1, los tests necesitan
// sembrar duplicados en la DB. El UNIQUE INDEX presente en createTestDatabase()
// rechaza esos seeds. Esta variante crea el mismo schema PERO omite el index,
// emulando el estado de prod pre-migración.

export function createPreMigrationTestDatabase(): Database.Database {
  _db = new Database(':memory:');
  _db.pragma('foreign_keys = ON');
  _db.exec(SQL_CREATE_HABITS);
  _db.exec(SQL_CREATE_PERFORMED);
  _db.exec(SQL_CREATE_MOODS);
  _db.exec(SQL_CREATE_ASSIGNMENTS);
  // NOTA: SQL_UNIQUE_INDEX intencionalmente NO se ejecuta aquí.
  setMockDatabase(_db);
  return _db;
}

// ─── Helpers de seed adicionales ─────────────────────────────────────────────

export interface TestPerformedOpts {
  id: string;
  habit_id: string;
  timestamp: string; // 'YYYY-MM-DD HH:MM:SS'
  points_earned?: number;
  habit_description?: string | null;
  categories_used?: string | null;
}

/** Inserta un performed_habit directamente (bypass service). */
export function insertTestPerformed(db: Database.Database, opts: TestPerformedOpts): void {
  db.prepare(`
    INSERT INTO performed_habits
      (id, habit_id, timestamp, points_earned, habit_description, categories_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.habit_id,
    opts.timestamp,
    opts.points_earned ?? 1,
    opts.habit_description ?? null,
    opts.categories_used ?? null,
  );
}

export interface DuplicateSeedOpts {
  /** Cuántos duplicados crear (default 2). */
  count?: number;
  /** Si true, marca al menos uno como is_completed=1. */
  withCompleted?: boolean;
  /** Si true, también inserta un performed_habit linked. */
  withPerformedLink?: boolean;
}

/**
 * Inserta `count` duplicados en (habit_id, date). El primero NO está completado;
 * si withCompleted, el segundo SÍ. Si withPerformedLink, agrega un performed_habit.
 *
 * REQUIERE que la DB sea creada con createPreMigrationTestDatabase()
 * (createTestDatabase normal rechazaría por UNIQUE INDEX).
 */
export function seedDuplicates(
  db: Database.Database,
  habitId: string,
  date: string,
  opts: DuplicateSeedOpts = {},
): string[] {
  const count = opts.count ?? 2;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `dup-${habitId}-${date}-${i}`;
    insertTestAssignment(db, {
      id,
      habit_id: habitId,
      date,
      snapshot_name: `Dup ${i}`,
      is_completed: opts.withCompleted && i === count - 1 ? 1 : 0,
    });
    ids.push(id);
  }
  if (opts.withPerformedLink) {
    insertTestPerformed(db, {
      id: `perf-${habitId}-${date}`,
      habit_id: habitId,
      timestamp: `${date} 10:00:00`,
    });
  }
  return ids;
}
