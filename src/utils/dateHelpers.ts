/**
 * dateHelpers.ts — Helpers de formateo y cálculo de fechas compartidos entre screens.
 */

import { MONTH_NAMES } from '../config/constants';

/** Formato de fecha para el título "Hoy": "lunes 10 de marzo". */
export function formatTodayDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** Formato de fecha para modo histórico: "10 de marzo 2025". */
export function formatHistoricDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Valida que una string tenga formato YYYY-MM-DD. */
export function isValidDateString(dateStr: string | null | undefined): dateStr is string {
  if (!dateStr) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/** Convierte un objeto Date a prefijo YYYY-MM-DD (UTC). */
export function dateToPrefix(d: Date): string {
  return d.toISOString().slice(0, 10);
}
