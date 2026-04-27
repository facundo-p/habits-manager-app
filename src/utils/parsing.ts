/**
 * parsing.ts — Utilidades de parseo compartidas entre services, screens y componentes.
 *
 * Único punto de parsing + validación de categorías de hábitos contra VALID_AREA_IDS.
 */

import { VALID_AREA_IDS } from '../config/constants';

/**
 * Parsea un JSON de array de categorías de forma segura.
 * - Filtra IDs inválidos contra VALID_AREA_IDS.
 * - Emite console.warn con los IDs descartados (D-14).
 * - Retorna [] ante JSON malformado, no-array, o array vacío.
 *
 * @param json String JSON crudo desde la DB (puede ser malformado en datos legacy).
 * @returns Array de IDs de área válidos en el orden original; [] si nada válido.
 */
export function parseAndValidateCategories(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const id of arr) {
      if (typeof id === 'string' && VALID_AREA_IDS.has(id)) {
        valid.push(id);
      } else {
        invalid.push(String(id));
      }
    }
    if (invalid.length > 0) {
      console.warn(
        '[parseAndValidateCategories] IDs de área inválidos descartados:',
        invalid,
      );
    }
    return valid;
  } catch {
    return [];
  }
}
