/**
 * constants.ts — Constantes globales de la aplicación.
 *
 * Prohibido usar strings o números mágicos en el código.
 * Toda constante compartida debe vivir aquí.
 */

// ─── Mood ───────────────────────────────────────────────────────────
export const MOOD_MIN = 1;
export const MOOD_MAX = 10;
export const MOOD_STEP = 0.5;

// ─── Frecuencias de hábitos ─────────────────────────────────────────
export const HABIT_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
