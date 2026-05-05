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
  /** Fila de acciones del header histórico */
  headerRow: 'flex-row items-center justify-end',
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

  // ─── Botón de logro espontáneo ──────────────────────────────────
  spontaneousButton: 'flex-row items-center gap-2 py-3 px-4 mb-4 rounded-xl border border-dashed border-amber-400/70 bg-amber-50/50',
  spontaneousButtonText: 'text-sm font-sans text-amber-700 font-medium',
  spontaneousPlusIcon: 'text-lg font-bold text-amber-600',

  // ─── Sección "Logros del Día" ────────────────────────────────────
  spontaneousRow: 'flex-row items-center gap-3 py-3',
  spontaneousName: text.body,
  spontaneousDeleteBtn: 'w-7 h-7 rounded-full items-center justify-center',
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

/** Ancho dinámico de la mini barra de progreso. */
export function miniProgressFillWidth(percentage: number): ViewStyle {
  return { width: `${Math.min(percentage, 100)}%` };
}

/** ViewStyle completo del badge de área con color dinámico (evita inline style). */
export function badgeContainerStyle(color: string): ViewStyle {
  return {
    ...nativeStyles.badgeContainer,
    backgroundColor: color,
  };
}

export { colors };
