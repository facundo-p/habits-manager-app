/**
 * HabitFormModal.styles.ts — Estilos del modal de creación/edición de hábitos.
 */

import { text, input, button, spacing, chip, stepper } from '../../styles/ui.styles';

export const styles = {
  /** Título del modal */
  title: text.screenTitle,

  /** Gap entre secciones */
  sectionGap: spacing.sectionGap,

  /** Label de campo */
  label: text.label,

  /** Campo de texto (nombre) */
  nameInput: input.field,

  // ─── Stepper de puntos ──────────────────────────────────────────
  stepperContainer: stepper.container,
  stepperButton: stepper.button,
  stepperButtonText: stepper.buttonText,
  stepperValue: stepper.value,

  // ─── Chips de frecuencia y categorías ─────────────────────────
  chipRow: chip.row,
  chipBase: chip.base,
  chipSelected: chip.selected,
  chipText: chip.text,
  chipTextSelected: chip.textSelected,

  /** Fila de chip con botón info al lado */
  chipWithInfo: 'flex-row items-center mr-2 mb-2',
  /** Botón (i) al lado del chip */
  infoButton: 'w-5 h-5 rounded-full items-center justify-center ml-0.5',
  infoButtonText: 'text-[10px] font-bold text-amber-500',

  // ─── Botones de acción ─────────────────────────────────────────
  saveButton: button.primary,
  saveButtonText: button.primaryText,
  cancelButton: 'items-center py-3',
  cancelText: text.caption,
} as const;
