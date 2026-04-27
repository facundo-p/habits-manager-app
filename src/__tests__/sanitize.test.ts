/**
 * sanitize.test.ts
 *
 * Tests para las dos funciones de sanitización defensiva (DEBT-03).
 * Usa DB SQLite in-memory (better-sqlite3) inyectada vía el mock manual
 * de expo-sqlite.
 *
 * Cubre:
 * - sanitizeHabitDefaultCategories: limpia habits.default_categories
 * - sanitizePerformedCategoriesUsed: limpia performed_habits.categories_used
 * - Ambas: ignoran filas con la columna NULL y no modifican filas válidas.
 */

import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  resetTestDatabase,
  insertTestHabit,
} from './setup/testDatabase';

// El mock de expo-sqlite (singleton MockSQLiteDatabase) se inyecta automáticamente
// por testDatabase.ts en createTestDatabase(). Importamos las funciones después
// de declarar cualquier mock global (no hay que mockear ../services/db acá:
// las funciones reciben la db por parámetro y no usan getTodayPrefix).

import {
  sanitizeHabitDefaultCategories,
  sanitizePerformedCategoriesUsed,
} from '../services/db';
import { openDatabaseAsync } from 'expo-sqlite';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});

// ─── Helpers locales ─────────────────────────────────────────────────────────

function readHabitCats(habitId: string): string | null {
  const row = db
    .prepare('SELECT default_categories FROM habits WHERE id = ?')
    .get(habitId) as { default_categories: string | null } | undefined;
  return row?.default_categories ?? null;
}

function insertPerformed(opts: {
  id: string;
  habit_id: string;
  categories_used: string | null;
}): void {
  db.prepare(`
    INSERT INTO performed_habits
      (id, habit_id, timestamp, points_earned, habit_description, categories_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.habit_id,
    '2026-04-26 10:00:00',
    1,
    null,
    opts.categories_used,
  );
}

function readPerformedCats(performedId: string): string | null {
  const row = db
    .prepare('SELECT categories_used FROM performed_habits WHERE id = ?')
    .get(performedId) as { categories_used: string | null } | undefined;
  return row?.categories_used ?? null;
}

// La instancia mock de expo-sqlite que las dos funciones consumen.
async function getMockDb() {
  return await openDatabaseAsync('test.db');
}

// ─── sanitizeHabitDefaultCategories ──────────────────────────────────────────

describe('sanitizeHabitDefaultCategories', () => {
  test('elimina IDs inválidos en habits.default_categories', async () => {
    insertTestHabit(db, {
      id: 'h1',
      name: 'Hábito mixto',
      default_categories: '["salud_fisica","fake_id"]',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockDb = await getMockDb();
    await sanitizeHabitDefaultCategories(
      mockDb as unknown as Parameters<typeof sanitizeHabitDefaultCategories>[0],
    );

    expect(readHabitCats('h1')).toBe('["salud_fisica"]');
    warnSpy.mockRestore();
  });

  test('no modifica filas con todas las categorías válidas', async () => {
    insertTestHabit(db, {
      id: 'h2',
      name: 'Hábito limpio',
      default_categories: '["salud_fisica","mental"]',
    });

    const mockDb = await getMockDb();
    await sanitizeHabitDefaultCategories(
      mockDb as unknown as Parameters<typeof sanitizeHabitDefaultCategories>[0],
    );

    expect(readHabitCats('h2')).toBe('["salud_fisica","mental"]');
  });

  test('ignora filas con default_categories NULL', async () => {
    db.prepare(`
      INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active)
      VALUES (?, ?, ?, ?, NULL, ?)
    `).run('h3', 'Hábito sin cats', 'daily', 1, 1);

    const mockDb = await getMockDb();
    await sanitizeHabitDefaultCategories(
      mockDb as unknown as Parameters<typeof sanitizeHabitDefaultCategories>[0],
    );

    expect(readHabitCats('h3')).toBeNull();
  });
});

// ─── sanitizePerformedCategoriesUsed ─────────────────────────────────────────

describe('sanitizePerformedCategoriesUsed', () => {
  beforeEach(() => {
    // performed_habits requiere un habit padre por foreign key
    insertTestHabit(db, { id: 'parent', name: 'Parent' });
  });

  test('elimina IDs inválidos en performed_habits.categories_used', async () => {
    insertPerformed({
      id: 'p1',
      habit_id: 'parent',
      categories_used: '["mental","invalid"]',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockDb = await getMockDb();
    await sanitizePerformedCategoriesUsed(
      mockDb as unknown as Parameters<typeof sanitizePerformedCategoriesUsed>[0],
    );

    expect(readPerformedCats('p1')).toBe('["mental"]');
    warnSpy.mockRestore();
  });

  test('no modifica filas con todas las categorías válidas', async () => {
    insertPerformed({
      id: 'p2',
      habit_id: 'parent',
      categories_used: '["mental","salud_fisica"]',
    });

    const mockDb = await getMockDb();
    await sanitizePerformedCategoriesUsed(
      mockDb as unknown as Parameters<typeof sanitizePerformedCategoriesUsed>[0],
    );

    expect(readPerformedCats('p2')).toBe('["mental","salud_fisica"]');
  });

  test('ignora filas con categories_used NULL', async () => {
    insertPerformed({
      id: 'p3',
      habit_id: 'parent',
      categories_used: null,
    });

    const mockDb = await getMockDb();
    await sanitizePerformedCategoriesUsed(
      mockDb as unknown as Parameters<typeof sanitizePerformedCategoriesUsed>[0],
    );

    expect(readPerformedCats('p3')).toBeNull();
  });
});
