/**
 * types/index.ts — Tipos del dominio de la aplicación.
 *
 * Los nombres de campos coinciden con las columnas de SQLite (snake_case)
 * según el esquema definido en la Regla 003.
 */

// ─── Entidades de BD ────────────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  base_points: number;
  default_categories: string; // JSON string, ej: '["salud_fisica"]'
  is_active: number; // 0 | 1 (SQLite boolean)
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

// ─── Daily Assignments (Cápsula del Tiempo) ─────────────────────────

/** Fila cruda de la tabla daily_assignments */
export interface DailyAssignment {
  id: string;
  habit_id: string | null;
  date: string;
  snapshot_name: string;
  snapshot_points: number;
  snapshot_categories: string;
  snapshot_frequency: string;
  is_completed: number; // 0 | 1
  is_spontaneous: number; // 0 | 1
}

// ─── Vistas enriquecidas ────────────────────────────────────────────

/** Habit enriquecido con estado de completado para la vista diaria (legacy) */
export interface DailyHabit extends Habit {
  completedToday: boolean;
  performedHabitId: string | null;
}

/** Ítem enriquecido del día basado en daily_assignments */
export interface DailyItem {
  assignmentId: string;
  habitId: string | null;
  name: string;
  points: number;
  categories: string; // JSON string
  frequency: 'daily' | 'weekly' | 'monthly';
  isCompleted: boolean; // estado de la row del día actual
  // REQ-04-10/11: true si HAY al menos 1 row con is_completed=1 en el período
  // actual del item (ISO week para weekly, mes calendario para monthly).
  // Para daily, isCompletedForPeriod === isCompleted (mismo período).
  isCompletedForPeriod: boolean;
  isSpontaneous: boolean;
  performedHabitId: string | null;
}

/** Progreso de puntos */
export interface DailyStats {
  earned: number;
  total: number;
  percentage: number;
}

/** Grupo de ítems por frecuencia con sus stats */
export interface FrequencyGroup {
  frequency: 'daily' | 'weekly' | 'monthly';
  items: DailyItem[];
  stats: DailyStats;
}

/** Datos del ítem pendiente de reflexión (modal abierto) */
export interface PendingReflection {
  item: DailyItem;
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

/** Habit de biblioteca con contador de completados */
export interface LibraryHabit extends Habit {
  completionCount: number;
}

// ─── Stats ──────────────────────────────────────────────────────────

export interface DaySummaryHabit {
  name: string;
  completed: boolean;
  isSpontaneous: boolean;
  points: number;
  frequency: string;
}

export interface CategoryPoints {
  category: string;
  points: number;
}

export interface WeeklyComparison {
  thisWeek: number;
  lastWeek: number;
}

// ─── Área de hábito (constante tipada) ──────────────────────────────

export interface HabitArea {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly color: string;
  readonly iconName: string;
}

// ─── Navegación ─────────────────────────────────────────────────────

export type RootStackParamList = {
  Main: undefined;
  Ajustes: undefined;
  RestoreFromDrive: undefined;
};

export type RootTabParamList = {
  Hoy: { date?: string };
  Biblioteca: undefined;
  Progreso: undefined;
};

// ─── Backup ─────────────────────────────────────────────────────────

export interface BackupData {
  version: number;
  exportedAt: string;
  habits: Habit[];
  performed_habits: PerformedHabit[];
  mood_entries: MoodEntry[];
  daily_assignments: DailyAssignment[];
}
