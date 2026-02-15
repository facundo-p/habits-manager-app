/**
 * moodService.ts — Lógica de negocio para registros de humor.
 *
 * Maneja operaciones en la tabla mood_entries (Regla 003).
 */

import { getDatabase, generateId, getTodayPrefix, getNowTimestamp, getTimestampForDate } from './db';

/** Crea un registro de humor vinculado opcionalmente a un hábito. */
export async function createMoodEntry(
  value: number,
  description: string | null,
  habitId: string | null,
  datePrefix?: string,
): Promise<void> {
  const db = await getDatabase();
  const ts = datePrefix ? getTimestampForDate(datePrefix) : getNowTimestamp();

  await db.runAsync(
    'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)',
    [generateId(), value, description, ts, habitId],
  );
}

/** Obtiene el mood_value para un hábito en una fecha (default: hoy). */
export async function getMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<number | null> {
  const db = await getDatabase();
  const day = datePrefix ?? getTodayPrefix();

  const row = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%' ORDER BY timestamp DESC LIMIT 1",
    [habitId, day],
  );

  return row?.value ?? null;
}

/** Elimina registros de mood para un hábito en una fecha (default: hoy). */
export async function deleteMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<void> {
  const db = await getDatabase();
  const day = datePrefix ?? getTodayPrefix();

  await db.runAsync(
    "DELETE FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%'",
    [habitId, day],
  );
}
