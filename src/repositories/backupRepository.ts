/**
 * backupRepository.ts — Acceso a datos crudo para respaldo/restauración.
 *
 * Lee y escribe TODAS las tablas. Funciones "tontas" (sin lógica de validación).
 * La validación y coordinación vive en backupService.ts.
 */

import { getDatabase } from '../services/db';
import type { Habit, PerformedHabit, MoodEntry } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_ALL_HABITS = 'SELECT * FROM habits';
const SQL_ALL_PERFORMED = 'SELECT * FROM performed_habits';
const SQL_ALL_MOODS = 'SELECT * FROM mood_entries';

const SQL_CLEAR_MOODS = 'DELETE FROM mood_entries';
const SQL_CLEAR_PERFORMED = 'DELETE FROM performed_habits';
const SQL_CLEAR_HABITS = 'DELETE FROM habits';

const SQL_INSERT_HABIT =
  'INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_PERFORMED =
  'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, habit_description, categories_used) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_MOOD =
  'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)';

// ─── Lectura ────────────────────────────────────────────────────────

export async function readAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_ALL_HABITS);
}

export async function readAllPerformed(): Promise<PerformedHabit[]> {
  const db = await getDatabase();
  return db.getAllAsync<PerformedHabit>(SQL_ALL_PERFORMED);
}

export async function readAllMoods(): Promise<MoodEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<MoodEntry>(SQL_ALL_MOODS);
}

// ─── Limpieza (orden por foreign keys) ───────────────────────────────

export async function clearAllTables(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_CLEAR_MOODS);
  await db.runAsync(SQL_CLEAR_PERFORMED);
  await db.runAsync(SQL_CLEAR_HABITS);
}

// ─── Inserción masiva ────────────────────────────────────────────────

export async function insertHabits(habits: Habit[]): Promise<void> {
  const db = await getDatabase();
  for (const h of habits) {
    await db.runAsync(SQL_INSERT_HABIT, [
      h.id, h.name, h.frequency, h.base_points,
      h.default_categories, h.is_active,
    ]);
  }
}

export async function insertPerformed(records: PerformedHabit[]): Promise<void> {
  const db = await getDatabase();
  for (const r of records) {
    await db.runAsync(SQL_INSERT_PERFORMED, [
      r.id, r.habit_id, r.timestamp, r.points_earned,
      r.habit_description, r.categories_used,
    ]);
  }
}

export async function insertMoods(entries: MoodEntry[]): Promise<void> {
  const db = await getDatabase();
  for (const e of entries) {
    await db.runAsync(SQL_INSERT_MOOD, [
      e.id, e.value, e.description, e.timestamp, e.habit_id,
    ]);
  }
}
