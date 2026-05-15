/**
 * DraftHarnessModal.styles.ts — Estilos del harness dev de drafts.
 *
 * Convención: NativeWind classes (matching ReflectionModal pattern).
 * Sin inline styles (CLAUDE.md). Colores parametrizados via theme.
 */

import { text, input, button, spacing } from '../../styles/ui.styles';

export const styles = {
  /** Título "Dev — Draft harness" */
  title: text.screenTitle,
  /** Hint para el tester */
  hint: text.caption,
  /** Label sobre el TextInput */
  label: text.label,
  /** TextInput multiline */
  textArea: input.textArea,
  /** Botón "Limpiar draft" (destructive) */
  clearButton: button.primary + ' bg-red-500',
  clearButtonText: button.primaryText,
  /** Botón "Cerrar" */
  closeButton: 'items-center py-3',
  closeText: text.caption,
  /** Gap entre secciones */
  sectionGap: spacing.sectionGap,
  /** Status de autosave */
  status: text.caption,
} as const;
