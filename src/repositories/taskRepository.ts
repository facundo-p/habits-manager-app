/**
 * taskRepository.ts — Acceso a datos de la tabla `performed_habits`.
 *
 * Funciones "tontas" (solo CRUD). Sin lógica de negocio ni transformaciones.
 * Toda consulta SQL a `performed_habits` vive exclusivamente aquí.
 */

import { getDatabase, generateId } from '../services/db';

// ─── Tipos de fila crudos ────────────────────────────────────────────

export interface PerformedRow {
  id: string;
  habit_id: string;
}

export interface CategoryDataRow {
  categories_used: string;
  points_earned: number;
}

export interface CompletionCountRow {
  habit_id: string;
  count: number;
}

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_BY_DATE =
  "SELECT id, habit_id FROM performed_habits WHERE timestamp LIKE ? || '%'";

const SQL_EARNED_FOR_DATE =
  "SELECT COALESCE(SUM(points_earned), 0) as earned FROM performed_habits WHERE timestamp LIKE ? || '%'";

const SQL_CATEGORIES_IN_MONTH =
  "SELECT categories_used, points_earned FROM performed_habits WHERE timestamp LIKE ? || '%' AND categories_used IS NOT NULL";

const SQL_SUM_IN_RANGE =
  'SELECT COALESCE(SUM(points_earned), 0) as total FROM performed_habits WHERE timestamp >= ? AND timestamp < ?';

const SQL_COMPLETION_COUNTS =
  'SELECT habit_id, COUNT(*) as count FROM performed_habits GROUP BY habit_id';

const SQL_DESCRIPTION =
  'SELECT habit_description FROM performed_habits WHERE id = ?';

const SQL_INSERT =
  'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, categories_used) VALUES (?, ?, ?, ?, ?)';

const SQL_DELETE = 'DELETE FROM performed_habits WHERE id = ?';

const SQL_UPDATE_DESC =
  'UPDATE performed_habits SET habit_description = ? WHERE id = ?';

// ─── Consultas ──────────────────────────────────────────────────────

/** Performed habits para una fecha (prefix YYYY-MM-DD). */
export async function findByDate(datePrefix: string): Promise<PerformedRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PerformedRow>(SQL_BY_DATE, [datePrefix]);
}

/** Suma de points_earned para una fecha. */
export async function sumEarnedForDate(datePrefix: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ earned: number }>(SQL_EARNED_FOR_DATE, [datePrefix]);
  return row?.earned ?? 0;
}

/** Categorías y puntos para registros dentro de un mes. */
export async function findCategoriesInMonth(monthPrefix: string): Promise<CategoryDataRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CategoryDataRow>(SQL_CATEGORIES_IN_MONTH, [monthPrefix]);
}

/** Suma de puntos en un rango de fechas [start, end). */
export async function sumEarnedInRange(start: string, end: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(SQL_SUM_IN_RANGE, [start, end]);
  return row?.total ?? 0;
}

/** Conteo de completados agrupados por habit_id. */
export async function countByHabit(): Promise<CompletionCountRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CompletionCountRow>(SQL_COMPLETION_COUNTS);
}

/** Descripción de un performed_habit por ID. */
export async function findDescription(performedHabitId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ habit_description: string | null }>(
    SQL_DESCRIPTION,
    [performedHabitId],
  );
  return row?.habit_description ?? null;
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Inserta un performed_habit. Retorna el ID generado. */
export async function insert(
  habitId: string,
  timestamp: string,
  pointsEarned: number,
  categoriesUsed: string,
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(SQL_INSERT, [id, habitId, timestamp, pointsEarned, categoriesUsed]);
  return id;
}

/** Elimina un performed_habit por ID. */
export async function deleteById(performedHabitId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE, [performedHabitId]);
}

/** Actualiza la descripción/reflexión de un performed_habit. */
export async function updateDescription(
  performedHabitId: string,
  description: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_UPDATE_DESC, [description, performedHabitId]);
}
