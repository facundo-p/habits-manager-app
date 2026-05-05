/**
 * BottomSheet.styles.ts — Estilos del componente shell de modal (TopSheet).
 *
 * Ahora desliza desde arriba con bordes redondeados inferiores.
 */

import { StyleSheet } from 'react-native';
import { overlay } from '../../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  /** Backdrop oscuro con justify-start (sheet arriba) */
  backdrop: overlay.backdrop,

  /** Sheet con bordes redondeados inferiores */
  sheet: overlay.content,
} as const;

// ─── Native styles (para Animated.View) ─────────────────────────────

export const nativeStyles = StyleSheet.create({
  /** Valor inicial de translateY para ocultar el sheet fuera de pantalla */
  sheetAnimated: {
    alignSelf: 'stretch',
  },
});
