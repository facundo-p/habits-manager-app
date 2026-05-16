/**
 * backupRepository.ts — Acceso a datos crudo para respaldo/restauración.
 *
 * Lee y escribe TODAS las tablas. Funciones "tontas" (sin lógica de validación).
 * La validación y coordinación vive en backupService.ts.
 *
 * Post-migration v2: la tabla `mood_entries` ya no existe. `readAllMoods`
 * permanece con un guard "tabla inexistente → []" para que `buildV1Snapshot`
 * pueda invocarlo sin crashear (pre-migration retorna las rows reales,
 * post-migration retorna []). Las escrituras a mood_entries se eliminaron.
 */

import { getDatabase } from '../services/db';
import type {
  Habit,
  PerformedHabit,
  MoodEntry,
  DailyAssignment,
  MoodLogEntry,
  TextLibraryItem,
  WeeklyReview,
} from '../types';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_ALL_HABITS = 'SELECT * FROM habits';
const SQL_ALL_PERFORMED = 'SELECT * FROM performed_habits';
const SQL_ALL_ASSIGNMENTS = 'SELECT * FROM daily_assignments';
const SQL_ALL_MOOD_LOG = 'SELECT * FROM mood_log';
const SQL_ALL_TEXT_LIBRARY = 'SELECT * FROM text_library';
const SQL_ALL_WEEKLY_REVIEWS = 'SELECT * FROM weekly_reviews';

/** @deprecated Solo consumido por buildV1Snapshot pre-migration v2. */
const SQL_ALL_MOOD_ENTRIES = 'SELECT * FROM mood_entries';
const SQL_TABLE_EXISTS =
  "SELECT name FROM sqlite_master WHERE type='table' AND name=?";

const SQL_CLEAR_PERFORMED = 'DELETE FROM performed_habits';
const SQL_CLEAR_ASSIGNMENTS = 'DELETE FROM daily_assignments';
const SQL_CLEAR_HABITS = 'DELETE FROM habits';
const SQL_CLEAR_MOOD_LOG = 'DELETE FROM mood_log';
const SQL_CLEAR_TEXT_LIBRARY = 'DELETE FROM text_library';
const SQL_CLEAR_WEEKLY_REVIEWS = 'DELETE FROM weekly_reviews';

const SQL_INSERT_HABIT =
  'INSERT INTO habits (id, name, frequency, base_points, default_categories, is_active) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_PERFORMED =
  'INSERT INTO performed_habits (id, habit_id, timestamp, points_earned, habit_description, categories_used) VALUES (?, ?, ?, ?, ?, ?)';

const SQL_INSERT_ASSIGNMENT =
  'INSERT INTO daily_assignments (id, habit_id, date, snapshot_name, snapshot_points, snapshot_categories, snapshot_frequency, is_completed, is_spontaneous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

const SQL_INSERT_MOOD_LOG =
  'INSERT INTO mood_log (id, kind, date_key, occurred_at, mood_value, mood_scale_version, sleep_hours, comment, habit_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

const SQL_INSERT_TEXT_LIBRARY =
  'INSERT INTO text_library (id, kind, text, author, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

const SQL_INSERT_WEEKLY_REVIEW =
  'INSERT INTO weekly_reviews (id, week_key, week_start, mood_avg, sleep_avg, top_habits_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

// ─── Lectura ────────────────────────────────────────────────────────

export async function readAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(SQL_ALL_HABITS);
}

export async function readAllPerformed(): Promise<PerformedHabit[]> {
  const db = await getDatabase();
  return db.getAllAsync<PerformedHabit>(SQL_ALL_PERFORMED);
}

export async function readAllAssignments(): Promise<DailyAssignment[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyAssignment>(SQL_ALL_ASSIGNMENTS);
}

export async function readAllMoodLog(): Promise<MoodLogEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<MoodLogEntry>(SQL_ALL_MOOD_LOG);
}

export async function readAllTextLibrary(): Promise<TextLibraryItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<TextLibraryItem>(SQL_ALL_TEXT_LIBRARY);
}

export async function readAllWeeklyReviews(): Promise<WeeklyReview[]> {
  const db = await getDatabase();
  return db.getAllAsync<WeeklyReview>(SQL_ALL_WEEKLY_REVIEWS);
}

/**
 * Legacy reader contra mood_entries — usado solo por `buildV1Snapshot`
 * pre-migration v2. Post-migration la tabla no existe; retorna [].
 */
export async function readAllMoods(): Promise<MoodEntry[]> {
  const db = await getDatabase();
  const exists = await db.getFirstAsync<{ name: string }>(SQL_TABLE_EXISTS, [
    'mood_entries',
  ]);
  if (!exists) return [];
  return db.getAllAsync<MoodEntry>(SQL_ALL_MOOD_ENTRIES);
}

// ─── Restauración atómica (con transacción) ──────────────────────────

/**
 * Limpia las 6 tablas de dominio e inserta los datos del backup en una única
 * transacción atómica. Rollback automático en throw. Drafts NO se restauran
 * (transient — FOUND-04).
 */
export async function restoreAllData(
  habits: Habit[],
  performed: PerformedHabit[],
  assignments: DailyAssignment[],
  moodLog: MoodLogEntry[],
  textLibrary: TextLibraryItem[],
  weeklyReviews: WeeklyReview[],
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await clearAllTables(db);
    await insertHabits(db, habits);
    await insertAssignments(db, assignments);
    await insertPerformed(db, performed);
    await insertMoodLog(db, moodLog);
    await insertTextLibrary(db, textLibrary);
    await insertWeeklyReviews(db, weeklyReviews);
  });
}

type DB = Awaited<ReturnType<typeof getDatabase>>;

async function clearAllTables(db: DB): Promise<void> {
  await db.runAsync(SQL_CLEAR_MOOD_LOG);
  await db.runAsync(SQL_CLEAR_TEXT_LIBRARY);
  await db.runAsync(SQL_CLEAR_WEEKLY_REVIEWS);
  await db.runAsync(SQL_CLEAR_PERFORMED);
  await db.runAsync(SQL_CLEAR_ASSIGNMENTS);
  await db.runAsync(SQL_CLEAR_HABITS);
}

async function insertHabits(db: DB, rows: Habit[]): Promise<void> {
  for (const h of rows) {
    await db.runAsync(SQL_INSERT_HABIT, [
      h.id, h.name, h.frequency, h.base_points,
      h.default_categories, h.is_active,
    ]);
  }
}

async function insertAssignments(db: DB, rows: DailyAssignment[]): Promise<void> {
  for (const e of rows) {
    await db.runAsync(SQL_INSERT_ASSIGNMENT, [
      e.id, e.habit_id, e.date, e.snapshot_name, e.snapshot_points,
      e.snapshot_categories, e.snapshot_frequency, e.is_completed, e.is_spontaneous,
    ]);
  }
}

async function insertPerformed(db: DB, rows: PerformedHabit[]): Promise<void> {
  for (const r of rows) {
    await db.runAsync(SQL_INSERT_PERFORMED, [
      r.id, r.habit_id, r.timestamp, r.points_earned,
      r.habit_description, r.categories_used,
    ]);
  }
}

async function insertMoodLog(db: DB, rows: MoodLogEntry[]): Promise<void> {
  for (const m of rows) {
    await db.runAsync(SQL_INSERT_MOOD_LOG, [
      m.id, m.kind, m.date_key, m.occurred_at, m.mood_value, m.mood_scale_version,
      m.sleep_hours, m.comment, m.habit_id, m.created_at, m.updated_at,
    ]);
  }
}

async function insertTextLibrary(db: DB, rows: TextLibraryItem[]): Promise<void> {
  for (const t of rows) {
    await db.runAsync(SQL_INSERT_TEXT_LIBRARY, [
      t.id, t.kind, t.text, t.author, t.is_active, t.created_at, t.updated_at,
    ]);
  }
}

async function insertWeeklyReviews(db: DB, rows: WeeklyReview[]): Promise<void> {
  for (const w of rows) {
    await db.runAsync(SQL_INSERT_WEEKLY_REVIEW, [
      w.id, w.week_key, w.week_start, w.mood_avg, w.sleep_avg,
      w.top_habits_json, w.answers_json, w.created_at, w.updated_at,
    ]);
  }
}
