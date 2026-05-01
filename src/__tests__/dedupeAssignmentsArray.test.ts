import { dedupeAssignmentsArray } from '../utils/dedupeAssignmentsArray';
import type { DailyAssignment, PerformedHabit } from '../types';

function row(over: Partial<DailyAssignment>): DailyAssignment {
  return {
    id: 'a-' + Math.random().toString(36).slice(2),
    habit_id: 'h1',
    date: '2026-03-15',
    snapshot_name: 'Test',
    snapshot_points: 1,
    snapshot_categories: '[]',
    snapshot_frequency: 'daily',
    is_completed: 0,
    is_spontaneous: 0,
    ...over,
  };
}

function performed(over: Partial<PerformedHabit>): PerformedHabit {
  return {
    id: 'p-' + Math.random().toString(36).slice(2),
    habit_id: 'h1',
    timestamp: '2026-03-15 10:00:00',
    points_earned: 1,
    habit_description: null,
    categories_used: null,
    ...over,
  };
}

describe('dedupeAssignmentsArray — REQ-04-03', () => {
  test('REQ-04-03: array vacío → array vacío', () => {
    expect(dedupeAssignmentsArray([], [])).toEqual([]);
  });

  test('REQ-04-03: una sola row regular → passthrough', () => {
    const r = row({ id: 'a1' });
    expect(dedupeAssignmentsArray([r], [])).toEqual([r]);
  });

  test('REQ-04-03: spontaneous (habit_id null) NUNCA se deduplica', () => {
    const s1 = row({ id: 's1', habit_id: null, is_spontaneous: 1, snapshot_name: 'Logro 1' });
    const s2 = row({ id: 's2', habit_id: null, is_spontaneous: 1, snapshot_name: 'Logro 2' });
    const s3 = row({ id: 's3', habit_id: null, is_spontaneous: 1, snapshot_name: 'Logro 3' });
    const out = dedupeAssignmentsArray([s1, s2, s3], []);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  test('REQ-04-03 D-03 step 1: completed wins', () => {
    const a = row({ id: 'a1', is_completed: 0 });
    const b = row({ id: 'a2', is_completed: 1 });
    const out = dedupeAssignmentsArray([a, b], []);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a2');
  });

  test('REQ-04-03 D-03 step 2 documentado: per-group performed_keys empata → cae a step 3', () => {
    // Documenta la asimetría semántica JS-vs-SQL del helper:
    // - El SQL CTE en plan 02 usa EXISTS por-row → puede discriminar step 2 entre filas.
    // - Este JS array dedupe colapsa a un Set<string> por key; todos los miembros de un
    //   grupo (mismo habit_id+date) comparten la misma key, así que step 2 NO discrimina
    //   *dentro* de un grupo — siempre cae a step 3 (original-position) en empates.
    // Ambas implementaciones llegan al mismo final consistency para el use case del backup
    // pre-clean (sólo una row por key sobrevive); la asimetría debe estar documentada en
    // el JSDoc de dedupeAssignmentsArray.ts.
    const a = row({ id: 'a1', is_completed: 0 });
    const b = row({ id: 'a2', is_completed: 0 });
    const p = performed({ habit_id: 'h1', timestamp: '2026-03-15 10:00:00' });
    const out = dedupeAssignmentsArray([a, b], [p]);
    expect(out).toHaveLength(1);
    // Empate en step 2 → step 3 elige el primero del array (original-position)
    expect(out[0].id).toBe('a1');
  });

  test('REQ-04-03 D-03 step 3: original-position wins on full tie', () => {
    const a = row({ id: 'first', is_completed: 0 });
    const b = row({ id: 'second', is_completed: 0 });
    const out = dedupeAssignmentsArray([a, b], []);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('first');
  });

  test('REQ-04-03 mixed: 1 spontaneous + 2 duplicados regulares → 1 spontaneous + 1 regular winner', () => {
    const s = row({ id: 's', habit_id: null, is_spontaneous: 1 });
    const a = row({ id: 'a1', is_completed: 0 });
    const b = row({ id: 'a2', is_completed: 1 });
    const out = dedupeAssignmentsArray([s, a, b], []);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.habit_id === null)?.id).toBe('s');
    expect(out.find((r) => r.habit_id === 'h1')?.id).toBe('a2');
  });

  test('REQ-04-03 multi-grupo: deduplica grupos independientes', () => {
    const g1a = row({ id: 'g1a', habit_id: 'h1', date: '2026-03-15', is_completed: 0 });
    const g1b = row({ id: 'g1b', habit_id: 'h1', date: '2026-03-15', is_completed: 1 });
    const g2a = row({ id: 'g2a', habit_id: 'h2', date: '2026-03-15', is_completed: 0 });
    const g2b = row({ id: 'g2b', habit_id: 'h2', date: '2026-03-15', is_completed: 0 });
    const out = dedupeAssignmentsArray([g1a, g1b, g2a, g2b], []);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.habit_id === 'h1')?.id).toBe('g1b'); // completed wins
    expect(out.find((r) => r.habit_id === 'h2')?.id).toBe('g2a'); // first in array wins
  });
});
