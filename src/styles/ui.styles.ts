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
  gray400: '#9ca3af',
  gray500: '#6b7280',
} as const;

// ─── Layout / Contenedores ──────────────────────────────────────────
export const layout = {
  screen: 'flex-1 bg-amber-50',
  transparentScreen: 'flex-1 bg-transparent',
  centered: 'flex-1 items-center justify-center',
  padded: 'flex-1 px-5 pt-4',
  transparentPadded: 'flex-1 bg-transparent px-5 pt-4',
  row: 'flex-row items-center gap-3',
  rowBetween: 'flex-row items-center justify-between',
} as const;

// ─── Tarjetas / Superficies ─────────────────────────────────────────
export const card = {
  base: 'bg-white/80 rounded-2xl p-4 shadow-sm border border-amber-100',
  elevated: 'bg-white/90 rounded-2xl p-5 shadow-md border border-amber-200',
  habit: 'bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-amber-100 flex-row items-center gap-3',
  lined: 'border-b border-amber-100/60',
  notebookPaper: 'bg-[#fefcf3]/90 rounded-2xl p-5 shadow-sm border-l-4 border-l-rose-200 border border-amber-100',
} as const;

// ─── Tipografía ─────────────────────────────────────────────────────
export const text = {
  titleLarge: 'text-3xl font-serif text-amber-900',
  screenTitle: 'text-2xl font-serif text-amber-900',
  sectionTitle: 'text-lg font-semibold font-sans text-amber-800',
  body: 'text-base font-sans text-amber-900',
  caption: 'text-sm font-sans text-amber-600',
  captionSmall: 'text-xs font-sans text-amber-500',
  strikethrough: 'line-through text-amber-400 font-sans',
  textCompleted: 'text-base font-sans line-through text-amber-400',
  label: 'text-sm font-medium font-sans text-amber-700 mb-1',
  /** Texto para modo histórico */
  editingLabel: 'text-sm font-sans text-rose-400 mb-1',
} as const;

// ─── Botones ────────────────────────────────────────────────────────
export const button = {
  primary: 'bg-amber-600 rounded-xl px-5 py-3 items-center',
  primaryText: 'text-white font-semibold font-sans text-base',
  secondary: 'border border-amber-600 rounded-xl px-5 py-3 items-center',
  secondaryText: 'text-amber-600 font-semibold font-sans text-base',
  icon: 'w-10 h-10 rounded-full items-center justify-center bg-amber-100',
  /** Botón pequeño icono (8x8) */
  iconSmall: 'w-8 h-8 rounded-full items-center justify-center',
  destructive: 'w-9 h-9 rounded-full items-center justify-center',
  fab: 'bg-amber-600 w-14 h-14 rounded-full items-center justify-center shadow-md absolute bottom-5 right-5',
} as const;

// ─── Inputs ─────────────────────────────────────────────────────────
export const input = {
  field: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base font-sans text-amber-900',
  textArea: 'bg-white/70 border border-amber-200 rounded-xl px-4 py-3 text-base font-sans text-amber-900 min-h-[100px]',
} as const;

// ─── Checkbox / Toggle ──────────────────────────────────────────────
export const checkbox = {
  box: 'w-6 h-6 rounded-md border-2 border-amber-400 items-center justify-center',
  checked: 'w-6 h-6 rounded-md bg-amber-500 items-center justify-center',
} as const;

// ─── Chips / Tags ───────────────────────────────────────────────────
export const chip = {
  base: 'px-3 py-1.5 rounded-full border border-amber-300 mr-2 mb-2',
  selected: 'px-3 py-1.5 rounded-full bg-amber-500 border border-amber-500 mr-2 mb-2',
  /** Variantes sin margen, para usar dentro de un wrapper que ya gestiona el espaciado */
  innerBase: 'px-3 py-1.5 rounded-full border border-amber-300',
  innerSelected: 'px-3 py-1.5 rounded-full bg-amber-500 border border-amber-500',
  text: 'text-sm font-sans text-amber-700',
  textSelected: 'text-sm font-sans text-white',
  row: 'flex-row flex-wrap',
} as const;

// ─── Badges (áreas de hábito) ───────────────────────────────────────
export const badge = {
  /** Contenedor del badge de área */
  container: 'px-2 py-0.5 rounded-full mr-1.5 mt-1',
  /** Texto del badge */
  text: 'text-[10px] font-semibold font-sans text-white',
  /** Fila de badges */
  row: 'flex-row flex-wrap mt-1',
} as const;

// ─── Stepper (puntos base) ──────────────────────────────────────────
export const stepper = {
  container: 'flex-row items-center gap-4',
  button: 'w-9 h-9 rounded-full bg-amber-100 items-center justify-center',
  buttonText: 'text-lg font-sans text-amber-700',
  value: 'text-xl font-serif text-amber-800 min-w-[30px] text-center',
} as const;

// ─── Mood Slider ────────────────────────────────────────────────────
export const mood = {
  container: 'bg-white/80 rounded-2xl p-4 border border-amber-100',
  valueLabel: 'text-3xl font-serif text-amber-700 text-center',
  track: 'h-2 bg-amber-100 rounded-full',
  thumb: 'w-6 h-6 rounded-full bg-amber-500 shadow-sm',
} as const;

// ─── Overlay / Modal (TopSheet — desliza desde arriba) ──────────────
export const overlay = {
  /** Backdrop oscuro, justify-start empuja el sheet hacia arriba */
  backdrop: 'flex-1 justify-start bg-black/40',
  /** Sheet con bordes redondeados inferiores */
  content: 'bg-amber-50 rounded-b-3xl p-6 shadow-lg',
} as const;

// ─── Barra de Progreso ──────────────────────────────────────────────
export const progress = {
  wrapper: 'mb-4',
  row: 'flex-row items-baseline gap-1 mb-2',
  earned: 'text-2xl font-serif text-amber-800',
  total: 'text-sm font-sans text-amber-600',
  track: 'h-2.5 bg-amber-100 rounded-full overflow-hidden',
  fill: 'h-2.5 bg-amber-500 rounded-full',
  /** Mini barra de progreso para secciones de frecuencia */
  miniWrapper: 'mb-3',
  miniRow: 'flex-row items-baseline gap-1 mb-1',
  miniEarned: 'text-base font-serif text-amber-800',
  miniTotal: 'text-xs font-sans text-amber-500',
  miniTrack: 'h-1.5 bg-amber-100 rounded-full overflow-hidden',
  miniFill: 'h-1.5 bg-amber-500 rounded-full',
} as const;

// ─── Sección de frecuencia ──────────────────────────────────────────
export const section = {
  /** Título de sección (Diarios, Semanales, Mensuales) */
  title: 'text-lg font-serif text-amber-800 mb-1',
  /** Contenedor de sección con notebook paper */
  container: 'mb-5',
} as const;

// ─── Espaciado / Utilidades ─────────────────────────────────────────
export const spacing = {
  divider: 'h-px bg-amber-200/50 my-3',
  sectionGap: 'mb-6',
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
  small: 16,
  medium: 18,
} as const;
