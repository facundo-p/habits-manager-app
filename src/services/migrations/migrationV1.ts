/**
 * migrationV1.ts — Migración v1: dedupe + partial UNIQUE INDEX en daily_assignments.
 *
 * Implementa REQ-04-04..REQ-04-07 (Phase 4):
 *   - Detecta y borra duplicados (habit_id, date) según heurística D-03
 *   - Crea partial UNIQUE INDEX idx_unique_habit_date (D-07)
 *   - Marca PRAGMA user_version = 1 (D-05)
 *
 * Atomicidad (D-08): todo dentro de un único withTransactionAsync.
 * Rollback automático en throw. Falla silenciosa con console.error (D-06).
 *
 * Esta es la PRIMERA migración versionada del proyecto. Convención:
 *   - PRAGMA user_version es la fuente de verdad
 *   - cada nueva migración suma 1 al target_version
 *   - se ejecutan en orden creciente; si version >= target, skip
 */

import * as SQLite from 'expo-sqlite';
import {
  SQL_DEDUPE_VIA_CTE,
  SQL_ASSERT_NO_DUPLICATES,
  SQL_CREATE_UNIQUE_INDEX,
} from '../../repositories/assignmentRepository';

const TARGET_VERSION = 1;

/**
 * Punto de entrada del sistema de migraciones versionadas.
 * Lee PRAGMA user_version y dispatcha a las migraciones pendientes en orden.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = result?.user_version ?? 0;

  if (current < 1) {
    await migrationV1_dedupeAndIndex(db);
  }
  // Nota: cuando se agregue v2, agregar aquí: if (current < 2) await migrationV2_*(db)
}

/**
 * Migración v1: dedupe (habit_id, date) regulares + crea partial UNIQUE INDEX.
 *
 * Orden estricto (D-08):
 *   1. DELETE losers via CTE+ROW_NUMBER (single statement)
 *   2. SELECT COUNT(*) sobre grupos con count>1 — DEBE ser 0 (Pitfall #1)
 *   3. CREATE UNIQUE INDEX (IF NOT EXISTS — idempotente)
 *   4. PRAGMA user_version = 1
 *
 * Si cualquier paso falla, withTransactionAsync hace rollback completo.
 * console.error y continuar boot — D-06.
 */
async function migrationV1_dedupeAndIndex(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SQL_DEDUPE_VIA_CTE);
      await assertNoDuplicatesRemain(db);
      await db.execAsync(SQL_CREATE_UNIQUE_INDEX);
      await db.execAsync(`PRAGMA user_version = ${TARGET_VERSION}`);
    });
  } catch (err) {
    // D-06: silent failure, NO bloquear boot. La DB queda en versión 0;
    // se reintentará en el próximo arranque.
    console.error('[migration v1] dedupe+index falló — la DB queda en versión 0', err);
  }
}

/**
 * Invariante post-DELETE (RESEARCH §Pitfall #1): si quedan grupos con count>1,
 * el CREATE INDEX siguiente fallaría — es preferible abortar acá con error
 * descriptivo para que el rollback preserve la DB y el log indique el problema.
 */
async function assertNoDuplicatesRemain(db: SQLite.SQLiteDatabase): Promise<void> {
  const remaining = await db.getFirstAsync<{ count: number }>(SQL_ASSERT_NO_DUPLICATES);
  const count = remaining?.count ?? 0;
  if (count > 0) {
    throw new Error(`migration v1: ${count} grupos siguen duplicados post-DELETE`);
  }
}
