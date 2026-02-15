/**
 * statsService.ts — Consultas de estadísticas y progreso.
 *
 * Las funciones mantienen < 20 líneas; SQL largo se extrae a constantes.
 * Los componentes NUNCA ejecutan SQL directamente (Regla 001 + 003).
 */

import { getDatabase } from './db';
import type { Habit, DaySummaryHabit, CategoryPoints, WeeklyComparison } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_DAILY_TOTAL =
  "SELECT COALESCE(SUM(base_points), 0) as total FROM habits WHERE frequency = 'daily' AND is_active = 1";

const SQL_EARNED_BY_DAY =
  "SELECT SUBSTR(timestamp, 9, 2) as day, SUM(points_earned) as earned FROM performed_habits WHERE timestamp LIKE ? || '%' GROUP BY day";

const SQL_CATEGORY_DATA =
  "SELECT categories_used, points_earned FROM performed_habits WHERE timestamp LIKE ? || '%' AND categories_used IS NOT NULL";

const SQL_WEEK_TOTAL =
  'SELECT COALESCE(SUM(points_earned), 0) as total FROM performed_habits WHERE timestamp >= ? AND timestamp < ?';

const SQL_DAILY_HABITS =
  "SELECT * FROM habits WHERE frequency = 'daily' AND is_active = 1";

const SQL_PERFORMED_ON_DATE =
  "SELECT habit_id FROM performed_habits WHERE timestamp LIKE ? || '%'";

// ─── Helpers ────────────────────────────────────────────────────────

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
  const db = await getDatabase();
  const prefix = buildMonthPrefix(month, year);

  const totalRow = await db.getFirstAsync<{ total: number }>(SQL_DAILY_TOTAL);
  const totalPossible = totalRow?.total ?? 0;
  if (totalPossible === 0) return {};

  const rows = await db.getAllAsync<{ day: string; earned: number }>(
    SQL_EARNED_BY_DAY,
    [prefix],
  );

  return buildHeatmap(rows, totalPossible);
}

/** Distribución de categorías (pie chart) para un mes dado. */
export async function getCategoryDistribution(
  month: number,
  year: number,
): Promise<CategoryPoints[]> {
  const db = await getDatabase();
  const prefix = buildMonthPrefix(month, year);

  const rows = await db.getAllAsync<{ categories_used: string; points_earned: number }>(
    SQL_CATEGORY_DATA,
    [prefix],
  );

  return aggregateByCategory(rows);
}

/** Puntos totales: semana actual vs semana anterior. */
export async function getWeeklyComparison(): Promise<WeeklyComparison> {
  const db = await getDatabase();
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);

  const [thisRow, lastRow] = await Promise.all([
    db.getFirstAsync<{ total: number }>(SQL_WEEK_TOTAL, [thisWeek.start, thisWeek.end]),
    db.getFirstAsync<{ total: number }>(SQL_WEEK_TOTAL, [lastWeek.start, lastWeek.end]),
  ]);

  return {
    thisWeek: thisRow?.total ?? 0,
    lastWeek: lastRow?.total ?? 0,
  };
}

/** Hábitos diarios con estado completed para una fecha (YYYY-MM-DD). */
export async function getHabitsForDate(
  dateStr: string,
): Promise<DaySummaryHabit[]> {
  const db = await getDatabase();

  const [habits, performed] = await Promise.all([
    db.getAllAsync<Habit>(SQL_DAILY_HABITS),
    db.getAllAsync<{ habit_id: string }>(SQL_PERFORMED_ON_DATE, [dateStr]),
  ]);

  const doneSet = new Set(performed.map((p) => p.habit_id));

  return habits.map((h) => ({
    name: h.name,
    completed: doneSet.has(h.id),
  }));
}

// ─── Helpers internos de transformación ──────────────────────────────

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

function aggregateByCategory(
  rows: { categories_used: string; points_earned: number }[],
): CategoryPoints[] {
  const map: Record<string, number> = {};

  for (const row of rows) {
    const cats = safeParseJson(row.categories_used);
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
