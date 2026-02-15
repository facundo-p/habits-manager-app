/**
 * AppBackground.styles.ts — Estilos del fondo global "Cozy".
 *
 * Usa StyleSheet porque ImageBackground y BlurView reciben
 * la prop `style` (ViewStyle), no className de NativeWind.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../styles/ui.styles';

export const styles = {
  /** SafeAreaView interior: ocupa todo el espacio disponible */
  safeArea: 'flex-1',
} as const;

/** Estilos nativos para componentes que requieren ViewStyle */
export const nativeStyles = StyleSheet.create({
  image: {
    flex: 1,
    backgroundColor: colors.amber50, // fallback si la imagen de red falla
  },
  blur: {
    flex: 1, // NO usar absoluteFillObject — los hijos necesitan flujo normal
  },
});
