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
  daily: 'Diarios',
  weekly: 'Semanales',
  monthly: 'Mensuales',
};

// ─── Puntos base ────────────────────────────────────────────────────
export const BASE_POINTS_MIN = 1;
export const BASE_POINTS_MAX = 10;
export const BASE_POINTS_DEFAULT = 1;

// ─── Áreas de hábitos (9 categorías enriquecidas) ───────────────────

export const HABIT_AREAS = [
  {
    id: 'salud_fisica',
    label: 'Salud Física',
    description: 'Cuidar tu cuerpo a través del movimiento, nutrición y descanso.',
    examples: ['Caminar 30 min', 'Beber 2L de agua', 'Dormir 8 horas'],
    color: '#4ade80',
    iconName: 'Heart',
  },
  {
    id: 'mental',
    label: 'Salud Mental',
    description: 'Fortalecer tu bienestar emocional y cognitivo.',
    examples: ['Meditar 10 min', 'Journaling', 'Respiración consciente'],
    color: '#93c5fd',
    iconName: 'Brain',
  },
  {
    id: 'relaciones',
    label: 'Relaciones',
    description: 'Nutrir vínculos con familia, amigos y comunidad.',
    examples: ['Llamar a un amigo', 'Cena familiar', 'Mensaje de gratitud'],
    color: '#fda4af',
    iconName: 'Users',
  },
  {
    id: 'proposito',
    label: 'Propósito',
    description: 'Avanzar en tus metas profesionales y de vida.',
    examples: ['Proyecto personal', 'Planificar la semana', 'Networking'],
    color: '#fbbf24',
    iconName: 'Target',
  },
  {
    id: 'economia',
    label: 'Economía',
    description: 'Gestionar tus finanzas de forma consciente.',
    examples: ['Revisar gastos', 'Ahorrar', 'Leer sobre inversiones'],
    color: '#67e8f9',
    iconName: 'Wallet',
  },
  {
    id: 'crecimiento',
    label: 'Crecimiento',
    description: 'Aprender y desarrollar nuevas habilidades.',
    examples: ['Leer 20 páginas', 'Curso online', 'Practicar idioma'],
    color: '#c4b5fd',
    iconName: 'TrendingUp',
  },
  {
    id: 'espiritualidad',
    label: 'Espiritualidad',
    description: 'Conectar con tu interior y encontrar paz.',
    examples: ['Oración', 'Meditación guiada', 'Gratitud diaria'],
    color: '#86efac',
    iconName: 'Sparkles',
  },
  {
    id: 'recreacion',
    label: 'Recreación',
    description: 'Disfrutar de actividades que te revitalicen.',
    examples: ['Hobby creativo', 'Paseo al aire libre', 'Ver una película'],
    color: '#fdba74',
    iconName: 'Palette',
  },
  {
    id: 'entorno',
    label: 'Entorno',
    description: 'Mantener y mejorar tu espacio vital.',
    examples: ['Ordenar escritorio', 'Limpiar casa', 'Cuidar plantas'],
    color: '#a3e635',
    iconName: 'Home',
  },
] as const;

/** Mapa de acceso rápido por ID de área. */
export const AREAS_MAP = Object.fromEntries(
  HABIT_AREAS.map((a) => [a.id, a]),
) as Record<string, (typeof HABIT_AREAS)[number]>;

/** Colores para cada área/categoría en el pie chart (incluye legacy). */
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  ...Object.fromEntries(HABIT_AREAS.map((a) => [a.id, a.color])),
  // Legacy mappings para datos existentes
  paz: '#86efac',
  fisico: '#4ade80',
  aprendizaje: '#c4b5fd',
  social: '#fda4af',
  creatividad: '#fdba74',
  productividad: '#fbbf24',
};

/** Labels legibles derivados de HABIT_AREAS (incluye legacy). */
export const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(HABIT_AREAS.map((a) => [a.id, a.label])),
  paz: 'Espiritualidad',
  fisico: 'Salud Física',
  aprendizaje: 'Crecimiento',
  social: 'Relaciones',
  creatividad: 'Recreación',
  productividad: 'Propósito',
};

/** Set de IDs válidos de áreas (para sanitización de datos). */
export const VALID_AREA_IDS = new Set(HABIT_AREAS.map((a) => a.id));

// ─── Seed data (hábitos iniciales de prueba) ────────────────────────
export const SEED_HABITS = [
  { name: 'Meditación matutina', frequency: 'daily', basePoints: 2, categories: '["espiritualidad"]' },
  { name: 'Caminata 20 min', frequency: 'daily', basePoints: 3, categories: '["salud_fisica"]' },
  { name: 'Lectura técnica', frequency: 'daily', basePoints: 2, categories: '["crecimiento"]' },
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

export const ALERT_VOICE_UNAVAILABLE = {
  title: 'Dictado no disponible',
  message: 'El dictado de voz requiere una build de desarrollo (no Expo Go).',
} as const;

// ─── Stats / Charts ─────────────────────────────────────────────────
export const HEATMAP_COLORS = {
  empty: '#fffbeb',
  low: '#fde68a',
  medium: '#fbbf24',
  good: '#bbf7d0',
  great: '#4ade80',
  full: '#15803d',
} as const;

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

// ─── AppBackground ──────────────────────────────────────────────────
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
