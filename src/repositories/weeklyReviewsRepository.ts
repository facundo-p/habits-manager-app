/**
 * weeklyReviewsRepository.ts — Acceso a datos de la tabla `weekly_reviews`.
 *
 * Phase 1: stubs mínimos (readAll para backup, clear+insertMany para restore).
 * Phase 4 agregará UPSERT por week_key + read by date range.
 */

import { getDatabase } from '../services/db';
import type { WeeklyReview } from '../types';

const SQL_ALL = 'SELECT * FROM weekly_reviews';
const SQL_CLEAR = 'DELETE FROM weekly_reviews';
const SQL_INSERT = `
  INSERT INTO weekly_reviews (
    id, week_key, week_start, mood_avg, sleep_avg,
    top_habits_json, answers_json, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function readAll(): Promise<WeeklyReview[]> {
  const db = await getDatabase();
  return db.getAllAsync<WeeklyReview>(SQL_ALL);
}

export async function clear(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_CLEAR);
}

export async function insertMany(rows: WeeklyReview[]): Promise<void> {
  const db = await getDatabase();
  for (const r of rows) {
    await db.runAsync(SQL_INSERT, [
      r.id, r.week_key, r.week_start, r.mood_avg, r.sleep_avg,
      r.top_habits_json, r.answers_json, r.created_at, r.updated_at,
    ]);
  }
}
