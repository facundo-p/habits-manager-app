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

const SQL_FIND_BY_HABIT_AND_DATE =
  'SELECT * FROM daily_assignments WHERE habit_id = ? AND date = ? LIMIT 1';

const SQL_DELETE_UNCOMPLETED_BY_HABIT_AND_DATE =
  'DELETE FROM daily_assignments WHERE habit_id = ? AND date = ? AND is_completed = 0';

const SQL_UPDATE_SNAPSHOT =
  'UPDATE daily_assignments SET snapshot_name = ?, snapshot_points = ?, snapshot_categories = ?, snapshot_frequency = ? WHERE habit_id = ? AND date = ? AND is_completed = 0';

// ─── SQL Constants para dedup migration (REQ-04-04..09) ─────────────

/**
 * SQL_DEDUPE_VIA_CTE — single-statement DELETE que aplica D-03 priority.
 *
 * Heurística (RESEARCH §Pattern 2):
 *   1. is_completed DESC  (1 wins)
 *   2. has performed_habit linked DESC (1 wins)
 *   3. da.rowid ASC       (más antigua wins — rowid es monotónico)
 *
 * Usa ROW_NUMBER() OVER (PARTITION BY habit_id, date ORDER BY ...) para
 * etiquetar la fila ganadora con rn=1; borra las rn>1.
 *
 * Sólo aplica a habit_id IS NOT NULL (spontaneous se preservan, D-07).
 */
export const SQL_DEDUPE_VIA_CTE = `
DELETE FROM daily_assignments
WHERE id IN (
  SELECT id FROM (
    SELECT
      da.id,
      ROW_NUMBER() OVER (
        PARTITION BY da.habit_id, da.date
        ORDER BY
          da.is_completed DESC,
          (CASE WHEN EXISTS (
            SELECT 1 FROM performed_habits ph
            WHERE ph.habit_id = da.habit_id
              AND substr(ph.timestamp, 1, 10) = da.date
          ) THEN 1 ELSE 0 END) DESC,
          da.rowid ASC
      ) AS rn
    FROM daily_assignments da
    WHERE da.habit_id IS NOT NULL
  )
  WHERE rn > 1
)
`;

/** Encuentra grupos (habit_id, date) con count > 1 — SOLO regulares. */
export const SQL_FIND_DUPLICATES = `
  SELECT habit_id, date, COUNT(*) as count
  FROM daily_assignments
  WHERE habit_id IS NOT NULL
  GROUP BY habit_id, date
  HAVING COUNT(*) > 1
`;

/**
 * Invariante post-DELETE: cuenta cuántos grupos siguen duplicados.
 * Si > 0, la migración debe abortar (RESEARCH §Pitfall #1).
 */
export const SQL_ASSERT_NO_DUPLICATES = `
  SELECT COUNT(*) as count FROM (
    SELECT 1 FROM daily_assignments
    WHERE habit_id IS NOT NULL
    GROUP BY habit_id, date HAVING COUNT(*) > 1
  )
`;

/** Partial UNIQUE INDEX (D-07). IF NOT EXISTS para idempotencia. */
export const SQL_CREATE_UNIQUE_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_habit_date
  ON daily_assignments(habit_id, date)
  WHERE habit_id IS NOT NULL
`;

const SQL_COUNT_BY_HABIT_AND_DATE =
  'SELECT COUNT(*) as count FROM daily_assignments WHERE habit_id = ? AND date = ?';

// ─── SQL Constants para visibility de período (REQ-04-10/11) ────────

const SQL_SET_COMPLETED_FOR_HABIT_IN_RANGE = `
  UPDATE daily_assignments
  SET is_completed = ?
  WHERE habit_id = ?
    AND date BETWEEN ? AND ?
`;

const SQL_UPDATE_SNAPSHOT_FOR_HABIT_IN_RANGE = `
  UPDATE daily_assignments
  SET snapshot_name = ?, snapshot_points = ?, snapshot_categories = ?, snapshot_frequency = ?
  WHERE habit_id = ?
    AND date BETWEEN ? AND ?
    AND is_completed = 0
`;

// SQL_FIND_COMPLETED_HABITS_IN_RANGE NO se define como const aquí porque
// el placeholder list es dinámico (?, ?, ?... según largo de habitIds).
// Se construye dentro de la wrapper.

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

/** Busca una asignación por habit_id y fecha. */
export async function findByHabitAndDate(
  habitId: string,
  datePrefix: string,
): Promise<DailyAssignment | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DailyAssignment>(SQL_FIND_BY_HABIT_AND_DATE, [habitId, datePrefix]);
}

/** Cuenta rows para un (habit_id, date). Útil para invariantes runtime (REQ-04-02). */
export async function countByHabitAndDate(
  habitId: string,
  datePrefix: string,
): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    SQL_COUNT_BY_HABIT_AND_DATE,
    [habitId, datePrefix],
  );
  return row?.count ?? 0;
}

/** Lista grupos duplicados (habit_id, date, count). Util para invariantes y tests. */
export async function findDuplicates(): Promise<{ habit_id: string; date: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ habit_id: string; date: string; count: number }>(SQL_FIND_DUPLICATES);
}

/**
 * REQ-04-10/11: para una lista de habit_ids y un rango de fechas, retorna los
 * habit_ids que tienen AL MENOS UNA row con is_completed=1 en el rango.
 * Single aggregated query — evita N+1 (RESEARCH §Pattern 3, Risk R3).
 *
 * Si habitIds está vacío, retorna [] sin tocar la DB.
 */
export async function findCompletedHabitsInRange(
  habitIds: string[],
  startDate: string,
  endDate: string,
): Promise<string[]> {
  if (habitIds.length === 0) return [];
  const db = await getDatabase();
  const placeholders = habitIds.map(() => '?').join(',');
  const sql = `
    SELECT DISTINCT habit_id
    FROM daily_assignments
    WHERE habit_id IN (${placeholders})
      AND date BETWEEN ? AND ?
      AND is_completed = 1
  `;
  const rows = await db.getAllAsync<{ habit_id: string }>(
    sql,
    [...habitIds, startDate, endDate],
  );
  return rows.map((r) => r.habit_id);
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

/** Actualiza el snapshot de asignaciones no completadas para un hábito en una fecha. */
export async function updateSnapshot(
  habitId: string,
  datePrefix: string,
  snapshotName: string,
  snapshotPoints: number,
  snapshotCategories: string,
  snapshotFrequency: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_UPDATE_SNAPSHOT, [
    snapshotName, snapshotPoints, snapshotCategories, snapshotFrequency,
    habitId, datePrefix,
  ]);
}

/** Elimina la asignación no completada de un hábito en una fecha (solo hoy). */
export async function deleteUncompletedByHabitAndDate(
  habitId: string,
  datePrefix: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE_UNCOMPLETED_BY_HABIT_AND_DATE, [habitId, datePrefix]);
}

/**
 * REQ-04-10/11: marca/desmarca is_completed para todas las rows
 * (habit_id, date BETWEEN start AND end). Soporta propagación de completion
 * a las rows del período actual de hábitos weekly/monthly.
 */
export async function setCompletedForHabitInRange(
  habitId: string,
  completed: number,
  startDate: string,
  endDate: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_SET_COMPLETED_FOR_HABIT_IN_RANGE, [
    completed, habitId, startDate, endDate,
  ]);
}

/**
 * REQ-04-10/11: aplica snapshot a rows uncompleted en (habit_id, date BETWEEN ...).
 * Preserva snapshots de rows ya completadas (consistencia con updateSnapshot existente).
 */
export async function updateSnapshotForHabitInRange(
  habitId: string,
  startDate: string,
  endDate: string,
  snapshotName: string,
  snapshotPoints: number,
  snapshotCategories: string,
  snapshotFrequency: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_UPDATE_SNAPSHOT_FOR_HABIT_IN_RANGE, [
    snapshotName, snapshotPoints, snapshotCategories, snapshotFrequency,
    habitId, startDate, endDate,
  ]);
}
