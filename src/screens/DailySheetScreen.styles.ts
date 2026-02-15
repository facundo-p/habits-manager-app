/**
 * DailySheetScreen.styles.ts — Estilos de la pantalla "Hoy".
 */

import { StyleSheet, ViewStyle } from 'react-native';
import {
  text, layout, checkbox, spacing, progress, section, badge, button, colors,
} from '../styles/ui.styles';

export const styles = {
  container: layout.transparentPadded,
  title: text.titleLarge,
  dateCaption: text.caption,
  editingLabel: text.editingLabel,
  titleGap: spacing.sectionGap,

  // ─── Header histórico ──────────────────────────────────────────
  /** Fila del header: título + botón volver */
  headerRow: 'flex-row items-center justify-between',
  /** Botón "Guardar y Volver" */
  goBackButton: button.secondary,
  goBackText: button.secondaryText,

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
  habitRow: 'flex-row items-start gap-3 py-3',
  checkboxUnchecked: checkbox.box,
  checkboxChecked: checkbox.checked,
  habitContent: 'flex-1',
  habitText: text.body,
  habitTextCompleted: text.textCompleted,

  // ─── Badges de área ─────────────────────────────────────────────
  badgeRow: badge.row,
  badgeText: badge.text,

  separator: 'border-b border-amber-100/60',
  loading: layout.centered,
  emptyText: text.caption,
} as const;

// ─── Native styles (para badges dinámicos y barras) ────────────────

export const nativeStyles = StyleSheet.create({
  /** Badge individual de área (color dinámico via style prop) */
  badgeContainer: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginTop: 4,
  },
});

/** Ancho dinámico de la barra de progreso global. */
export function progressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}

/** Ancho dinámico de la mini barra de progreso. */
export function miniProgressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}

export { colors };
