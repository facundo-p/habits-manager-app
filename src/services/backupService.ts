/**
 * backupService.ts — Lógica de respaldo y restauración local de datos.
 *
 * Exportar: Lee todas las tablas, genera JSON, abre el menú nativo
 *           de compartir para que el usuario elija dónde guardarlo.
 * Importar: Selecciona archivo JSON, valida estructura, limpia + restaura.
 *
 * Phase 3: `buildBackupData`, `parseAndValidate` y `restoreData` se exponen
 * como named exports para reuso por driveBackupService (transporte a Drive).
 *
 * Usa expo-file-system/legacy (compatible con Expo Go en SDK 54).
 * Delega SQL a backupRepository.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BACKUP_VERSION, BACKUP_FILENAME } from '../config/constants';
import * as backupRepo from '../repositories/backupRepository';
import { dedupeAssignmentsArray } from '../utils/dedupeAssignmentsArray';
import type { BackupData, Habit, PerformedHabit, MoodEntry, DailyAssignment } from '../types';

// ─── Exportar ────────────────────────────────────────────────────────

/** Lee toda la DB, genera JSON y abre el menú de compartir del sistema. */
export async function exportBackup(): Promise<void> {
  const data = await buildBackupData();
  const json = JSON.stringify(data, null, 2);
  const path = `${FileSystem.documentDirectory}${BACKUP_FILENAME}`;

  await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar respaldo CozyHabit',
  });
}

// ─── Importar ────────────────────────────────────────────────────────

/**
 * Abre el selector de archivos, lee el JSON, valida y restaura.
 * Retorna true si la importación fue exitosa, false si el usuario canceló.
 * Lanza error si el archivo es inválido.
 */
export async function importBackup(): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return false;

  const file = result.assets[0];
  const json = await FileSystem.readAsStringAsync(file.uri, {
    encoding: 'utf8',
  });

  const data = parseAndValidate(json);
  await restoreData(data);
  return true;
}

// ─── API pública (consumida por exportBackup/importBackup y driveBackupService) ──

export async function buildBackupData(): Promise<BackupData> {
  const [habits, performed_habits, mood_entries, daily_assignments] = await Promise.all([
    backupRepo.readAllHabits(),
    backupRepo.readAllPerformed(),
    backupRepo.readAllMoods(),
    backupRepo.readAllAssignments(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    performed_habits,
    mood_entries,
    daily_assignments,
  };
}

/**
 * Parsea un JSON de respaldo y valida su shape via type guards sobre `unknown`.
 * Reemplaza el patrón anterior (cast a Partial + cast final completo) por narrowing en runtime
 * (DEBT-02 alcance ampliado D-04). Mensajes de error en español preservados.
 */
export function parseAndValidate(json: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Formato de respaldo inválido: JSON malformado');
  }

  if (raw == null || typeof raw !== 'object') {
    throw new Error('Formato de respaldo inválido');
  }

  const data = raw as Record<string, unknown>;

  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error(`Versión de respaldo no soportada: ${data.version}`);
  }
  if (data.version < BACKUP_VERSION) {
    console.warn(`[parseAndValidate] backup version ${data.version} < ${BACKUP_VERSION}`);
  }
  if (!Array.isArray(data.habits)) {
    throw new Error('Formato de respaldo inválido');
  }
  if (!Array.isArray(data.performed_habits)) {
    throw new Error('Falta performed_habits en el respaldo');
  }
  if (!Array.isArray(data.mood_entries)) {
    throw new Error('Falta mood_entries en el respaldo');
  }

  // Validación profunda de cada item queda fuera de scope de Phase 2 (Phase 3 la refinará).
  // Acá solo garantizamos que cada campo es un Array y que version es number.
  return {
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    habits: data.habits as Habit[],
    performed_habits: data.performed_habits as PerformedHabit[],
    mood_entries: data.mood_entries as MoodEntry[],
    daily_assignments: Array.isArray(data.daily_assignments)
      ? (data.daily_assignments as DailyAssignment[])
      : [],
  };
}

/**
 * Restaura un backup completo. Aplica pre-clean a daily_assignments via
 * dedupeAssignmentsArray (REQ-04-03) para que un backup pre-Phase-4 con
 * duplicados no rompa el partial UNIQUE INDEX (idx_unique_habit_date).
 *
 * Heurística D-03 aplicada en memoria; spontaneous (habit_id=null) se preservan.
 *
 * driveBackupService.applyRestore consume esta función — el pre-clean se
 * aplica transparentemente al restore desde Drive también.
 */
export async function restoreData(data: BackupData): Promise<void> {
  const dedupedAssignments = dedupeAssignmentsArray(
    data.daily_assignments,
    data.performed_habits,
  );
  await backupRepo.restoreAllData(
    data.habits,
    data.performed_habits,
    data.mood_entries,
    dedupedAssignments,
  );
}
