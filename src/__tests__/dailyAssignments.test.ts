/**
 * dailyAssignments.test.ts
 *
 * Tests de integración para el daily assignment service.
 * Usa una DB SQLite in-memory (better-sqlite3) completamente independiente
 * de la DB del usuario. No impacta datos reales.
 *
 * Cubre los criterios de FEATURES.md:
 * - Los hábitos del día se crean al inicio del día según hábitos activos
 * - Los días futuros no tienen hábitos asignados
 * - Agregar un hábito nuevo: se agrega al día de hoy (no a anteriores)
 * - Quitar un hábito (inactivo): se remueve de hoy, no de anteriores
 * - Modificar un hábito activo: impacta hoy, no los días anteriores
 */

import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  resetTestDatabase,
  insertTestHabit,
  insertTestAssignment,
} from './setup/testDatabase';

// Fijar "hoy" para que los tests sean deterministas
jest.mock('../services/db', () => {
  const actual = jest.requireActual('../services/db');
  return {
    ...actual,
    getTodayPrefix: jest.fn(() => TODAY),
    getNowTimestamp: jest.fn(() => `${TODAY} 10:00:00`),
    getTimestampForDate: jest.fn((date: string) => `${date} 10:00:00`),
  };
});

import {
  ensureAssignmentsForDate,
  addAssignmentForHabit,
  removeAssignmentForHabit,
  updateTodaySnapshotForHabit,
  checkAndBackfillHistory,
  nextDay,
} from '../services/assignmentService';

import { isFutureDate } from '../services/db';

const TODAY = '2026-03-11';
const YESTERDAY = '2026-03-10';
const TWO_DAYS_AGO = '2026-03-09';
const TOMORROW = '2026-03-12';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});

// ─── Helpers locales ─────────────────────────────────────────────────────────

function countAssignments(date: string, habitId?: string): number {
  if (habitId) {
    return (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE date = ? AND habit_id = ?',
    ).get(date, habitId) as { c: number }).c;
  }
  return (db.prepare(
    'SELECT COUNT(*) as c FROM daily_assignments WHERE date = ?',
  ).get(date) as { c: number }).c;
}

function countHabitAssignments(date: string): number {
  return (db.prepare(
    'SELECT COUNT(*) as c FROM daily_assignments WHERE date = ? AND habit_id IS NOT NULL',
  ).get(date) as { c: number }).c;
}

function getSnapshot(assignmentId: string): { snapshot_name: string; snapshot_points: number } {
  return db.prepare(
    'SELECT snapshot_name, snapshot_points FROM daily_assignments WHERE id = ?',
  ).get(assignmentId) as { snapshot_name: string; snapshot_points: number };
}

// ─── ensureAssignmentsForDate ─────────────────────────────────────────────────

describe('ensureAssignmentsForDate', () => {
  test('crea asignaciones para todos los hábitos activos en hoy', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar', base_points: 2 });
    insertTestHabit(db, { id: 'h2', name: 'Caminar', base_points: 3 });

    await ensureAssignmentsForDate(TODAY);

    expect(countAssignments(TODAY, 'h1')).toBe(1);
    expect(countAssignments(TODAY, 'h2')).toBe(1);
  });

  test('NO crea asignaciones para fechas futuras', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await ensureAssignmentsForDate(TOMORROW);

    expect(countAssignments(TOMORROW)).toBe(0);
  });

  test('es idempotente — doble llamada no genera duplicados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await ensureAssignmentsForDate(TODAY);
    await ensureAssignmentsForDate(TODAY);

    expect(countAssignments(TODAY, 'h1')).toBe(1);
  });

  test('solo genera para hábitos activos — ignora inactivos', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Activo', is_active: 1 });
    insertTestHabit(db, { id: 'h2', name: 'Inactivo', is_active: 0 });

    await ensureAssignmentsForDate(TODAY);

    expect(countAssignments(TODAY, 'h1')).toBe(1);
    expect(countAssignments(TODAY, 'h2')).toBe(0);
  });

  test('BUG-01: no genera nuevas assignments si la fecha solo tiene espontaneos', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    // Dia con SOLO un espontaneo — no hay habits regulares
    insertTestAssignment(db, {
      id: 'spont-only',
      habit_id: null,
      date: TODAY,
      snapshot_name: 'Solo espontaneo',
      is_spontaneous: 1,
    });

    await ensureAssignmentsForDate(TODAY);

    // BUG-01: debe contar el espontaneo como "existing" y NO generar h1
    expect(countAssignments(TODAY)).toBe(1); // solo el espontaneo
    expect(countHabitAssignments(TODAY)).toBe(0); // ningun habit regular creado
  });
});

// ─── addAssignmentForHabit ────────────────────────────────────────────────────

describe('addAssignmentForHabit', () => {
  test('agrega asignación al día de hoy al activar un hábito', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await addAssignmentForHabit('h1');

    expect(countAssignments(TODAY, 'h1')).toBe(1);
  });

  test('NO agrega asignaciones a días pasados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await addAssignmentForHabit('h1');

    expect(countAssignments(YESTERDAY, 'h1')).toBe(0);
  });

  test('NO agrega asignaciones a fechas futuras', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await addAssignmentForHabit('h1', TOMORROW);

    expect(countAssignments(TOMORROW, 'h1')).toBe(0);
  });

  test('es idempotente — múltiples llamadas no crean duplicados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await addAssignmentForHabit('h1');
    await addAssignmentForHabit('h1');
    await addAssignmentForHabit('h1');

    expect(countAssignments(TODAY, 'h1')).toBe(1);
  });

  test('no hace nada si el hábito no existe', async () => {
    await addAssignmentForHabit('inexistente');

    expect(countAssignments(TODAY)).toBe(0);
  });
});

// ─── removeAssignmentForHabit ─────────────────────────────────────────────────

describe('removeAssignmentForHabit', () => {
  test('elimina la asignación no completada de hoy al desactivar un hábito', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: TODAY, is_completed: 0 });

    await removeAssignmentForHabit('h1');

    expect(countAssignments(TODAY, 'h1')).toBe(0);
  });

  test('NO elimina asignaciones ya completadas', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: TODAY, is_completed: 1 });

    await removeAssignmentForHabit('h1');

    expect(countAssignments(TODAY, 'h1')).toBe(1);
  });

  test('NO afecta asignaciones de días pasados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a-past', habit_id: 'h1', date: YESTERDAY, is_completed: 0 });

    await removeAssignmentForHabit('h1'); // remueve de hoy por defecto

    expect(countAssignments(YESTERDAY, 'h1')).toBe(1);
  });
});

// ─── updateTodaySnapshotForHabit ──────────────────────────────────────────────

describe('updateTodaySnapshotForHabit', () => {
  test('actualiza snapshot_name y snapshot_points del día de hoy al editar el hábito', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Nombre viejo', base_points: 1 });
    insertTestAssignment(db, {
      id: 'a1',
      habit_id: 'h1',
      date: TODAY,
      snapshot_name: 'Nombre viejo',
      snapshot_points: 1,
      is_completed: 0,
    });

    // Simular edición del hábito en DB (como lo haría habitRepo.update)
    db.prepare('UPDATE habits SET name = ?, base_points = ? WHERE id = ?')
      .run('Nombre nuevo', 5, 'h1');

    await updateTodaySnapshotForHabit('h1');

    const row = getSnapshot('a1');
    expect(row.snapshot_name).toBe('Nombre nuevo');
    expect(row.snapshot_points).toBe(5);
  });

  test('NO modifica snapshots de días pasados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Nombre nuevo', base_points: 5 });
    insertTestAssignment(db, {
      id: 'a-past',
      habit_id: 'h1',
      date: YESTERDAY,
      snapshot_name: 'Nombre viejo',
      snapshot_points: 1,
      is_completed: 0,
    });

    await updateTodaySnapshotForHabit('h1');

    const row = getSnapshot('a-past');
    expect(row.snapshot_name).toBe('Nombre viejo');
  });

  test('NO modifica asignaciones ya completadas (preserva snapshot al momento de completar)', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Nombre nuevo', base_points: 5 });
    insertTestAssignment(db, {
      id: 'a1',
      habit_id: 'h1',
      date: TODAY,
      snapshot_name: 'Snapshot al completar',
      snapshot_points: 3,
      is_completed: 1,
    });

    await updateTodaySnapshotForHabit('h1');

    const row = getSnapshot('a1');
    expect(row.snapshot_name).toBe('Snapshot al completar');
    expect(row.snapshot_points).toBe(3);
  });

  test('no lanza error si el hábito no existe', async () => {
    await expect(updateTodaySnapshotForHabit('inexistente')).resolves.toBeUndefined();
  });
});

// ─── checkAndBackfillHistory ──────────────────────────────────────────────────

describe('checkAndBackfillHistory', () => {
  test('rellena días faltantes entre la última fecha registrada y hoy', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, {
      id: 'a-old',
      habit_id: 'h1',
      date: TWO_DAYS_AGO,
      is_completed: 1,
    });

    await checkAndBackfillHistory();

    expect(countHabitAssignments(YESTERDAY)).toBe(1);
    expect(countHabitAssignments(TODAY)).toBe(1);
  });

  test('NO genera asignaciones para fechas futuras', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, {
      id: 'a-today',
      habit_id: 'h1',
      date: TODAY,
      is_completed: 0,
    });

    await checkAndBackfillHistory();

    expect(countAssignments(TOMORROW)).toBe(0);
  });

  test('en la primera ejecución (sin historial) solo genera para hoy', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await checkAndBackfillHistory();

    expect(countHabitAssignments(TODAY)).toBe(1);
    expect(countHabitAssignments(YESTERDAY)).toBe(0);
  });
});

// ─── Prevención de duplicados (índice UNIQUE) ─────────────────────────────────

describe('Prevención de duplicados', () => {
  test('el índice UNIQUE impide duplicados a nivel DB para el mismo hábito+fecha', () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    insertTestAssignment(db, { id: 'a1', habit_id: 'h1', date: TODAY });

    expect(() => {
      insertTestAssignment(db, { id: 'a2', habit_id: 'h1', date: TODAY });
    }).toThrow(/UNIQUE constraint failed/);
  });

  test('el índice UNIQUE permite múltiples entradas espontáneas el mismo día (habit_id IS NULL)', () => {
    insertTestAssignment(db, {
      id: 's1', habit_id: null, date: TODAY, snapshot_name: 'Logro 1', is_spontaneous: 1,
    });
    insertTestAssignment(db, {
      id: 's2', habit_id: null, date: TODAY, snapshot_name: 'Logro 2', is_spontaneous: 1,
    });

    expect(countAssignments(TODAY)).toBe(2);
  });

  test('múltiples llamadas a addAssignmentForHabit no crean duplicados', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });

    await addAssignmentForHabit('h1', TODAY);
    await addAssignmentForHabit('h1', TODAY);

    expect(countAssignments(TODAY, 'h1')).toBe(1);
  });
});

// ─── isFutureDate (BUG-02) ────────────────────────────────────────────────────

describe('isFutureDate (BUG-02)', () => {
  test('returns true for dates after today', () => {
    expect(isFutureDate(TOMORROW)).toBe(true);
  });

  test('returns false for today', () => {
    expect(isFutureDate(TODAY)).toBe(false);
  });

  test('returns false for dates before today', () => {
    expect(isFutureDate(YESTERDAY)).toBe(false);
  });
});

// ─── BUG-03: UTC-safe date iteration ─────────────────────────────────────────

describe('BUG-03: UTC-safe date iteration', () => {
  test('nextDay("2026-03-10") returns "2026-03-11" (no drift)', () => {
    expect(nextDay('2026-03-10')).toBe('2026-03-11');
  });

  test('nextDay works across month boundary', () => {
    expect(nextDay('2026-03-31')).toBe('2026-04-01');
  });

  test('nextDay works across year boundary', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
