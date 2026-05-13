/**
 * mood.ts — Single source of truth de la escala de mood.
 *
 * - Re-exporta MOOD_MIN/MAX/STEP/DEFAULT_VALUE desde constants.ts
 *   (constants.ts sigue siendo la fuente numérica original).
 * - Define labels discretas (MOOD_LABELS) usadas por Phase 2 surfaces
 *   (morning/evening/note). Phase 1 NO las consume visualmente todavía.
 * - Expone MOOD_SCALE_VERSION para stamp persistido en mood_log.
 */

import { MOOD_MIN, MOOD_MAX } from './constants';

export {
  MOOD_MIN,
  MOOD_MAX,
  MOOD_STEP,
  MOOD_DEFAULT_VALUE,
} from './constants';

export const MOOD_LABELS = ['muyMal', 'mal', 'neutral', 'bien', 'muyBien'] as const;
export type MoodLabel = (typeof MOOD_LABELS)[number];

const BUCKET_SIZE = (MOOD_MAX - MOOD_MIN) / MOOD_LABELS.length;

/**
 * Mapea un valor numérico de mood [MOOD_MIN, MOOD_MAX] a una label discreta.
 * Buckets equipartitos. Valores fuera de rango se clampean. Pure function.
 */
export function moodLabelFor(value: number): MoodLabel {
  const clamped = Math.min(Math.max(value, MOOD_MIN), MOOD_MAX);
  const idx = Math.min(
    Math.floor((clamped - MOOD_MIN) / BUCKET_SIZE),
    MOOD_LABELS.length - 1,
  );
  return MOOD_LABELS[idx];
}

/**
 * Versión de la escala persistida en mood_log.mood_scale_version.
 * Bump SOLO si cambia shape (rango, step, semántica de los puntos).
 * NO bumpear por labels — labels son cosméticas.
 */
export const MOOD_SCALE_VERSION = 'v1' as const;
