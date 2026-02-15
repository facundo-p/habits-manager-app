/**
 * HabitLibraryScreen.styles.ts — Estilos de la pantalla "Biblioteca".
 */

import { text, layout, card, button, spacing, colors } from '../styles/ui.styles';

export const styles = {
  /** Contenedor principal */
  container: layout.transparentPadded,

  /** Título de la pantalla */
  title: text.titleLarge,

  /** Espacio debajo del título */
  titleGap: spacing.sectionGap,

  /** Contenedor estilo cuaderno */
  paper: card.notebookPaper,

  // ─── Fila de hábito en la biblioteca ──────────────────────────
  habitRow: 'flex-row items-center justify-between py-3',
  habitInfo: 'flex-1 mr-3',
  habitName: text.body,
  habitMeta: text.caption,
  habitCount: text.captionSmall,

  /** Nombre de hábito inactivo (opaco) */
  habitNameInactive: text.body + ' opacity-40',

  // ─── Acciones derecha ─────────────────────────────────────────
  actionsRow: 'flex-row items-center gap-1',

  /** Botón de toggle visibilidad (ojo) */
  eyeButton: button.iconSmall,

  /** Botón de borrar (icono) */
  deleteButton: button.destructive,

  /** Separador entre filas */
  separator: card.lined,

  /** Texto cuando la lista está vacía */
  emptyText: text.caption,

  /** Contenedor del loading */
  loading: layout.centered,

  /** FAB para agregar hábito */
  fab: button.fab,
} as const;

export { colors };
