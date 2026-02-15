/**
 * habitService.ts — Lógica de negocio para hábitos.
 *
 * Único punto de acceso a consultas SQL de hábitos (Regla 001 + 003).
 * Los componentes NUNCA ejecutan SQL directamente.
 */

import {
  getDatabase,
  generateId,
  getTodayPrefix,
  getNowTimestamp,
  getTimestampForDate,
} from './db';
import type { Habit, DailyHabit, DailyStats } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_ACTIVE_HABITS = 'SELECT * FROM habits WHERE is_active = 1';

const SQL_ALL_HABITS = 'SELECT * FROM habits';

const SQL_PERFORMED_FOR_DAY =
  "SELECT id, habit_id FROM performed_habits WHERE timestamp LIKE ? || '%'";

const SQL_TOTAL_BY_FREQ =
  'SELECT COALESCE(SUM(base_points), 0) as total FROM habits WHERE frequency = ? AND is_active = 1';

const SQL_EARNED_FOR_DAY =
  "SELECT COALESCE(SUM(points_earned), 0) as earned FROM performed_habits WHERE timestamp LIKE ? || '%'";

const SQL_COMPLETION_COUNTS =
  'SELECT habit_id, COUNT(*) as count FROM performed_habits GROUP BY habit_id';

// ─── Consultas ──────────────────────────────────────────────────────

/** Hábitos activos con estado de completado para una fecha (default: hoy). */
export async function getHabitsForDay(
  datePrefix?: string,
): Promise<DailyHabit[]> {
  const db = await getDatabase();
  const day = datePrefix ?? getTodayPrefix();
  const habits = await db.getAllAsync<Habit>(SQL_ACTIVE_HABITS);

  const performed = await db.getAllAsync<{ id: string; habit_id: string }>(
    SQL_PERFORMED_FOR_DAY,
    [day],
  );

  return enrichWithPerformed(habits, performed);
}

/** Progreso de puntos para hábitos de frecuencia daily (para header global). */
export async function getDailyPointsProgress(
  datePrefix?: string,
): Promise<DailyStats> {
  const db = await getDatabase();
  const day = datePrefix ?? getTodayPrefix();

  const totalRow = await db.getFirstAsync<{ total: number }>(
    SQL_TOTAL_BY_FREQ,
    ['daily'],
  );

  const earnedRow = await db.getFirstAsync<{ earned: number }>(
    SQL_EARNED_FOR_DAY,
    [day],
  );

  return buildStats(earnedRow?.earned ?? 0, totalRow?.total ?? 0);
}

/** Todos los hábitos (incluyendo inactivos) para la Biblioteca. */
export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_ALL_HABITS);
}

/** Obtiene la descripción de un performed_habit (para edición). */
export async function getPerformedDescription(
  performedHabitId: string,
): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ habit_description: string | null }>(
    'SELECT habit_description FROM performed_habits WHERE id = ?',
    [performedHabitId],
  );
  return row?.habit_description ?? '';
}

/** Conteo de completados por habit_id (para la biblioteca). */
export async function getCompletionCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ habit_id: string; count: number }>(
    SQL_COMPLETION_COUNTS,
  );
  return Object.fromEntries(rows.map((r) => [r.habit_id, r.count]));
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Marca un hábito como hecho. Acepta datePrefix para modo histórico. */
export async function markHabitDone(
  habit: DailyHabit,
  datePrefix?: string,
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const ts = datePrefix ? getTimestampForDate(datePrefix) : getNowTimestamp();

  await db.runAsync(
    'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, categories_used) VALUES (?, ?, ?, ?, ?)',
    [id, habit.id, ts, habit.base_points, habit.default_categories],
  );

  return id;
}

/** Desmarca un hábito (borra el registro performed_habit). */
export async function unmarkHabit(performedHabitId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM performed_habits WHERE id = ?', [performedHabitId]);
}

/** Actualiza la descripción/reflexión de un performed_habit. */
export async function updatePerformedDescription(
  performedHabitId: string,
  description: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE performed_habits SET habit_description = ? WHERE id = ?',
    [description, performedHabitId],
  );
}

/** Activa o desactiva un hábito. */
export async function toggleHabitActive(
  habitId: string,
  isActive: boolean,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE habits SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    habitId,
  ]);
}

// ─── CRUD de hábitos "molde" (Biblioteca) ────────────────────────────

export async function createHabit(
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const cats = JSON.stringify(categories);

  await db.runAsync(
    'INSERT INTO habits (id, name, frequency, base_points, default_categories) VALUES (?, ?, ?, ?, ?)',
    [id, name, frequency, basePoints, cats],
  );

  return id;
}

export async function updateHabit(
  id: string,
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<void> {
  const db = await getDatabase();
  const cats = JSON.stringify(categories);

  await db.runAsync(
    'UPDATE habits SET name = ?, frequency = ?, base_points = ?, default_categories = ? WHERE id = ?',
    [name, frequency, basePoints, cats, id],
  );
}

export async function deleteHabit(habitId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM habits WHERE id = ?', [habitId]);
}

// ─── Helpers internos ───────────────────────────────────────────────

function enrichWithPerformed(
  habits: Habit[],
  performed: { id: string; habit_id: string }[],
): DailyHabit[] {
  const map = new Map(performed.map((p) => [p.habit_id, p.id]));
  return habits.map((h) => ({
    ...h,
    completedToday: map.has(h.id),
    performedHabitId: map.get(h.id) ?? null,
  }));
}

function buildStats(earned: number, total: number): DailyStats {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { earned, total, percentage: pct };
}
