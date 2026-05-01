/**
 * dedupeAssignmentsArray.ts — Pre-clean puro para arrays de daily_assignments.
 *
 * Aplica la heurística D-03 (CONTEXT phase 4) sobre un array en memoria,
 * antes de bulk-insertarlo a DB. Necesario porque el partial UNIQUE INDEX
 * (REQ-04-05) rechazaría duplicados pre-fix presentes en backups antiguos
 * (RESEARCH §Pitfall #3).
 *
 * Heurística D-03 (sólo aplica a rows con habit_id !== null):
 *   1. is_completed = 1 gana
 *   2. tie → row con performed_habit linked (matching habit_id+date) gana
 *   3. tie → la más antigua (proxy: primera en el array de entrada)
 *
 * Spontaneous (habit_id === null) NUNCA se deduplican — pasan tal cual.
 *
 * NOTA — JS-vs-SQL semantic asymmetry (intencional):
 *   El SQL CTE de plan 02 (SQL_DEDUPE_VIA_CTE) evalúa EXISTS por-row, así que el
 *   step 2 (has_performed) puede discriminar entre filas de un mismo grupo cuando
 *   sólo algunas tienen performed_habit linked. Esta implementación JS, en cambio,
 *   usa un Set<string> por (habit_id|date); todos los miembros de un grupo comparten
 *   la misma key, por lo cual el step 2 NO discrimina *dentro* de un grupo y siempre
 *   cae a step 3 (original-position) en empates de step 1. Ambas variantes cumplen
 *   la invariante final: una sola row por key sobrevive. La asimetría es aceptable
 *   porque el orden D-03 sigue siendo respetado y el winner es determinístico.
 */

import type { DailyAssignment, PerformedHabit } from '../types';

export function dedupeAssignmentsArray(
  rows: DailyAssignment[],
  performed: PerformedHabit[],
): DailyAssignment[] {
  const performedKeys = buildPerformedKeySet(performed);
  const groups = groupRegularByHabitDate(rows);
  const out: DailyAssignment[] = [];

  // Spontaneous passthrough preservando orden original
  for (const r of rows) {
    if (r.habit_id === null) out.push(r);
  }

  // Regulares: elegir winner por grupo según D-03
  for (const candidates of groups.values()) {
    out.push(pickWinner(candidates, performedKeys, rows));
  }

  return out;
}

function buildPerformedKeySet(performed: PerformedHabit[]): Set<string> {
  return new Set(
    performed.map((p) => `${p.habit_id}|${p.timestamp.slice(0, 10)}`),
  );
}

function groupRegularByHabitDate(
  rows: DailyAssignment[],
): Map<string, DailyAssignment[]> {
  const groups = new Map<string, DailyAssignment[]>();
  for (const r of rows) {
    if (r.habit_id === null) continue;
    const k = `${r.habit_id}|${r.date}`;
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  return groups;
}

function pickWinner(
  candidates: DailyAssignment[],
  performedKeys: Set<string>,
  originalOrder: DailyAssignment[],
): DailyAssignment {
  if (candidates.length === 1) return candidates[0];
  const sorted = [...candidates].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return b.is_completed - a.is_completed;
    const aPerf = performedKeys.has(`${a.habit_id}|${a.date}`) ? 1 : 0;
    const bPerf = performedKeys.has(`${b.habit_id}|${b.date}`) ? 1 : 0;
    if (aPerf !== bPerf) return bPerf - aPerf;
    return originalOrder.indexOf(a) - originalOrder.indexOf(b);
  });
  return sorted[0];
}
