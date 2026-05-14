/**
 * MoodPicker.styles.ts — Estilos del componente compartido <MoodPicker>.
 *
 * Extraídos verbatim de ReflectionModal.styles.ts para preservar paridad
 * visual estricta (D-03 / FOUND-06). Las keys conservan los mismos
 * nombres + valores que tenían en ReflectionModal.
 */

import { StyleSheet } from 'react-native';
import { text, mood, spacing, colors } from '../../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  /** Label "¿Cómo te sientes?" */
  label: text.label,
  /** Valor numérico (e.g. "5.5") */
  moodValue: mood.valueLabel,
  /** Wrapper del slider con margen vertical */
  sliderWrapper: 'mt-2 mb-1',
  /** Espacio inferior tras el componente */
  sectionGap: spacing.sectionGap,
} as const;

// ─── Slider colors (props, no NativeWind) ───────────────────────────

export const sliderColors = {
  minimumTrack: colors.amber600,
  maximumTrack: colors.amber100,
  thumb: colors.amber500,
} as const;

// ─── Native styles (Slider necesita ViewStyle) ──────────────────────

export const nativeStyles = StyleSheet.create({
  slider: {
    width: '100%',
    height: 40,
  },
});
