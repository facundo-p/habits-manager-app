/**
 * assignmentService.ts — Lógica de negocio para daily_assignments.
 *
 * Se encarga de: generación de asignaciones, backfill, toggle,
 * registros espontáneos y construcción de DailyItem para la vista.
 *
 * Delega acceso a datos a los repositorios.
 */

import { getTodayPrefix, getTimestampForDate, getNowTimestamp, isFutureDate } from './db';
import { dateToPrefix } from '../utils/dateHelpers';
import * as assignmentRepo from '../repositories/assignmentRepository';
import * as habitRepo from '../repositories/habitRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { DailyItem, DailyStats, DailyAssignment } from '../types';
import { buildStats } from '../utils/statsHelpers';
import { assertValidCategories } from '../utils/validation';
import { type Frequency } from '../utils/periodHelpers';

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

  // REQ-04-10/11: resolver isCompletedForPeriod via single aggregated query
  // por frequency (weekly/monthly) — daily no necesita query (ya viene en is_completed).
  const completedInPeriod = await resolveCompletedInPeriod(assignments, day);
  return enrichAssignments(assignments, performed, completedInPeriod);
}

/**
 * Para cada frequency periódica (weekly/monthly), agrupa habit_ids y consulta
 * findCompletedHabitsInRange. Retorna el set unión de ids con al menos una row
 * is_completed=1 en el período correspondiente.
 */
async function resolveCompletedInPeriod(
  assignments: DailyAssignment[],
  day: string,
): Promise<Set<string>> {
  const completedInPeriod = new Set<string>();
  const weeklyIds = uniqueHabitIdsByFrequency(assignments, 'weekly');
  const monthlyIds = uniqueHabitIdsByFrequency(assignments, 'monthly');

  if (weeklyIds.length > 0) {
    const [start, end] = getPeriodRange(day, 'weekly');
    const ids = await assignmentRepo.findCompletedHabitsInRange(weeklyIds, start, end);
    ids.forEach((id) => completedInPeriod.add(id));
  }
  if (monthlyIds.length > 0) {
    const [start, end] = getPeriodRange(day, 'monthly');
    const ids = await assignmentRepo.findCompletedHabitsInRange(monthlyIds, start, end);
    ids.forEach((id) => completedInPeriod.add(id));
  }
  return completedInPeriod;
}

function uniqueHabitIdsByFrequency(
  assignments: DailyAssignment[],
  frequency: Frequency,
): string[] {
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.habit_id !== null && a.snapshot_frequency === frequency) {
      ids.add(a.habit_id);
    }
  }
  return [...ids];
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

  // REQ-04-10/11 D-01 Opción B: weekly/monthly propagan completion al período.
  if (item.habitId !== null && (item.frequency === 'weekly' || item.frequency === 'monthly')) {
    const [start, end] = getPeriodRange(day, item.frequency);
    await assignmentRepo.setCompletedForHabitInRange(item.habitId, 1, start, end);
  } else {
    await assignmentRepo.setCompleted(item.assignmentId, true);
  }

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
  const day = datePrefix ?? getTodayPrefix();

  // REQ-04-10/11: revertir propagación si el hábito es weekly/monthly.
  if (item.habitId !== null && (item.frequency === 'weekly' || item.frequency === 'monthly')) {
    const [start, end] = getPeriodRange(day, item.frequency);
    await assignmentRepo.setCompletedForHabitInRange(item.habitId, 0, start, end);
  } else {
    await assignmentRepo.setCompleted(item.assignmentId, false);
  }

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
  assertValidCategories(categories, 'addSpontaneous');
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

  const freq = habit.frequency as Frequency;
  // REQ-04-10/11 D-01: weekly/monthly propagan snapshot a todas las rows
  // uncompleted del período actual; daily mantiene comportamiento por-día.
  if (freq === 'weekly' || freq === 'monthly') {
    const [start, end] = getPeriodRange(today, freq);
    await assignmentRepo.updateSnapshotForHabitInRange(
      habitId, start, end,
      habit.name, habit.base_points, habit.default_categories, habit.frequency,
    );
  } else {
    await assignmentRepo.updateSnapshot(
      habitId, today,
      habit.name, habit.base_points, habit.default_categories, habit.frequency,
    );
  }
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
  await backfillRange(start, today);
}

async function backfillRange(start: string, end: string): Promise<void> {
  const current = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (current <= endDate) {
    await ensureAssignmentsForDate(dateToPrefix(current));
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
    await insertAssignmentForHabit(habit, datePrefix, performedSet);
  }

  await assertNoDuplicatesIfDev();
}

async function insertAssignmentForHabit(
  habit: { id: string; name: string; base_points: number; default_categories: string; frequency: string },
  datePrefix: string,
  performedSet: Set<string>,
): Promise<void> {
  const isCompleted = performedSet.has(habit.id) ? 1 : 0;
  await assignmentRepo.insert(
    habit.id, datePrefix, habit.name, habit.base_points,
    habit.default_categories, habit.frequency, isCompleted, 0,
  );
}

/**
 * REQ-04-01: invariante runtime dev-only — el INDEX en prod ya hace fail-loud,
 * pero en dev queremos detectar regresiones en tests sin index en otros paths.
 *
 * Lectura defensiva: `__DEV__` es global en Metro/RN. En jest no se inyecta,
 * así que default = true (en jest queremos que el invariante CORRA — es donde
 * más útil es para detectar regresiones tempranas).
 */
async function assertNoDuplicatesIfDev(): Promise<void> {
  const __DEV__ = (globalThis as { __DEV__?: boolean }).__DEV__ ?? true;
  if (__DEV__) {
    const dups = await assignmentRepo.findDuplicates();
    if (dups.length > 0) {
      console.warn('[ensureAssignmentsForDate] duplicates detected post-insert', dups);
    }
  }
}

// ─── Helpers internos ───────────────────────────────────────────────

function enrichAssignments(
  assignments: DailyAssignment[],
  performed: { id: string; habit_id: string }[],
  completedInPeriod: Set<string>,
): DailyItem[] {
  const performedMap = new Map(performed.map((p) => [p.habit_id, p.id]));

  return assignments.map((a) => {
    const isCompleted = a.is_completed === 1;
    // REQ-04-10/11: para hábitos regulares periódicos, isCompletedForPeriod
    // refleja si CUALQUIER row del período tiene is_completed=1. Para spontaneous
    // (habit_id=null) y daily, equivale al estado de la propia row.
    const isCompletedForPeriod = a.habit_id !== null
      ? (isCompleted || completedInPeriod.has(a.habit_id))
      : isCompleted;
    return {
      assignmentId: a.id,
      habitId: a.habit_id,
      name: a.snapshot_name,
      points: a.snapshot_points,
      categories: a.snapshot_categories,
      frequency: a.snapshot_frequency as 'daily' | 'weekly' | 'monthly',
      isCompleted,
      isCompletedForPeriod,
      isSpontaneous: a.is_spontaneous === 1,
      performedHabitId: a.habit_id ? performedMap.get(a.habit_id) ?? null : null,
    };
  });
}

/**
 * Devuelve [startDate, endDate] (inclusive) del período al que pertenece datePrefix.
 * - daily:   [datePrefix, datePrefix]
 * - weekly:  [lunes, domingo] de la semana ISO 8601 (UTC)
 * - monthly: [primer-día-del-mes, último-día-del-mes]
 */
function getPeriodRange(datePrefix: string, frequency: Frequency): [string, string] {
  if (frequency === 'daily') return [datePrefix, datePrefix];
  if (frequency === 'monthly') {
    const [y, m] = datePrefix.split('-').map(Number);
    const start = `${datePrefix.slice(0, 7)}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = `${datePrefix.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
    return [start, end];
  }
  // weekly: lunes a domingo (ISO 8601)
  const d = new Date(`${datePrefix}T00:00:00Z`);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return [dateToPrefix(monday), dateToPrefix(sunday)];
}

// exported for unit tests
export function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateToPrefix(d);
}
