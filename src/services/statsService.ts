/**
 * statsService.ts — Lógica de negocio para estadísticas y progreso.
 *
 * Delega el acceso a datos a los repositorios.
 * Se encarga de: cálculo de heatmap, agregación de categorías,
 * comparación semanal y resumen diario.
 *
 * Las firmas públicas NO cambian (contrato con StatsScreen).
 */

import { VALID_AREA_IDS } from '../config/constants';
import * as habitRepo from '../repositories/habitRepository';
import * as taskRepo from '../repositories/taskRepository';
import type { Habit, DaySummaryHabit, CategoryPoints, WeeklyComparison } from '../types';

// ─── Helpers de fecha ────────────────────────────────────────────────

function buildMonthPrefix(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekBounds(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  return { start: formatDateOnly(monday), end: formatDateOnly(nextMonday) };
}

function safeParseJson(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ─── Consultas públicas ─────────────────────────────────────────────

/** Heatmap mensual: { díaDelMes → porcentaje de cumplimiento }. */
export async function getMonthlyHeatmapData(
  month: number,
  year: number,
): Promise<Record<number, number>> {
  const prefix = buildMonthPrefix(month, year);
  const [totalPossible, rows] = await Promise.all([
    habitRepo.sumDailyActivePoints(),
    taskRepo.sumEarnedByDayInMonth(prefix),
  ]);

  if (totalPossible === 0) return {};
  return buildHeatmap(rows, totalPossible);
}

/** Distribución de categorías (pie chart) para un mes dado. */
export async function getCategoryDistribution(
  month: number,
  year: number,
): Promise<CategoryPoints[]> {
  const prefix = buildMonthPrefix(month, year);
  const rows = await taskRepo.findCategoriesInMonth(prefix);
  return aggregateByCategory(rows);
}

/** Puntos totales: semana actual vs semana anterior. */
export async function getWeeklyComparison(): Promise<WeeklyComparison> {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);

  const [thisTotal, lastTotal] = await Promise.all([
    taskRepo.sumEarnedInRange(thisWeek.start, thisWeek.end),
    taskRepo.sumEarnedInRange(lastWeek.start, lastWeek.end),
  ]);

  return { thisWeek: thisTotal, lastWeek: lastTotal };
}

/** Hábitos diarios con estado completed para una fecha (YYYY-MM-DD). */
export async function getHabitsForDate(
  dateStr: string,
): Promise<DaySummaryHabit[]> {
  const [habits, doneIds] = await Promise.all([
    habitRepo.findDailyActive(),
    taskRepo.findHabitIdsOnDate(dateStr),
  ]);

  return buildDaySummary(habits, doneIds);
}

// ─── Helpers internos de transformación (lógica de negocio) ──────────

function buildHeatmap(
  rows: { day: string; earned: number }[],
  totalPossible: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const row of rows) {
    const dayNum = parseInt(row.day, 10);
    result[dayNum] = Math.min(Math.round((row.earned / totalPossible) * 100), 100);
  }
  return result;
}

/**
 * Agrega puntos por categoría, deduplicando IDs dentro de cada registro
 * y filtrando categorías que no existan en HABIT_AREAS (VALID_AREA_IDS).
 */
function aggregateByCategory(
  rows: { categories_used: string; points_earned: number }[],
): CategoryPoints[] {
  const map: Record<string, number> = {};

  for (const row of rows) {
    const rawCats = safeParseJson(row.categories_used);
    const cats = [...new Set(rawCats)].filter((id) => VALID_AREA_IDS.has(id as never));
    const share = row.points_earned / Math.max(cats.length, 1);
    for (const cat of cats) {
      map[cat] = (map[cat] ?? 0) + share;
    }
  }

  return Object.entries(map).map(([category, points]) => ({
    category,
    points: Math.round(points * 10) / 10,
  }));
}

function buildDaySummary(habits: Habit[], doneIds: string[]): DaySummaryHabit[] {
  const doneSet = new Set(doneIds);
  return habits.map((h) => ({
    name: h.name,
    completed: doneSet.has(h.id),
  }));
}
