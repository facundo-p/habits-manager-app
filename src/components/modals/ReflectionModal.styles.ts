/**
 * ReflectionModal.styles.ts — Estilos del modal de reflexión y humor.
 */

import { StyleSheet } from 'react-native';
import { text, input, button, overlay, mood, spacing, colors } from '../../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  backdrop: overlay.backdrop,
  sheet: overlay.content,

  /** Título "Reflexión" */
  title: text.screenTitle,
  habitName: text.sectionTitle,
  sectionGap: spacing.sectionGap,

  /** Label */
  label: text.label,
  moodValue: mood.valueLabel,
  sliderWrapper: 'mt-2 mb-1',

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

// ─── Slider colors (props, no NativeWind) ───────────────────────────

export const sliderColors = {
  minimumTrack: colors.amber600,
  maximumTrack: colors.amber100,
  thumb: colors.amber500,
} as const;

// ─── Native styles (para Slider que necesita ViewStyle) ─────────────

export const nativeStyles = StyleSheet.create({
  slider: {
    width: '100%',
    height: 40,
  },
});

export { colors };
