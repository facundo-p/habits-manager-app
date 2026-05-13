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

/**
 * MOOD_LABELS — Identificadores enum-style de los 5 buckets de la escala.
 *
 * ⚠️ NO son strings de UI. NUNCA renderizar estos valores directamente.
 * Son claves internas que Phase 2 surfaces (morning / evening / note / weekly
 * review) usarán como índice de mapas para: copy localizado, color tokens,
 * iconos/emojis por bucket. Ejemplo de uso futuro:
 *
 *   const MOOD_COPY: Record<MoodLabel, string> = {
 *     VERY_BAD: '😞 Muy mal', BAD: '🙁 Mal', NEUTRAL: '😐 Neutral',
 *     GOOD: '🙂 Bien',       VERY_GOOD: '😄 Muy bien',
 *   };
 *
 * El convention SCREAMING_SNAKE_CASE deja explícito que son discriminantes,
 * no display strings (TS enum-member convention).
 */
export const MOOD_LABELS = ['VERY_BAD', 'BAD', 'NEUTRAL', 'GOOD', 'VERY_GOOD'] as const;
export type MoodLabel = (typeof MOOD_LABELS)[number];

const BUCKET_SIZE = (MOOD_MAX - MOOD_MIN) / MOOD_LABELS.length;

/**
 * Mapea un valor numérico de mood [MOOD_MIN, MOOD_MAX] a su bucket discreto.
 * Buckets equipartitos. Valores fuera de rango se clampean. Pure function.
 *
 * El retorno es una clave (MoodLabel), NO un string visible — los consumers
 * la usan para resolver copy/color/icon vía map lookup.
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
