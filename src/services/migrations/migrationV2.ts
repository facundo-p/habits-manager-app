/**
 * migrationV2.ts — Migración v2: tablas de bienestar emocional.
 *
 * Crea las 4 tablas nuevas (mood_log, text_library, weekly_reviews, drafts)
 * + indexes, migra `mood_entries` → `mood_log` kind='reflection', y dropea
 * la tabla legacy. Todo dentro de un único `withTransactionAsync` para
 * rollback automático en throw.
 *
 * Pre-step (D-06): antes de BEGIN TRANSACTION se escribe un snapshot pre-v2
 * en `${documentDirectory}/pre-v2-snapshot-<ts>.json` con shape v1. Si falla
 * el snapshot, la migration NO se ejecuta (determinístico). El cleanup 30d
 * vive en `backupService.cleanupPreV2Snapshots` y se invoca post-success
 * desde `initDatabase`.
 *
 * Diferencia con v1 (research §1, A4): **v2 re-throws en error**. App.tsx
 * (vía MigrationErrorScreen en Plan 06/Wave 5) será responsable de mostrar
 * el screen bloqueante con Restore + Retry. El re-throw NO incluye row
 * payloads — solo `err.message` (T-04-01 mitigation, ASVS V7).
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { buildV1Snapshot } from '../preV2Snapshot';

const TARGET_VERSION = 2;

// ─── Schema v2 — Single source of truth ──────────────────────────────
//
// Estas constants son importadas también por __tests__/setup/testDatabase.ts
// (T-01-01 mitigation: fixture y prod usan idéntico SQL).

export const SQL_CREATE_MOOD_LOG = `
  CREATE TABLE IF NOT EXISTS mood_log (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('morning','evening','note','reflection')),
    date_key TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    mood_value REAL NOT NULL,
    mood_scale_version TEXT NOT NULL DEFAULT 'v1',
    sleep_hours REAL,
    comment TEXT,
    habit_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
  )
`;

export const SQL_CREATE_MOOD_LOG_ONE_PER_DAY = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_log_one_per_day
  ON mood_log(kind, date_key)
  WHERE kind IN ('morning','evening')
`;

export const SQL_CREATE_MOOD_LOG_DATE_KEY = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_date_key ON mood_log(date_key)
`;

export const SQL_CREATE_MOOD_LOG_KIND = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_kind ON mood_log(kind)
`;

export const SQL_CREATE_MOOD_LOG_HABIT_ID = `
  CREATE INDEX IF NOT EXISTS idx_mood_log_habit_id
  ON mood_log(habit_id)
  WHERE habit_id IS NOT NULL
`;

export const SQL_CREATE_TEXT_LIBRARY = `
  CREATE TABLE IF NOT EXISTS text_library (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('quote')),
    text TEXT NOT NULL,
    author TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_CREATE_TEXT_LIBRARY_KIND_ACTIVE = `
  CREATE INDEX IF NOT EXISTS idx_text_library_kind_active
  ON text_library(kind, is_active)
`;

export const SQL_CREATE_WEEKLY_REVIEWS = `
  CREATE TABLE IF NOT EXISTS weekly_reviews (
    id TEXT PRIMARY KEY,
    week_key TEXT NOT NULL UNIQUE,
    week_start TEXT NOT NULL,
    mood_avg REAL,
    sleep_avg REAL,
    top_habits_json TEXT NOT NULL DEFAULT '[]',
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_CREATE_DRAFTS = `
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const SQL_CREATE_DRAFTS_KIND_KEY = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_kind_key
  ON drafts(kind, key)
`;

const SQL_INSERT_SELECT_MOOD_LOG_FROM_MOOD_ENTRIES = `
  INSERT INTO mood_log (
    id, kind, date_key, occurred_at, mood_value, mood_scale_version,
    sleep_hours, comment, habit_id, created_at, updated_at
  )
  SELECT
    id,
    'reflection',
    substr(timestamp, 1, 10),
    timestamp,
    value,
    'v1',
    NULL,
    description,
    habit_id,
    timestamp,
    timestamp
  FROM mood_entries
`;

const SQL_DROP_MOOD_ENTRIES = 'DROP TABLE mood_entries';
const SQL_COUNT_MOOD_ENTRIES = 'SELECT COUNT(*) AS c FROM mood_entries';
const SQL_COUNT_MOOD_LOG_REFLECTION =
  "SELECT COUNT(*) AS c FROM mood_log WHERE kind = 'reflection'";

// ─── Pre-v2 snapshot (D-06) ──────────────────────────────────────────

/**
 * Escribe `${documentDirectory}/pre-v2-snapshot-<ts>.json` con shape v1
 * antes de iniciar la transaction. Si falla, la migration aborta:
 * el throw burbujea por `migrationV2_addWellbeingTables` → `runMigrations`.
 *
 * D-06 "determinístico": no se permite skip silencioso. Si el snapshot
 * no se puede garantizar, la DB se queda en user_version=1.
 */
async function writePreV2Snapshot(): Promise<void> {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error(
      'pre-v2 snapshot: documentDirectory unavailable — abort migration (D-06)',
    );
  }
  const snapshot = await buildV1Snapshot();
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${dir}pre-v2-snapshot-${iso}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(snapshot), {
    encoding: 'utf8',
  });
}

// ─── Helpers de migration ────────────────────────────────────────────

async function createV2Tables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SQL_CREATE_MOOD_LOG);
  await db.execAsync(SQL_CREATE_MOOD_LOG_ONE_PER_DAY);
  await db.execAsync(SQL_CREATE_MOOD_LOG_DATE_KEY);
  await db.execAsync(SQL_CREATE_MOOD_LOG_KIND);
  await db.execAsync(SQL_CREATE_MOOD_LOG_HABIT_ID);
  await db.execAsync(SQL_CREATE_TEXT_LIBRARY);
  await db.execAsync(SQL_CREATE_TEXT_LIBRARY_KIND_ACTIVE);
  await db.execAsync(SQL_CREATE_WEEKLY_REVIEWS);
  await db.execAsync(SQL_CREATE_DRAFTS);
  await db.execAsync(SQL_CREATE_DRAFTS_KIND_KEY);
}

async function migrateMoodEntriesToMoodLog(
  db: SQLite.SQLiteDatabase,
  preCount: number,
): Promise<void> {
  await db.execAsync(SQL_INSERT_SELECT_MOOD_LOG_FROM_MOOD_ENTRIES);
  await assertInsertSelectCount(db, preCount);
  await db.execAsync(SQL_DROP_MOOD_ENTRIES);
}

/**
 * Invariante post-INSERT...SELECT: count(mood_log kind='reflection') === preCount.
 * Si difiere, abortar para que el rollback preserve mood_entries.
 * Se ejecuta DENTRO de la transaction (cualquier throw rolleback completo).
 */
export async function assertInsertSelectCount(
  db: SQLite.SQLiteDatabase,
  preCount: number,
): Promise<void> {
  const post = await db.getFirstAsync<{ c: number }>(
    SQL_COUNT_MOOD_LOG_REFLECTION,
  );
  const postCount = post?.c ?? 0;
  if (postCount !== preCount) {
    throw new Error(
      `migration v2: INSERT...SELECT mismatch — pre=${preCount}, post=${postCount}`,
    );
  }
}

// ─── Migration entrypoint ────────────────────────────────────────────

/**
 * Migration v2 — pre-snapshot + atomic schema change + INSERT...SELECT + drop.
 *
 * Orden:
 *   1. writePreV2Snapshot() — falla aquí aborta sin tocar DB (D-06).
 *   2. preCount = SELECT COUNT(*) FROM mood_entries.
 *   3. withTransactionAsync:
 *      a. createV2Tables: 4 nuevas + indexes.
 *      b. migrateMoodEntriesToMoodLog: INSERT...SELECT + assert + DROP.
 *      c. PRAGMA user_version = 2.
 *   4. En catch: console.error('[migration v2] ...', err.message) + throw.
 *      NUNCA loggear row payloads (T-04-01 / ASVS V7).
 */
export async function migrationV2_addWellbeingTables(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await writePreV2Snapshot();

  const pre = await db.getFirstAsync<{ c: number }>(SQL_COUNT_MOOD_ENTRIES);
  const preCount = pre?.c ?? 0;

  try {
    await db.withTransactionAsync(async () => {
      await createV2Tables(db);
      await migrateMoodEntriesToMoodLog(db, preCount);
      await db.execAsync(`PRAGMA user_version = ${TARGET_VERSION}`);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[migration v2] schema migration falló — rollback aplicado:', msg);
    throw err;
  }
}
