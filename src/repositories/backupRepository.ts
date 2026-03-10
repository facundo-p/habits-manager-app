/**
 * backupRepository.ts — Acceso a datos crudo para respaldo/restauración.
 *
 * Lee y escribe TODAS las tablas. Funciones "tontas" (sin lógica de validación).
 * La validación y coordinación vive en backupService.ts.
 */

import { getDatabase } from '../services/db';
import type { Habit, PerformedHabit, MoodEntry, DailyAssignment } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_ALL_HABITS = 'SELECT * FROM habits';
const SQL_ALL_PERFORMED = 'SELECT * FROM performed_habits';
const SQL_ALL_MOODS = 'SELECT * FROM mood_entries';
const SQL_ALL_ASSIGNMENTS = 'SELECT * FROM daily_assignments';

const SQL_CLEAR_MOODS = 'DELETE FROM mood_entries';
const SQL_CLEAR_PERFORMED = 'DELETE FROM performed_habits';
const SQL_CLEAR_ASSIGNMENTS = 'DELETE FROM daily_assignments';
const SQL_CLEAR_HABITS = 'DELETE FROM habits';

const SQL_INSERT_HABIT =
  'INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_PERFORMED =
  'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, habit_description, categories_used) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_MOOD =
  'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)';

const SQL_INSERT_ASSIGNMENT =
  'INSERT INTO daily_assignments (id, habit_id, date, snapshot_name, snapshot_points, snapshot_categories, snapshot_frequency, is_completed, is_spontaneous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

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

export async function readAllAssignments(): Promise<DailyAssignment[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyAssignment>(SQL_ALL_ASSIGNMENTS);
}

// ─── Restauración atómica (con transacción) ──────────────────────────

/**
 * Limpia todas las tablas e inserta los datos del backup en una única
 * transacción atómica. Si cualquier paso falla, hace rollback automático.
 */
export async function restoreAllData(
  habits: Habit[],
  performed: PerformedHabit[],
  moods: MoodEntry[],
  assignments: DailyAssignment[],
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(SQL_CLEAR_MOODS);
    await db.runAsync(SQL_CLEAR_PERFORMED);
    await db.runAsync(SQL_CLEAR_ASSIGNMENTS);
    await db.runAsync(SQL_CLEAR_HABITS);

    for (const h of habits) {
      await db.runAsync(SQL_INSERT_HABIT, [
        h.id, h.name, h.frequency, h.base_points,
        h.default_categories, h.is_active,
      ]);
    }

    for (const e of assignments) {
      await db.runAsync(SQL_INSERT_ASSIGNMENT, [
        e.id, e.habit_id, e.date, e.snapshot_name, e.snapshot_points,
        e.snapshot_categories, e.snapshot_frequency, e.is_completed, e.is_spontaneous,
      ]);
    }

    for (const r of performed) {
      await db.runAsync(SQL_INSERT_PERFORMED, [
        r.id, r.habit_id, r.timestamp, r.points_earned,
        r.habit_description, r.categories_used,
      ]);
    }

    for (const e of moods) {
      await db.runAsync(SQL_INSERT_MOOD, [
        e.id, e.value, e.description, e.timestamp, e.habit_id,
      ]);
    }
  });
}
