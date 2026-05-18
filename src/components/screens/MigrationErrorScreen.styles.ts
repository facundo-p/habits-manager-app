/**
 * MigrationErrorScreen.styles.ts — Estilos del error screen bloqueante (D-05).
 *
 * StyleSheet nativo (no NativeWind): este screen debe poder renderizarse
 * incluso si NativeWind / fonts no están listos al fallar el boot.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../styles/ui.styles';

export { colors };

export const nativeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.amber50,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber700,
    textAlign: 'center',
    marginBottom: 12,
  },
  subhead: {
    fontSize: 15,
    color: colors.amber700,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
  },
  primaryButton: {
    backgroundColor: colors.amber600,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.amber600,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.amber600,
    fontSize: 15,
    fontWeight: '600',
  },
  errorDetail: {
    marginTop: 32,
    fontSize: 11,
    color: colors.amber700,
    opacity: 0.6,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
