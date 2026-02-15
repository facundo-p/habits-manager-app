/**
 * HabitLibraryScreen.styles.ts — Estilos de la pantalla "Biblioteca".
 */

import { StyleSheet } from 'react-native';
import { text, layout, button, spacing, colors } from '../styles/ui.styles';

export const styles = {
  container: layout.transparentPadded,
  title: text.titleLarge,
  titleGap: spacing.sectionGap,

  // ─── Título de sección ────────────────────────────────────────────
  sectionTitle: text.sectionTitle,
  sectionGap: spacing.sectionGap,

  // ─── Fila de hábito ───────────────────────────────────────────────
  habitRow: 'flex-row items-center justify-between py-3',
  habitInfo: 'flex-1 mr-3',
  habitName: text.body,
  habitMeta: text.caption,
  habitCount: text.captionSmall,

  /** Nombre de hábito inactivo (opaco) */
  habitNameInactive: text.body + ' opacity-40',
  habitMetaInactive: text.caption + ' opacity-40',
  habitCountInactive: text.captionSmall + ' opacity-40',

  // ─── Acciones derecha ─────────────────────────────────────────────
  actionsRow: 'flex-row items-center gap-1',
  eyeButton: button.iconSmall,
  deleteButton: button.destructive,

  // ─── Separadores y estados ────────────────────────────────────────
  separator: 'border-b border-amber-100/60',
  emptyText: text.caption,
  loading: layout.centered,
  fab: button.fab,
} as const;

// ─── Native styles (para opacity en sección archivados) ────────────

export const nativeStyles = StyleSheet.create({
  archivedWrapper: {
    opacity: 0.5,
  },
});

export { colors };
