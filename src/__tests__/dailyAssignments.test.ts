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
jest.mock('../utils/date', () => {
  const actual = jest.requireActual('../utils/date');
  const mockGetLocalDayKey = jest.fn(() => TODAY);
  return {
    ...actual,
    getLocalDayKey: mockGetLocalDayKey,
    getNowTimestamp: jest.fn(() => `${TODAY} 10:00:00`),
    getTimestampForDate: jest.fn((date: string) => `${date} 10:00:00`),
    isFutureDate: (datePrefix: string) => datePrefix > mockGetLocalDayKey(),
  };
});

import {
  ensureAssignmentsForDate,
  addAssignmentForHabit,
  removeAssignmentForHabit,
  updateTodaySnapshotForHabit,
  checkAndBackfillHistory,
  addSpontaneous,
  getItemsForDate,
  completeAssignment,
  uncompleteAssignment,
} from '../services/assignmentService';

import { isFutureDate, nextDay } from '../utils/date';

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

// ─── addSpontaneous — BUG-04: category validation ────────────────────────────

describe('addSpontaneous — BUG-04: category validation', () => {
  test('BUG-04: throws descriptive error when categories contain invalid ID', async () => {
    await expect(addSpontaneous('Test', ['invalid_area_id']))
      .rejects.toThrow(/invalid_area_id/);
  });

  test('BUG-04: throws error listing ALL invalid IDs', async () => {
    await expect(addSpontaneous('Test', ['salud_fisica', 'fake_id']))
      .rejects.toThrow(/fake_id/);
  });

  test('BUG-04: succeeds with all valid categories', async () => {
    await expect(addSpontaneous('Logro', ['salud_fisica', 'mental']))
      .resolves.toBeUndefined();

    expect(countAssignments(TODAY)).toBe(1);
  });

  test('BUG-04: succeeds with empty categories array', async () => {
    await expect(addSpontaneous('Logro', []))
      .resolves.toBeUndefined();
  });
});

// ─── Visibility weekly/monthly (REQ-04-10/11, D-01 Opción B) ─────────────────

describe('Visibility weekly/monthly — REQ-04-10/11', () => {
  // Para 2026-03-11 (miércoles): semana ISO corre 2026-03-09 (lun) a 2026-03-15 (dom).
  // Mes 2026-03 corre 2026-03-01 a 2026-03-31.
  const MONDAY = '2026-03-09';
  const SUNDAY = '2026-03-15';

  function seedWeeklyRows(habitId: string, baseDate: string, days = 7): void {
    for (let i = 0; i < days; i++) {
      const d = new Date(`${baseDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      insertTestAssignment(db, {
        id: `${habitId}-${date}`,
        habit_id: habitId,
        date,
        snapshot_name: 'Yoga',
        snapshot_points: 5,
        snapshot_frequency: 'weekly',
      });
    }
  }

  test('REQ-04-10: weekly habit visible toda la semana — completar miércoles propaga a la semana', async () => {
    insertTestHabit(db, { id: 'wh', name: 'Yoga', frequency: 'weekly', base_points: 5 });
    seedWeeklyRows('wh', MONDAY);

    // Estado inicial: ningún día visto como completado en período
    const itemsMon = await getItemsForDate(MONDAY);
    expect(itemsMon.find((i) => i.habitId === 'wh')?.isCompletedForPeriod).toBe(false);

    // Completar el miércoles (TODAY)
    const itemsWed = await getItemsForDate(TODAY);
    const wedItem = itemsWed.find((i) => i.habitId === 'wh')!;
    await completeAssignment(wedItem, TODAY);

    // Volver a leer cada día — todos deben mostrar isCompletedForPeriod=true
    const itemsMonAfter = await getItemsForDate(MONDAY);
    const itemsSunAfter = await getItemsForDate(SUNDAY);
    expect(itemsMonAfter.find((i) => i.habitId === 'wh')?.isCompletedForPeriod).toBe(true);
    expect(itemsSunAfter.find((i) => i.habitId === 'wh')?.isCompletedForPeriod).toBe(true);

    // is_completed (por-row) debe ser 1 para TODAS las rows (propagación física)
    const completedRows = (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ? AND is_completed = 1',
    ).get('wh') as { c: number }).c;
    expect(completedRows).toBe(7);
  });

  test('REQ-04-10: uncomplete revierte la propagación', async () => {
    insertTestHabit(db, { id: 'wh', name: 'Yoga', frequency: 'weekly' });
    // Sembrar 7 rows ya completadas
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${MONDAY}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      insertTestAssignment(db, {
        id: `wh-${date}`, habit_id: 'wh', date,
        snapshot_frequency: 'weekly', is_completed: 1,
      });
    }

    const items = await getItemsForDate(TODAY);
    const item = items.find((i) => i.habitId === 'wh')!;
    await uncompleteAssignment(item, TODAY);

    const stillCompleted = (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ? AND is_completed = 1',
    ).get('wh') as { c: number }).c;
    expect(stillCompleted).toBe(0);
  });

  test('REQ-04-11: monthly habit visible todo el mes — completar día 11 propaga al mes', async () => {
    insertTestHabit(db, { id: 'mh', name: 'Reflexión mensual', frequency: 'monthly' });
    // Sembrar rows del 1 al 31 de marzo
    for (let day = 1; day <= 31; day++) {
      const date = `2026-03-${String(day).padStart(2, '0')}`;
      insertTestAssignment(db, {
        id: `mh-${date}`, habit_id: 'mh', date,
        snapshot_frequency: 'monthly',
      });
    }

    const items = await getItemsForDate(TODAY);
    const item = items.find((i) => i.habitId === 'mh')!;
    await completeAssignment(item, TODAY);

    const itemsDay1 = await getItemsForDate('2026-03-01');
    const itemsDay31 = await getItemsForDate('2026-03-31');
    expect(itemsDay1.find((i) => i.habitId === 'mh')?.isCompletedForPeriod).toBe(true);
    expect(itemsDay31.find((i) => i.habitId === 'mh')?.isCompletedForPeriod).toBe(true);

    const completedRows = (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ? AND is_completed = 1',
    ).get('mh') as { c: number }).c;
    expect(completedRows).toBe(31);
  });

  test('REQ-04-10: daily habit NO se propaga (sólo afecta su día)', async () => {
    insertTestHabit(db, { id: 'dh', name: 'Meditar', frequency: 'daily' });
    insertTestAssignment(db, {
      id: 'dh-today', habit_id: 'dh', date: TODAY, snapshot_frequency: 'daily',
    });
    insertTestAssignment(db, {
      id: 'dh-yest', habit_id: 'dh', date: YESTERDAY, snapshot_frequency: 'daily',
    });

    const items = await getItemsForDate(TODAY);
    const item = items.find((i) => i.habitId === 'dh')!;
    await completeAssignment(item, TODAY);

    // Sólo la row de today queda completada
    const completedRows = (db.prepare(
      'SELECT COUNT(*) as c FROM daily_assignments WHERE habit_id = ? AND is_completed = 1',
    ).get('dh') as { c: number }).c;
    expect(completedRows).toBe(1);

    // isCompletedForPeriod del día = isCompleted (mismo período)
    const itemsToday = await getItemsForDate(TODAY);
    const todayItem = itemsToday.find((i) => i.habitId === 'dh')!;
    expect(todayItem.isCompletedForPeriod).toBe(true);
    expect(todayItem.isCompleted).toBe(true);

    const itemsYest = await getItemsForDate(YESTERDAY);
    const yest = itemsYest.find((i) => i.habitId === 'dh')!;
    expect(yest.isCompletedForPeriod).toBe(false);
  });
});

// ─── Dev invariant (REQ-04-01) ───────────────────────────────────────────────

describe('ensureAssignmentsForDate — REQ-04-01 dev invariant', () => {
  test('REQ-04-01: en operación normal, NO emite warn (no hay duplicados)', async () => {
    insertTestHabit(db, { id: 'h1', name: 'Meditar' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await ensureAssignmentsForDate(TODAY);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[ensureAssignmentsForDate] duplicates detected'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });
});
