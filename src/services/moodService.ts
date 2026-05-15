/**
 * moodService.ts — Lógica de negocio para registros de humor.
 *
 * Delega el acceso a datos a moodRepository.
 * Se encarga de: resolución de fechas y generación de timestamps.
 *
 * Las firmas públicas NO cambian (contrato con el Store).
 */

import { getLocalDayKey, getNowTimestamp, getTimestampForDate } from '../utils/date';
import * as moodRepo from '../repositories/moodRepository';

/** Crea un registro de humor vinculado opcionalmente a un hábito. */
export async function createMoodEntry(
  value: number,
  description: string | null,
  habitId: string | null,
  datePrefix?: string,
): Promise<void> {
  const ts = datePrefix ? getTimestampForDate(datePrefix) : getNowTimestamp();
  return moodRepo.insert(value, description, ts, habitId);
}

/** Obtiene el mood_value para un hábito en una fecha (default: hoy). */
export async function getMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<number | null> {
  const day = datePrefix ?? getLocalDayKey();
  return moodRepo.findValueByHabitAndDate(habitId, day);
}

/** Elimina registros de mood para un hábito en una fecha (default: hoy). */
export async function deleteMoodForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<void> {
  const day = datePrefix ?? getLocalDayKey();
  return moodRepo.deleteByHabitAndDate(habitId, day);
}
