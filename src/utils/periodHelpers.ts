/**
 * periodHelpers.ts — Helpers puros de cómputo de período para hábitos weekly/monthly.
 *
 * Implementa el modelo D-01/D-02 (CONTEXT phase 4):
 *   - week: ISO 8601 (lunes a domingo, Thursday-anchor)
 *   - month: calendario YYYY-MM
 *
 * Toda función opera sobre strings 'YYYY-MM-DD' (datePrefix). NUNCA construye
 * Dates locales — siempre UTC explícito para evitar drift de timezone (Pitfall #2).
 */

export type Frequency = 'daily' | 'weekly' | 'monthly';

/** Devuelve la clave ISO 8601 de la semana, formato 'YYYY-Www' (zero-padded). */
export function getISOWeekKey(datePrefix: string): string {
  const d = new Date(`${datePrefix}T00:00:00Z`);
  // ISO: Thursday del mismo bloque-semana determina año+semana.
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 3);
  const isoYear = d.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const firstThuDow = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDow + 3);
  const week = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Devuelve la clave de mes calendario, formato 'YYYY-MM'. */
export function getMonthKey(datePrefix: string): string {
  return datePrefix.slice(0, 7);
}

/** Discriminador por frequency. Pasa-through 'daily'. */
export function getPeriodKey(datePrefix: string, frequency: Frequency): string {
  if (frequency === 'weekly') return getISOWeekKey(datePrefix);
  if (frequency === 'monthly') return getMonthKey(datePrefix);
  return datePrefix;
}
