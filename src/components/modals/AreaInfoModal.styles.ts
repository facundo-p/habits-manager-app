/**
 * AreaInfoModal.styles.ts — Estilos del modal de información de área.
 */

import { text, spacing, button, card } from '../../styles/ui.styles';

export const styles = {
  /** Fila del header: icono + título */
  header: 'flex-row items-center gap-3 mb-3',

  /** Título del área (label) */
  title: text.screenTitle,

  /** Descripción del área */
  description: text.body + ' mb-4',

  /** Título "Ejemplos" */
  examplesTitle: text.sectionTitle + ' mb-2',

  /** Card contenedora de un ejemplo */
  exampleCard: card.base + ' mb-2',

  /** Texto de un ejemplo */
  exampleText: text.body,

  /** Espacio inferior */
  bottomGap: spacing.sectionGap,

  /** Botón cerrar */
  closeButton: button.primary,

  /** Texto botón cerrar */
  closeButtonText: button.primaryText,
} as const;
