/**
 * DailySheetScreen.styles.ts — Estilos de la pantalla "Hoy".
 */

import { ViewStyle } from 'react-native';
import {
  text, layout, card, checkbox, spacing, progress, section, badge,
} from '../styles/ui.styles';

export const styles = {
  /** Contenedor principal transparente con padding */
  container: layout.transparentPadded,

  /** Título de la pantalla */
  title: text.titleLarge,

  /** Subtítulo con la fecha */
  dateCaption: text.caption,

  /** Label modo histórico */
  editingLabel: text.editingLabel,

  /** Separador debajo del título */
  titleGap: spacing.sectionGap,

  // ─── Progress header (global) ────────────────────────────────────
  progressWrapper: progress.wrapper,
  progressRow: progress.row,
  progressEarned: progress.earned,
  progressTotal: progress.total,
  progressTrack: progress.track,
  progressFill: progress.fill,

  // ─── Sección de frecuencia ───────────────────────────────────────
  sectionContainer: section.container,
  sectionTitle: section.title,

  // ─── Mini progress bar por sección ───────────────────────────────
  miniProgressWrapper: progress.miniWrapper,
  miniProgressRow: progress.miniRow,
  miniProgressEarned: progress.miniEarned,
  miniProgressTotal: progress.miniTotal,
  miniProgressTrack: progress.miniTrack,
  miniProgressFill: progress.miniFill,

  // ─── Habit list ─────────────────────────────────────────────────
  paper: card.notebookPaper,

  /** Fila de hábito */
  habitRow: 'flex-row items-start gap-3 py-3',

  /** Checkbox sin marcar */
  checkboxUnchecked: checkbox.box,
  /** Checkbox marcado */
  checkboxChecked: checkbox.checked,

  /** Contenedor de info del hábito (nombre + badges) */
  habitContent: 'flex-1',

  /** Texto del hábito pendiente */
  habitText: text.body,
  /** Texto del hábito completado (tachado sepia) */
  habitTextCompleted: text.textCompleted,

  // ─── Badges de área ─────────────────────────────────────────────
  badgeRow: badge.row,
  badgeText: badge.text,

  /** Línea separadora entre hábitos */
  separator: card.lined,

  /** Contenedor del loading */
  loading: layout.centered,

  /** Texto cuando no hay hábitos */
  emptyText: text.caption,
} as const;

/** Ancho dinámico de la barra de progreso global. */
export function progressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}

/** Ancho dinámico de la mini barra de progreso. */
export function miniProgressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}
