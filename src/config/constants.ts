/**
 * constants.ts — Constantes globales de la aplicación.
 *
 * Prohibido usar strings o números mágicos en el código.
 * Toda constante compartida debe vivir aquí.
 */

// ─── Base de datos ──────────────────────────────────────────────────
export const DB_NAME = 'cozyhabit.db';

// ─── Mood ───────────────────────────────────────────────────────────
export const MOOD_MIN = 1;
export const MOOD_MAX = 10;
export const MOOD_STEP = 0.5;
export const MOOD_DEFAULT_VALUE = 5;

// ─── Frecuencias de hábitos ─────────────────────────────────────────
export const HABIT_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

export const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
] as const;

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

// ─── Puntos base ────────────────────────────────────────────────────
export const BASE_POINTS_MIN = 1;
export const BASE_POINTS_MAX = 10;
export const BASE_POINTS_DEFAULT = 1;

// ─── Categorías de hábitos ──────────────────────────────────────────
export const HABIT_CATEGORIES = [
  { id: 'paz', label: 'Paz interior' },
  { id: 'fisico', label: 'Bienestar físico' },
  { id: 'aprendizaje', label: 'Aprendizaje' },
  { id: 'social', label: 'Social' },
  { id: 'creatividad', label: 'Creatividad' },
  { id: 'productividad', label: 'Productividad' },
] as const;

// ─── Seed data (hábitos iniciales de prueba) ────────────────────────
export const SEED_HABITS = [
  { name: 'Meditación matutina', frequency: 'daily', basePoints: 2, categories: '["paz"]' },
  { name: 'Caminata 20 min', frequency: 'daily', basePoints: 3, categories: '["fisico"]' },
  { name: 'Lectura técnica', frequency: 'daily', basePoints: 2, categories: '["aprendizaje"]' },
] as const;

// ─── UI ─────────────────────────────────────────────────────────────
export const CHECKBOX_ICON_SIZE = 16;
export const PROGRESS_BAR_HEIGHT = 10;

// ─── Alerts ─────────────────────────────────────────────────────────
export const ALERT_UNMARK = {
  title: '¿Eliminar registro?',
  message: '¿Deseas eliminar el registro de hoy? Esto borrará también tu reflexión y humor.',
  confirm: 'Eliminar',
  cancel: 'Cancelar',
} as const;

export const ALERT_DELETE_HABIT = {
  title: '¿Eliminar hábito?',
  message: 'Se eliminarán todos los registros asociados a este hábito.',
  confirm: 'Eliminar',
  cancel: 'Cancelar',
} as const;

// ─── Stats / Charts ─────────────────────────────────────────────────

/** Colores del heatmap por nivel de cumplimiento */
export const HEATMAP_COLORS = {
  empty: '#fffbeb',    // amber50 (sin actividad)
  low: '#fde68a',      // amber200 (1-24 %)
  medium: '#fbbf24',   // amber400 (25-49 %)
  good: '#bbf7d0',     // sage200 (50-74 %)
  great: '#4ade80',    // sage400 (75-99 %)
  full: '#15803d',     // sage700 (100 %)
} as const;

/** Colores para cada categoría en el pie chart */
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  paz: '#86efac',
  fisico: '#fbbf24',
  aprendizaje: '#93c5fd',
  social: '#fda4af',
  creatividad: '#c4b5fd',
  productividad: '#67e8f9',
};

/** Labels legibles derivados de HABIT_CATEGORIES */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  HABIT_CATEGORIES.map((c) => [c.id, c.label]),
);

/** Nombres de meses en español (índice 0 = enero) */
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** Etiquetas de días de la semana (L-D, empezando lunes) */
export const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

// ─── AppBackground ──────────────────────────────────────────────────
/** URL temporal — reemplazar por require('../../assets/images/background.jpg') */
export const BACKGROUND_IMAGE_URI =
  'https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?w=800&q=80';
export const BLUR_INTENSITY = 20;
export const BLUR_TINT = 'light' as const;

// ─── Navegación — Nombres de rutas ─────────────────────────────────
export const ROUTES = {
  DAILY_SHEET: 'Hoy',
  HABIT_LIBRARY: 'Biblioteca',
  STATS: 'Progreso',
} as const;
