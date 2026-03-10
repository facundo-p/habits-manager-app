/**
 * statsHelpers.ts — Helpers de cálculo de estadísticas compartidos entre services.
 */

import type { DailyStats } from '../types';

export function buildStats(earned: number, total: number): DailyStats {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { earned, total, percentage: pct };
}
