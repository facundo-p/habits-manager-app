/**
 * textLibraryRepository.ts — Acceso a datos de la tabla `text_library`.
 *
 * Phase 1: stubs mínimos (readAll para backup, clear+insertMany para restore).
 * Phase 2 agregará CRUD individual (insert por usuario, soft-delete).
 */

import { getDatabase } from '../services/db';
import type { TextLibraryItem } from '../types';

const SQL_ALL = 'SELECT * FROM text_library';
const SQL_CLEAR = 'DELETE FROM text_library';
const SQL_INSERT =
  'INSERT INTO text_library (id, kind, text, author, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

export async function readAll(): Promise<TextLibraryItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<TextLibraryItem>(SQL_ALL);
}

export async function clear(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(SQL_CLEAR);
}

export async function insertMany(rows: TextLibraryItem[]): Promise<void> {
  const db = await getDatabase();
  for (const r of rows) {
    await db.runAsync(SQL_INSERT, [
      r.id, r.kind, r.text, r.author, r.is_active, r.created_at, r.updated_at,
    ]);
  }
}
