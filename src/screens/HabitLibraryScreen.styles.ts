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
  /** Fila: nombre + delete a la derecha */
  habitRow: 'flex-row items-center justify-between py-3',

  /** Columna izquierda con nombre y metadata */
  habitInfo: 'flex-1 mr-3',

  /** Nombre del hábito */
  habitName: text.body,

  /** Metadata (frecuencia · puntos · categorías) */
  habitMeta: text.caption,

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
