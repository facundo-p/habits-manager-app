/**
 * DailySheetScreen.styles.ts — Estilos de la pantalla "Hoy".
 */

import { ViewStyle } from 'react-native';
import { text, layout, card, checkbox, spacing, progress } from '../styles/ui.styles';

export const styles = {
  /** Contenedor principal transparente con padding */
  container: layout.transparentPadded,

  /** Título de la pantalla */
  title: text.titleLarge,

  /** Subtítulo con la fecha */
  dateCaption: text.caption,

  /** Separador debajo del título */
  titleGap: spacing.sectionGap,

  // ─── Progress header ────────────────────────────────────────────
  /** Wrapper del progreso */
  progressWrapper: progress.wrapper,

  /** Fila de puntos earned / total */
  progressRow: progress.row,

  /** Puntos ganados (grande, serif) */
  progressEarned: progress.earned,

  /** Texto " / X puntos" */
  progressTotal: progress.total,

  /** Track de la barra */
  progressTrack: progress.track,

  /** Relleno de la barra */
  progressFill: progress.fill,

  // ─── Habit list ─────────────────────────────────────────────────
  /** Contenedor estilo cuaderno */
  paper: card.notebookPaper,

  /** Fila de hábito */
  habitRow: 'flex-row items-center gap-3 py-3',

  /** Checkbox sin marcar */
  checkboxUnchecked: checkbox.box,

  /** Checkbox marcado */
  checkboxChecked: checkbox.checked,

  /** Texto del hábito pendiente */
  habitText: text.body,

  /** Texto del hábito completado (tachado sepia) */
  habitTextCompleted: text.textCompleted,

  /** Línea separadora entre hábitos */
  separator: card.lined,

  /** Contenedor del loading */
  loading: layout.centered,

  /** Texto cuando no hay hábitos */
  emptyText: text.caption,
} as const;

/** Ancho dinámico de la barra de progreso (requiere ViewStyle). */
export function progressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}
