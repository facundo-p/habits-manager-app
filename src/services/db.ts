/**
 * db.ts — Servicio de base de datos SQLite.
 *
 * Solo los archivos en src/services/ pueden ejecutar SQL directamente.
 * Usa expo-sqlite de forma asíncrona (Regla 003).
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { DB_NAME, SEED_HABITS } from '../config/constants';

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

export function getNowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Timestamp para una fecha específica (usa hora actual). */
export function getTimestampForDate(datePrefix: string): string {
  const time = new Date().toISOString().slice(11, 19);
  return `${datePrefix} ${time}`;
}

// ─── Inicialización ─────────────────────────────────────────────────

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    base_points INTEGER NOT NULL DEFAULT 1,
    default_categories TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS performed_habits (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    points_earned REAL NOT NULL,
    habit_description TEXT,
    categories_used TEXT,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mood_entries (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL,
    description TEXT,
    timestamp TEXT NOT NULL,
    habit_id TEXT,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
  );
`;

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(SCHEMA_SQL);
  await migrateSchema(db);
  await seedHabits(db);
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
