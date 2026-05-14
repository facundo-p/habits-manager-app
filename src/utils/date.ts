/**
 * date.ts — Único módulo de date helpers del proyecto (D-01 / FOUND-01).
 *
 * Anti-pitfall: el codebase tenía `getTodayPrefix` en db.ts y `dateToPrefix`
 * en dateHelpers.ts (este último vía `toISOString().slice(0,10)` — UTC-bias,
 * rompe en GMT-3 cerca de medianoche). Wave 1 unifica todo acá:
 *
 *   - getLocalDayKey() reemplaza getTodayPrefix (mismo impl: getters locales).
 *   - formatDateStr(d) reemplaza dateToPrefix, reescrito con getters UTC
 *     explícitos para que el grep ban sobre `new Date().toISOString().slice(0,10)`
 *     sea absoluto (research §2).
 *
 * Cualquier nuevo helper de fecha en el proyecto vive acá. No reintroducir
 * helpers locales en services.
 */

/** "Hoy" en local TZ, formato YYYY-MM-DD. Reemplaza getTodayPrefix. */
export function getLocalDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `datePrefix > getLocalDayKey()` — comparación lexicográfica sobre YYYY-MM-DD. */
export function isFutureDate(datePrefix: string): boolean {
  return datePrefix > getLocalDayKey();
}

/** "YYYY-MM-DD HH:MM:SS" actual (UTC del system clock). */
export function getNowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** "<datePrefix> HH:MM:SS" con la hora actual (UTC). */
export function getTimestampForDate(datePrefix: string): string {
  const time = new Date().toISOString().slice(11, 19);
  return `${datePrefix} ${time}`;
}

/**
 * Date → YYYY-MM-DD usando getters UTC (DST-safe).
 *
 * Reemplaza `dateToPrefix(d) = d.toISOString().slice(0, 10)`. Comportamiento
 * idéntico para cualquier Date input, pero permite que el grep ban sobre
 * `new Date().toISOString().slice(0,10)` sea absoluto en el codebase.
 */
export function formatDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Avanza un día sobre YYYY-MM-DD, UTC arithmetic (DST-safe). */
export function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateStr(d);
}
