/**
 * draftsRepository.ts — Acceso a datos de la tabla `drafts` (D-04 / FOUND-05).
 *
 * 1 row por (kind, key). `INSERT OR REPLACE ON CONFLICT` garantiza la
 * unicidad via el partial UNIQUE INDEX `idx_drafts_kind_key` (creado por
 * migration v2). Boot purge >7d vive en `db.ts` (purgeStaleDrafts).
 *
 * Funciones tontas: sin lógica de negocio. Cada función ≤ 10 líneas.
 */

import { getDatabase, generateId } from '../services/db';

// ─── SQL Constants ──────────────────────────────────────────────────

const SQL_UPSERT_DRAFT = `
  INSERT INTO drafts (id, kind, key, payload_json, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(kind, key) DO UPDATE SET
    payload_json = excluded.payload_json,
    updated_at = excluded.updated_at
`;

const SQL_FIND_DRAFT =
  'SELECT payload_json, updated_at FROM drafts WHERE kind = ? AND key = ?';

const SQL_DELETE_DRAFT = 'DELETE FROM drafts WHERE kind = ? AND key = ?';

const SQL_PURGE_OLDER_THAN = 'DELETE FROM drafts WHERE updated_at < ?';

// ─── Public API ─────────────────────────────────────────────────────

export interface DraftRow {
  payload_json: string;
  updated_at: string;
}

/** Inserta o reemplaza el draft de la surface (kind, key). */
export async function upsert(
  kind: string,
  key: string,
  payloadJson: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_UPSERT_DRAFT, [
    generateId(),
    kind,
    key,
    payloadJson,
    new Date().toISOString(),
  ]);
}

/** Lee el draft de la surface (kind, key), o null si no existe. */
export async function find(kind: string, key: string): Promise<DraftRow | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DraftRow>(SQL_FIND_DRAFT, [kind, key]);
  return row ?? null;
}

/** Borra el draft de la surface (kind, key). Idempotente. */
export async function deleteOne(kind: string, key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_DELETE_DRAFT, [kind, key]);
}

/** Borra todos los drafts con `updated_at < cutoffIso`. Boot housekeeping. */
export async function purgeOlderThan(cutoffIso: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_PURGE_OLDER_THAN, [cutoffIso]);
}
