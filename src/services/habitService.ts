/**
 * habitService.ts — Lógica de negocio para hábitos.
 *
 * Delega el acceso a datos a los repositorios.
 * Se encarga de: resolución de fechas, enriquecimiento de objetos,
 * cálculo de estadísticas y coordinación entre repositorios.
 *
 * Las firmas públicas NO cambian (contrato con el Store).
 */

import * as habitRepo from '../repositories/habitRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { Habit } from '../types';
import { assertValidCategories } from '../utils/validation';

// ─── Consultas ──────────────────────────────────────────────────────

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
  assertValidCategories(categories, 'createHabit');
  return habitRepo.insert(name, frequency, basePoints, JSON.stringify(categories));
}

export async function updateHabit(
  id: string,
  name: string,
  frequency: string,
  basePoints: number,
  categories: string[],
): Promise<void> {
  assertValidCategories(categories, 'updateHabit');
  return habitRepo.update(id, name, frequency, basePoints, JSON.stringify(categories));
}

export async function deleteHabit(habitId: string): Promise<void> {
  return habitRepo.deleteById(habitId);
}
