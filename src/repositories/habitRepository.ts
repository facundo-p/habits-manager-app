/**
 * habitRepository.ts — Acceso a datos de la tabla `habits`.
 *
 * Funciones "tontas" (solo CRUD). Sin lógica de negocio ni transformaciones.
 * Toda consulta SQL a `habits` vive exclusivamente aquí.
 */

import { getDatabase, generateId } from '../services/db';
import type { Habit } from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_ACTIVE = 'SELECT * FROM habits WHERE is_active = 1';

const SQL_ALL = 'SELECT * FROM habits';

const SQL_DAILY_ACTIVE =
  "SELECT * FROM habits WHERE frequency = 'daily' AND is_active = 1";

const SQL_SUM_BY_FREQ =
  'SELECT COALESCE(SUM(base_points), 0) as total FROM habits WHERE frequency = ? AND is_active = 1';

const SQL_SUM_DAILY_ACTIVE =
  "SELECT COALESCE(SUM(base_points), 0) as total FROM habits WHERE frequency = 'daily' AND is_active = 1";

const SQL_INSERT =
  'INSERT INTO habits (id, name, frequency, base_points, default_categories) VALUES (?, ?, ?, ?, ?)';

const SQL_UPDATE =
  'UPDATE habits SET name = ?, frequency = ?, base_points = ?, default_categories = ? WHERE id = ?';

const SQL_DELETE = 'DELETE FROM habits WHERE id = ?';

const SQL_SET_ACTIVE = 'UPDATE habits SET is_active = ? WHERE id = ?';

// ─── Consultas ──────────────────────────────────────────────────────

/** Todos los hábitos activos. */
export async function findAllActive(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_ACTIVE);
}

/** Todos los hábitos (activos e inactivos). */
export async function findAll(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_ALL);
}

/** Todos los hábitos diarios activos. */
export async function findDailyActive(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_DAILY_ACTIVE);
}

/** Suma de base_points para una frecuencia dada (solo activos). */
export async function sumPointsByFrequency(freq: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(SQL_SUM_BY_FREQ, [freq]);
  return row?.total ?? 0;
}

/** Suma de base_points de hábitos diarios activos. */
export async function sumDailyActivePoints(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(SQL_SUM_DAILY_ACTIVE);
  return row?.total ?? 0;
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/** Inserta un nuevo hábito. Retorna el ID generado. */
export async function insert(
  name: string,
  frequency: string,
  basePoints: number,
  categoriesJson: string,
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(SQL_INSERT, [id, name, frequency, basePoints, categoriesJson]);
  return id;
}

/** Actualiza nombre, frecuencia, puntos y categorías de un hábito. */
export async function update(
  id: string,
  name: string,
  frequency: string,
  basePoints: number,
  categoriesJson: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_UPDATE, [name, frequency, basePoints, categoriesJson, id]);
}

/** Elimina un hábito por ID. */
export async function deleteById(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE, [id]);
}

/** Cambia el estado is_active de un hábito. */
export async function setActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_SET_ACTIVE, [isActive ? 1 : 0, id]);
}
