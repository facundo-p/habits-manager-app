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
import type { MoodEntry } from '../../types';

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

// ─── Schema v2 (espejo de research/ARCHITECTURE.md §2) ──────────────────────
// Estas constantes serán importadas por src/db/migrations/migrationV2.ts (Wave 3)
// como single source of truth — ver T-01-01 en 01-01-PLAN.md threat model.

export const SQL_CREATE_MOOD_LOG_V2 = `
  CREATE TABLE IF NOT EXISTS mood_log (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('morning','evening','note','reflection')),
    date_key TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    mood_value REAL NOT NULL,
    mood_scale_version TEXT NOT NULL DEFAULT 'v1',
    sleep_hours REAL,
    comment TEXT,
    habit_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
  )
`;

export const SQL_CREATE_TEXT_LIBRARY_V2 = `
  CREATE TABLE IF NOT EXISTS text_library (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('quote')),
    text TEXT NOT NULL,
    author TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_CREATE_WEEKLY_REVIEWS_V2 = `
  CREATE TABLE IF NOT EXISTS weekly_reviews (
    id TEXT PRIMARY KEY,
    week_key TEXT NOT NULL UNIQUE,
    week_start TEXT NOT NULL,
    mood_avg REAL,
    sleep_avg REAL,
    top_habits_json TEXT NOT NULL DEFAULT '[]',
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_CREATE_DRAFTS_V2 = `
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_INDEX_MOOD_LOG_ONE_PER_DAY = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_log_one_per_day
  ON mood_log(kind, date_key)
  WHERE kind IN ('morning','evening')
`;

export const SQL_INDEX_MOOD_LOG_DATE_KEY = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_date_key ON mood_log(date_key)
`;

export const SQL_INDEX_MOOD_LOG_KIND = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_kind ON mood_log(kind)
`;

export const SQL_INDEX_MOOD_LOG_HABIT_ID = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_habit_id
  ON mood_log(habit_id)
  WHERE habit_id IS NOT NULL
`;

export const SQL_INDEX_TEXT_LIBRARY_KIND_ACTIVE = `
  CREATE INDEX IF NOT EXISTS idx_text_library_kind_active
  ON text_library(kind, is_active)
`;

export const SQL_INDEX_DRAFTS_KIND_KEY = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_kind_key
  ON drafts(kind, key)
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

// ─── Variante pre-migración v2 ───────────────────────────────────────────────
//
// FOUND-03/04 (Wave 3): los tests de migrationV2 necesitan una DB que represente
// el estado post-migrationV1 (user_version=1 + UNIQUE INDEX) con la tabla legacy
// `mood_entries` poblable para validar la migración a `mood_log`.

export interface PreMigrationV2Opts {
  /** Filas a sembrar en mood_entries antes de correr migrationV2. */
  moodEntries?: MoodEntry[];
}

function seedMoodEntries(db: Database.Database, rows: MoodEntry[]): void {
  const stmt = db.prepare(`
    INSERT INTO mood_entries (id, value, description, timestamp, habit_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const r of rows) {
    stmt.run(r.id, r.value, r.description, r.timestamp, r.habit_id);
  }
}

export async function createPreMigrationV2TestDatabase(
  opts: PreMigrationV2Opts = {},
): Promise<Database.Database> {
  _db = new Database(':memory:');
  _db.pragma('foreign_keys = ON');
  _db.exec(SQL_CREATE_HABITS);
  _db.exec(SQL_CREATE_PERFORMED);
  _db.exec(SQL_CREATE_MOODS);
  _db.exec(SQL_CREATE_ASSIGNMENTS);
  _db.exec(SQL_UNIQUE_INDEX);
  _db.pragma('user_version = 1');
  if (opts.moodEntries?.length) seedMoodEntries(_db, opts.moodEntries);
  setMockDatabase(_db);
  return _db;
}

// ─── Variante post-migración v2 ──────────────────────────────────────────────
//
// Schema final de v2: habits + performed_habits + daily_assignments (pre-v2 sin
// mood_entries) + mood_log + text_library + weekly_reviews + drafts.

function createV2Tables(db: Database.Database): void {
  db.exec(SQL_CREATE_HABITS);
  db.exec(SQL_CREATE_PERFORMED);
  db.exec(SQL_CREATE_ASSIGNMENTS);
  db.exec(SQL_CREATE_MOOD_LOG_V2);
  db.exec(SQL_CREATE_TEXT_LIBRARY_V2);
  db.exec(SQL_CREATE_WEEKLY_REVIEWS_V2);
  db.exec(SQL_CREATE_DRAFTS_V2);
}

function createV2Indexes(db: Database.Database): void {
  db.exec(SQL_UNIQUE_INDEX);
  db.exec(SQL_INDEX_MOOD_LOG_ONE_PER_DAY);
  db.exec(SQL_INDEX_MOOD_LOG_DATE_KEY);
  db.exec(SQL_INDEX_MOOD_LOG_KIND);
  db.exec(SQL_INDEX_MOOD_LOG_HABIT_ID);
  db.exec(SQL_INDEX_TEXT_LIBRARY_KIND_ACTIVE);
  db.exec(SQL_INDEX_DRAFTS_KIND_KEY);
}

export async function createPostMigrationV2TestDatabase(): Promise<Database.Database> {
  _db = new Database(':memory:');
  _db.pragma('foreign_keys = ON');
  createV2Tables(_db);
  createV2Indexes(_db);
  _db.pragma('user_version = 2');
  setMockDatabase(_db);
  return _db;
}
