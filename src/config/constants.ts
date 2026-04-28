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

export const SPONTANEOUS_SECTION_LABEL = 'Logros del Día';
export const SPONTANEOUS_DEFAULT_POINTS = 0;

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

export const ALERT_UNMARK_SPONTANEOUS = {
  title: '¿Eliminar logro?',
  message: 'Se eliminará este registro espontáneo de hoy.',
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
  SETTINGS: 'Ajustes',
  MAIN: 'Main',
} as const;

// ─── Backup ─────────────────────────────────────────────────────────
export const BACKUP_VERSION = 1;
export const BACKUP_FILENAME = 'cozy_habit_backup.json';

export const ALERT_IMPORT = {
  title: '¿Importar datos?',
  message: 'Esto reemplazará TODOS tus datos actuales (hábitos, registros y humor). Esta acción no se puede deshacer.',
  confirm: 'Importar',
  cancel: 'Cancelar',
} as const;

export const ALERT_IMPORT_SUCCESS = {
  title: 'Importación exitosa',
  message: 'Tus datos han sido restaurados correctamente.',
} as const;

export const ALERT_IMPORT_ERROR = {
  title: 'Error de importación',
  message: 'El archivo no tiene un formato válido de respaldo CozyHabit.',
} as const;

export const ALERT_EXPORT_ERROR = {
  title: 'Error de exportación',
  message: 'No se pudo exportar el respaldo. Intenta nuevamente.',
} as const;

// ─── Drive Backup ───────────────────────────────────────────────────
export const BACKUP_FILE_PREFIX = 'cozyhabits-';
export const BACKUP_FILE_EXTENSION = '.json';
export const RETENTION_RECENT_DAYS = 30;
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// ─── Drive Alerts ───────────────────────────────────────────────────
export const ALERT_DRIVE_RESTORE_CONFIRM = {
  title: '¿Restaurar este backup?',
  // message templated at call site con {fecha, N, M, K, J}
  confirm: 'Restaurar',
  cancel: 'Cancelar',
} as const;

export const ALERT_DRIVE_SIGN_OUT = {
  title: '¿Desconectar tu cuenta?',
  message: 'Vas a cerrar sesión de Google. Podés volver a conectarla cuando quieras. Tus backups en Drive no se eliminan.',
  confirm: 'Desconectar',
  cancel: 'Cancelar',
} as const;

export const ALERT_DRIVE_OVERWRITE_TODAY = {
  title: '¿Reemplazar el backup de hoy?',
  // message templated at call site con {fechaHoy}
  confirm: 'Reemplazar',
  cancel: 'Cancelar',
} as const;

export const ALERT_DRIVE_BACKUP_SUCCESS = {
  title: 'Backup completado',
  message: 'Tu respaldo se guardó en Google Drive.',
} as const;

// D-13: variante usada cuando uploadBackup retornó { overwrote: true } (PATCH al fileId
// del día). El caller arma el mensaje final concatenando este suffix al base success.
export const ALERT_DRIVE_BACKUP_REPLACED = {
  title: 'Backup completado',
  message: 'Tu respaldo se guardó en Google Drive. Reemplazó al backup anterior del día.',
} as const;

export const ALERT_DRIVE_RESTORE_SUCCESS = {
  title: 'Restauración exitosa',
  // message templated at call site con {fecha}
} as const;

export const ALERT_DRIVE_NO_NETWORK = {
  title: 'Sin conexión',
  message: 'No hay internet. Verificá tu red e intentá de nuevo.',
  retry: true,
} as const;

export const ALERT_DRIVE_AUTH_EXPIRED = {
  title: 'Sesión expirada',
  message: 'Tu sesión de Google expiró. Volvé a conectar tu cuenta desde Ajustes.',
  retry: false,
  actionLabel: 'Ir a Ajustes',
} as const;

export const ALERT_DRIVE_QUOTA = {
  title: 'Drive sin espacio',
  message: 'Tu Google Drive está lleno. Liberá espacio en drive.google.com o usá otra cuenta.',
  retry: false,
} as const;

export const ALERT_DRIVE_PERMISSION = {
  title: 'Permisos revocados',
  message: 'Cozy Habits ya no tiene acceso a tu Drive. Reconectá tu cuenta desde Ajustes.',
  retry: false,
  actionLabel: 'Ir a Ajustes',
} as const;

export const ALERT_DRIVE_GENERIC = {
  title: 'Algo salió mal',
  message: 'No pudimos completar la operación. Intentá de nuevo en unos minutos.',
  retry: true,
} as const;
