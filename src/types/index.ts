/**
 * types/index.ts — Tipos del dominio de la aplicación.
 *
 * Los nombres de campos coinciden con las columnas de SQLite (snake_case)
 * según el esquema definido en la Regla 003.
 */

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  base_points: number;
  default_categories: string; // JSON string, ej: '["paz","fisico"]'
}

export interface PerformedHabit {
  id: string;
  habit_id: string;
  timestamp: string; // ISO 8601 YYYY-MM-DD HH:MM:SS
  points_earned: number;
  habit_description: string | null;
  categories_used: string | null; // JSON string
}

export interface MoodEntry {
  id: string;
  value: number; // 1.0–10.0, step 0.5
  description: string | null;
  timestamp: string; // ISO 8601
  habit_id: string | null;
}

/** Habit enriquecido con estado de completado para la vista diaria */
export interface DailyHabit extends Habit {
  completedToday: boolean;
  performedHabitId: string | null;
}

/** Progreso de puntos del día */
export interface DailyStats {
  earned: number;
  total: number;
  percentage: number;
}

/** Datos del hábito pendiente de reflexión (modal abierto) */
export interface PendingReflection {
  habit: DailyHabit;
  performedHabitId: string;
  isEditing: boolean;
  initialDescription: string;
  initialMoodValue: number;
}

/** Datos para crear o editar un hábito "molde" */
export interface HabitFormData {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  basePoints: number;
  categories: string[];
}

// ─── Stats ──────────────────────────────────────────────────────────

/** Resumen de un hábito en una fecha específica (heatmap detail) */
export interface DaySummaryHabit {
  name: string;
  completed: boolean;
}

/** Puntos acumulados por categoría (pie chart) */
export interface CategoryPoints {
  category: string;
  points: number;
}

/** Comparativa semanal de puntos */
export interface WeeklyComparison {
  thisWeek: number;
  lastWeek: number;
}
