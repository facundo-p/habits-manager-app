/**
 * habitService.ts — Lógica de negocio para hábitos.
 *
 * Delega el acceso a datos a los repositorios.
 * Se encarga de: resolución de fechas, enriquecimiento de objetos,
 * cálculo de estadísticas y coordinación entre repositorios.
 *
 * Las firmas públicas NO cambian (contrato con el Store).
 */

import { getTodayPrefix, getNowTimestamp, getTimestampForDate } from './db';
import * as habitRepo from '../repositories/habitRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { Habit, DailyHabit, DailyStats } from '../types';
import { buildStats } from '../utils/statsHelpers';

// ─── Consultas ──────────────────────────────────────────────────────

/** Hábitos activos con estado de completado para una fecha (default: hoy). */
export async function getHabitsForDay(
  datePrefix?: string,
): Promise<DailyHabit[]> {
  const day = datePrefix ?? getTodayPrefix();
  const [habits, performed] = await Promise.all([
    habitRepo.findAllActive(),
    taskRepo.findByDate(day),
  ]);
  return enrichWithPerformed(habits, performed);
}

/** Progreso de puntos para hábitos de frecuencia daily (para header global). */
export async function getDailyPointsProgress(
  datePrefix?: string,
): Promise<DailyStats> {
  const day = datePrefix ?? getTodayPrefix();
  const [total, earned] = await Promise.all([
    habitRepo.sumPointsByFrequency('daily'),
    taskRepo.sumEarnedForDate(day),
  ]);
  return buildStats(earned, total);
}

/** Todos los hábitos (incluyendo inactivos) para la Biblioteca. */
export async function getAllHabits(): Promise<Habit[]> {
  return habitRepo.findAll();
}

/** Obtiene la descripción de un performed_habit (para edición). */
export async function getPerformedDescription(
  performedHabitId: string,
): Promise<string> {
  const desc = await taskRepo.findDescription(performedHabitId);
  return desc ?? '';
}

/** Conteo de completados por habit_id (para la biblioteca). */
export async function getCompletionCounts(): Promise<Record<string, number>> {
  const rows = await taskRepo.countByHabit();
  return Object.fromEntries(rows.map((r) => [r.habit_id, r.count]));
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Marca un hábito como hecho. Acepta datePrefix para modo histórico. */
export async function markHabitDone(
  habit: DailyHabit,
  datePrefix?: string,
): Promise<string> {
  const ts = datePrefix ? getTimestampForDate(datePrefix) : getNowTimestamp();
  return taskRepo.insert(habit.id, ts, habit.base_points, habit.default_categories);
}

/** Desmarca un hábito (borra el registro performed_habit). */
export async function unmarkHabit(performedHabitId: string): Promise<void> {
  return taskRepo.deleteById(performedHabitId);
}

/** Actualiza la descripción/reflexión de un performed_habit. */
export async function updatePerformedDescription(
  performedHabitId: string,
  description: string,
): Promise<void> {
  return taskRepo.updateDescription(performedHabitId, description);
}

/** Activa o desactiva un hábito. */
export async function toggleHabitActive(
  habitId: string,
  isActive: boolean,
): Promise<void> {
  return habitRepo.setActive(habitId, isActive);
}

// ─── CRUD de hábitos "molde" (Biblioteca) ────────────────────────────

export async function createHabit(
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<string> {
  return habitRepo.insert(name, frequency, basePoints, JSON.stringify(categories));
}

export async function updateHabit(
  id: string,
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<void> {
  return habitRepo.update(id, name, frequency, basePoints, JSON.stringify(categories));
}

export async function deleteHabit(habitId: string): Promise<void> {
  return habitRepo.deleteById(habitId);
}

// ─── Helpers internos (lógica de negocio) ────────────────────────────

function enrichWithPerformed(
  habits: Habit[],
  performed: { id: string; habit_id: string }[],
): DailyHabit[] {
  const map = new Map(performed.map((p) => [p.habit_id, p.id]));
  return habits.map((h) => ({
    ...h,
    completedToday: map.has(h.id),
    performedHabitId: map.get(h.id) ?? null,
  }));
}

