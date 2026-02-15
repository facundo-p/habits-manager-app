/**
 * habitService.ts — Lógica de negocio para hábitos.
 *
 * Único punto de acceso a consultas SQL de hábitos (Regla 001 + 003).
 * Los componentes NUNCA ejecutan SQL directamente.
 */

import { getDatabase, generateId, getTodayPrefix, getNowTimestamp } from './db';
import type { Habit, DailyHabit, DailyStats } from '../types';

// ─── Consultas ──────────────────────────────────────────────────────

export async function getDailyHabits(): Promise<DailyHabit[]> {
  const db = await getDatabase();
  const today = getTodayPrefix();

  const habits = await db.getAllAsync<Habit>('SELECT * FROM habits');

  const performed = await db.getAllAsync<{ id: string; habit_id: string }>(
    "SELECT id, habit_id FROM performed_habits WHERE timestamp LIKE ? || '%'",
    [today],
  );

  const performedMap = new Map(performed.map((p) => [p.habit_id, p.id]));

  return habits.map((habit) => ({
    ...habit,
    completedToday: performedMap.has(habit.id),
    performedHabitId: performedMap.get(habit.id) ?? null,
  }));
}

export async function getDailyPointsProgress(): Promise<DailyStats> {
  const db = await getDatabase();
  const today = getTodayPrefix();

  const totalRow = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(base_points), 0) as total FROM habits WHERE frequency = 'daily'",
  );

  const earnedRow = await db.getFirstAsync<{ earned: number }>(
    "SELECT COALESCE(SUM(points_earned), 0) as earned FROM performed_habits WHERE timestamp LIKE ? || '%'",
    [today],
  );

  const total = totalRow?.total ?? 0;
  const earned = earnedRow?.earned ?? 0;
  const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;

  return { earned, total, percentage };
}

/** Devuelve todos los hábitos "molde" (para la Biblioteca). */
export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>('SELECT * FROM habits');
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

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Marca un hábito como hecho hoy. Devuelve el ID del performed_habit creado. */
export async function markHabitDone(habit: DailyHabit): Promise<string> {
  const db = await getDatabase();
  const id = generateId();

  await db.runAsync(
    'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, categories_used) VALUES (?, ?, ?, ?, ?)',
    [id, habit.id, getNowTimestamp(), habit.base_points, habit.default_categories],
  );

  return id;
}

/** Desmarca un hábito (borra el registro performed_habit). */
export async function unmarkHabit(performedHabitId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM performed_habits WHERE id = ?', [performedHabitId]);
}

/** Actualiza la descripción/reflexión de un performed_habit existente. */
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

// ─── CRUD de hábitos "molde" (Biblioteca) ────────────────────────────

/** Crea un hábito molde. Devuelve el ID generado. */
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

/** Actualiza un hábito molde existente. */
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

/** Elimina un hábito molde (CASCADE borra performed_habits). */
export async function deleteHabit(habitId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM habits WHERE id = ?', [habitId]);
}
