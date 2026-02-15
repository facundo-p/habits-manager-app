/**
 * StatsScreen.styles.ts — Estilos de la pantalla "Progreso".
 *
 * Incluye NativeWind classes, StyleSheet nativo para el heatmap/charts,
 * y funciones dinámicas para colores y anchos de barra.
 */

import { Dimensions, StyleSheet, ViewStyle } from 'react-native';
import { text, layout, card, spacing, colors } from '../styles/ui.styles';
import { HEATMAP_COLORS } from '../config/constants';

// ─── Dimensiones calculadas ─────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 80; // px-5 × 2 (screen) + p-5 × 2 (paper)
const CELL_GAP = 4;

export const CELL_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING) / 7) - CELL_GAP;
export const CHART_WIDTH = SCREEN_WIDTH - GRID_PADDING;
export const CHART_HEIGHT = 200;

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  /** Contenedor principal con scroll */
  container: layout.transparentPadded,

  /** Título "Progreso" */
  title: text.titleLarge,

  /** Gap debajo del título */
  titleGap: spacing.sectionGap,

  /** Tarjeta notebookPaper para cada sección */
  section: card.notebookPaper,

  /** Título de sección dentro del card */
  sectionTitle: text.sectionTitle,

  /** Separación entre secciones */
  sectionGap: spacing.sectionGap,

  /** Separación menor entre items */
  itemGap: spacing.itemGap,

  // ─── Month Navigator ────────────────────────────────────────────
  monthNav: 'flex-row items-center justify-between mb-4',
  monthLabel: 'text-lg font-serif text-amber-800',
  navButton: 'p-2',

  // ─── Heatmap Grid ───────────────────────────────────────────────
  gridContainer: 'flex-row flex-wrap justify-center',
  cellDay: 'text-xs font-sans text-center',
  weekdayLabel: 'text-xs font-sans text-amber-600 text-center',

  // ─── Day Detail ─────────────────────────────────────────────────
  detailTitle: text.body,
  detailRow: 'flex-row items-center gap-2 py-1',
  detailDone: 'text-sm font-sans text-green-700',
  detailMissed: 'text-sm font-sans text-amber-400',
  detailName: text.caption,

  // ─── Pie Chart ──────────────────────────────────────────────────
  chartCenter: 'items-center',

  // ─── Weekly Comparison ──────────────────────────────────────────
  compRow: 'mb-3',
  compLabel: text.caption,
  compBarRow: 'flex-row items-center gap-2 mt-1',
  compValue: 'text-sm font-serif text-amber-800',

  // ─── States ─────────────────────────────────────────────────────
  loading: layout.centered,
  emptyText: text.caption,
} as const;

// ─── Native styles (ViewStyle para celdas y barras) ──────────────────

export const nativeStyles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    margin: CELL_GAP / 2,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: colors.amber700,
  },
  weekdayCell: {
    width: CELL_SIZE,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    margin: CELL_GAP / 2,
  },
  compTrack: {
    height: 14,
    borderRadius: 7,
    flex: 1,
    backgroundColor: colors.amber100,
    overflow: 'hidden' as const,
  },
  compBar: {
    height: 14,
    borderRadius: 7,
    minWidth: 4,
  },
});

// ─── Chart config (react-native-chart-kit) ───────────────────────────

export const chartConfig = {
  color: (opacity = 1) => `rgba(217, 119, 6, ${opacity})`,
  labelColor: () => colors.amber800,
} as const;

// ─── Funciones dinámicas ─────────────────────────────────────────────

/** Background color de una celda del heatmap según porcentaje. */
export function heatmapCellBg(pct: number | undefined): ViewStyle {
  let bg: string;
  if (pct === undefined || pct === 0) {
    bg = HEATMAP_COLORS.empty;
  } else if (pct >= 100) {
    bg = HEATMAP_COLORS.full;
  } else if (pct >= 75) {
    bg = HEATMAP_COLORS.great;
  } else if (pct >= 50) {
    bg = HEATMAP_COLORS.good;
  } else if (pct >= 25) {
    bg = HEATMAP_COLORS.medium;
  } else {
    bg = HEATMAP_COLORS.low;
  }
  return { backgroundColor: bg };
}

/** Color de texto de la celda (blanco para fondos oscuros). */
export function heatmapTextColor(pct: number | undefined): string {
  return pct !== undefined && pct >= 100 ? colors.white : colors.amber900;
}

/** Ancho proporcional de una barra de comparación semanal. */
export function compBarWidth(value: number, max: number): ViewStyle {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return { width: `${percent}%` };
}

export { colors };
