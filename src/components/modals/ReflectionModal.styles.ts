/**
 * ReflectionModal.styles.ts — Estilos del modal de reflexión y humor.
 */

import { StyleSheet } from 'react-native';
import { text, card, input, button, overlay, mood, spacing, colors } from '../../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  /** Backdrop oscuro */
  backdrop: overlay.backdrop,

  /** Contenedor del sheet desde abajo */
  sheet: overlay.content,

  /** Título "Reflexión" */
  title: text.screenTitle,

  /** Nombre del hábito */
  habitName: text.sectionTitle,

  /** Gap entre secciones */
  sectionGap: spacing.sectionGap,

  /** Label "¿Cómo te sientes?" */
  label: text.label,

  /** Valor del mood (grande, serif) */
  moodValue: mood.valueLabel,

  /** Contenedor del slider */
  sliderWrapper: 'mt-2 mb-1',

  /** TextInput de reflexión */
  textArea: input.textArea,

  /** Botón principal "Guardar" */
  saveButton: button.primary,

  /** Texto del botón "Guardar" */
  saveButtonText: button.primaryText,

  /** Botón "Omitir" */
  skipButton: 'items-center py-3',

  /** Texto del botón "Omitir" */
  skipText: text.caption,

  /** Separador inferior */
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
