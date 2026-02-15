/**
 * assignmentRepository.ts — Acceso a datos de la tabla `daily_assignments`.
 *
 * Funciones "tontas" (solo CRUD). Sin lógica de negocio ni transformaciones.
 * Toda consulta SQL a `daily_assignments` vive exclusivamente aquí.
 */

import { getDatabase, generateId } from '../services/db';
import type { DailyAssignment } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_BY_DATE =
  'SELECT * FROM daily_assignments WHERE date = ? ORDER BY is_spontaneous ASC, snapshot_frequency ASC, snapshot_name ASC';

const SQL_COUNT_BY_DATE =
  'SELECT COUNT(*) as count FROM daily_assignments WHERE date = ?';

const SQL_LATEST_DATE =
  'SELECT date FROM daily_assignments ORDER BY date DESC LIMIT 1';

const SQL_INSERT =
  'INSERT INTO daily_assignments (id, habit_id, date, snapshot_name, snapshot_points, snapshot_categories, snapshot_frequency, is_completed, is_spontaneous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

const SQL_SET_COMPLETED =
  'UPDATE daily_assignments SET is_completed = ? WHERE id = ?';

const SQL_DELETE = 'DELETE FROM daily_assignments WHERE id = ?';

const SQL_FIND_BY_ID =
  'SELECT * FROM daily_assignments WHERE id = ?';

const SQL_SUM_POINTS_BY_DATE =
  'SELECT COALESCE(SUM(snapshot_points), 0) as total FROM daily_assignments WHERE date = ?';

const SQL_SUM_EARNED_BY_DATE =
  'SELECT COALESCE(SUM(snapshot_points), 0) as earned FROM daily_assignments WHERE date = ? AND is_completed = 1';

const SQL_EARNED_BY_DAY_IN_MONTH =
  "SELECT SUBSTR(date, 9, 2) as day, SUM(CASE WHEN is_completed = 1 THEN snapshot_points ELSE 0 END) as earned, SUM(snapshot_points) as total FROM daily_assignments WHERE date LIKE ? || '%' GROUP BY day";

// ─── Consultas ──────────────────────────────────────────────────────

/** Todas las asignaciones para una fecha (YYYY-MM-DD). */
export async function findByDate(datePrefix: string): Promise<DailyAssignment[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyAssignment>(SQL_BY_DATE, [datePrefix]);
}

/** Número de asignaciones para una fecha. */
export async function countByDate(datePrefix: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(SQL_COUNT_BY_DATE, [datePrefix]);
  return row?.count ?? 0;
}

/** Fecha más reciente con asignaciones (o null si no hay). */
export async function findLatestDate(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ date: string }>(SQL_LATEST_DATE);
  return row?.date ?? null;
}

/** Busca una asignación por ID. */
export async function findById(id: string): Promise<DailyAssignment | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DailyAssignment>(SQL_FIND_BY_ID, [id]);
}

/** Suma de snapshot_points para una fecha (total posible del día). */
export async function sumPointsByDate(datePrefix: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(SQL_SUM_POINTS_BY_DATE, [datePrefix]);
  return row?.total ?? 0;
}

/** Suma de snapshot_points de asignaciones completadas para una fecha. */
export async function sumEarnedByDate(datePrefix: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ earned: number }>(SQL_SUM_EARNED_BY_DATE, [datePrefix]);
  return row?.earned ?? 0;
}

/** Puntos ganados y totales agrupados por día dentro de un mes (prefix YYYY-MM). */
export async function sumByDayInMonth(
  monthPrefix: string,
): Promise<{ day: string; earned: number; total: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ day: string; earned: number; total: number }>(
    SQL_EARNED_BY_DAY_IN_MONTH,
    [monthPrefix],
  );
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Inserta una nueva asignación. Retorna el ID generado. */
export async function insert(
  habitId: string | null,
  date: string,
  snapshotName: string,
  snapshotPoints: number,
  snapshotCategories: string,
  snapshotFrequency: string,
  isCompleted: number,
  isSpontaneous: number,
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(SQL_INSERT, [
    id, habitId, date, snapshotName, snapshotPoints,
    snapshotCategories, snapshotFrequency, isCompleted, isSpontaneous,
  ]);
  return id;
}

/** Cambia el estado is_completed de una asignación. */
export async function setCompleted(id: string, completed: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_SET_COMPLETED, [completed ? 1 : 0, id]);
}

/** Elimina una asignación por ID. */
export async function deleteById(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE, [id]);
}
