/**
 * moodRepository.ts — Acceso a datos de la tabla `mood_entries`.
 *
 * Funciones "tontas" (solo CRUD). Sin lógica de negocio ni transformaciones.
 * Toda consulta SQL a `mood_entries` vive exclusivamente aquí.
 */

import { getDatabase, generateId } from '../services/db';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_FIND_BY_HABIT_AND_DATE =
  "SELECT value FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%' ORDER BY timestamp DESC LIMIT 1";

const SQL_INSERT =
  'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)';

const SQL_DELETE_BY_HABIT_AND_DATE =
  "DELETE FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%'";

// ─── Consultas ──────────────────────────────────────────────────────

/** Valor de mood para un hábito en una fecha (prefix YYYY-MM-DD). */
export async function findValueByHabitAndDate(
  habitId: string,
  datePrefix: string,
): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: number }>(
    SQL_FIND_BY_HABIT_AND_DATE,
    [habitId, datePrefix],
  );
  return row?.value ?? null;
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Inserta un registro de mood. */
export async function insert(
  value: number,
  description: string | null,
  timestamp: string,
  habitId: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_INSERT, [generateId(), value, description, timestamp, habitId]);
}

/** Elimina registros de mood para un hábito en una fecha. */
export async function deleteByHabitAndDate(
  habitId: string,
  datePrefix: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE_BY_HABIT_AND_DATE, [habitId, datePrefix]);
}
