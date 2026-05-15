/**
 * moodService.ts — Lógica de negocio para reflections del habit completion flow.
 *
 * Post-migration v2: escribe a `mood_log` con `kind='reflection'`. La API
 * pública preserva el shape legacy (firmas idénticas) para no romper callers
 * (ReflectionModal, etc.). El mapping legacy → mood_log queda contained acá.
 *
 * Phase 2 añadirá moodService surfaces para morning/evening/note (otros kinds
 * de mood_log).
 */

import { MOOD_SCALE_VERSION } from '../config/mood';
import { getLocalDayKey, getNowTimestamp, getTimestampForDate } from '../utils/date';
import * as moodLogRepo from '../repositories/moodLogRepository';

/** Crea una reflection (habit completion flow). Compatible con la firma v1. */
export async function createMoodEntry(
  value: number,
  description: string | null,
  habitId: string | null,
  datePrefix?: string,
): Promise<void> {
  const dateKey = datePrefix ?? getLocalDayKey();
  const occurredAt = datePrefix ? getTimestampForDate(datePrefix) : getNowTimestamp();
  await moodLogRepo.insert({
    kind: 'reflection',
    date_key: dateKey,
    occurred_at: occurredAt,
    mood_value: value,
    mood_scale_version: MOOD_SCALE_VERSION,
    comment: description,
    habit_id: habitId,
    created_at: occurredAt,
    updated_at: occurredAt,
  });
}

/** Mood value de la reflection más reciente de un hábito en una fecha. */
export async function getMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<number | null> {
  const dateKey = datePrefix ?? getLocalDayKey();
  return moodLogRepo.findReflectionValueByHabitAndDate(habitId, dateKey);
}

/** Elimina reflections de un hábito en una fecha (por unmark del habit). */
export async function deleteMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<void> {
  const dateKey = datePrefix ?? getLocalDayKey();
  return moodLogRepo.deleteReflectionByHabitAndDate(habitId, dateKey);
}
