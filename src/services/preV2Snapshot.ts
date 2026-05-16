/**
 * preV2Snapshot.ts — Helpers específicos del snapshot pre-migration v2 (D-06).
 *
 * Aislado de backupService para que `migrationV2.ts` no arrastre dependencias
 * de expo-sharing / DocumentPicker (que no se cargan en el ambiente de tests
 * para migrations). Sólo depende de expo-file-system/legacy + backupRepository.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as backupRepo from '../repositories/backupRepository';
import type { BackupDataV1 } from '../types';

const PRE_V2_SNAPSHOT_PREFIX = 'pre-v2-snapshot-';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Construye un snapshot shape v1 leyendo `mood_entries` directamente.
 *
 * Consumido por `migrationV2.writePreV2Snapshot` antes de la transaction.
 * Post-migration `mood_entries` no existe; `readAllMoods` retorna `[]` con
 * un guard de tabla.
 */
export async function buildV1Snapshot(): Promise<BackupDataV1> {
  const [habits, performed_habits, mood_entries, daily_assignments] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllMoods(),
    backupRepo.readAllAssignments(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    performed_habits,
    mood_entries,
    daily_assignments,
  };
}

/**
 * Borra snapshots pre-v2 con mtime > 30 días. Idempotente, silenciosa.
 * Llamado desde `initDatabase` post-success de migrationV2.
 *
 * Falla silenciosa: housekeeping no crítico; un error de FS no debe bloquear boot.
 */
export async function cleanupPreV2Snapshots(): Promise<void> {
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    const cutoff = Date.now() - RETENTION_MS;
    const entries = await FileSystem.readDirectoryAsync(dir);
    for (const name of entries) {
      if (!name.startsWith(PRE_V2_SNAPSHOT_PREFIX)) continue;
      const info = await FileSystem.getInfoAsync(`${dir}${name}`);
      const mtime = (info as { modificationTime?: number }).modificationTime;
      if (mtime != null && mtime * 1000 < cutoff) {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn('[cleanupPreV2Snapshots] cleanup skipped:', msg);
  }
}
