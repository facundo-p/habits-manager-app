import { VALID_AREA_IDS } from '../config/constants';

type AreaId = Parameters<typeof VALID_AREA_IDS.has>[0];

export function assertValidCategories(categories: string[], context: string): void {
  const invalid = categories.filter((id) => !VALID_AREA_IDS.has(id as AreaId));
  if (invalid.length > 0) {
    throw new Error(`${context}: categorias invalidas — ${invalid.join(', ')}`);
  }
}
