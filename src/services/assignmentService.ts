/**
 * assignmentService.ts — Lógica de negocio para daily_assignments.
 *
 * Se encarga de: generación de asignaciones, backfill, toggle,
 * registros espontáneos y construcción de DailyItem para la vista.
 *
 * Delega acceso a datos a los repositorios.
 */

import { getTodayPrefix, getTimestampForDate, getNowTimestamp, isFutureDate } from './db';
import * as assignmentRepo from '../repositories/assignmentRepository';
import * as habitRepo from '../repositories/habitRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { DailyItem, DailyStats, DailyAssignment } from '../types';
import { buildStats } from '../utils/statsHelpers';
import { VALID_AREA_IDS } from '../config/constants';

// ─── Consultas públicas ─────────────────────────────────────────────

/** Ítems del día enriquecidos (genera asignaciones si faltan). */
export async function getItemsForDate(
  datePrefix?: string,
): Promise<DailyItem[]> {
  const day = datePrefix ?? getTodayPrefix();
  await ensureAssignmentsForDate(day);

  const [assignments, performed] = await Promise.all([
    assignmentRepo.findByDate(day),
    taskRepo.findByDate(day),
  ]);

  return enrichAssignments(assignments, performed);
}

/** Progreso de puntos del día (basado en asignaciones). */
export async function getPointsForDate(
  datePrefix?: string,
): Promise<DailyStats> {
  const day = datePrefix ?? getTodayPrefix();
  await ensureAssignmentsForDate(day);

  const [total, earned] = await Promise.all([
    assignmentRepo.sumPointsByDate(day),
    assignmentRepo.sumEarnedByDate(day),
  ]);

  return buildStats(earned, total);
}

// ─── Mutaciones públicas ────────────────────────────────────────────

/** Completa una asignación y crea performed_habit (para hábitos regulares). */
export async function completeAssignment(
  item: DailyItem,
  datePrefix?: string,
): Promise<string | null> {
  const day = datePrefix ?? getTodayPrefix();
  await assignmentRepo.setCompleted(item.assignmentId, true);

  // Crear performed_habit solo para hábitos regulares (no espontáneos)
  if (item.habitId) {
    const ts = datePrefix ? getTimestampForDate(day) : getNowTimestamp();
    const performedId = await taskRepo.insert(
      item.habitId, ts, item.points, item.categories,
    );
    return performedId;
  }

  return null;
}

/** Descompleta una asignación y borra performed_habit + mood. */
export async function uncompleteAssignment(
  item: DailyItem,
  datePrefix?: string,
): Promise<void> {
  await assignmentRepo.setCompleted(item.assignmentId, false);

  // Borrar performed_habit asociado
  if (item.performedHabitId) {
    await taskRepo.deleteById(item.performedHabitId);
  }
}

/** Crea un registro espontáneo (siempre completado). */
export async function addSpontaneous(
  name: string,
  categories: string[],
  datePrefix?: string,
): Promise<void> {
  // BUG-04: validar categorias antes de insertar
  const invalidIds = categories.filter((id) => !VALID_AREA_IDS.has(id));
  if (invalidIds.length > 0) {
    throw new Error(
      `addSpontaneous: categorias invalidas — ${invalidIds.join(', ')}`,
    );
  }
  const day = datePrefix ?? getTodayPrefix();
  await assignmentRepo.insert(
    null, day, name, 0,
    JSON.stringify(categories), 'daily', 1, 1,
  );
}

/** Elimina un registro espontáneo. */
export async function removeSpontaneous(
  assignmentId: string,
): Promise<void> {
  await assignmentRepo.deleteById(assignmentId);
}

// ─── Sincronización con la Biblioteca ────────────────────────────────

/**
 * Agrega una asignación para un hábito en la fecha dada (solo si no existe).
 * Se usa al crear o re-activar un hábito desde la Biblioteca.
 * Solo afecta al día de hoy — nunca toca días pasados.
 */
export async function addAssignmentForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<void> {
  const day = datePrefix ?? getTodayPrefix();
  if (isFutureDate(day)) return;
  const existing = await assignmentRepo.findByHabitAndDate(habitId, day);
  if (existing) return;

  const habit = await habitRepo.findById(habitId);
  if (!habit) return;

  await assignmentRepo.insert(
    habit.id, day, habit.name, habit.base_points,
    habit.default_categories, habit.frequency, 0, 0,
  );
}

/**
 * Elimina la asignación no completada de un hábito en la fecha dada.
 * Se usa al archivar un hábito desde la Biblioteca.
 * Solo afecta al día de hoy — nunca toca días pasados.
 * Si el hábito ya fue completado hoy, su asignación se preserva.
 */
export async function removeAssignmentForHabit(
  habitId: string,
  datePrefix?: string,
): Promise<void> {
  const day = datePrefix ?? getTodayPrefix();
  await assignmentRepo.deleteUncompletedByHabitAndDate(habitId, day);
}

/**
 * Actualiza el snapshot del día de hoy para un hábito editado.
 * Solo afecta asignaciones no completadas — las ya completadas preservan
 * el snapshot del momento en que se completaron.
 */
export async function updateTodaySnapshotForHabit(habitId: string): Promise<void> {
  const today = getTodayPrefix();
  const habit = await habitRepo.findById(habitId);
  if (!habit) return;

  await assignmentRepo.updateSnapshot(
    habitId,
    today,
    habit.name,
    habit.base_points,
    habit.default_categories,
    habit.frequency,
  );
}

// ─── Backfill (integridad histórica) ────────────────────────────────

/**
 * Detecta días sin asignaciones desde la última fecha registrada
 * y genera asignaciones con is_completed = 0 para cada uno.
 * En días con performed_habits existentes, marca como completado.
 */
export async function checkAndBackfillHistory(): Promise<void> {
  const today = getTodayPrefix();
  const latestDate = await assignmentRepo.findLatestDate();

  if (!latestDate) {
    // Primera vez: solo generar para hoy
    await ensureAssignmentsForDate(today);
    return;
  }

  // Rellenar desde el día siguiente al último registrado hasta hoy
  const start = nextDay(latestDate);
  const end = new Date(`${today}T00:00:00Z`);

  const current = new Date(`${start}T00:00:00Z`);
  while (current <= end) {
    const dateStr = formatDateStr(current);
    await ensureAssignmentsForDate(dateStr);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

// ─── Generación de asignaciones ─────────────────────────────────────

/**
 * Genera daily_assignments para una fecha si aún no existen.
 * Usa los hábitos activos actuales como base del snapshot.
 * Cruza con performed_habits existentes para marcar completados.
 */
export async function ensureAssignmentsForDate(datePrefix: string): Promise<void> {
  if (isFutureDate(datePrefix)) return;
  const existing = await assignmentRepo.countByDate(datePrefix);
  if (existing > 0) return;

  const [habits, performed] = await Promise.all([
    habitRepo.findAllActive(),
    taskRepo.findByDate(datePrefix),
  ]);

  const performedSet = new Set(performed.map((p) => p.habit_id));

  for (const habit of habits) {
    const isCompleted = performedSet.has(habit.id) ? 1 : 0;
    await assignmentRepo.insert(
      habit.id,
      datePrefix,
      habit.name,
      habit.base_points,
      habit.default_categories,
      habit.frequency,
      isCompleted,
      0,
    );
  }
}

// ─── Helpers internos ───────────────────────────────────────────────

function enrichAssignments(
  assignments: DailyAssignment[],
  performed: { id: string; habit_id: string }[],
): DailyItem[] {
  const performedMap = new Map(performed.map((p) => [p.habit_id, p.id]));

  return assignments.map((a) => {
    const isCompleted = a.is_completed === 1;
    return {
      assignmentId: a.id,
      habitId: a.habit_id,
      name: a.snapshot_name,
      points: a.snapshot_points,
      categories: a.snapshot_categories,
      frequency: a.snapshot_frequency as 'daily' | 'weekly' | 'monthly',
      isCompleted,
      // Hotfix Task 1: placeholder = isCompleted; el cómputo real (period-aware)
      // lo agrega Task 2 mediante getItemsForDate -> findCompletedHabitsInRange.
      isCompletedForPeriod: isCompleted,
      isSpontaneous: a.is_spontaneous === 1,
      performedHabitId: a.habit_id ? performedMap.get(a.habit_id) ?? null : null,
    };
  });
}

export function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateStr(d);
}

function formatDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
