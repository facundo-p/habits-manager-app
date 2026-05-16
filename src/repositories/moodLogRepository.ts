/**
 * moodLogRepository.ts — Acceso a datos de la tabla `mood_log`.
 *
 * 4 kinds: 'morning' | 'evening' | 'note' | 'reflection'. Phase 1 sólo
 * usa 'reflection' (via moodService desde el habit completion flow).
 * Phase 2 agregará morning/evening/note CRUD.
 *
 * Funciones tontas: sin lógica de negocio.
 */

import { getDatabase, generateId } from '../services/db';
import type { MoodLogEntry } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_INSERT = `
  INSERT INTO mood_log (
    id, kind, date_key, occurred_at, mood_value, mood_scale_version,
    sleep_hours, comment, habit_id, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SQL_FIND_REFLECTION_BY_HABIT_AND_DATE = `
  SELECT mood_value FROM mood_log
  WHERE kind = 'reflection' AND habit_id = ? AND date_key = ?
  ORDER BY occurred_at DESC
  LIMIT 1
`;

const SQL_DELETE_REFLECTION_BY_HABIT_AND_DATE = `
  DELETE FROM mood_log
  WHERE kind = 'reflection' AND habit_id = ? AND date_key = ?
`;

// ─── Public API ─────────────────────────────────────────────────────

export interface InsertMoodLogParams {
  kind: MoodLogEntry['kind'];
  date_key: string;
  occurred_at: string;
  mood_value: number;
  mood_scale_version: string;
  sleep_hours?: number | null;
  comment?: string | null;
  habit_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Inserta una row de mood_log (cualquier kind). Devuelve el id generado. */
export async function insert(params: InsertMoodLogParams): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(SQL_INSERT, [
    id,
    params.kind,
    params.date_key,
    params.occurred_at,
    params.mood_value,
    params.mood_scale_version,
    params.sleep_hours ?? null,
    params.comment ?? null,
    params.habit_id ?? null,
    params.created_at,
    params.updated_at,
  ]);
  return id;
}

/** Mood value de la última reflection de un hábito en una fecha. */
export async function findReflectionValueByHabitAndDate(
  habitId: string,
  dateKey: string,
): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mood_value: number }>(
    SQL_FIND_REFLECTION_BY_HABIT_AND_DATE,
    [habitId, dateKey],
  );
  return row?.mood_value ?? null;
}

/** Borra todas las reflections de un hábito en una fecha. */
export async function deleteReflectionByHabitAndDate(
  habitId: string,
  dateKey: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE_REFLECTION_BY_HABIT_AND_DATE, [habitId, dateKey]);
}
