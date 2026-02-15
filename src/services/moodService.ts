/**
 * moodService.ts — Lógica de negocio para registros de humor.
 *
 * Maneja operaciones en la tabla mood_entries (Regla 003).
 */

import { getDatabase, generateId, getTodayPrefix, getNowTimestamp } from './db';

/** Crea un registro de humor vinculado opcionalmente a un hábito. */
export async function createMoodEntry(
  value: number,
  description: string | null,
  habitId: string | null,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'INSERT INTO mood_entries (id, value, description, timestamp, habit_id) VALUES (?, ?, ?, ?, ?)',
    [generateId(), value, description, getNowTimestamp(), habitId],
  );
}

/** Obtiene el mood_value de hoy para un hábito (para modo edición). */
export async function getMoodForHabitToday(
  habitId: string,
): Promise<number | null> {
  const db = await getDatabase();
  const today = getTodayPrefix();

  const row = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%' ORDER BY timestamp DESC LIMIT 1",
    [habitId, today],
  );

  return row?.value ?? null;
}

/** Elimina registros de mood de hoy para un hábito (antes de recrear). */
export async function deleteMoodForHabitToday(
  habitId: string,
): Promise<void> {
  const db = await getDatabase();
  const today = getTodayPrefix();

  await db.runAsync(
    "DELETE FROM mood_entries WHERE habit_id = ? AND timestamp LIKE ? || '%'",
    [habitId, today],
  );
}
