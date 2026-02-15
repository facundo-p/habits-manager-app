/**
 * ui.styles.ts — Estilos globales reutilizables (NativeWind).
 *
 * Antes de crear un estilo local en un componente,
 * verifica si ya existe aquí una clase global que puedas usar.
 *
 * Convención: cada clave es un string de clases Tailwind/NativeWind.
 */

import type { ViewStyle } from 'react-native';

// ─── Colores (para StyleSheet y React Navigation) ───────────────────
export const colors = {
  amber900: '#78350f',
  amber800: '#92400e',
  amber700: '#b45309',
  amber600: '#d97706',
  amber500: '#f59e0b',
  amber400: '#fbbf24',
  amber200: '#fde68a',
  amber100: '#fef3c7',
  amber50: '#fffbeb',
  white: '#ffffff',
  white80: 'rgba(255,255,255,0.8)',
  white90: 'rgba(255,255,255,0.9)',
  black40: 'rgba(0,0,0,0.4)',
  rose200: '#fecdd3',
  rose400: '#fb7185',
  sage200: '#bbf7d0',
  sage400: '#4ade80',
  sage700: '#15803d',
} as const;

// ─── Layout / Contenedores ──────────────────────────────────────────
export const layout = {
  /** Pantalla completa con fondo base */
  screen: 'flex-1 bg-amber-50',

  /** Pantalla transparente (deja ver el AppBackground global) */
  transparentScreen: 'flex-1 bg-transparent',

  /** Contenedor centrado genérico */
  centered: 'flex-1 items-center justify-center',

  /** Contenedor con padding horizontal estándar */
  padded: 'flex-1 px-5 pt-4',

  /** Pantalla transparente con padding */
  transparentPadded: 'flex-1 bg-transparent px-5 pt-4',

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

  /** Contenedor estilo "papel de cuaderno" con margen izquierdo rosa */
  notebookPaper: 'bg-[#fefcf3]/90 rounded-2xl p-5 shadow-sm border-l-4 border-l-rose-200 border border-amber-100',
} as const;

// ─── Tipografía ─────────────────────────────────────────────────────
export const text = {
  /** Título grande de pantalla (serif / Merriweather) */
  titleLarge: 'text-3xl font-serif text-amber-900',

  /** Título principal de pantalla */
  screenTitle: 'text-2xl font-serif text-amber-900',

  /** Subtítulo / sección */
  sectionTitle: 'text-lg font-semibold font-sans text-amber-800',

  /** Texto de cuerpo estándar */
  body: 'text-base font-sans text-amber-900',

  /** Texto secundario / descripción */
  caption: 'text-sm font-sans text-amber-600',

  /** Texto tachado genérico */
  strikethrough: 'line-through text-amber-400 font-sans',

  /** Texto de hábito completado (tamaño body + tachado sepia) */
  textCompleted: 'text-base font-sans line-through text-amber-400',

  /** Label de input / campo */
  label: 'text-sm font-medium font-sans text-amber-700 mb-1',
} as const;

// ─── Botones ────────────────────────────────────────────────────────
export const button = {
  /** Botón primario cálido */
  primary: 'bg-amber-600 rounded-xl px-5 py-3 items-center',

  /** Texto del botón primario */
  primaryText: 'text-white font-semibold font-sans text-base',

  /** Botón secundario (outline) */
  secondary: 'border border-amber-600 rounded-xl px-5 py-3 items-center',

  /** Texto del botón secundario */
  secondaryText: 'text-amber-600 font-semibold font-sans text-base',

  /** Botón pequeño / ícono */
  icon: 'w-10 h-10 rounded-full items-center justify-center bg-amber-100',

  /** Botón destructivo */
  destructive: 'w-9 h-9 rounded-full items-center justify-center',

  /** FAB (floating action button) */
  fab: 'bg-amber-600 w-14 h-14 rounded-full items-center justify-center shadow-md absolute bottom-5 right-5',
} as const;

// ─── Inputs ─────────────────────────────────────────────────────────
export const input = {
  /** Campo de texto estándar */
  field: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base font-sans text-amber-900',

  /** Campo de texto multilínea (reflexión) */
  textArea: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base font-sans text-amber-900 min-h-[100px]',
} as const;

// ─── Checkbox / Toggle ──────────────────────────────────────────────
export const checkbox = {
  /** Contenedor del checkbox */
  box: 'w-6 h-6 rounded-md border-2 border-amber-400 items-center justify-center',

  /** Estado marcado */
  checked: 'w-6 h-6 rounded-md bg-amber-500 items-center justify-center',
} as const;

// ─── Chips / Tags ───────────────────────────────────────────────────
export const chip = {
  /** Chip no seleccionado */
  base: 'px-3 py-1.5 rounded-full border border-amber-300 mr-2 mb-2',

  /** Chip seleccionado */
  selected: 'px-3 py-1.5 rounded-full bg-amber-500 border border-amber-500 mr-2 mb-2',

  /** Texto chip no seleccionado */
  text: 'text-sm font-sans text-amber-700',

  /** Texto chip seleccionado */
  textSelected: 'text-sm font-sans text-white',

  /** Contenedor de chips (flex wrap) */
  row: 'flex-row flex-wrap',
} as const;

// ─── Stepper (puntos base) ──────────────────────────────────────────
export const stepper = {
  /** Contenedor del stepper */
  container: 'flex-row items-center gap-4',

  /** Botón +/- del stepper */
  button: 'w-9 h-9 rounded-full bg-amber-100 items-center justify-center',

  /** Texto del botón +/- */
  buttonText: 'text-lg font-sans text-amber-700',

  /** Valor actual */
  value: 'text-xl font-serif text-amber-800 min-w-[30px] text-center',
} as const;

// ─── Mood Slider ────────────────────────────────────────────────────
export const mood = {
  /** Contenedor del slider de humor */
  container: 'bg-white/80 rounded-2xl p-4 border border-amber-100',

  /** Etiqueta del valor actual (serif para feedback cálido) */
  valueLabel: 'text-3xl font-serif text-amber-700 text-center',

  /** Track del slider */
  track: 'h-2 bg-amber-100 rounded-full',

  /** Thumb del slider */
  thumb: 'w-6 h-6 rounded-full bg-amber-500 shadow-sm',
} as const;

// ─── Overlay / Modal ────────────────────────────────────────────────
export const overlay = {
  /** Fondo oscuro del modal (flex-end para bottom sheet) */
  backdrop: 'flex-1 justify-end bg-black/40',

  /** Contenido del sheet desde abajo */
  content: 'bg-amber-50 rounded-t-3xl p-6 shadow-lg',
} as const;

// ─── Barra de Progreso ──────────────────────────────────────────────
export const progress = {
  /** Contenedor de la sección de puntos */
  wrapper: 'mb-4',

  /** Fila: puntos earned / total */
  row: 'flex-row items-baseline gap-1 mb-2',

  /** Número grande de puntos (serif) */
  earned: 'text-2xl font-serif text-amber-800',

  /** Texto "/ total puntos" */
  total: 'text-sm font-sans text-amber-600',

  /** Track de la barra */
  track: 'h-2.5 bg-amber-100 rounded-full overflow-hidden',

  /** Relleno de la barra */
  fill: 'h-2.5 bg-amber-500 rounded-full',
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

// ─── Tab Bar (React Navigation ViewStyle — no NativeWind) ───────────
export const tabBarTheme = {
  activeTintColor: colors.amber800,
  inactiveTintColor: colors.amber600,
  style: {
    backgroundColor: 'rgba(255,251,235,0.92)',
    borderTopColor: colors.amber100,
    borderTopWidth: 0.5,
    elevation: 0,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: -1 },
    shadowRadius: 4,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
  } satisfies ViewStyle,
} as const;

// ─── Iconos (lucide) ────────────────────────────────────────────────
export const iconDefaults = {
  size: 22,
  strokeWidth: 1.8,
} as const;
