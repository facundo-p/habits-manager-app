/**
 * ReflectionModal.styles.ts — Estilos del modal de reflexión y humor.
 */

import { text, input, button, overlay, spacing, colors } from '../../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  backdrop: overlay.backdrop,
  sheet: overlay.content,

  /** Título "Reflexión" */
  title: text.screenTitle,
  habitName: text.sectionTitle,
  sectionGap: spacing.sectionGap,

  /** Label compartido (Notas, ...) */
  label: text.label,

  /** Fila del campo de texto + botón mic */
  textRow: 'flex-row items-start gap-2',
  /** TextInput con flex-1 para compartir espacio con mic */
  textAreaFlex: input.textArea + ' flex-1',
  /** Botón del micrófono */
  micButton: button.iconSmall + ' mt-3',

  /** TextInput (modo sin mic, fallback) */
  textArea: input.textArea,

  /** Botones de acción */
  saveButton: button.primary,
  saveButtonText: button.primaryText,
  skipButton: 'items-center py-3',
  skipText: text.caption,
  itemGap: spacing.itemGap,
} as const;

export { colors };
