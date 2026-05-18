/**
 * bootSequence.ts — Orchestrator de inicialización extraído de App.tsx (D-05).
 *
 * Aislado para testability: las deps son inyectables (initDatabase,
 * checkAndBackfillHistory), por lo que tests mockean sin importar el módulo
 * de DB real.
 *
 * Política de errores:
 *   - `initDatabase` falla → `{status:'failed'}`. App.tsx renderiza
 *     MigrationErrorScreen bloqueante (D-05).
 *   - `checkAndBackfillHistory` falla → log warn + continúa OK. Backfill
 *     no es schema-breaking, no debe bloquear el boot (research §6).
 *   - Errores SOLO loguean `err.message`, nunca payloads (ASVS V7).
 */

export type MigrationState =
  | { status: 'pending' }
  | { status: 'ok' }
  | { status: 'failed'; error: unknown };

export interface BootDeps {
  initDatabase: () => Promise<void>;
  checkAndBackfillHistory: () => Promise<void>;
}

export async function bootSequence(deps: BootDeps): Promise<MigrationState> {
  try {
    await deps.initDatabase();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[bootSequence] initDatabase falló:', msg);
    return { status: 'failed', error: err };
  }
  try {
    await deps.checkAndBackfillHistory();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn('[bootSequence] backfill falló (no bloqueante):', msg);
  }
  return { status: 'ok' };
}
