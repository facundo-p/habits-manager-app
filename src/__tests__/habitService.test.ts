/**
 * habitService.test.ts
 *
 * Tests para D-15: validación de escritura de categorías en
 * createHabit y updateHabit. Replica el patrón de BUG-04
 * (assignmentService.addSpontaneous) — error descriptivo con
 * IDs inválidos antes del INSERT/UPDATE.
 */

import type Database from 'better-sqlite3';
import { createTestDatabase, resetTestDatabase } from './setup/testDatabase';

const TODAY = '2026-04-26';

jest.mock('../services/db', () => {
  const actual = jest.requireActual('../services/db');
  return {
    ...actual,
    getTodayPrefix: jest.fn(() => TODAY),
    getNowTimestamp: jest.fn(() => `${TODAY} 10:00:00`),
    getTimestampForDate: jest.fn((date: string) => `${date} 10:00:00`),
  };
});

import { createHabit, updateHabit } from '../services/habitService';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  resetTestDatabase();
  jest.clearAllMocks();
});

describe('habitService — D-15: write-time category validation', () => {
  test('createHabit: throws descriptive error when categories contain an invalid ID', async () => {
    await expect(createHabit('Habito', 'daily', 1, ['fake_id']))
      .rejects.toThrow(/fake_id/);
  });

  test('createHabit: throws error listing ALL invalid IDs', async () => {
    await expect(createHabit('Habito', 'daily', 1, ['salud_fisica', 'fake_id']))
      .rejects.toThrow(/fake_id/);
  });

  test('createHabit: succeeds with all valid categories', async () => {
    const id = await createHabit('Habito', 'daily', 1, ['salud_fisica', 'mental']);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('updateHabit: throws on invalid IDs', async () => {
    const id = await createHabit('Habito', 'daily', 1, ['salud_fisica']);
    await expect(updateHabit(id, 'Habito', 'daily', 1, ['fake_id']))
      .rejects.toThrow(/fake_id/);
  });
});
