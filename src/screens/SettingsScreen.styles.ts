/**
 * SettingsScreen.styles.ts — Estilos de la pantalla de Ajustes.
 *
 * Usa constantes globales de ui.styles.ts y estilos nativos donde
 * se necesita dinámica (opacidad, colores condicionales).
 */

import { StyleSheet } from 'react-native';
import { text, button, spacing, colors } from '../styles/ui.styles';

// ─── NativeWind classes ─────────────────────────────────────────────

export const styles = {
  container: 'flex-1 bg-transparent px-5 pt-4',
  title: text.titleLarge,
  subtitle: text.caption + ' mb-6',
  sectionTitle: text.sectionTitle + ' mb-3 mt-2',
  sectionGap: spacing.sectionGap,

  /** Fila de toggle (label + switch) */
  toggleRow: 'flex-row items-center justify-between py-3',
  toggleLabel: text.body,
  toggleCaption: 'text-xs font-sans text-amber-500 mt-0.5',

  /** Placeholder de funcionalidad futura */
  placeholderRow: 'flex-row items-center justify-between py-3 opacity-40',
  placeholderBadge: 'text-[10px] font-sans text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full',

  /** Botones de acción */
  exportButton: button.primary + ' flex-row gap-2 mt-2',
  exportButtonText: button.primaryText,
  importButton: button.secondary + ' flex-row gap-2 mt-3',
  importButtonText: button.secondaryText,
  destructiveNote: 'text-xs font-sans text-rose-400 mt-2 text-center',

  /** Separadores */
  divider: spacing.divider,

  /** Header con botón atrás */
  headerRow: 'flex-row items-center gap-3 mb-2',
  backButton: button.iconSmall + ' bg-amber-100',

  /** Versión */
  versionText: 'text-xs font-sans text-amber-400 text-center mt-8 mb-4',
} as const;

// ─── Native styles ──────────────────────────────────────────────────

export { colors };

export const nativeStyles = StyleSheet.create({
  switchTrack: {
    // Usado para thumbColor / trackColor en Switch
  },
});

export const switchColors = {
  trackTrue: colors.amber400,
  trackFalse: colors.amber100,
  thumbTrue: colors.white,
  thumbFalse: colors.amber200,
} as const;
