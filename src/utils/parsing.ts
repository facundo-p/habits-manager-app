/**
 * parsing.ts — Utilidades de parseo compartidas entre services, screens y componentes.
 */

/** Parsea un JSON de array de strings de forma segura. Devuelve [] ante cualquier error. */
export function parseJsonArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
