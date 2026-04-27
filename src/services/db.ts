/**
 * db.ts — Servicio de base de datos SQLite.
 *
 * Solo los archivos en src/services/ pueden ejecutar SQL directamente.
 * Usa expo-sqlite de forma asíncrona (Regla 003).
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { DB_NAME, SEED_HABITS } from '../config/constants';
import { parseAndValidateCategories } from '../utils/parsing';

let _db: SQLite.SQLiteDatabase | null = null;

// ─── Acceso a la instancia ──────────────────────────────────────────

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return _db;
}

export function generateId(): string {
  return Crypto.randomUUID();
}

// ─── Date helpers (compartidos entre services) ──────────────────────

export function getTodayPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isFutureDate(datePrefix: string): boolean {
  return datePrefix > getTodayPrefix();
}

export function getNowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Timestamp para una fecha específica (usa hora actual). */
export function getTimestampForDate(datePrefix: string): string {
  const time = new Date().toISOString().slice(11, 19);
  return `${datePrefix} ${time}`;
}

// ─── Inicialización ─────────────────────────────────────────────────

const SQL_ENABLE_WAL = 'PRAGMA journal_mode = WAL';
const SQL_ENABLE_FK = 'PRAGMA foreign_keys = ON';

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

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await executeSchema(db);
  await migrateSchema(db);
  await sanitizeCategories(db);
  await seedHabits(db);
}

async function executeSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SQL_ENABLE_WAL);
  await db.execAsync(SQL_ENABLE_FK);
  await db.execAsync(SQL_CREATE_HABITS);
  await db.execAsync(SQL_CREATE_PERFORMED);
  await db.execAsync(SQL_CREATE_MOODS);
  await db.execAsync(SQL_CREATE_ASSIGNMENTS);
}

/** Verifica si la tabla daily_assignments ya existe (para uso externo). */
export async function hasDailyAssignmentsTable(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='daily_assignments'",
  );
  return (result?.count ?? 0) > 0;
}

// ─── Migración (para DBs existentes sin is_active) ──────────────────

async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(habits)',
  );
  const hasIsActive = cols.some((c) => c.name === 'is_active');
  if (!hasIsActive) {
    await db.execAsync(
      'ALTER TABLE habits ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1',
    );
  }
}

// ─── Sanitización de categorías ─────────────────────────────────────

/**
 * Recorre habits.default_categories y performed_habits.categories_used.
 * Elimina cualquier ID que NO exista en VALID_AREA_IDS.
 *
 * Caller defensivo invocado en initDatabase() — delega en las dos
 * funciones explícitas por tabla para mantener SQL estático y tipos
 * por columna (DEBT-03).
 */
async function sanitizeCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  await sanitizeHabitDefaultCategories(db);
  await sanitizePerformedCategoriesUsed(db);
}

/**
 * Limpia habits.default_categories eliminando IDs de área inválidos.
 * Defensivo: corre en initDatabase() y no rompe ante datos legacy.
 * Exportada para tests directos (Wave 0).
 */
export async function sanitizeHabitDefaultCategories(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; default_categories: string | null }>(
    'SELECT id, default_categories FROM habits WHERE default_categories IS NOT NULL',
  );
  for (const row of rows) {
    if (row.default_categories == null) continue;
    const cleaned = JSON.stringify(parseAndValidateCategories(row.default_categories));
    if (cleaned !== row.default_categories) {
      await db.runAsync(
        'UPDATE habits SET default_categories = ? WHERE id = ?',
        [cleaned, row.id],
      );
    }
  }
}

/**
 * Limpia performed_habits.categories_used eliminando IDs de área inválidos.
 * Defensivo: corre en initDatabase() y no rompe ante datos legacy.
 * Exportada para tests directos (Wave 0).
 */
export async function sanitizePerformedCategoriesUsed(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; categories_used: string | null }>(
    'SELECT id, categories_used FROM performed_habits WHERE categories_used IS NOT NULL',
  );
  for (const row of rows) {
    if (row.categories_used == null) continue;
    const cleaned = JSON.stringify(parseAndValidateCategories(row.categories_used));
    if (cleaned !== row.categories_used) {
      await db.runAsync(
        'UPDATE performed_habits SET categories_used = ? WHERE id = ?',
        [cleaned, row.id],
      );
    }
  }
}

// ─── Seed Data ──────────────────────────────────────────────────────

async function seedHabits(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM habits',
  );

  if (result && result.count > 0) return;

  for (const habit of SEED_HABITS) {
    await db.runAsync(
      'INSERT INTO habits (id, name, frequency, base_points, default_categories) VALUES (?, ?, ?, ?, ?)',
      [generateId(), habit.name, habit.frequency, habit.basePoints, habit.categories],
    );
  }
}
