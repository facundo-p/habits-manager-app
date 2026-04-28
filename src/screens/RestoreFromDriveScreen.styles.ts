/**
 * RestoreFromDriveScreen.styles.ts — Estilos de la pantalla de restore.
 *
 * Tokens reutilizados de ui.styles.ts. Estados: loading + empty operativos en
 * el scaffold (plan 03-02); error + loaded los expande plan 03-03.
 */
import { text, layout, button, spacing, colors } from '../styles/ui.styles';

export const styles = {
  container: layout.transparentPadded,
  sectionTitle: text.sectionTitle,
  sectionGap: spacing.sectionGap,

  // ─── Item row (poblado en plan 03-03) ────────────────────────────
  itemRow: 'flex-row items-center gap-3 py-3 px-4',
  itemPrimary: text.body,
  itemCaption: text.caption,
  separator: 'border-b border-amber-100/60',

  // ─── Estados (loading + empty cubiertos en este scaffold) ───────
  loading: layout.centered,
  loadingCaption: text.caption + ' mt-2',
  emptyContainer: 'flex-1 items-center justify-center px-5 pt-12',
  emptyHeading: text.sectionTitle + ' text-center mt-4',
  emptyBody: text.caption + ' text-center mt-2',
  errorContainer: 'flex-1 items-center justify-center px-5 pt-12',
  errorHeading: text.sectionTitle + ' text-center mt-4',
  errorBody: text.caption + ' text-center mt-2',
  errorRetryButton: button.primary + ' w-40 mt-4',
  errorRetryButtonText: button.primaryText,
} as const;

export { colors };
