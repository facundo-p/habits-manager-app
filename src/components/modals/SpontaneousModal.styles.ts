/**
 * SpontaneousModal.styles.ts — Estilos del modal de logro espontáneo.
 */

import { text, input, button, spacing, chip } from '../../styles/ui.styles';

export const styles = {
  /** Título del modal */
  title: text.screenTitle,

  /** Gap entre secciones */
  sectionGap: spacing.sectionGap,

  /** Label de campo */
  label: text.label,

  /** Campo de texto (nombre) */
  nameInput: input.field,

  /** Nota explicativa */
  note: text.captionSmall,

  // ─── Chips de categorías ─────────────────────────────────────────
  chipRow: chip.row,
  chipBase: chip.base,
  chipSelected: chip.selected,
  chipText: chip.text,
  chipTextSelected: chip.textSelected,

  // ─── Botones de acción ─────────────────────────────────────────
  saveButton: button.primary,
  saveButtonText: button.primaryText,
  cancelButton: 'items-center py-3',
  cancelText: text.caption,
} as const;
