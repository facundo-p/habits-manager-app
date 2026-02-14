/**
 * ui.styles.ts — Estilos globales reutilizables (NativeWind).
 *
 * Antes de crear un estilo local en un componente,
 * verifica si ya existe aquí una clase global que puedas usar.
 *
 * Convención: cada clave es un string de clases Tailwind/NativeWind.
 */

// ─── Layout / Contenedores ──────────────────────────────────────────
export const layout = {
  /** Pantalla completa con fondo base */
  screen: 'flex-1 bg-amber-50',

  /** Contenedor centrado genérico */
  centered: 'flex-1 items-center justify-center',

  /** Contenedor con padding horizontal estándar */
  padded: 'flex-1 px-5 pt-4',

  /** Fila con separación entre elementos */
  row: 'flex-row items-center gap-3',

  /** Fila distribuida (space-between) */
  rowBetween: 'flex-row items-center justify-between',
} as const;

// ─── Tarjetas / Superficies ─────────────────────────────────────────
export const card = {
  /** Tarjeta base estilo "hoja de cuaderno" */
  base: 'bg-white/80 rounded-2xl p-4 shadow-sm border border-amber-100',

  /** Tarjeta elevada (modales, detalle) */
  elevated: 'bg-white/90 rounded-2xl p-5 shadow-md border border-amber-200',

  /** Tarjeta de hábito en la lista diaria */
  habit: 'bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-amber-100 flex-row items-center gap-3',

  /** Líneas decorativas estilo papel rayado */
  lined: 'border-b border-amber-100/60',
} as const;

// ─── Tipografía ─────────────────────────────────────────────────────
export const text = {
  /** Título principal de pantalla */
  screenTitle: 'text-2xl font-bold text-amber-900',

  /** Subtítulo / sección */
  sectionTitle: 'text-lg font-semibold text-amber-800',

  /** Texto de cuerpo estándar */
  body: 'text-base text-amber-900',

  /** Texto secundario / descripción */
  caption: 'text-sm text-amber-600',

  /** Texto tachado (hábito completado) */
  strikethrough: 'line-through text-amber-400',

  /** Label de input / campo */
  label: 'text-sm font-medium text-amber-700 mb-1',
} as const;

// ─── Botones ────────────────────────────────────────────────────────
export const button = {
  /** Botón primario cálido */
  primary: 'bg-amber-600 rounded-xl px-5 py-3 items-center',

  /** Texto del botón primario */
  primaryText: 'text-white font-semibold text-base',

  /** Botón secundario (outline) */
  secondary: 'border border-amber-600 rounded-xl px-5 py-3 items-center',

  /** Texto del botón secundario */
  secondaryText: 'text-amber-600 font-semibold text-base',

  /** Botón pequeño / ícono */
  icon: 'w-10 h-10 rounded-full items-center justify-center bg-amber-100',
} as const;

// ─── Inputs ─────────────────────────────────────────────────────────
export const input = {
  /** Campo de texto estándar */
  field: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base text-amber-900',

  /** Campo de texto multilínea (reflexión) */
  textArea: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base text-amber-900 min-h-[100px]',
} as const;

// ─── Checkbox / Toggle ──────────────────────────────────────────────
export const checkbox = {
  /** Contenedor del checkbox */
  box: 'w-6 h-6 rounded-md border-2 border-amber-400 items-center justify-center',

  /** Estado marcado */
  checked: 'w-6 h-6 rounded-md bg-amber-500 items-center justify-center',
} as const;

// ─── Mood Slider ────────────────────────────────────────────────────
export const mood = {
  /** Contenedor del slider de humor */
  container: 'bg-white/80 rounded-2xl p-4 border border-amber-100',

  /** Etiqueta del valor actual */
  valueLabel: 'text-3xl font-bold text-amber-700 text-center',

  /** Track del slider */
  track: 'h-2 bg-amber-100 rounded-full',

  /** Thumb del slider */
  thumb: 'w-6 h-6 rounded-full bg-amber-500 shadow-sm',
} as const;

// ─── Overlay / Modal ────────────────────────────────────────────────
export const overlay = {
  /** Fondo oscuro del modal */
  backdrop: 'absolute inset-0 bg-black/40',

  /** Contenido del modal */
  content: 'bg-amber-50 rounded-t-3xl p-6 shadow-lg',
} as const;

// ─── Espaciado / Utilidades ─────────────────────────────────────────
export const spacing = {
  /** Separador horizontal fino */
  divider: 'h-px bg-amber-200/50 my-3',

  /** Espacio vertical entre secciones */
  sectionGap: 'mb-6',

  /** Espacio vertical entre items de lista */
  itemGap: 'mb-3',
} as const;
